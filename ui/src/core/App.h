#pragma once
#include <QObject>

class App : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString version READ version CONSTANT)

public:
    explicit App(QObject* parent = nullptr) : QObject(parent) {}
    QString version() const { return "1.0.0"; }
};
