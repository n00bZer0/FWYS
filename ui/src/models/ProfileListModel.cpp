#include "ProfileListModel.h"
#include "core/ProfileManager.h"
#include <QJsonArray>
#include <QJsonObject>

ProfileListModel::ProfileListModel(ProfileManager* pm, QObject* parent)
    : QAbstractListModel(parent), m_pm(pm)
{
    refresh();

    // Connect signals
    connect(m_pm, &ProfileManager::profileCreated, this, [this](const QString&) { refresh(); });
    connect(m_pm, &ProfileManager::profileDeleted, this, [this](const QString&) { refresh(); });
    connect(m_pm, &ProfileManager::profileUpdated, this, [this](const QString&) { refresh(); });
    connect(m_pm, &ProfileManager::profileStatusChanged, this,
        [this](const QString& id, int status) {
            for (int i = 0; i < m_profiles.size(); ++i) {
                if (m_profiles[i]["id"].toString() == id) {
                    m_profiles[i]["status"] = status;
                    emit dataChanged(index(i), index(i), { StatusRole });
                    return;
                }
            }
        }
    );
}

void ProfileListModel::setStatus(const QString& profileId, int status)
{
    for (int i = 0; i < m_profiles.size(); ++i) {
        if (m_profiles[i]["id"].toString() == profileId) {
            m_profiles[i]["status"] = status;
            const QModelIndex idx = index(i);
            emit dataChanged(idx, idx, { StatusRole });
            return;
        }
    }
}

void ProfileListModel::refresh()
{
    beginResetModel();
    m_profiles.clear();
    QJsonArray arr = m_pm->getAllProfiles();
    for (const auto& v : arr) m_profiles.append(v.toObject());
    endResetModel();
    emit countChanged();
}

int ProfileListModel::rowCount(const QModelIndex& parent) const
{
    if (parent.isValid()) return 0;
    return m_profiles.size();
}

QVariant ProfileListModel::data(const QModelIndex& index, int role) const
{
    if (!index.isValid() || index.row() >= m_profiles.size()) return {};
    const QJsonObject& p = m_profiles[index.row()];

    switch (role) {
    case IdRole:          return p["id"].toString();
    case NameRole:        return p["name"].toString();
    case ProxyRole:       return p["proxy"].toString();
    case ProxyTypeRole:   return p["proxy_type"].toString();
    case StatusRole:      return p["status"].toInt();
    case CreatedAtRole:   return p["created_at"].toString();
    case OsTypeRole:      return p["os_type"].toString("windows10");
    case IpAddressRole:   return p["ip_address"].toString();
    case CountryFlagRole: return p["ip_country_flag"].toString();
    case CountryCodeRole: return p["ip_country_code"].toString();
    case RiskScoreRole:   return p["ip_score"].toInt(-1);
    case LastUsedAtRole:  return p["last_used_at"].toString();
    default:              return {};
    }
}

QHash<int, QByteArray> ProfileListModel::roleNames() const
{
    return {
        { IdRole,          "profileId" },
        { NameRole,        "profileName" },
        { ProxyRole,       "profileProxy" },
        { ProxyTypeRole,   "profileProxyType" },
        { StatusRole,      "profileStatus" },
        { CreatedAtRole,   "profileCreatedAt" },
        { OsTypeRole,      "profileOsType" },
        { IpAddressRole,   "profileIpAddress" },
        { CountryFlagRole, "profileCountryFlag" },
        { CountryCodeRole, "profileCountryCode" },
        { RiskScoreRole,   "profileRiskScore" },
        { LastUsedAtRole,  "profileLastUsed" },
    };
}

