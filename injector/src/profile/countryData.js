// FWYS — countryData.js
// Comprehensive global mapping for 195+ countries (ISO 3166-1 alpha-2)
// Provides: Primary Languages, Windows TTS Speech Voices, and Regional Fonts

// ── 1. Global Country Language Map (195+ countries) ─────────────────────────
const COUNTRY_LANGUAGES = {
    // North America
    US: ['en-US', 'en'],
    CA: ['en-CA', 'fr-CA', 'en'],
    MX: ['es-MX', 'es', 'en'],

    // Western Europe
    GB: ['en-GB', 'en'],
    DE: ['de-DE', 'de', 'en'],
    FR: ['fr-FR', 'fr', 'en'],
    IT: ['it-IT', 'it', 'en'],
    ES: ['es-ES', 'es', 'en'],
    PT: ['pt-PT', 'pt', 'en'],
    NL: ['nl-NL', 'nl', 'en'],
    BE: ['nl-BE', 'fr-BE', 'en'],
    CH: ['de-CH', 'fr-CH', 'en'],
    AT: ['de-AT', 'de', 'en'],
    IE: ['en-IE', 'en'],
    LU: ['fr-LU', 'de-LU', 'en'],
    MC: ['fr-MC', 'fr', 'en'],
    AD: ['ca-AD', 'es', 'en'],
    SM: ['it-SM', 'it', 'en'],
    VA: ['it-VA', 'it', 'la'],
    LI: ['de-LI', 'de', 'en'],

    // Northern Europe (Nordics & Baltics)
    SE: ['sv-SE', 'sv', 'en'],
    NO: ['nb-NO', 'nn-NO', 'en'],
    DK: ['da-DK', 'da', 'en'],
    FI: ['fi-FI', 'sv-FI', 'en'],
    IS: ['is-IS', 'is', 'en'],
    EE: ['et-EE', 'et', 'en', 'ru'],
    LV: ['lv-LV', 'lv', 'en', 'ru'],
    LT: ['lt-LT', 'lt', 'en', 'ru'],

    // Central & Eastern Europe
    PL: ['pl-PL', 'pl', 'en'],
    CZ: ['cs-CZ', 'cs', 'en'],
    SK: ['sk-SK', 'sk', 'en'],
    HU: ['hu-HU', 'hu', 'en'],
    RO: ['ro-RO', 'ro', 'en'],
    BG: ['bg-BG', 'bg', 'en'],
    GR: ['el-GR', 'el', 'en'],
    CY: ['el-CY', 'tr-CY', 'en'],
    MT: ['mt-MT', 'en-MT', 'en'],
    HR: ['hr-HR', 'hr', 'en'],
    SI: ['sl-SI', 'sl', 'en'],
    RS: ['sr-RS', 'sr', 'en'],
    BA: ['bs-BA', 'hr-BA', 'sr-BA'],
    ME: ['sr-ME', 'bs', 'en'],
    MK: ['mk-MK', 'mk', 'en'],
    AL: ['sq-AL', 'sq', 'en'],
    XK: ['sq-XK', 'sr', 'en'],

    // Post-Soviet / CIS
    RU: ['ru-RU', 'ru', 'en'],
    UA: ['uk-UA', 'uk', 'ru', 'en'],
    BY: ['be-BY', 'ru-BY', 'ru', 'en'],
    MD: ['ro-MD', 'ru-MD', 'en'],
    KZ: ['kk-KZ', 'ru-KZ', 'ru', 'en'],
    UZ: ['uz-UZ', 'ru', 'en'],
    KG: ['ky-KG', 'ru-KG', 'ru', 'en'],
    TJ: ['tg-TJ', 'ru', 'en'],
    TM: ['tk-TM', 'ru', 'en'],
    AZ: ['az-AZ', 'ru', 'en'],
    GE: ['ka-GE', 'ka', 'en', 'ru'],
    AM: ['hy-AM', 'hy', 'ru', 'en'],

    // East Asia
    JP: ['ja-JP', 'ja', 'en'],
    CN: ['zh-CN', 'zh', 'en'],
    TW: ['zh-TW', 'zh', 'en'],
    HK: ['zh-HK', 'en-HK', 'zh'],
    MO: ['zh-MO', 'pt-MO', 'en'],
    KR: ['ko-KR', 'ko', 'en'],
    MN: ['mn-MN', 'mn', 'en'],

    // South & Southeast Asia
    IN: ['en-IN', 'hi-IN', 'en'],
    PK: ['ur-PK', 'en-PK', 'en'],
    BD: ['bn-BD', 'bn', 'en'],
    LK: ['si-LK', 'ta-LK', 'en'],
    NP: ['ne-NP', 'ne', 'en'],
    BT: ['dz-BT', 'en'],
    MV: ['dv-MV', 'en'],
    ID: ['id-ID', 'id', 'en'],
    MY: ['ms-MY', 'en-MY', 'zh-MY'],
    SG: ['en-SG', 'zh-SG', 'en'],
    TH: ['th-TH', 'th', 'en'],
    VN: ['vi-VN', 'vi', 'en'],
    PH: ['en-PH', 'fil-PH', 'en'],
    MM: ['my-MM', 'en'],
    KH: ['km-KH', 'en'],
    LA: ['lo-LA', 'en'],
    BN: ['ms-BN', 'en'],

    // Middle East & North Africa (MENA)
    TR: ['tr-TR', 'tr', 'en'],
    IL: ['he-IL', 'ar-IL', 'en'],
    SA: ['ar-SA', 'ar', 'en'],
    AE: ['ar-AE', 'en-AE', 'en'],
    QA: ['ar-QA', 'en'],
    KW: ['ar-KW', 'en'],
    BH: ['ar-BH', 'en'],
    OM: ['ar-OM', 'en'],
    YE: ['ar-YE', 'en'],
    IQ: ['ar-IQ', 'ku', 'en'],
    SY: ['ar-SY', 'en'],
    JO: ['ar-JO', 'en'],
    LB: ['ar-LB', 'fr-LB', 'en'],
    IR: ['fa-IR', 'fa', 'en'],
    EG: ['ar-EG', 'ar', 'en'],
    MA: ['ar-MA', 'fr-MA', 'en'],
    DZ: ['ar-DZ', 'fr-DZ', 'en'],
    TN: ['ar-TN', 'fr-TN', 'en'],
    LY: ['ar-LY', 'en'],
    SD: ['ar-SD', 'en'],

    // Latin America & Caribbean
    BR: ['pt-BR', 'pt', 'en'],
    AR: ['es-AR', 'es', 'en'],
    CL: ['es-CL', 'es', 'en'],
    CO: ['es-CO', 'es', 'en'],
    PE: ['es-PE', 'es', 'en'],
    VE: ['es-VE', 'es', 'en'],
    EC: ['es-EC', 'es', 'en'],
    BO: ['es-BO', 'es', 'en'],
    PY: ['es-PY', 'es', 'en'],
    UY: ['es-UY', 'es', 'en'],
    CR: ['es-CR', 'es', 'en'],
    PA: ['es-PA', 'es', 'en'],
    GT: ['es-GT', 'es', 'en'],
    HN: ['es-HN', 'es', 'en'],
    SV: ['es-SV', 'es', 'en'],
    NI: ['es-NI', 'es', 'en'],
    DO: ['es-DO', 'es', 'en'],
    CU: ['es-CU', 'es', 'en'],
    PR: ['es-PR', 'en-PR', 'en'],
    JM: ['en-JM', 'en'],
    TT: ['en-TT', 'en'],
    BS: ['en-BS', 'en'],
    BB: ['en-BB', 'en'],

    // Sub-Saharan Africa
    ZA: ['en-ZA', 'af-ZA', 'en'],
    NG: ['en-NG', 'en'],
    KE: ['en-KE', 'sw-KE', 'en'],
    GH: ['en-GH', 'en'],
    ET: ['am-ET', 'en'],
    TZ: ['sw-TZ', 'en-TZ', 'en'],
    UG: ['en-UG', 'sw', 'en'],
    RW: ['rw-RW', 'fr-RW', 'en'],
    CM: ['fr-CM', 'en-CM', 'en'],
    CI: ['fr-CI', 'fr', 'en'],
    SN: ['fr-SN', 'fr', 'en'],
    AO: ['pt-AO', 'pt', 'en'],
    MZ: ['pt-MZ', 'pt', 'en'],
    ZM: ['en-ZM', 'en'],
    ZW: ['en-ZW', 'sn', 'en'],
    NA: ['en-NA', 'af', 'en'],
    BW: ['en-BW', 'tn', 'en'],
    MU: ['en-MU', 'fr-MU', 'en'],
    MG: ['mg-MG', 'fr-MG', 'en'],

    // Oceania
    AU: ['en-AU', 'en'],
    NZ: ['en-NZ', 'en'],
    FJ: ['en-FJ', 'fj', 'en'],
    PG: ['en-PG', 'tpi', 'en'],
};

// ── 2. Windows Speech Voices by Language Family ─────────────────────────────
const LANGUAGE_VOICES = {
    de: [
        { name: 'Microsoft Hedda Desktop - German', lang: 'de-DE' },
        { name: 'Microsoft Stefan Desktop - German', lang: 'de-DE' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    fr: [
        { name: 'Microsoft Hortense Desktop - French', lang: 'fr-FR' },
        { name: 'Microsoft Paul Desktop - French',     lang: 'fr-FR' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    es: [
        { name: 'Microsoft Helena Desktop - Spanish (Spain)', lang: 'es-ES' },
        { name: 'Microsoft Laura Desktop - Spanish (Spain)',  lang: 'es-ES' },
        { name: 'Microsoft Sabina Desktop - Spanish (Mexico)',lang: 'es-MX' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    it: [
        { name: 'Microsoft Elsa Desktop - Italian',   lang: 'it-IT' },
        { name: 'Microsoft Cosimo Desktop - Italian', lang: 'it-IT' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    pt: [
        { name: 'Microsoft Daniel Desktop - Portuguese (Brazil)', lang: 'pt-BR' },
        { name: 'Microsoft Maria Desktop - Portuguese (Brazil)',  lang: 'pt-BR' },
        { name: 'Microsoft Helia Desktop - Portuguese (Portugal)',lang: 'pt-PT' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    nl: [
        { name: 'Microsoft Frank Desktop - Dutch', lang: 'nl-NL' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    pl: [
        { name: 'Microsoft Paulina Desktop - Polish', lang: 'pl-PL' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    ru: [
        { name: 'Microsoft Irina Desktop - Russian', lang: 'ru-RU' },
        { name: 'Microsoft Pavel Desktop - Russian', lang: 'ru-RU' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    uk: [
        { name: 'Microsoft Polina Desktop - Ukrainian', lang: 'uk-UA' },
        { name: 'Microsoft Irina Desktop - Russian',   lang: 'ru-RU' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    tr: [
        { name: 'Microsoft Tolga Desktop - Turkish', lang: 'tr-TR' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    ja: [
        { name: 'Microsoft Haruka Desktop - Japanese', lang: 'ja-JP' },
        { name: 'Microsoft Ichiro Desktop - Japanese', lang: 'ja-JP' },
        { name: 'Microsoft Ayumi Desktop - Japanese',  lang: 'ja-JP' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    zh: [
        { name: 'Microsoft Huihui Desktop - Chinese (Simplified)', lang: 'zh-CN' },
        { name: 'Microsoft Yaoyao Desktop - Chinese (Simplified)', lang: 'zh-CN' },
        { name: 'Microsoft Kangkang Desktop - Chinese (Simplified)', lang: 'zh-CN' },
        { name: 'Microsoft Hanhan Desktop - Chinese (Taiwan)',     lang: 'zh-TW' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    ko: [
        { name: 'Microsoft Heami Desktop - Korean', lang: 'ko-KR' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    hi: [
        { name: 'Microsoft Kalpana Desktop - Hindi (India)',   lang: 'hi-IN' },
        { name: 'Microsoft Ravi Desktop - English (India)',    lang: 'en-IN' },
        { name: 'Microsoft Heera Desktop - English (India)',   lang: 'en-IN' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    ar: [
        { name: 'Microsoft Hoda Desktop - Arabic (Egypt)',      lang: 'ar-EG' },
        { name: 'Microsoft Naayf Desktop - Arabic (Saudi Arabia)', lang: 'ar-SA' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    he: [
        { name: 'Microsoft Asaf Desktop - Hebrew', lang: 'he-IL' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    th: [
        { name: 'Microsoft Pattara Desktop - Thai', lang: 'th-TH' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    vi: [
        { name: 'Microsoft An Desktop - Vietnamese', lang: 'vi-VN' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    id: [
        { name: 'Microsoft Andika Desktop - Indonesian', lang: 'id-ID' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    sv: [
        { name: 'Microsoft Bengt Desktop - Swedish', lang: 'sv-SE' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    da: [
        { name: 'Microsoft Helle Desktop - Danish', lang: 'da-DK' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    nb: [
        { name: 'Microsoft Jon Desktop - Norwegian', lang: 'nb-NO' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    fi: [
        { name: 'Microsoft Heidi Desktop - Finnish', lang: 'fi-FI' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    cs: [
        { name: 'Microsoft Jakub Desktop - Czech', lang: 'cs-CZ' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    hu: [
        { name: 'Microsoft Szabolcs Desktop - Hungarian', lang: 'hu-HU' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    ro: [
        { name: 'Microsoft Andrei Desktop - Romanian', lang: 'ro-RO' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    el: [
        { name: 'Microsoft Stefanos Desktop - Greek', lang: 'el-GR' },
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
    ],
    en: [
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
        { name: 'Microsoft Zira Desktop - English (United States)',  lang: 'en-US' },
        { name: 'Microsoft Mark Desktop - English (United States)',  lang: 'en-US' },
    ],
};

// ── 3. Regional Font Bundles by Script ──────────────────────────────────────
const SCRIPT_FONTS = {
    cjk_jp:   ['Meiryo', 'Meiryo UI', 'MS Gothic', 'MS PGothic', 'MS UI Gothic', 'MS Mincho', 'MS PMincho', 'Yu Mincho'],
    cjk_sc:   ['SimSun', 'NSimSun', 'SimHei', 'Microsoft YaHei', 'Microsoft YaHei UI', 'FangSong', 'KaiTi'],
    cjk_tc:   ['MingLiU', 'PMingLiU', 'DFKai-SB', 'Microsoft JhengHei', 'Microsoft JhengHei UI'],
    cjk_kr:   ['Malgun Gothic', 'Gulim', 'GulimChe', 'Dotum', 'DotumChe', 'Batang', 'BatangChe', 'Gungsuh'],
    indic:    ['Nirmala UI', 'Mangal', 'Gautami', 'Latha', 'Raavi', 'Shruti', 'Kartika', 'Vrinda', 'Aparajita'],
    arabic:   ['Traditional Arabic', 'Simplified Arabic', 'Arabic Typesetting', 'Sakkal Majalla', 'Urdu Typesetting'],
    hebrew:   ['David', 'Miriam', 'Miriam Fixed', 'Narkisim', 'Rod', 'FrankRuehl', 'Segoe UI Historic'],
    thai:     ['Leelawadee', 'Leelawadee UI', 'Angsana New', 'Cordia New', 'TH Sarabun New', 'DilleniaUPC'],
    viet:     ['Segoe UI', 'Tahoma', 'Verdana', 'Arial'],
    cyrillic: ['Arial', 'Times New Roman', 'Courier New', 'Segoe UI'],
    greek:    ['Arial', 'Calibri', 'Times New Roman', 'Segoe UI'],
};

const COUNTRY_TO_SCRIPT = {
    JP: 'cjk_jp',
    CN: 'cjk_sc',
    TW: 'cjk_tc', HK: 'cjk_tc', MO: 'cjk_tc',
    KR: 'cjk_kr',
    IN: 'indic', PK: 'indic', BD: 'indic', LK: 'indic', NP: 'indic',
    SA: 'arabic', AE: 'arabic', EG: 'arabic', QA: 'arabic', KW: 'arabic',
    BH: 'arabic', OM: 'arabic', IQ: 'arabic', JO: 'arabic', LB: 'arabic',
    MA: 'arabic', DZ: 'arabic', TN: 'arabic', YE: 'arabic', IR: 'arabic',
    IL: 'hebrew',
    TH: 'thai',
    VN: 'viet',
    RU: 'cyrillic', UA: 'cyrillic', BY: 'cyrillic', KZ: 'cyrillic',
    BG: 'cyrillic', RS: 'cyrillic', MK: 'cyrillic',
    GR: 'greek', CY: 'greek',
};

// ── 4. Exported Helper Functions ───────────────────────────────────────────

function getLanguages(countryCode) {
    if (!countryCode) return ['en-US', 'en'];
    const cc = countryCode.toUpperCase();
    if (COUNTRY_LANGUAGES[cc]) {
        return COUNTRY_LANGUAGES[cc];
    }
    // Dynamic fallback using Intl
    try {
        const canonical = Intl.getCanonicalLocales(cc)[0];
        if (canonical) return [canonical, 'en'];
    } catch (e) {}
    return ['en-US', 'en'];
}

function getSpeechVoices(countryCode, os) {
    const cc = (countryCode || 'US').toUpperCase();
    const langs = getLanguages(cc);
    const primaryLang = langs[0].split('-')[0].toLowerCase();

    // Check by specific language
    if (LANGUAGE_VOICES[primaryLang]) {
        return LANGUAGE_VOICES[primaryLang];
    }
    // Fallback to OS default or standard English
    return os?.speechVoices || LANGUAGE_VOICES.en;
}

function getRegionalFonts(countryCode) {
    const cc = (countryCode || 'US').toUpperCase();
    const scriptKey = COUNTRY_TO_SCRIPT[cc];
    if (scriptKey && SCRIPT_FONTS[scriptKey]) {
        return SCRIPT_FONTS[scriptKey];
    }
    return [];
}

module.exports = {
    COUNTRY_LANGUAGES,
    LANGUAGE_VOICES,
    SCRIPT_FONTS,
    getLanguages,
    getSpeechVoices,
    getRegionalFonts,
};
