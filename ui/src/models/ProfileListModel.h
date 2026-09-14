#pragma once
#include <QAbstractListModel>
#include <QJsonObject>
#include <QVector>

class ProfileManager;

class ProfileListModel : public QAbstractListModel
{
    Q_OBJECT
    Q_PROPERTY(int count READ count NOTIFY countChanged)

public:
    enum Roles {
        IdRole = Qt::UserRole + 1,
        NameRole,
        ProxyRole,
        ProxyTypeRole,
        StatusRole,
        CreatedAtRole,
        OsTypeRole,
        IpAddressRole,
        CountryFlagRole,
        CountryCodeRole,
        RiskScoreRole,
        LastUsedAtRole,
    };

    explicit ProfileListModel(ProfileManager* pm, QObject* parent = nullptr);

    int rowCount(const QModelIndex& parent = QModelIndex()) const override;
    int count() const { return m_profiles.size(); }
    QVariant data(const QModelIndex& index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    // QML-callable: update status in-place (fast, no full refresh)
    Q_INVOKABLE void setStatus(const QString& profileId, int status);

public slots:
    Q_INVOKABLE void refresh();

signals:
    void countChanged();

private:
    ProfileManager* m_pm;
    QVector<QJsonObject> m_profiles;
};
