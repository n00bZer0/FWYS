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
    case ProxyRole: {
        QString proxy = p["proxy_string"].toString();
        if (proxy.isEmpty()) {
            QString host = p["proxy_host"].toString();
            if (!host.isEmpty()) {
                int port = p["proxy_port"].toInt();
                proxy = port > 0 ? (host + ":" + QString::number(port)) : host;
            }
        }
        if (proxy.isEmpty()) {
            proxy = p["ip_address"].toString();
        }
        return proxy;
    }
    case ProxyTypeRole: {
        QString ptype = p["proxy_type"].toString();
        if ((ptype.isEmpty() || ptype == "none") && (!p["proxy_host"].toString().isEmpty() || !p["ip_address"].toString().isEmpty())) {
            ptype = "http";
        }
        return ptype;
    }
    case StatusRole:      return p["status"].toInt();
    case CreatedAtRole:   return p["created_at"].toString();
    case OsTypeRole:      return p["os_type"].toString("windows10");
    case IpAddressRole:   return p["ip_address"].toString();
    case CountryFlagRole: {
        QString code = p["ip_country_code"].toString().trimmed().toUpper();
        if (code.length() == 2 && code[0] >= 'A' && code[0] <= 'Z' && code[1] >= 'A' && code[1] <= 'Z') {
            QString flag;
            flag.append(QChar(0xD83C));
            flag.append(QChar(0xDDE6 + (code[0].toLatin1() - 'A')));
            flag.append(QChar(0xD83C));
            flag.append(QChar(0xDDE6 + (code[1].toLatin1() - 'A')));
            return flag;
        }
        return p["ip_country_flag"].toString();
    }
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

