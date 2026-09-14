#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QIcon>
#include <QFont>
#include <QFontDatabase>
#include <QtQuickControls2/QQuickStyle>

#include "core/App.h"
#include "core/ProfileManager.h"
#include "core/BrowserLauncher.h"
#include "core/ProxyManager.h"
#include "core/FingerprintConfig.h"
#include "core/DatabaseManager.h"
#include "models/ProfileListModel.h"

int main(int argc, char *argv[])
{
    // Enable high-DPI scaling
    QGuiApplication::setHighDpiScaleFactorRoundingPolicy(
        Qt::HighDpiScaleFactorRoundingPolicy::PassThrough
    );

    QGuiApplication app(argc, argv);
    app.setApplicationName("FWYS");
    app.setApplicationVersion("1.0.0");
    app.setOrganizationName("FWYS");
    app.setWindowIcon(QIcon(":/icons/logo.png"));

    // Use Material style for modern look
    QQuickStyle::setStyle("Material");

    // Initialize database
    DatabaseManager db;
    if (!db.initialize()) {
        qCritical() << "[DB] Failed to initialize database!";
        return 1;
    }

    // Initialize managers
    ProfileManager profileManager(&db);
    ProxyManager proxyManager;
    BrowserLauncher launcher(&profileManager);
    FingerprintConfig fingerprintConfig;

    // QML models
    ProfileListModel profileModel(&profileManager);

    // QML engine
    QQmlApplicationEngine engine;

    // Expose C++ objects to QML
    engine.rootContext()->setContextProperty("profileManager", &profileManager);
    engine.rootContext()->setContextProperty("proxyManager", &proxyManager);
    engine.rootContext()->setContextProperty("browserLauncher", &launcher);
    engine.rootContext()->setContextProperty("fingerprintConfig", &fingerprintConfig);
    engine.rootContext()->setContextProperty("profileModel", &profileModel);

    // App version info
    engine.rootContext()->setContextProperty("appVersion", "1.0.0");
    engine.rootContext()->setContextProperty("appName", "FWYS");

    // Load main QML
    const QUrl url(u"qrc:/FWYS/qml/main.qml"_qs);
    QObject::connect(
        &engine, &QQmlApplicationEngine::objectCreated,
        &app, [url](QObject *obj, const QUrl &objUrl) {
            if (!obj && url == objUrl) QCoreApplication::exit(-1);
        },
        Qt::QueuedConnection
    );
    engine.load(url);

    return app.exec();
}
