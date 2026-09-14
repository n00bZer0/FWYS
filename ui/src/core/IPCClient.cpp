#include "IPCClient.h"
#include <QJsonDocument>
#include <QDir>
#include <QFileInfo>
#include <QCoreApplication>
#include <QDebug>

static const QString PIPE_NAME = "\\\\.\\pipe\\fwys_ipc";

IPCClient::IPCClient(QObject* parent)
    : QObject(parent)
    , m_socket(new QLocalSocket(this))
    , m_nodeProcess(nullptr)
    , m_reconnectTimer(new QTimer(this))
{
    connect(m_socket, &QLocalSocket::connected, this, &IPCClient::onSocketConnected);
    connect(m_socket, &QLocalSocket::disconnected, this, &IPCClient::onSocketDisconnected);
    connect(m_socket, &QLocalSocket::readyRead, this, &IPCClient::onReadyRead);
    connect(m_socket, &QLocalSocket::errorOccurred, this, &IPCClient::onSocketError);

    m_reconnectTimer->setInterval(2000);
    m_reconnectTimer->setSingleShot(true);
    connect(m_reconnectTimer, &QTimer::timeout, this, &IPCClient::connectToServer);
}

IPCClient::~IPCClient()
{
    if (m_socket->isOpen()) {
        m_socket->close();
    }
}

bool IPCClient::isConnected() const
{
    return m_socket && m_socket->state() == QLocalSocket::ConnectedState;
}

void IPCClient::connectToServer()
{
    if (isConnected()) return;

    m_socket->abort();
    m_socket->connectToServer(PIPE_NAME);
    if (!m_socket->waitForConnected(400)) {
        // Node process might not be running, try to start it
        ensureNodeRunning();
        m_socket->connectToServer(PIPE_NAME);
    }
}

void IPCClient::send(const QString& event, const QJsonObject& payload)
{
    if (!isConnected()) {
        connectToServer();
        if (!m_socket->waitForConnected(1500)) {
            qWarning() << "[IPCClient] Could not connect to pipe for event:" << event;
            return;
        }
    }

    QJsonObject msg;
    msg["event"]   = event;
    msg["payload"] = payload;

    QByteArray data = QJsonDocument(msg).toJson(QJsonDocument::Compact) + "\n";
    m_socket->write(data);
    m_socket->flush();
    qDebug() << "[IPCClient] ->" << event << data.trimmed();
}

void IPCClient::onSocketConnected()
{
    qDebug() << "[IPCClient] Connected to Node.js named pipe";
    m_reconnectTimer->stop();
    emit connected();
}

void IPCClient::onSocketDisconnected()
{
    qDebug() << "[IPCClient] Disconnected from Node.js pipe";
    emit disconnected();
}

void IPCClient::onSocketError(QLocalSocket::LocalSocketError socketError)
{
    Q_UNUSED(socketError);
    // Don't spam logs if pipe is just waiting for server to launch
}

void IPCClient::onReadyRead()
{
    m_buffer.append(m_socket->readAll());

    int newlineIdx;
    while ((newlineIdx = m_buffer.indexOf('\n')) != -1) {
        QByteArray line = m_buffer.left(newlineIdx).trimmed();
        m_buffer.remove(0, newlineIdx + 1);

        if (!line.isEmpty()) {
            processLine(line);
        }
    }
}

void IPCClient::processLine(const QByteArray& line)
{
    QJsonParseError err;
    QJsonDocument doc = QJsonDocument::fromJson(line, &err);
    if (err.error != QJsonParseError::NoError || !doc.isObject()) {
        qWarning() << "[IPCClient] Malformed JSON from pipe:" << line;
        return;
    }

    QJsonObject msg = doc.object();
    QString event = msg["event"].toString();
    QJsonObject payload = msg["payload"].toObject();

    qDebug() << "[IPCClient] <-" << event;
    emit eventReceived(event, payload);

    if (event == "proxy_test_result") {
        QString profileId = payload["profileId"].toString();
        bool success = payload["success"].toBool();
        QJsonObject ipData = payload["ipData"].toObject();
        QString error = payload["error"].toString();
        emit proxyTestResult(profileId, success, ipData, error);
    }
    else if (event == "fp_generated") {
        QString profileId = payload["profileId"].toString();
        bool success = payload["success"].toBool();
        QJsonObject fp = payload["fingerprint"].toObject();
        QString error = payload["error"].toString();
        emit fingerprintGenerated(profileId, success, fp, error);
    }
    else if (event == "cdp_attached") {
        QString profileId = payload["profileId"].toString();
        bool success = payload["success"].toBool();
        int pid = payload["pid"].toInt();
        QString error = payload["error"].toString();
        emit cdpAttached(profileId, success, pid, error);
    }
    else if (event == "launch_result") {
        QString profileId = payload["profileId"].toString();
        bool success = payload["success"].toBool();
        int pid = payload["pid"].toInt();
        QString error = payload["error"].toString();
        emit launchResult(profileId, success, pid, error);
    }
    else if (event == "close_result") {
        QString profileId = payload["profileId"].toString();
        bool success = payload["success"].toBool();
        emit closeResult(profileId, success);
    }
    else if (event == "cookies_parsed") {
        bool success = payload["success"].toBool();
        int count = payload["count"].toInt();
        QString json = payload["json"].toString();
        QString netscape = payload["netscape"].toString();
        QString error = payload["error"].toString();
        emit cookiesParsed(success, count, json, netscape, error);
    }
    else if (event == "cookies_extracted") {
        QString profileId = payload["profileId"].toString();
        bool success = payload["success"].toBool();
        int count = payload["count"].toInt();
        QString json = payload["json"].toString();
        QString netscape = payload["netscape"].toString();
        QString error = payload["error"].toString();
        emit cookiesExtracted(profileId, success, count, json, netscape, error);
    }
}

void IPCClient::ensureNodeRunning()
{
    if (m_nodeProcess && m_nodeProcess->state() == QProcess::Running) {
        return;
    }

    QString appDir = QCoreApplication::applicationDirPath();
    QStringList candidates = {
        appDir + "/injector/src/index.js",
        appDir + "/../injector/src/index.js",
        appDir + "/../../injector/src/index.js",
        QDir::currentPath() + "/injector/src/index.js",
        QDir::currentPath() + "/../injector/src/index.js",
        QDir::currentPath() + "/../../injector/src/index.js",
        "D:/C_Camofoux_Node/injector/src/index.js"
    };

    QString injectorPath;
    for (const QString& p : candidates) {
        if (QFileInfo::exists(p)) {
            injectorPath = QFileInfo(p).canonicalFilePath();
            break;
        }
    }

    if (injectorPath.isEmpty()) {
        return;
    }

    if (!m_nodeProcess) {
        m_nodeProcess = new QProcess(this);
        connect(m_nodeProcess, &QProcess::readyReadStandardOutput, this, [this]() {
            qDebug() << "[Node]" << m_nodeProcess->readAllStandardOutput().trimmed();
        });
        connect(m_nodeProcess, &QProcess::readyReadStandardError, this, [this]() {
            qWarning() << "[Node ERR]" << m_nodeProcess->readAllStandardError().trimmed();
        });
    }

    // Check for bundled node.exe first
    QString nodeBin = "node";
    if (QFileInfo::exists(appDir + "/node.exe")) {
        nodeBin = appDir + "/node.exe";
    } else if (QFileInfo::exists(appDir + "/bin/node.exe")) {
        nodeBin = appDir + "/bin/node.exe";
    } else if (QFileInfo::exists("C:/Program Files/nodejs/node.exe")) {
        nodeBin = "C:/Program Files/nodejs/node.exe";
    }

    m_nodeProcess->setProgram(nodeBin);
    m_nodeProcess->setArguments({ injectorPath });
    m_nodeProcess->setWorkingDirectory(QFileInfo(injectorPath).absolutePath() + "/..");
    m_nodeProcess->start();
    m_nodeProcess->waitForStarted(2000);
}
