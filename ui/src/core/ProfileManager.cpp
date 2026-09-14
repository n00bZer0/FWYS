#include "ProfileManager.h"
#include "DatabaseManager.h"
#include "ProxyParser.h"

#include <QUuid>
#include <QDateTime>
#include <QJsonArray>
#include <QJsonDocument>
#include <QDir>
#include <QDebug>

// Fields allowed to be updated via updateProfile()
const QStringList ProfileManager::s_allowedFields = {
    "name", "notes",
    "proxy_string", "proxy_type", "proxy_host", "proxy_port",
    "proxy_username", "proxy_password",
    "ip_address", "ip_country", "ip_country_code", "ip_city",
    "ip_timezone", "ip_asn", "ip_isp", "ip_score", "ip_type",
    "ip_lat", "ip_lng", "ip_last_tested",
    "os_type", "browser_version",
    "fingerprint_data",
    "cookies", "extensions"
};

// ─── Profile struct serialization ─────────────────────────────────────────

QJsonObject Profile::toJson() const
{
    QJsonObject j;
    j["id"]               = id;
    j["name"]             = name;
    j["notes"]            = notes;
    j["proxy_string"]     = proxyString;
    j["proxy_type"]       = proxyTypeStr;
    j["proxy_host"]       = proxyHost;
    j["proxy_port"]       = proxyPort;
    j["proxy_username"]   = proxyUsername;
    j["proxy_password"]   = proxyPassword;
    j["ip_address"]       = ipAddress;
    j["ip_country"]       = ipCountry;
    j["ip_country_code"]  = ipCountryCode;
    j["ip_city"]          = ipCity;
    j["ip_timezone"]      = ipTimezone;
    j["ip_asn"]           = ipAsn;
    j["ip_isp"]           = ipIsp;
    j["ip_score"]         = ipScore;
    j["ip_type"]          = ipType;
    j["ip_lat"]           = ipLat;
    j["ip_lng"]           = ipLng;
    j["ip_last_tested"]   = ipLastTested;
    j["os_type"]          = osType;
    j["browser_version"]  = browserVersion;
    j["fingerprint_data"] = fingerprintData;
    j["cookies"]          = cookies;
    j["extensions"]       = extensions;
    j["status"]           = status;
    j["created_at"]       = createdAt;
    j["last_used_at"]     = lastUsedAt;
    return j;
}

Profile Profile::fromJson(const QJsonObject& j)
{
    Profile p;
    p.id             = j["id"].toString();
    p.name           = j["name"].toString();
    p.notes          = j["notes"].toString();
    p.proxyString    = j["proxy_string"].toString();
    p.proxyTypeStr   = j["proxy_type"].toString("none");
    p.proxyType      = ProxyParser::stringToType(p.proxyTypeStr);
    p.proxyHost      = j["proxy_host"].toString();
    p.proxyPort      = j["proxy_port"].toInt();
    p.proxyUsername  = j["proxy_username"].toString();
    p.proxyPassword  = j["proxy_password"].toString();
    p.ipAddress      = j["ip_address"].toString();
    p.ipCountry      = j["ip_country"].toString();
    p.ipCountryCode  = j["ip_country_code"].toString();
    p.ipCity         = j["ip_city"].toString();
    p.ipTimezone     = j["ip_timezone"].toString();
    p.ipAsn          = j["ip_asn"].toString();
    p.ipIsp          = j["ip_isp"].toString();
    p.ipScore        = j["ip_score"].toInt(-1);
    p.ipType         = j["ip_type"].toString();
    p.ipLat          = j["ip_lat"].toDouble();
    p.ipLng          = j["ip_lng"].toDouble();
    p.ipLastTested   = j["ip_last_tested"].toString();
    p.osType         = j["os_type"].toString("windows10");
    p.browserVersion = j["browser_version"].toString("auto");
    p.fingerprintData = j["fingerprint_data"].toObject();
    p.cookies        = j["cookies"].toString("[]");
    p.extensions     = j["extensions"].toString("[]");
    p.status         = j["status"].toInt(0);
    p.createdAt      = j["created_at"].toString();
    p.lastUsedAt     = j["last_used_at"].toString();
    return p;
}

// ─── ProfileManager ────────────────────────────────────────────────────────

ProfileManager::ProfileManager(DatabaseManager* db, QObject* parent)
    : QObject(parent), m_db(db)
{}

bool ProfileManager::createProfile(const QString& name)
{
    QString id  = QUuid::createUuid().toString(QUuid::WithoutBraces);
    QString now = QDateTime::currentDateTime().toString(Qt::ISODate);

    bool ok = m_db->exec(
        "INSERT INTO profiles "
        "(id, name, notes, proxy_string, proxy_type, proxy_host, proxy_port, "
        " proxy_username, proxy_password, "
        " ip_score, os_type, browser_version, fingerprint_data, "
        " cookies, extensions, "
        " status, created_at, last_used_at) "
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        { id, name, "", "", "none", "", 0,
          "", "",
          -1, "windows10", "auto", "{}",
          "[]", "[]",
          0, now, now }
    );

    if (ok) {
        qDebug() << "[ProfileManager] Created profile:" << name << id;
        // Create isolated user-data directory for this profile
        QDir().mkpath(m_db->profilesDataPath() + "/" + id);
        emit profileCreated(id);
    }
    return ok;
}

bool ProfileManager::updateProfile(const QString& id, const QJsonObject& data)
{
    QStringList setClauses;
    QVariantList values;

    for (const QString& key : s_allowedFields) {
        if (data.contains(key)) {
            setClauses << (key + " = ?");
            // fingerprint_data must be serialized to string
            if (key == "fingerprint_data") {
                QJsonValue v = data[key];
                if (v.isObject()) {
                    values << QJsonDocument(v.toObject()).toJson(QJsonDocument::Compact);
                } else {
                    values << v.toString("{}");
                }
            } else {
                values << data[key].toVariant();
            }
        }
    }

    if (setClauses.isEmpty()) return false;

    values << id;
    bool ok = m_db->exec(
        "UPDATE profiles SET " + setClauses.join(", ") + " WHERE id = ?",
        values
    );

    if (ok) emit profileUpdated(id);
    return ok;
}

bool ProfileManager::deleteProfile(const QString& id)
{
    bool ok = m_db->exec("DELETE FROM profiles WHERE id = ?", { id });
    if (ok) {
        QDir dir(m_db->profilesDataPath() + "/" + id);
        dir.removeRecursively();
        emit profileDeleted(id);
    }
    return ok;
}

QJsonObject ProfileManager::getProfile(const QString& id)
{
    auto rows = m_db->query("SELECT * FROM profiles WHERE id = ?", { id });
    if (rows.isEmpty()) return {};

    QJsonObject row = rows.first();
    // Deserialize fingerprint_data JSON string → object
    QString fpStr = row["fingerprint_data"].toString("{}");
    row["fingerprint_data"] = QJsonDocument::fromJson(fpStr.toUtf8()).object();
    return row;
}

QJsonArray ProfileManager::getAllProfiles()
{
    // Return summary fields for dashboard list
    return m_db->queryArray(
        "SELECT id, name, notes, proxy_string, proxy_type, proxy_host, proxy_port, "
        "       ip_address, ip_country, ip_country_code, ip_score, ip_type, "
        "       os_type, browser_version, status, created_at, last_used_at "
        "FROM profiles ORDER BY created_at DESC"
    );
}

int ProfileManager::profileCount()
{
    auto rows = m_db->query("SELECT COUNT(*) as cnt FROM profiles");
    if (rows.isEmpty()) return 0;
    return rows.first()["cnt"].toInt();
}

// ── Proxy ─────────────────────────────────────────────────────────────────

QJsonObject ProfileManager::parseProxy(const QString& proxyString)
{
    ParsedProxy p = ProxyParser::parse(proxyString);
    QJsonObject result;
    result["valid"]        = p.valid;
    result["proxy_string"] = p.rawString;
    result["proxy_type"]   = p.typeString;
    result["proxy_host"]   = p.host;
    result["proxy_port"]   = p.port;
    result["proxy_username"] = p.username;
    result["proxy_password"] = p.password;
    result["canonical"]    = p.canonical();

    // Node.js & general IPC convenience keys
    result["type"]     = p.typeString;
    result["host"]     = p.host;
    result["port"]     = p.port;
    result["username"] = p.username;
    result["password"] = p.password;
    result["user"]     = p.username;
    result["pass"]     = p.password;
    return result;
}

bool ProfileManager::saveIpResult(const QString& id, const QJsonObject& ipData)
{
    QString now = QDateTime::currentDateTime().toString(Qt::ISODate);

    bool ok = m_db->exec(
        "UPDATE profiles SET "
        "  ip_address=?, ip_country=?, ip_country_code=?, ip_city=?, "
        "  ip_timezone=?, ip_asn=?, ip_isp=?, ip_score=?, ip_type=?, "
        "  ip_lat=?, ip_lng=?, ip_last_tested=? "
        "WHERE id=?",
        {
            ipData["ip"].toString(),
            ipData["country"].toString(),
            ipData["countryCode"].toString(),
            ipData["city"].toString(),
            ipData["timezone"].toString(),
            ipData["asn"].toString(),
            ipData["isp"].toString(),
            ipData["score"].toInt(0),
            ipData["type"].toString(),
            ipData["lat"].toDouble(),
            ipData["lng"].toDouble(),
            now,
            id
        }
    );

    if (ok) emit profileUpdated(id);
    return ok;
}

// ── Fingerprint ───────────────────────────────────────────────────────────

QJsonObject ProfileManager::getFingerprint(const QString& profileId)
{
    auto rows = m_db->query(
        "SELECT fingerprint_data FROM profiles WHERE id = ?",
        { profileId }
    );
    if (rows.isEmpty()) return {};
    QString json = rows.first()["fingerprint_data"].toString("{}");
    return QJsonDocument::fromJson(json.toUtf8()).object();
}

bool ProfileManager::saveFingerprint(const QString& profileId, const QJsonObject& fp)
{
    QString json = QJsonDocument(fp).toJson(QJsonDocument::Compact);
    bool ok = m_db->exec(
        "UPDATE profiles SET fingerprint_data = ? WHERE id = ?",
        { json, profileId }
    );
    if (ok) emit profileUpdated(profileId);
    return ok;
}

bool ProfileManager::setFingerprintKey(const QString& profileId,
                                        const QString& key,
                                        const QJsonValue& value)
{
    QJsonObject fp = getFingerprint(profileId);
    fp[key] = value;
    return saveFingerprint(profileId, fp);
}

// ── Status ────────────────────────────────────────────────────────────────

void ProfileManager::setProfileStatus(const QString& id, int status)
{
    m_db->exec("UPDATE profiles SET status = ? WHERE id = ?", { status, id });
    emit profileStatusChanged(id, status);
}

int ProfileManager::getProfileStatus(const QString& id)
{
    auto rows = m_db->query("SELECT status FROM profiles WHERE id = ?", { id });
    if (rows.isEmpty()) return 0;
    return rows.first()["status"].toInt();
}

void ProfileManager::touchLastUsed(const QString& id)
{
    QString now = QDateTime::currentDateTime().toString(Qt::ISODate);
    m_db->exec("UPDATE profiles SET last_used_at = ? WHERE id = ?", { now, id });
}

// ── Cookies & Extensions ──────────────────────────────────────────────────

QString ProfileManager::getCookies(const QString& id)
{
    auto rows = m_db->query("SELECT cookies FROM profiles WHERE id = ?", { id });
    if (rows.isEmpty()) return "[]";
    return rows.first()["cookies"].toString("[]");
}

bool ProfileManager::saveCookies(const QString& id, const QString& cookies)
{
    bool ok = m_db->exec("UPDATE profiles SET cookies = ? WHERE id = ?", { cookies, id });
    if (ok) emit profileUpdated(id);
    return ok;
}

QString ProfileManager::getExtensions(const QString& id)
{
    auto rows = m_db->query("SELECT extensions FROM profiles WHERE id = ?", { id });
    if (rows.isEmpty()) return "[]";
    return rows.first()["extensions"].toString("[]");
}

bool ProfileManager::saveExtensions(const QString& id, const QString& extensions)
{
    bool ok = m_db->exec("UPDATE profiles SET extensions = ? WHERE id = ?", { extensions, id });
    if (ok) emit profileUpdated(id);
    return ok;
}
