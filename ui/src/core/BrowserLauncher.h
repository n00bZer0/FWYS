#pragma once
#include <QObject>
#include <QProcess>
#include <QMap>
#include <QString>
#include <QJsonObject>
#include <QStringList>

class ProfileManager;
class DatabaseManager;

class BrowserLauncher : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString chromiumPath READ chromiumPath WRITE setChromiumPath NOTIFY chromiumPathChanged)
    Q_PROPERTY(QString nodejsPath READ nodejsPath WRITE setNodejsPath NOTIFY nodejsPathChanged)

public:
    explicit BrowserLauncher(ProfileManager* profileManager,
                              DatabaseManager* db,
                              QObject* parent = nullptr);
    ~BrowserLauncher();

    QString chromiumPath() const { return m_chromiumPath; }
    void setChromiumPath(const QString& path);

    QString nodejsPath() const { return m_nodejsPath; }
    void setNodejsPath(const QString& path);

    // Launch browser for a profile (reads profile from DB)
    Q_INVOKABLE bool launchProfile(const QString& profileId);

    // Close browser for a profile
    Q_INVOKABLE bool closeProfile(const QString& profileId);

    // Check if profile browser is running
    Q_INVOKABLE bool isRunning(const QString& profileId);

    // Auto-detect chromium binary
    Q_INVOKABLE QString detectChromiumPath();

    // Auto-detect node.js
    Q_INVOKABLE QString detectNodePath();

    // Build the full command-line args list for a profile (for preview/debug)
    Q_INVOKABLE QStringList buildChromiumArgs(const QJsonObject& profile, int debugPort);

signals:
    void chromiumPathChanged();
    void nodejsPathChanged();
    void profileLaunched(const QString& profileId, int pid);
    void profileClosed(const QString& profileId);
    void launchError(const QString& profileId, const QString& error);

private:
    void startNodeIPC();
    void sendIPCCommand(const QString& event, const QJsonObject& payload);

    // Derive per-profile uint64 seed (canvas/audio noise)
    quint64 profileSeed(const QString& profileId, const QString& type) const;

    ProfileManager* m_profileManager;
    DatabaseManager* m_db;

    QString m_chromiumPath;
    QString m_nodejsPath;

    // profileId -> chrome process
    QMap<QString, QProcess*> m_processes;

    // Single shared Node.js injector process
    QProcess* m_nodeProcess = nullptr;

    // Next available debug port (starts from 9222)
    int m_nextDebugPort = 9222;
};
