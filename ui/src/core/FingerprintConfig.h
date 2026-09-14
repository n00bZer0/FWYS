#pragma once
#include <QObject>
#include <QJsonObject>
#include <QString>

/**
 * FingerprintConfig — generates fingerprint profile data for a given profile.
 * Calls into the same deterministic algorithm as Node.js FingerprintGenerator.
 */
class FingerprintConfig : public QObject
{
    Q_OBJECT

public:
    explicit FingerprintConfig(QObject* parent = nullptr);

    // Generate fingerprint for a profile (deterministic from profileId)
    Q_INVOKABLE QJsonObject generateForProfile(const QString& profileId);

    // Generate a completely random fingerprint
    Q_INVOKABLE QJsonObject generateRandom();

    // Get human-readable summary of fingerprint
    Q_INVOKABLE QString summarize(const QJsonObject& fingerprint);
};
