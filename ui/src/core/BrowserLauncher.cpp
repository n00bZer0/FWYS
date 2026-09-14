#include "BrowserLauncher.h"
#include "ProfileManager.h"

#include <QDir>
#include <QFileInfo>
#include <QJsonDocument>
#include <QLocalSocket>
#include <QDebug>
#include <QStandardPaths>

BrowserLauncher::BrowserLauncher(ProfileManager* profileManager, QObject* parent)
    : QObject(parent), m_profileManager(profileManager)
{
    // Auto-detect paths on startup
    m_chromiumPath = detectChromiumPath();
    m_nodejsPath   = detectNodePath();
}

BrowserLauncher::~BrowserLauncher()
{
    if (m_nodeProcess && m_nodeProcess->state() == QProcess::Running) {
        m_nodeProcess->terminate();
        m_nodeProcess->waitForFinished(2000);
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

    // Ensure Node.js injector is running
    startNodeIPC();

    int debugPort = m_nextDebugPort++;
    QJsonObject payload;
    payload["profileId"]   = profileId;
    payload["chromiumPath"] = m_chromiumPath;
    payload["debugPort"]   = debugPort;

    sendIPCCommand("launch_profile", payload);

    // Mark profile as launching
    m_profileManager->setProfileStatus(profileId, 1); // running

    qDebug() << "[Launcher] Launch requested:" << profileId << "port:" << debugPort;
    return true;
}

bool BrowserLauncher::closeProfile(const QString& profileId)
{
    QJsonObject payload;
    payload["profileId"] = profileId;
    sendIPCCommand("close_profile", payload);

    m_profileManager->setProfileStatus(profileId, 0); // idle
    emit profileClosed(profileId);
    return true;
}

bool BrowserLauncher::isRunning(const QString& profileId)
{
    return m_profileManager->getProfileStatus(profileId) == 1;
}

QString BrowserLauncher::detectChromiumPath()
{
    QStringList candidates = {
        QDir::currentPath() + "/../dist/chromium/chrome.exe",
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
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
    // Try 'node' from PATH
    QProcess probe;
    probe.start("node", {"--version"});
    probe.waitForFinished(2000);
    if (probe.exitCode() == 0) return "node";

    // Common install paths
    QStringList candidates = {
        "C:/Program Files/nodejs/node.exe",
        "C:/Program Files (x86)/nodejs/node.exe",
    };
    for (const QString& p : candidates) {
        if (QFileInfo::exists(p)) return p;
    }
    return "node"; // fallback
}

void BrowserLauncher::startNodeIPC()
{
    if (m_nodeProcess && m_nodeProcess->state() == QProcess::Running) return;

    QString injectorPath = QDir::currentPath() + "/../injector/src/index.js";
    if (!QFileInfo::exists(injectorPath)) {
        qWarning() << "[Launcher] Injector not found at:" << injectorPath;
        return;
    }

    m_nodeProcess = new QProcess(this);
    m_nodeProcess->setProgram(m_nodejsPath);
    m_nodeProcess->setArguments({ injectorPath });
    m_nodeProcess->setWorkingDirectory(QDir::currentPath() + "/../injector");

    connect(m_nodeProcess, &QProcess::readyReadStandardOutput, this, [this]() {
        qDebug() << "[Node]" << m_nodeProcess->readAllStandardOutput().trimmed();
    });
    connect(m_nodeProcess, &QProcess::readyReadStandardError, this, [this]() {
        qWarning() << "[Node ERR]" << m_nodeProcess->readAllStandardError().trimmed();
    });

    m_nodeProcess->start();
    qDebug() << "[Launcher] Node.js injector started PID:" << m_nodeProcess->processId();
}

void BrowserLauncher::sendIPCCommand(const QString& event, const QJsonObject& payload)
{
    // Connect to named pipe
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
