#pragma once
#include <QObject>
#include <QString>
#include <QJsonObject>
#include <QJsonArray>

class ProxyManager : public QObject
{
    Q_OBJECT

public:
    explicit ProxyManager(QObject* parent = nullptr);

    // Test a proxy string, returns {success, ip, latency_ms}
    Q_INVOKABLE QJsonObject testProxy(const QString& proxyString);

    // Parse proxy string to components
    Q_INVOKABLE QJsonObject parseProxy(const QString& proxyString);

    // Build proxy string from components
    Q_INVOKABLE QString buildProxy(const QString& type,
                                   const QString& host,
                                   int port,
                                   const QString& user = QString(),
                                   const QString& pass = QString());
};
