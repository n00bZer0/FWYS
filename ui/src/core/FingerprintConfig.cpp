#include "FingerprintConfig.h"
#include <QCryptographicHash>
#include <QJsonObject>
#include <QJsonArray>
#include <QRandomGenerator>

FingerprintConfig::FingerprintConfig(QObject* parent) : QObject(parent) {}

static uint32_t mulberry32(uint32_t& s) {
    s += 0x6D2B79F5;
    uint32_t t = s ^ (s >> 15);
    t = t * (1 | s);
    t ^= t + t * (61 | t);
    return t ^ (t >> 14);
}

static uint32_t seedFromProfileId(const QString& profileId) {
    QByteArray hash = QCryptographicHash::hash(
        profileId.toUtf8(), QCryptographicHash::Sha256
    );
    return *reinterpret_cast<const uint32_t*>(hash.constData());
}

QJsonObject FingerprintConfig::generateForProfile(const QString& profileId)
{
    uint32_t seed = seedFromProfileId(profileId);

    // GPU profiles
    const QStringList vendors   = { "Google Inc. (NVIDIA)", "Google Inc. (AMD)", "Google Inc. (Intel)" };
    const QStringList renderers = {
        "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)",
        "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Super Direct3D11 vs_5_0 ps_5_0)",
        "ANGLE (AMD, AMD Radeon RX 6600 XT Direct3D11 vs_5_0 ps_5_0)",
        "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)"
    };

    const QList<int> hw_options = { 4, 6, 8, 10, 12, 16 };
    const QList<double> mem_options = { 4.0, 8.0 };
    const QList<int> widths  = { 1920, 2560, 1440, 1366, 1600 };
    const QList<int> heights = { 1080, 1440, 900,  768,  900  };

    int gpuIdx     = mulberry32(seed) % vendors.size();
    int rendIdx    = mulberry32(seed) % renderers.size();
    int hwIdx      = mulberry32(seed) % hw_options.size();
    int memIdx     = mulberry32(seed) % mem_options.size();
    int scrnIdx    = mulberry32(seed) % widths.size();
    uint32_t canvasSeed = mulberry32(seed);
    uint32_t audioSeed  = mulberry32(seed);
    uint32_t fontSeed   = mulberry32(seed);

    QJsonObject fp;
    fp["webgl_vendor"]         = vendors[gpuIdx];
    fp["webgl_renderer"]       = renderers[rendIdx];
    fp["hardware_concurrency"] = hw_options[hwIdx];
    fp["device_memory"]        = mem_options[memIdx];
    fp["screen_width"]         = widths[scrnIdx];
    fp["screen_height"]        = heights[scrnIdx];
    fp["platform"]             = "Win32";
    fp["vendor"]               = "Google Inc.";
    fp["max_touch_points"]     = 0;
    fp["language"]             = "en-US";
    fp["canvas_seed"]          = (int)canvasSeed;
    fp["audio_seed"]           = (int)audioSeed;
    fp["font_seed"]            = (int)fontSeed;
    fp["webrtc_mode"]          = "filter_local";

    return fp;
}

QJsonObject FingerprintConfig::generateRandom()
{
    QString randomId = QString::number(QRandomGenerator::global()->generate64(), 16);
    return generateForProfile(randomId);
}

QString FingerprintConfig::summarize(const QJsonObject& fp)
{
    return QString("%1 | %2 CPUs | %3GB RAM | %4×%5")
        .arg(fp["webgl_vendor"].toString().split("(").last().remove(")"))
        .arg(fp["hardware_concurrency"].toInt())
        .arg(fp["device_memory"].toDouble())
        .arg(fp["screen_width"].toInt())
        .arg(fp["screen_height"].toInt());
}
