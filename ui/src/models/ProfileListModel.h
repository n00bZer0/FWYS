#pragma once
#include <QAbstractListModel>
#include <QJsonObject>
#include <QVector>

class ProfileManager;

class ProfileListModel : public QAbstractListModel
{
    Q_OBJECT

public:
    enum Roles {
        IdRole = Qt::UserRole + 1,
        NameRole,
        ProxyRole,
        ProxyTypeRole,
        StatusRole,
        CreatedAtRole,
    };

    explicit ProfileListModel(ProfileManager* pm, QObject* parent = nullptr);

    int rowCount(const QModelIndex& parent = QModelIndex()) const override;
    QVariant data(const QModelIndex& index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

public slots:
    void refresh();

private:
    ProfileManager* m_pm;
    QVector<QJsonObject> m_profiles;
};
