#include "ProfileManager.h"
#include "DatabaseManager.h"

#include <QUuid>
#include <QDateTime>
#include <QJsonArray>
#include <QJsonDocument>
#include <QDebug>

ProfileManager::ProfileManager(DatabaseManager* db, QObject* parent)
    : QObject(parent), m_db(db)
{}

bool ProfileManager::createProfile(const QString& name,
                                    const QString& proxy,
                                    const QString& proxyType)
{
    QString id = QUuid::createUuid().toString(QUuid::WithoutBraces);
    QString now = QDateTime::currentDateTime().toString(Qt::ISODate);

    bool ok = m_db->exec(
        "INSERT INTO profiles (id, name, proxy, proxy_type, status, created_at, last_used_at, fingerprint_overrides) "
        "VALUES (?, ?, ?, ?, 0, ?, ?, ?)",
        { id, name, proxy, proxyType, now, now, "{}" }
    );

    if (ok) {
        qDebug() << "[ProfileManager] Created profile:" << name << id;
        emit profileCreated(id);

        // Create user-data directory for this profile
        QDir().mkpath(m_db->profilesDataPath() + "/" + id);
    }
    return ok;
}

bool ProfileManager::updateProfile(const QString& id, const QJsonObject& data)
{
    // Build dynamic update query from provided fields
    QStringList setClauses;
    QVariantList values;

    const QStringList allowed = { "name", "proxy", "proxy_type",
                                   "proxy_username", "proxy_password", "notes" };
    for (const QString& key : allowed) {
        if (data.contains(key)) {
            setClauses << (key + " = ?");
            values << data[key].toVariant();
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
        // Remove user data directory
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
    return rows.first();
}

QJsonArray ProfileManager::getAllProfiles()
{
    return m_db->queryArray(
        "SELECT id, name, proxy, proxy_type, status, created_at, last_used_at "
        "FROM profiles ORDER BY created_at DESC"
    );
}

QJsonObject ProfileManager::getFingerprint(const QString& profileId)
{
    auto rows = m_db->query(
        "SELECT fingerprint_overrides FROM profiles WHERE id = ?",
        { profileId }
    );
    if (rows.isEmpty()) return {};
    QString json = rows.first()["fingerprint_overrides"].toString();
    return QJsonDocument::fromJson(json.toUtf8()).object();
}

bool ProfileManager::setFingerprintOverride(const QString& profileId,
                                              const QString& key,
                                              const QJsonValue& value)
{
    QJsonObject current = getFingerprint(profileId);
    current[key] = value;
    QString json = QJsonDocument(current).toJson(QJsonDocument::Compact);

    bool ok = m_db->exec(
        "UPDATE profiles SET fingerprint_overrides = ? WHERE id = ?",
        { json, profileId }
    );
    if (ok) emit profileUpdated(profileId);
    return ok;
}

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

int ProfileManager::profileCount()
{
    auto rows = m_db->query("SELECT COUNT(*) as cnt FROM profiles");
    if (rows.isEmpty()) return 0;
    return rows.first()["cnt"].toInt();
}
