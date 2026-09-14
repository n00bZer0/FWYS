#pragma once
#include <QObject>
#include <QString>
#include <QJsonObject>
#include <QJsonArray>
#include "ProxyParser.h"

class DatabaseManager;

// ─── Profile struct — complete data model ─────────────────────────────────
struct Profile {
    // Identity
    QString id;
    QString name;
    QString notes;

    // Proxy
    QString proxyString;        // raw pasted string
    ProxyType proxyType = ProxyType::None;
    QString proxyTypeStr = "none";
    QString proxyHost;
    int     proxyPort = 0;
    QString proxyUsername;
    QString proxyPassword;

    // IP Test Result
    QString ipAddress;
    QString ipCountry;
    QString ipCountryCode;
    QString ipCity;
    QString ipTimezone;
    QString ipAsn;
    QString ipIsp;
    int     ipScore = -1;       // -1 = not tested, 0-100 = risk score
    QString ipType;             // residential / datacenter / mobile / vpn
    double  ipLat = 0.0;
    double  ipLng = 0.0;
    QString ipLastTested;

    // OS & Browser
    QString osType = "windows10";       // windows10 / windows11 / linux
    QString browserVersion = "auto";

    // Full fingerprint JSON (75+ params)
    QJsonObject fingerprintData;

    // Cookies & Extensions
    QString cookies = "[]";
    QString extensions = "[]";

    // Metadata
    int     status = 0;         // 0=idle 1=running 2=error
    QString createdAt;
    QString lastUsedAt;

    // Convert to/from JSON for IPC & storage
    QJsonObject toJson() const;
    static Profile fromJson(const QJsonObject& j);
};

// ─── ProfileManager ────────────────────────────────────────────────────────
class ProfileManager : public QObject
{
    Q_OBJECT

public:
    explicit ProfileManager(DatabaseManager* db, QObject* parent = nullptr);

    // ── CRUD ──
    Q_INVOKABLE bool        createProfile(const QString& name);
    Q_INVOKABLE QString     createProfileWithData(const QJsonObject& data);
    Q_INVOKABLE bool        updateProfile(const QString& id, const QJsonObject& data);
    Q_INVOKABLE bool        deleteProfile(const QString& id);
    Q_INVOKABLE QJsonObject getProfile(const QString& id);
    Q_INVOKABLE QJsonArray  getAllProfiles();
    Q_INVOKABLE int         profileCount();

    // ── Proxy ──
    // Parse proxy string and save parsed fields to DB
    Q_INVOKABLE QJsonObject parseProxy(const QString& proxyString);
    // Save IP test result into profile
    Q_INVOKABLE bool        saveIpResult(const QString& id, const QJsonObject& ipData);

    // ── Fingerprint ──
    Q_INVOKABLE QJsonObject getFingerprint(const QString& profileId);
    Q_INVOKABLE bool        saveFingerprint(const QString& profileId, const QJsonObject& fp);
    // Convenience: update a single key inside fingerprint_data
    Q_INVOKABLE bool        setFingerprintKey(const QString& profileId,
                                              const QString& key,
                                              const QJsonValue& value);

    // ── Cookies & Extensions ──
    Q_INVOKABLE QString     getCookies(const QString& id);
    Q_INVOKABLE bool        saveCookies(const QString& id, const QString& cookies);
    Q_INVOKABLE QString     getExtensions(const QString& id);
    Q_INVOKABLE bool        saveExtensions(const QString& id, const QString& extensions);

    // ── Status ──
    Q_INVOKABLE void setProfileStatus(const QString& id, int status);
    Q_INVOKABLE int  getProfileStatus(const QString& id);

    // ── Launch metadata ──
    Q_INVOKABLE void touchLastUsed(const QString& id);

signals:
    void profileCreated(const QString& id);
    void profileUpdated(const QString& id);
    void profileDeleted(const QString& id);
    void profileStatusChanged(const QString& id, int status);

private:
    DatabaseManager* m_db;

    // Fields allowed in updateProfile()
    static const QStringList s_allowedFields;
};
