#include "BrowserLauncher.h"
#include "ProfileManager.h"
#include "DatabaseManager.h"

#include <QDir>
#include <QFileInfo>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QLocalSocket>
#include <QDebug>
#include <QCryptographicHash>

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
    QString osType      = profile["os_type"].toString("windows10");
    QString userAgent   = fpStr_("navigator.userAgent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
    QString platform    = fpStr_("navigator.platform", "Win32");
    int     hwConcurrency = fpInt_("navigator.hardwareConcurrency", 8);
    int     deviceMemory  = fpInt_("navigator.deviceMemory", 8);

    // GPU
    QString webglVendor   = fpStr_("gpu.vendor",   "Google Inc. (NVIDIA)");
    QString webglRenderer = fpStr_("gpu.renderer",  "ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)");

    // Screen
    int screenW = fpInt_("screen.width",  1920);
    int screenH = fpInt_("screen.height", 1080);

    // Noise seeds (deterministic per profile)
    quint64 canvasSeed = profileSeed(profileId, "canvas");
    quint64 audioSeed  = profileSeed(profileId, "audio");

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
        // Route all WebRTC through proxy — no STUN to real IP
        << "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"
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
        << "--disable-breakpad";

    // ── P0: FWYS fingerprint flags (custom Chromium patches) ────────────
    args
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
        // Block WebRTC entirely (safest)
        << "--fwys-block-webrtc"
        << "--fwys-webrtc-filter-local";

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

    // ── OS-specific hardening ─────────────────────────────────────────────
#ifdef Q_OS_WIN
    args << "--disable-gpu-sandbox";  // needed on some Windows configs
#endif

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
    QJsonObject fpPayload;

    if (profile["fingerprint_data"].isObject()) {
        fpPayload = profile["fingerprint_data"].toObject();
    } else if (profile.contains("fingerprint_data")) {
        fpPayload = QJsonDocument::fromJson(profile["fingerprint_data"].toString("{}").toUtf8()).object();
    }
    ipcPayload["fingerprint"] = fpPayload;
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
    QStringList candidates = {
        // Our custom-patched Chromium (preferred)
        QDir::currentPath() + "/../dist/chromium/chrome.exe",
        // Fallback: system Chrome (unpatched — CDP injection still works)
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        // Chromium portable
        QDir::currentPath() + "/../chromium/chrome.exe",
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
    QProcess probe;
    probe.start("node", {"--version"});
    probe.waitForFinished(2000);
    if (probe.exitCode() == 0) return "node";

    QStringList candidates = {
        "C:/Program Files/nodejs/node.exe",
        "C:/Program Files (x86)/nodejs/node.exe",
    };
    for (const QString& p : candidates) {
        if (QFileInfo::exists(p)) return p;
    }
    return "node";
}

// ── Node.js IPC ───────────────────────────────────────────────────────────
void BrowserLauncher::startNodeIPC()
{
    if (m_nodeProcess && m_nodeProcess->state() == QProcess::Running) return;

    // Find injector path relative to executable
    QStringList injectorCandidates = {
        QDir::currentPath() + "/../injector/src/index.js",
        QDir::currentPath() + "/../../injector/src/index.js",
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
