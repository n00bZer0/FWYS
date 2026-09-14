#include "ProxyParser.h"
#include <QUrl>
#include <QRegularExpression>
#include <QStringList>
#include <QDebug>

QString ParsedProxy::canonical() const
{
    if (type == ProxyType::None || !valid) return QString();

    QString result = typeString + "://";
    if (!username.isEmpty()) {
        result += username;
        if (!password.isEmpty()) result += ":" + password;
        result += "@";
    }
    result += host + ":" + QString::number(port);
    return result;
}

QString ProxyParser::typeToString(ProxyType t)
{
    switch (t) {
    case ProxyType::HTTP:   return "http";
    case ProxyType::HTTPS:  return "https";
    case ProxyType::SOCKS4: return "socks4";
    case ProxyType::SOCKS5: return "socks5";
    case ProxyType::SSH:    return "ssh";
    default:                return "none";
    }
}

ProxyType ProxyParser::stringToType(const QString& s)
{
    QString lower = s.toLower().trimmed();
    if (lower == "http")   return ProxyType::HTTP;
    if (lower == "https")  return ProxyType::HTTPS;
    if (lower == "socks4") return ProxyType::SOCKS4;
    if (lower == "socks5") return ProxyType::SOCKS5;
    if (lower == "ssh")    return ProxyType::SSH;
    return ProxyType::None;
}

ParsedProxy ProxyParser::parse(const QString& raw)
{
    ParsedProxy result;
    result.rawString = raw.trimmed();
    QString input    = raw.trimmed();

    if (input.isEmpty()) {
        return result;   // type=None, valid=false
    }

    // ── Strategy 1: URI scheme present  e.g. socks5://user:pass@host:port ──
    static const QStringList schemes = {
        "socks5://", "socks4://", "https://", "http://", "ssh://"
    };

    bool hasScheme = false;
    for (const QString& scheme : schemes) {
        if (input.startsWith(scheme, Qt::CaseInsensitive)) {
            hasScheme = true;
            break;
        }
    }

    if (hasScheme) {
        // Add placeholder scheme if QUrl can't parse it (e.g. socks4)
        QString urlStr = input;

        QUrl url(urlStr);
        if (!url.isValid() || url.host().isEmpty()) {
            qWarning() << "[ProxyParser] QUrl failed for:" << urlStr;
            return result;
        }

        result.type       = stringToType(url.scheme());
        result.typeString = url.scheme().toLower();
        result.host       = url.host();
        result.port       = url.port(0);
        result.username   = url.userName();
        result.password   = url.password();
        result.valid      = !result.host.isEmpty() && result.port > 0;
        return result;
    }

    // ── Strategy 2: user:pass@host:port  (no scheme) ──
    if (input.contains('@')) {
        // Split at last '@' to handle passwords with '@'
        int atIdx = input.lastIndexOf('@');
        QString userPart = input.left(atIdx);
        QString hostPart = input.mid(atIdx + 1);

        // Parse user:pass
        int colonIdx = userPart.indexOf(':');
        if (colonIdx >= 0) {
            result.username = userPart.left(colonIdx);
            result.password = userPart.mid(colonIdx + 1);
        } else {
            result.username = userPart;
        }

        // Parse host:port
        int hostColon = hostPart.lastIndexOf(':');
        if (hostColon > 0) {
            result.host = hostPart.left(hostColon);
            result.port = hostPart.mid(hostColon + 1).toInt();
        }

        result.type       = ProxyType::SOCKS5; // default
        result.typeString = "socks5";
        result.valid      = !result.host.isEmpty() && result.port > 0;
        return result;
    }

    // ── Strategy 3: host:port:user:pass  (legacy colon-separated) ──
    {
        QStringList parts = input.split(':');
        if (parts.size() >= 4) {
            // Could be host:port:user:pass or user:pass:host:port
            // Heuristic: if part[1] is a number → host:port:user:pass
            bool portIsSecond = false;
            parts[1].toInt(&portIsSecond);

            if (portIsSecond) {
                result.host     = parts[0];
                result.port     = parts[1].toInt();
                result.username = parts[2];
                result.password = parts.mid(3).join(':'); // password may contain ':'
            } else {
                // user:pass:host:port
                result.username = parts[0];
                result.password = parts[1];
                result.host     = parts[2];
                result.port     = parts[3].toInt();
            }

            result.type       = ProxyType::SOCKS5;
            result.typeString = "socks5";
            result.valid      = !result.host.isEmpty() && result.port > 0;
            return result;
        }

        // ── Strategy 4: bare host:port  ──
        if (parts.size() == 2) {
            result.host = parts[0];
            result.port = parts[1].toInt();
            result.type       = ProxyType::SOCKS5;
            result.typeString = "socks5";
            result.valid      = !result.host.isEmpty() && result.port > 0;
            return result;
        }
    }

    qWarning() << "[ProxyParser] Could not parse proxy string:" << raw;
    return result;
}
