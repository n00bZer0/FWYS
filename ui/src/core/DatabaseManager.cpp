#include "DatabaseManager.h"
#include <QSqlQuery>
#include <QSqlError>
#include <QSqlRecord>
#include <QStandardPaths>
#include <QDir>
#include <QCoreApplication>
#include <QDebug>
#include <QJsonValue>

DatabaseManager::DatabaseManager(QObject* parent) : QObject(parent)
{
    // Check if running in portable standalone mode (profiles adjacent to exe)
    QString appDir = QCoreApplication::applicationDirPath();
    if (QDir(appDir + "/profiles").exists()) {
        m_dataPath = appDir + "/profiles";
    } else if (QDir(appDir + "/../profiles").exists()) {
        m_dataPath = appDir + "/../profiles";
    } else if (QDir(QDir::currentPath() + "/../profiles").exists()) {
        m_dataPath = QDir::currentPath() + "/../profiles";
    } else {
        m_dataPath = appDir + "/profiles";
    }

    m_dbPath = m_dataPath + "/profiles.db";
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
    pragma.exec("PRAGMA synchronous=NORMAL");

    createSchema();
    migrateSchema();

    qDebug() << "[DB] Initialized at" << m_dbPath;
    return true;
}

void DatabaseManager::createSchema()
{
    QSqlQuery q(m_db);

    // Full profiles table with all fingerprint fields
    q.exec(R"SQL(
        CREATE TABLE IF NOT EXISTS profiles (
            id                  TEXT PRIMARY KEY,
            name                TEXT NOT NULL,
            notes               TEXT DEFAULT '',

            -- Proxy
            proxy_string        TEXT DEFAULT '',
            proxy_type          TEXT DEFAULT 'none',
            proxy_host          TEXT DEFAULT '',
            proxy_port          INTEGER DEFAULT 0,
            proxy_username      TEXT DEFAULT '',
            proxy_password      TEXT DEFAULT '',

            -- IP Test Result (from proxy)
            ip_address          TEXT DEFAULT '',
            ip_country          TEXT DEFAULT '',
            ip_country_code     TEXT DEFAULT '',
            ip_city             TEXT DEFAULT '',
            ip_timezone         TEXT DEFAULT '',
            ip_asn              TEXT DEFAULT '',
            ip_isp              TEXT DEFAULT '',
            ip_score            INTEGER DEFAULT -1,
            ip_type             TEXT DEFAULT '',
            ip_lat              REAL DEFAULT 0.0,
            ip_lng              REAL DEFAULT 0.0,
            ip_last_tested      TEXT DEFAULT '',

            -- OS & Browser selection
            os_type             TEXT DEFAULT 'windows10',
            browser_version     TEXT DEFAULT 'auto',

            -- Full fingerprint JSON blob (75+ params)
            fingerprint_data    TEXT DEFAULT '{}',

            -- Cookies & Extensions
            cookies             TEXT DEFAULT '[]',
            extensions          TEXT DEFAULT '[]',

            -- Metadata
            status              INTEGER DEFAULT 0,
            created_at          TEXT NOT NULL,
            last_used_at        TEXT NOT NULL,

            -- Legacy compat (keep for migration)
            proxy               TEXT DEFAULT '',
            proxy_type_old      TEXT DEFAULT 'none',
            fingerprint_overrides TEXT DEFAULT '{}'
        )
    )SQL");

    if (q.lastError().isValid()) {
        qWarning() << "[DB] Schema error:" << q.lastError().text();
    }

    // Proxy history table
    q.exec(R"SQL(
        CREATE TABLE IF NOT EXISTS proxy_history (
            id              TEXT PRIMARY KEY,
            proxy_string    TEXT NOT NULL,
            proxy_type      TEXT NOT NULL,
            proxy_host      TEXT NOT NULL,
            proxy_port      INTEGER NOT NULL,
            proxy_username  TEXT DEFAULT '',
            last_used_at    TEXT NOT NULL,
            last_ip         TEXT DEFAULT '',
            last_country    TEXT DEFAULT '',
            profile_count   INTEGER DEFAULT 0
        )
    )SQL");

    if (q.lastError().isValid()) {
        qWarning() << "[DB] proxy_history error:" << q.lastError().text();
    }
}

bool DatabaseManager::columnExists(const QString& table, const QString& column)
{
    QSqlQuery q(m_db);
    q.prepare(QString("PRAGMA table_info(%1)").arg(table));
    if (!q.exec()) return false;
    while (q.next()) {
        if (q.value("name").toString() == column) return true;
    }
    return false;
}

void DatabaseManager::migrateSchema()
{
    // Safe migration: add new columns to existing profiles table if they don't exist
    struct Migration {
        QString column;
        QString definition;
    };

    const QList<Migration> migrations = {
        { "proxy_string",    "TEXT DEFAULT ''" },
        { "proxy_host",      "TEXT DEFAULT ''" },
        { "proxy_port",      "INTEGER DEFAULT 0" },
        { "proxy_username",  "TEXT DEFAULT ''" },
        { "proxy_password",  "TEXT DEFAULT ''" },
        { "ip_address",      "TEXT DEFAULT ''" },
        { "ip_country",      "TEXT DEFAULT ''" },
        { "ip_country_code", "TEXT DEFAULT ''" },
        { "ip_city",         "TEXT DEFAULT ''" },
        { "ip_timezone",     "TEXT DEFAULT ''" },
        { "ip_asn",          "TEXT DEFAULT ''" },
        { "ip_isp",          "TEXT DEFAULT ''" },
        { "ip_score",        "INTEGER DEFAULT -1" },
        { "ip_type",         "TEXT DEFAULT ''" },
        { "ip_lat",          "REAL DEFAULT 0.0" },
        { "ip_lng",          "REAL DEFAULT 0.0" },
        { "ip_last_tested",  "TEXT DEFAULT ''" },
        { "os_type",         "TEXT DEFAULT 'windows10'" },
        { "browser_version", "TEXT DEFAULT 'auto'" },
        { "fingerprint_data","TEXT DEFAULT '{}'" },
        { "cookies",         "TEXT DEFAULT '[]'" },
        { "extensions",      "TEXT DEFAULT '[]'" },
    };

    for (const auto& m : migrations) {
        if (!columnExists("profiles", m.column)) {
            QSqlQuery q(m_db);
            QString sql = QString("ALTER TABLE profiles ADD COLUMN %1 %2")
                          .arg(m.column, m.definition);
            if (!q.exec(sql)) {
                qWarning() << "[DB] Migration failed for column" << m.column
                           << ":" << q.lastError().text();
            } else {
                qDebug() << "[DB] Migrated: added column" << m.column;
            }
        }
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
