#pragma once
#include <QString>

// Supported proxy types
enum class ProxyType {
    None,
    HTTP,
    HTTPS,
    SOCKS4,
    SOCKS5,
    SSH
};

struct ParsedProxy {
    ProxyType   type        = ProxyType::None;
    QString     typeString  = "none";
    QString     host;
    int         port        = 0;
    QString     username;
    QString     password;
    bool        valid       = false;
    QString     rawString;

    // Rebuild canonical string from parts
    QString canonical() const;
};

class ProxyParser
{
public:
    // Parse any proxy format into ParsedProxy struct.
    // Supported formats:
    //   socks5://user:pass@host:port
    //   socks5://host:port
    //   http://host:port
    //   host:port:user:pass          (legacy colon-separated)
    //   host:port                   (bare — defaults to SOCKS5)
    //   user:pass@host:port
    //   ssh://user@host:port
    static ParsedProxy parse(const QString& raw);

    // Convert ProxyType enum to string
    static QString typeToString(ProxyType t);

    // Convert string to ProxyType enum
    static ProxyType stringToType(const QString& s);
};
