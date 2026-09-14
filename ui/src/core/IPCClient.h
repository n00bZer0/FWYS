#pragma once
#include <QObject>
#include <QLocalSocket>
#include <QJsonObject>
#include <QProcess>
#include <QTimer>

class IPCClient : public QObject
{
    Q_OBJECT

public:
    explicit IPCClient(QObject* parent = nullptr);
    ~IPCClient();

    Q_INVOKABLE void send(const QString& event, const QJsonObject& payload = QJsonObject());
    Q_INVOKABLE bool isConnected() const;
    Q_INVOKABLE void connectToServer();

signals:
    void connected();
    void disconnected();
    void eventReceived(const QString& event, const QJsonObject& payload);

    // Specific event signals
    void proxyTestResult(const QString& profileId, bool success, const QJsonObject& ipData, const QString& error);
    void fingerprintGenerated(const QString& profileId, bool success, const QJsonObject& fingerprint, const QString& error);
    void cdpAttached(const QString& profileId, bool success, int pid, const QString& error);
    void launchResult(const QString& profileId, bool success, int pid, const QString& error);
    void closeResult(const QString& profileId, bool success);
    void cookiesParsed(bool success, int count, const QString& json, const QString& netscape, const QString& error);
    void cookiesExtracted(const QString& profileId, bool success, int count, const QString& json, const QString& netscape, const QString& error);

private slots:
    void onSocketConnected();
    void onSocketDisconnected();
    void onReadyRead();
    void onSocketError(QLocalSocket::LocalSocketError socketError);

private:
    void ensureNodeRunning();
    void processLine(const QByteArray& line);

    QLocalSocket* m_socket;
    QByteArray    m_buffer;
    QProcess*     m_nodeProcess;
    QTimer*       m_reconnectTimer;
};
