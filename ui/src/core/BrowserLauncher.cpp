#include "BrowserLauncher.h"
#include "ProfileManager.h"
#include "DatabaseManager.h"

#include <QDir>
#include <QFileInfo>
#include <QCoreApplication>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QLocalSocket>
#include <QDebug>
#include <QCryptographicHash>
#include <QRegularExpression>

BrowserLauncher::BrowserLauncher(ProfileManager* profileManager,
                                  DatabaseManager* db,
                                  QObject* parent)
    : QObject(parent), m_profileManager(profileManager), m_db(db)
{
    m_chromiumPath = detectChromiumPath();
    m_nodejsPath   = detectNodePath();
}

BrowserLauncher::~BrowserLauncher()
{
    if (m_nodeProcess && m_nodeProcess->state() == QProcess::Running) {
        m_nodeProcess->terminate();
        m_nodeProcess->waitForFinished(2000);
    }
    for (auto* proc : m_processes) {
        if (proc && proc->state() == QProcess::Running) {
            proc->terminate();
            proc->waitForFinished(2000);
        }
    }
}

void BrowserLauncher::setChromiumPath(const QString& path)
{
    m_chromiumPath = path;
    emit chromiumPathChanged();
}

void BrowserLauncher::setNodejsPath(const QString& path)
{
    m_nodejsPath = path;
    emit nodejsPathChanged();
}

// ── Seed derivation ──────────────────────────────────────────────────────
quint64 BrowserLauncher::profileSeed(const QString& profileId, const QString& type) const
{
    // Deterministic: same profile always gets same seed
    // Different type (canvas vs audio) → different seeds
    QByteArray input = (profileId + ":" + type).toUtf8();
    QByteArray hash  = QCryptographicHash::hash(input, QCryptographicHash::Sha256);
    // Take first 8 bytes as uint64
    quint64 seed = 0;
    for (int i = 0; i < 8 && i < hash.size(); ++i) {
        seed = (seed << 8) | (quint8)hash[i];
    }
    return seed ? seed : 1ULL;  // never 0 (0 = noise disabled in C++ patch)
}

// ── Build Chromium arguments ──────────────────────────────────────────────
QStringList BrowserLauncher::buildChromiumArgs(const QJsonObject& profile, int debugPort)
{
    const QString profileId = profile["id"].toString();

    // Read fingerprint data (can be QJsonObject or serialized JSON string)
    QJsonObject fp;
    if (profile["fingerprint_data"].isObject()) {
        fp = profile["fingerprint_data"].toObject();
    } else {
        QString fpStr = profile["fingerprint_data"].toString("{}");
        fp = QJsonDocument::fromJson(fpStr.toUtf8()).object();
    }

    // Helper for nested or flat keys (e.g. "navigator.userAgent" or fp["navigator"]["userAgent"])
    auto fpVal_ = [&](const QString& key) -> QJsonValue {
        if (fp.contains(key)) return fp[key];
        QStringList parts = key.split('.');
        if (parts.size() == 2 && fp.contains(parts[0]) && fp[parts[0]].isObject()) {
            QJsonObject sub = fp[parts[0]].toObject();
            if (sub.contains(parts[1])) return sub[parts[1]];
        }
        return QJsonValue();
    };
    auto fpStr_ = [&](const QString& key, const QString& def) -> QString {
        QJsonValue v = fpVal_(key);
        return (v.isString() && !v.toString().isEmpty()) ? v.toString() : def;
    };
    auto fpInt_ = [&](const QString& key, int def) -> int {
        QJsonValue v = fpVal_(key);
        return v.isDouble() ? v.toInt() : def;
    };


    // Navigator fields
    QString osType        = profile["os_type"].toString("windows10");
    QString userAgent     = fpStr_("navigator.userAgent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.36 Safari/537.36");
    // Extract chrome version from UA for --fwys-ua-brands (must match binary!)
    // Format: ...Chrome/153.0.8010.36... → minor="153", full="153.0.8010.36"
    QString chromeMinor = "153";
    QString chromeFull  = "153.0.8010.36";
    QRegularExpression versionRx("Chrome\\/(\\d+)\\.(\\S+)");
    QRegularExpressionMatch vm = versionRx.match(userAgent);
    if (vm.hasMatch()) {
        chromeMinor = vm.captured(1);
        chromeFull  = vm.captured(1) + "." + vm.captured(2);
    }
    QString platform    = fpStr_("navigator.platform", "Win32");
    int     hwConcurrency = fpInt_("navigator.hardwareConcurrency", 8);
    int     deviceMemory  = fpInt_("navigator.deviceMemory", 8);

    // If fingerprint_data is empty (never generated), use stored IP/profile data
    // to at least get the timezone and hardware right at launch
    if (fp.isEmpty() || fp.keys().size() < 3) {
        // Build minimal fingerprint from profile IP fields
        QString ipTimezone = profile["ip_timezone"].toString();
        if (!ipTimezone.isEmpty()) {
            // Will be passed to Node.js via fingerprint payload
            // so it gets timezone right even without explicit generation
            QJsonObject minimalNav;
            minimalNav["userAgent"] = userAgent;
            minimalNav["platform"]  = "Win32";
            minimalNav["hardwareConcurrency"] = 8;
            minimalNav["deviceMemory"]  = 8;
            fp["navigator"] = minimalNav;
            fp["timezone"]  = ipTimezone;
            fp["os"]        = QJsonObject{{ "type", osType }};
        }
    }

    // GPU
    QString webglVendor   = fpStr_("gpu.vendor",   "Google Inc. (NVIDIA)");
    QString webglRenderer = fpStr_("gpu.renderer",  "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)");

    // Screen
    int screenW = fpInt_("screen.width",  1920);
    int screenH = fpInt_("screen.height", 1080);

    // Noise seeds: PREFER values from fingerprint_data (set by JS generator)
    // so that C++ (hardware-level) and JS (CDP-level) noise are in sync.
    // Fallback to C++ hash-based seed if not set.
    quint64 canvasSeed = profileSeed(profileId, "canvas");  // C++ default
    quint64 audioSeed  = profileSeed(profileId, "audio");
    // Read from fp if available (set by Node.js generator)
    if (fp.contains("canvas") && fp["canvas"].isObject()) {
        quint64 fpCanvasSeed = (quint64)fp["canvas"].toObject()["seed"].toDouble(0);
        if (fpCanvasSeed > 0) canvasSeed = fpCanvasSeed;
    }
    if (fp.contains("audio") && fp["audio"].isObject()) {
        quint64 fpAudioSeed = (quint64)fp["audio"].toObject()["seed"].toDouble(0);
        if (fpAudioSeed > 0) audioSeed = fpAudioSeed;
    }

    // Proxy
    QString proxyType = profile["proxy_type"].toString("none");
    QString proxyHost = profile["proxy_host"].toString();
    int     proxyPort = profile["proxy_port"].toInt(0);
    QString proxyUser = profile["proxy_username"].toString();
    QString proxyPass = profile["proxy_password"].toString();

    // Profile user-data directory (isolated per profile)
    QString userDataDir = m_db->profilesDataPath() + "/" + profileId;
    QDir().mkpath(userDataDir);

    QStringList args;

    // ── P0: Anti-detection flags (CRITICAL — always first) ──────────────
    args
        // Removes navigator.webdriver=true (most important flag)
        << "--disable-blink-features=AutomationControlled"
        // Suppresses "unsupported command-line flag" warning banners
        << "--test-type"
        // No background requests on real IP
        << "--disable-background-networking"
        // No hyperlink auditing (ping)
        << "--no-pings"
        // No Google sync (leaks identity)
        << "--disable-sync"
        // Clean first-run state
        << "--no-first-run"
        // No default extensions
        << "--disable-default-apps"
        // No metrics phone-home
        << "--metrics-recording-only"
        // No phishing detection (contacts Google)
        << "--disable-client-side-phishing-detection"
        // No password manager integration
        << "--password-store=basic"
        // Use system keyring for nothing
        << "--use-mock-keychain"
        // No crash reporter
        << "--disable-breakpad"
        // DNS leak prevention: disable prefetch DNS so queries go through proxy
        << "--dns-prefetch-disable"
        // No QUIC: QUIC (HTTP/3) uses UDP and can bypass proxy/expose real IP
        << "--disable-quic"
        // No speculative DNS/preconnect (sends DNS before proxy is ready)
        << "--no-network-profile-warning";

    // ── P0: FWYS fingerprint flags (custom Chromium patches) ────────────
    args
        << QString("--user-agent=%1").arg(userAgent)
        << QString("--fwys-canvas-seed=%1").arg(canvasSeed)
        << QString("--fwys-audio-seed=%1").arg(audioSeed)
        << QString("--fwys-platform=%1").arg(platform)
        << QString("--fwys-hw-concurrency=%1").arg(hwConcurrency)
        << QString("--fwys-device-memory=%1").arg(deviceMemory)
        << QString("--fwys-user-agent=%1").arg(userAgent)
        << QString("--fwys-webgl-vendor=%1").arg(webglVendor)
        << QString("--fwys-webgl-renderer=%1").arg(webglRenderer)
        << QString("--fwys-screen-width=%1").arg(screenW)
        << QString("--fwys-screen-height=%1").arg(screenH)
        << QString("--window-size=%1,%2").arg(screenW).arg(screenH)
        << QString("--fwys-ua-brands=[{\"brand\":\"Google Chrome\",\"version\":\"%1\"},{\"brand\":\"Not_A Brand\",\"version\":\"8\"},{\"brand\":\"Chromium\",\"version\":\"%1\"}]").arg(chromeMinor)
        << "--fwys-ua-platform=Windows"
        << "--fwys-ua-platform-version=10.0.0"
        << QString("--fwys-ua-full-version=%1").arg(chromeFull);

    // WebRTC IP handling policy
    // When proxy is configured: force ALL WebRTC through proxy (C++ level, unbypassable)
    // When no proxy: block non-proxied UDP so real IP never leaks
    QString webrtcMode = fpStr_("webrtc.mode", fpStr_("webrtc_mode", "filter_local"));
    if (webrtcMode == "block") {
        // Explicit block mode — disable WebRTC entirely
        args << "--fwys-block-webrtc"
             << "--force-webrtc-ip-handling-policy=disable_non_proxied_udp";
    } else if (proxyType != "none" && !proxyHost.isEmpty() && proxyPort > 0) {
        // Proxy is configured — force WebRTC through proxy so STUN sees exit IP, not real IP
        // disable_non_proxied_udp = Chrome will only use proxy-routed UDP for WebRTC
        args << "--fwys-webrtc-filter-local"
             << "--force-webrtc-ip-handling-policy=disable_non_proxied_udp";
    } else {
        // No proxy — filter local IPs via JS, no UDP block (direct connection is fine)
        args << "--fwys-webrtc-filter-local";
    }

    // ── Proxy configuration ───────────────────────────────────────────────
    if (proxyType != "none" && !proxyHost.isEmpty() && proxyPort > 0) {
        // Build local SOCKS5 tunnel via Node.js if needed
        // For now: pass proxy directly to Chromium
        QString proxyScheme = (proxyType == "http" || proxyType == "https") ? "http" : "socks5";
        QString proxyStr;

        if (!proxyUser.isEmpty()) {
            // Chromium proxy doesn't support inline auth — use Node.js tunnel
            // Node.js creates local SOCKS5 on 127.0.0.1:PORT → forwards to real proxy
            // Port = base port + profile index
            int localPort = 19000 + (debugPort - 9222);
            proxyStr = QString("socks5://127.0.0.1:%1").arg(localPort);
            // Send tunnel setup to Node.js
            QJsonObject tunnelPayload;
            tunnelPayload["profileId"]  = profileId;
            tunnelPayload["localPort"]  = localPort;
            tunnelPayload["proxyType"]  = proxyType;
            tunnelPayload["proxyHost"]  = proxyHost;
            tunnelPayload["proxyPort"]  = proxyPort;
            tunnelPayload["proxyUser"]  = proxyUser;
            tunnelPayload["proxyPass"]  = proxyPass;
            sendIPCCommand("setup_proxy_tunnel", tunnelPayload);
        } else {
            proxyStr = QString("%1://%2:%3").arg(proxyScheme, proxyHost, QString::number(proxyPort));
        }

        args << QString("--proxy-server=%1").arg(proxyStr);
        args << "--proxy-bypass-list=<-loopback>";  // don't bypass localhost
    } else {
        // No proxy — direct connection
        // For kill-switch: we still block WebRTC (done above)
        args << "--no-proxy-server";
    }

    // ── Profile isolation ─────────────────────────────────────────────────
    args
        << QString("--user-data-dir=%1").arg(QDir::toNativeSeparators(userDataDir))
        << QString("--remote-debugging-port=%1").arg(debugPort);

    // ── Window size (match screen resolution) ────────────────────────────
    // Subtract taskbar height for availHeight
    args
        << QString("--window-size=%1,%2").arg(screenW).arg(screenH - 40)
        << "--window-position=0,0";

    // ── Extensions loading ────────────────────────────────────────────────
    QString extStr = profile["extensions"].toString("[]");
    QJsonDocument extDoc = QJsonDocument::fromJson(extStr.toUtf8());
    QStringList extPaths;
    if (extDoc.isArray()) {
        for (const auto& item : extDoc.array()) {
            QString path = item.isObject() ? item.toObject()["path"].toString() : item.toString();
            bool enabled = item.isObject() ? item.toObject()["enabled"].toBool(true) : true;
            if (enabled && !path.isEmpty() && QDir(path).exists()) {
                extPaths << QDir::toNativeSeparators(path);
            }
        }
    }
    if (!extPaths.isEmpty()) {
        args << QString("--load-extension=%1").arg(extPaths.join(','));
        args << QString("--disable-extensions-except=%1").arg(extPaths.join(','));
    }

    // ── OS-specific hardening ─────────────────────────────────────────────
    // Note: --disable-gpu-sandbox removed to eliminate unsupported flag warning banner

    return args;
}

// ── Launch ────────────────────────────────────────────────────────────────
bool BrowserLauncher::launchProfile(const QString& profileId)
{
    if (isRunning(profileId)) {
        qDebug() << "[Launcher] Profile already running:" << profileId;
        return true;
    }

    if (m_chromiumPath.isEmpty() || !QFileInfo::exists(m_chromiumPath)) {
        emit launchError(profileId, "Chromium binary not found. Please set path in Settings.");
        return false;
    }

    // Load profile from DB
    QJsonObject profile = m_profileManager->getProfile(profileId);
    if (profile.isEmpty() || profile["id"].toString().isEmpty()) {
        emit launchError(profileId, "Profile not found: " + profileId);
        return false;
    }

    // Ensure Node.js injector is running (for CDP injection)
    startNodeIPC();

    int debugPort = m_nextDebugPort++;

    // Build Chromium args from profile data
    QStringList args = buildChromiumArgs(profile, debugPort);

    // Launch Chromium directly
    auto* proc = new QProcess(this);
    proc->setProgram(m_chromiumPath);
    proc->setArguments(args);

    connect(proc, &QProcess::started, this, [this, profileId, proc]() {
        qDebug() << "[Launcher] Chrome started PID:" << proc->processId() << "profile:" << profileId;
        m_profileManager->setProfileStatus(profileId, 1);
        m_profileManager->touchLastUsed(profileId);
        emit profileLaunched(profileId, (int)proc->processId());
    });

    connect(proc, QOverload<int, QProcess::ExitStatus>::of(&QProcess::finished),
            this, [this, profileId](int code, QProcess::ExitStatus) {
        qDebug() << "[Launcher] Chrome exited code:" << code << "profile:" << profileId;
        m_profileManager->setProfileStatus(profileId, 0);
        m_processes.remove(profileId);
        emit profileClosed(profileId);
    });

    proc->start();
    if (!proc->waitForStarted(5000)) {
        emit launchError(profileId, "Chrome failed to start: " + proc->errorString());
        delete proc;
        return false;
    }

    m_processes[profileId] = proc;

    // Send CDP injection command to Node.js
    QJsonObject ipcPayload;
    ipcPayload["profileId"]    = profileId;
    ipcPayload["chromiumPath"] = m_chromiumPath;
    ipcPayload["debugPort"]    = debugPort;

    // Read proxy config from profile for Node.js auto-resolve
    QString lpProxyType = profile["proxy_type"].toString("none");
    QString lpProxyHost = profile["proxy_host"].toString();
    int     lpProxyPort = profile["proxy_port"].toInt(0);
    QString lpProxyUser = profile["proxy_username"].toString();
    QString lpProxyPass = profile["proxy_password"].toString();

    QJsonObject fpPayload;

    if (profile["fingerprint_data"].isObject()) {
        fpPayload = profile["fingerprint_data"].toObject();
    } else if (profile.contains("fingerprint_data")) {
        fpPayload = QJsonDocument::fromJson(profile["fingerprint_data"].toString("{}").toUtf8()).object();
    }
    // Inject publicIp into fingerprint so WebRTC JS filter replaces real IPs
    // ip_address is stored after a successful proxy test (test_proxy IPC command)
    QString proxyExitIp = profile["ip_address"].toString();
    if (!proxyExitIp.isEmpty()) {
        fpPayload["publicIp"] = proxyExitIp;
        QJsonObject webrtcObj;
        webrtcObj["mode"]     = QString("filter_local");
        webrtcObj["publicIp"] = proxyExitIp;
        fpPayload["webrtc"]   = webrtcObj;
        QJsonObject metaObj   = fpPayload["meta"].toObject();
        metaObj["ipSource"]   = proxyExitIp;
        fpPayload["meta"]     = metaObj;
    }
    ipcPayload["fingerprint"] = fpPayload;

    // Cookies for CDP injection
    if (profile.contains("cookies")) {
        ipcPayload["cookies"] = profile["cookies"].toString("[]");
    }

    // Send proxy config so Node.js can auto-resolve exit IP if ip_address was empty
    if (lpProxyType != "none" && !lpProxyHost.isEmpty() && lpProxyPort > 0) {
        QJsonObject proxyCfg;
        proxyCfg["type"]     = lpProxyType;
        proxyCfg["host"]     = lpProxyHost;
        proxyCfg["port"]     = lpProxyPort;
        proxyCfg["username"] = lpProxyUser;
        proxyCfg["password"] = lpProxyPass;
        ipcPayload["proxyConfig"] = proxyCfg;
    }

    sendIPCCommand("attach_cdp", ipcPayload);


    qDebug() << "[Launcher] Launched profile:" << profileId << "port:" << debugPort;
    return true;
}

bool BrowserLauncher::closeProfile(const QString& profileId)
{
    // Tell Node.js to detach CDP
    QJsonObject payload;
    payload["profileId"] = profileId;
    sendIPCCommand("close_profile", payload);

    // Kill Chrome process
    if (m_processes.contains(profileId)) {
        QProcess* proc = m_processes[profileId];
        if (proc && proc->state() == QProcess::Running) {
            proc->terminate();
            if (!proc->waitForFinished(3000)) {
                proc->kill();
            }
        }
        m_processes.remove(profileId);
    }

    m_profileManager->setProfileStatus(profileId, 0);
    emit profileClosed(profileId);
    return true;
}

bool BrowserLauncher::isRunning(const QString& profileId)
{
    if (!m_processes.contains(profileId)) return false;
    QProcess* proc = m_processes[profileId];
    return proc && proc->state() == QProcess::Running;
}

// ── Path detection ────────────────────────────────────────────────────────
QString BrowserLauncher::detectChromiumPath()
{
    QString appDir = QCoreApplication::applicationDirPath();
    QStringList candidates = {
        // System Chrome (contains Google-signed Widevine CDM and proprietary codecs)
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        // Portable bundle locations
        appDir + "/chromium/chrome.exe",
        appDir + "/bin/chrome.exe",
        appDir + "/../../../dist/chromium/chrome.exe",
        "D:/C_Camofoux_Node/dist/chromium/chrome.exe",
        appDir + "/../dist/chromium/chrome.exe",
        appDir + "/../chromium/chrome.exe",
        QDir::currentPath() + "/../dist/chromium/chrome.exe",
        QDir::currentPath() + "/dist/chromium/chrome.exe",
        QDir::currentPath() + "/../chromium/chrome.exe",
        // System Edge fallback
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
    };

    for (const QString& p : candidates) {
        if (QFileInfo::exists(p)) {
            qDebug() << "[Launcher] Chromium found at:" << p;
            return p;
        }
    }
    return QString();
}

QString BrowserLauncher::detectNodePath()
{
    QString appDir = QCoreApplication::applicationDirPath();
    QStringList candidates = {
        // Portable bundle locations
        appDir + "/node.exe",
        appDir + "/bin/node.exe",
        appDir + "/injector/node.exe",
        // System installations
        "C:/Program Files/nodejs/node.exe",
        "C:/Program Files (x86)/nodejs/node.exe",
    };
    for (const QString& p : candidates) {
        if (QFileInfo::exists(p)) return p;
    }

    QProcess probe;
    probe.start("node", {"--version"});
    probe.waitForFinished(2000);
    if (probe.exitCode() == 0) return "node";

    return "node";
}

// ── Node.js IPC ───────────────────────────────────────────────────────────
void BrowserLauncher::startNodeIPC()
{
    if (m_nodeProcess && m_nodeProcess->state() == QProcess::Running) return;

    QString appDir = QCoreApplication::applicationDirPath();
    // Find injector path relative to executable
    QStringList injectorCandidates = {
        appDir + "/injector/src/index.js",
        appDir + "/../injector/src/index.js",
        appDir + "/../../injector/src/index.js",
        QDir::currentPath() + "/injector/src/index.js",
        QDir::currentPath() + "/../injector/src/index.js",
        QDir::currentPath() + "/../../injector/src/index.js",
        "D:/C_Camofoux_Node/injector/src/index.js"
    };

    QString injectorPath;
    for (const QString& p : injectorCandidates) {
        if (QFileInfo::exists(p)) { injectorPath = p; break; }
    }

    if (injectorPath.isEmpty()) {
        qWarning() << "[Launcher] Injector not found";
        return;
    }

    m_nodeProcess = new QProcess(this);
    m_nodeProcess->setProgram(m_nodejsPath);
    m_nodeProcess->setArguments({ injectorPath });
    m_nodeProcess->setWorkingDirectory(QFileInfo(injectorPath).absolutePath() + "/..");

    connect(m_nodeProcess, &QProcess::readyReadStandardOutput, this, [this]() {
        qDebug() << "[Node]" << m_nodeProcess->readAllStandardOutput().trimmed();
    });
    connect(m_nodeProcess, &QProcess::readyReadStandardError, this, [this]() {
        qWarning() << "[Node ERR]" << m_nodeProcess->readAllStandardError().trimmed();
    });

    m_nodeProcess->start();
    if (m_nodeProcess->waitForStarted(3000)) {
        qDebug() << "[Launcher] Node.js injector started PID:" << m_nodeProcess->processId();
        // Give it 500ms to start IPC server
        m_nodeProcess->waitForReadyRead(500);
    } else {
        qWarning() << "[Launcher] Node.js failed to start:" << m_nodeProcess->errorString();
    }
}

void BrowserLauncher::sendIPCCommand(const QString& event, const QJsonObject& payload)
{
    QLocalSocket socket;
    socket.connectToServer("\\\\.\\pipe\\fwys_ipc");

    if (!socket.waitForConnected(2000)) {
        qWarning() << "[IPC] Cannot connect to Node.js pipe:" << socket.errorString();
        return;
    }

    QJsonObject msg;
    msg["event"]   = event;
    msg["payload"] = payload;

    QByteArray data = QJsonDocument(msg).toJson(QJsonDocument::Compact) + "\n";
    socket.write(data);
    socket.flush();
    socket.waitForBytesWritten(1000);
    socket.disconnectFromServer();
}
