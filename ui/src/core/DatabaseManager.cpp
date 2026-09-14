#include "DatabaseManager.h"
#include <QSqlQuery>
#include <QSqlError>
#include <QSqlRecord>
#include <QStandardPaths>
#include <QDir>
#include <QDebug>
#include <QJsonValue>

DatabaseManager::DatabaseManager(QObject* parent) : QObject(parent)
{
    // Store DB in project root /profiles/
    QString appDir = QDir::currentPath();
    m_dataPath  = appDir + "/../profiles";
    m_dbPath    = m_dataPath + "/profiles.db";
    QDir().mkpath(m_dataPath);
    QDir().mkpath(m_dataPath + "/user_data");
}

DatabaseManager::~DatabaseManager()
{
    if (m_db.isOpen()) m_db.close();
}

bool DatabaseManager::initialize()
{
    m_db = QSqlDatabase::addDatabase("QSQLITE", "fwys_db");
    m_db.setDatabaseName(m_dbPath);

    if (!m_db.open()) {
        qCritical() << "[DB] Cannot open:" << m_db.lastError().text();
        return false;
    }

    // WAL mode for better concurrent access (Node.js reads while Qt writes)
    QSqlQuery pragma(m_db);
    pragma.exec("PRAGMA journal_mode=WAL");
    pragma.exec("PRAGMA foreign_keys=ON");

    createSchema();
    qDebug() << "[DB] Initialized at" << m_dbPath;
    return true;
}

void DatabaseManager::createSchema()
{
    QSqlQuery q(m_db);

    // Profiles table
    q.exec(R"SQL(
        CREATE TABLE IF NOT EXISTS profiles (
            id                   TEXT PRIMARY KEY,
            name                 TEXT NOT NULL,
            proxy                TEXT DEFAULT '',
            proxy_type           TEXT DEFAULT 'none',
            proxy_username       TEXT DEFAULT '',
            proxy_password       TEXT DEFAULT '',
            notes                TEXT DEFAULT '',
            status               INTEGER DEFAULT 0,
            created_at           TEXT NOT NULL,
            last_used_at         TEXT NOT NULL,
            fingerprint_overrides TEXT DEFAULT '{}'
        )
    )SQL");

    if (q.lastError().isValid()) {
        qWarning() << "[DB] Schema error:" << q.lastError().text();
    }
}

bool DatabaseManager::exec(const QString& sql, const QVariantList& bindings)
{
    QSqlQuery q(m_db);
    q.prepare(sql);
    for (int i = 0; i < bindings.size(); ++i) {
        q.bindValue(i, bindings[i]);
    }
    if (!q.exec()) {
        qWarning() << "[DB] Exec error:" << q.lastError().text() << "\nSQL:" << sql;
        return false;
    }
    return true;
}

QList<QJsonObject> DatabaseManager::query(const QString& sql, const QVariantList& bindings)
{
    QList<QJsonObject> results;
    QSqlQuery q(m_db);
    q.prepare(sql);
    for (int i = 0; i < bindings.size(); ++i) {
        q.bindValue(i, bindings[i]);
    }
    if (!q.exec()) {
        qWarning() << "[DB] Query error:" << q.lastError().text();
        return results;
    }

    QSqlRecord rec = q.record();
    while (q.next()) {
        QJsonObject row;
        for (int i = 0; i < rec.count(); ++i) {
            QVariant val = q.value(i);
            row[rec.fieldName(i)] = QJsonValue::fromVariant(val);
        }
        results.append(row);
    }
    return results;
}

QJsonArray DatabaseManager::queryArray(const QString& sql, const QVariantList& bindings)
{
    QJsonArray arr;
    for (const QJsonObject& obj : query(sql, bindings)) {
        arr.append(obj);
    }
    return arr;
}

QString DatabaseManager::profilesDataPath() const
{
    return m_dataPath + "/user_data";
}
