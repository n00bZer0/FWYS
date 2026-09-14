#include "ProxyManager.h"
#include <QNetworkProxy>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QElapsedTimer>
#include <QEventLoop>
#include <QUrl>
#include <QRegularExpression>
#include <QDebug>

ProxyManager::ProxyManager(QObject* parent) : QObject(parent) {}

QJsonObject ProxyManager::testProxy(const QString& proxyString)
{
    QJsonObject result;
    QJsonObject parsed = parseProxy(proxyString);
    if (parsed.isEmpty()) {
        result["success"] = false;
        result["error"] = "Invalid proxy format";
        return result;
    }

    QNetworkProxy proxy;
    QString type = parsed["type"].toString();
    proxy.setType(type == "socks5" ? QNetworkProxy::Socks5Proxy : QNetworkProxy::HttpProxy);
    proxy.setHostName(parsed["host"].toString());
    proxy.setPort(parsed["port"].toInt());
    if (!parsed["user"].toString().isEmpty()) {
        proxy.setUser(parsed["user"].toString());
        proxy.setPassword(parsed["pass"].toString());
    }

    QNetworkAccessManager nam;
    nam.setProxy(proxy);

    QElapsedTimer timer;
    QNetworkReply* reply = nullptr;
    QEventLoop loop;

    timer.start();
    reply = nam.get(QNetworkRequest(QUrl("https://api.ipify.org?format=text")));
    QObject::connect(reply, &QNetworkReply::finished, &loop, &QEventLoop::quit);
    QTimer::singleShot(8000, &loop, &QEventLoop::quit);
    loop.exec();

    qint64 ms = timer.elapsed();

    if (reply->error() == QNetworkReply::NoError) {
        QString ip = reply->readAll().trimmed();
        result["success"] = true;
        result["ip"] = ip;
        result["latency_ms"] = (int)ms;
    } else {
        result["success"] = false;
        result["error"] = reply->errorString();
    }
    reply->deleteLater();
    return result;
}

QJsonObject ProxyManager::parseProxy(const QString& proxyString)
{
    // Format: type://[user:pass@]host:port
    QRegularExpression re(
        R"(^(socks5|http|https)://(?:([^:@]+):([^@]*)@)?([^:]+):(\d+)$)"
    );
    auto m = re.match(proxyString.trimmed());
    if (!m.hasMatch()) return {};

    QJsonObject obj;
    obj["type"] = m.captured(1);
    obj["user"] = m.captured(2);
    obj["pass"] = m.captured(3);
    obj["host"] = m.captured(4);
    obj["port"] = m.captured(5).toInt();
    return obj;
}

QString ProxyManager::buildProxy(const QString& type, const QString& host,
                                  int port, const QString& user, const QString& pass)
{
    QString s = type + "://";
    if (!user.isEmpty()) s += user + ":" + pass + "@";
    s += host + ":" + QString::number(port);
    return s;
}
