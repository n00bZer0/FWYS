#pragma once
#include <QObject>
#include <QSqlDatabase>
#include <QJsonObject>
#include <QJsonArray>
#include <QVariantList>
#include <QStringList>
#include <QDir>

class DatabaseManager : public QObject
{
    Q_OBJECT

public:
    explicit DatabaseManager(QObject* parent = nullptr);
    ~DatabaseManager();

    bool initialize();

    // Execute a write query (INSERT/UPDATE/DELETE)
    bool exec(const QString& sql, const QVariantList& bindings = {});

    // Execute a SELECT query, returns list of JSON objects
    QList<QJsonObject> query(const QString& sql, const QVariantList& bindings = {});

    // Returns QJsonArray directly
    QJsonArray queryArray(const QString& sql, const QVariantList& bindings = {});

    // Path where per-profile user data is stored
    QString profilesDataPath() const;

private:
    void createSchema();
    QSqlDatabase m_db;
    QString m_dbPath;
    QString m_dataPath;
};
