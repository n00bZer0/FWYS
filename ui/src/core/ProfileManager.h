#pragma once
#include <QObject>
#include <QString>
#include <QJsonObject>

class DatabaseManager;

struct Profile {
    QString id;
    QString name;
    QString proxy;
    QString proxyType;       // "http", "socks5", "none"
    QString proxyUsername;
    QString proxyPassword;
    QString notes;
    QString createdAt;
    QString lastUsedAt;
    int status;              // 0=idle, 1=running, 2=error
    QJsonObject fingerprintOverrides;
};

class ProfileManager : public QObject
{
    Q_OBJECT

public:
    explicit ProfileManager(DatabaseManager* db, QObject* parent = nullptr);

    // CRUD
    Q_INVOKABLE bool createProfile(const QString& name,
                                   const QString& proxy = QString(),
                                   const QString& proxyType = "none");
    Q_INVOKABLE bool updateProfile(const QString& id, const QJsonObject& data);
    Q_INVOKABLE bool deleteProfile(const QString& id);
    Q_INVOKABLE QJsonObject getProfile(const QString& id);
    Q_INVOKABLE QJsonArray getAllProfiles();

    // Fingerprint
    Q_INVOKABLE QJsonObject getFingerprint(const QString& profileId);
    Q_INVOKABLE bool setFingerprintOverride(const QString& profileId,
                                             const QString& key,
                                             const QJsonValue& value);

    // Status
    Q_INVOKABLE void setProfileStatus(const QString& id, int status);
    Q_INVOKABLE int getProfileStatus(const QString& id);

    // Count
    Q_INVOKABLE int profileCount();

signals:
    void profileCreated(const QString& id);
    void profileUpdated(const QString& id);
    void profileDeleted(const QString& id);
    void profileStatusChanged(const QString& id, int status);

private:
    DatabaseManager* m_db;
};
