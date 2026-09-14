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
#include "core/IPCClient.h"
#include "models/ProfileListModel.h"

#include <QFile>
#include <QTextStream>
#include <QDateTime>

static void customLogHandler(QtMsgType type, const QMessageLogContext &context, const QString &msg)
{
    Q_UNUSED(context);
    QString level;
    switch (type) {
    case QtDebugMsg:    level = "[DEBUG]"; break;
    case QtInfoMsg:     level = "[INFO]"; break;
    case QtWarningMsg:  level = "[WARN]"; break;
    case QtCriticalMsg: level = "[CRIT]"; break;
    case QtFatalMsg:    level = "[FATAL]"; break;
    }
    QString line = QString("%1 %2 %3\n")
        .arg(QDateTime::currentDateTime().toString("yyyy-MM-dd hh:mm:ss.zzz"), level, msg);

    QFile file("fwys_debug.log");
    if (file.open(QIODevice::WriteOnly | QIODevice::Append | QIODevice::Text)) {
        QTextStream out(&file);
        out << line;
    }
}

int main(int argc, char *argv[])
{
    qInstallMessageHandler(customLogHandler);
    qInfo() << "=== FWYS Starting ===";

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
    BrowserLauncher launcher(&profileManager, &db);
    FingerprintConfig fingerprintConfig;
    IPCClient ipcClient;
    ipcClient.connectToServer();

    // QML models
    ProfileListModel profileModel(&profileManager);

    // QML engine
    QQmlApplicationEngine engine;

    // Expose C++ objects to QML
    engine.rootContext()->setContextProperty("profileManager", &profileManager);
    engine.rootContext()->setContextProperty("proxyManager", &proxyManager);
    engine.rootContext()->setContextProperty("browserLauncher", &launcher);
    engine.rootContext()->setContextProperty("fingerprintConfig", &fingerprintConfig);
    engine.rootContext()->setContextProperty("ipcClient", &ipcClient);
    engine.rootContext()->setContextProperty("profileModel", &profileModel);

    // App version info
    engine.rootContext()->setContextProperty("appVersion", "1.0.0");
    engine.rootContext()->setContextProperty("appName", "FWYS");

    // Load main QML
    QUrl url(u"qrc:/qt/qml/FWYS/qml/main.qml"_qs);
    if (!QFile::exists(url.toString().mid(3))) { // check :/qt/qml/...
        url = QUrl(u"qrc:/FWYS/qml/main.qml"_qs);
    }
    qInfo() << "Loading QML from:" << url;

    QObject::connect(
        &engine, &QQmlApplicationEngine::objectCreated,
        &app, [url](QObject *obj, const QUrl &objUrl) {
            if (!obj && url == objUrl) {
                qCritical() << "Failed to create root QML object for:" << objUrl;
                QCoreApplication::exit(-1);
            }
        },
        Qt::QueuedConnection
    );
    engine.load(url);

    return app.exec();
}
