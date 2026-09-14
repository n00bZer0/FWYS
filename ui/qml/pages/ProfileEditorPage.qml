import QtQuick 2.15
import QtQuick.Layouts 1.15
import QtQuick.Controls 2.15

// ─── ProfileEditorPage ────────────────────────────────────────────────────
// Full 5-tab profile editor:
//   Tab 0: Basic        — name, notes, OS, browser version
//   Tab 1: Proxy        — paste string, auto-parse, test, IP result
//   Tab 2: Fingerprint  — screen, hardware, GPU, canvas/audio noise
//   Tab 3: Geo          — coordinates, accuracy, mode
//   Tab 4: Extensions   — per-profile extension list (placeholder)

Item {
    id: root

    property string profileId: ""
    signal back()

    // Profile state (loaded from DB or defaults)
    property var profile: ({
        name: "",
        notes: "",
        proxy_string: "",
        proxy_type: "none",
        proxy_host: "",
        proxy_port: 0,
        proxy_username: "",
        proxy_password: "",
        ip_address: "",
        ip_country: "",
        ip_country_code: "",
        ip_city: "",
        ip_timezone: "",
        ip_asn: "",
        ip_isp: "",
        ip_score: -1,
        ip_type: "",
        ip_lat: 0,
        ip_lng: 0,
        ip_last_tested: "",
        os_type: "windows10",
        browser_version: "auto",
        fingerprint_data: {},
        cookies: "[]",
        extensions: "[]"
    })

    property bool isNew: profileId === ""
    property bool proxyTesting: false
    property bool fpGenerating: false
    property string statusMsg: ""
    property bool statusOk: true

    property var extensionsList: []
    property int cookieCount: 0
    property string cookieFormat: "None"

    // ── Load profile on open or ID change ──
    onProfileIdChanged: loadProfile()
    Component.onCompleted: loadProfile()

    function analyzeCookies(text) {
        if (!text || !text.trim() || text.trim() === "[]") {
            cookieCount = 0
            cookieFormat = "Empty"
            return
        }
        var str = text.trim()
        if (str.startsWith("[") || str.startsWith("{")) {
            try {
                var j = JSON.parse(str)
                var arr = Array.isArray(j) ? j : [j]
                cookieCount = arr.length
                cookieFormat = "JSON (" + cookieCount + " cookies)"
                return
            } catch(e) {}
        }
        var lines = str.split("\n")
        var count = 0
        for (var i = 0; i < lines.length; i++) {
            var l = lines[i].trim()
            if (!l || l.startsWith("#") || l.startsWith("//")) continue
            var parts = l.split("\t")
            if (parts.length >= 7) count++
        }
        if (count > 0) {
            cookieCount = count
            cookieFormat = "Netscape (" + count + " cookies)"
        } else {
            cookieCount = 0
            cookieFormat = "Raw / Custom"
        }
    }

    function loadProfile() {
        if (!isNew && typeof profileManager !== 'undefined') {
            var data = profileManager.getProfile(profileId)
            if (data && data.id) {
                root.profile = data
                nameField.text  = data.name    || ""
                notesField.text = data.notes   || ""
                proxyInput.text = data.proxy_string || ""
                // Set OS selection
                var osIdx = ["windows10","windows11","linux"].indexOf(data.os_type || "windows10")
                osSelector.currentIndex = osIdx >= 0 ? osIdx : 0

                // Parse proxy if present
                if (data.proxy_string) {
                    var p = profileManager.parseProxy(data.proxy_string)
                    if (p.valid) {
                        parsedText.text = p.proxy_type.toUpperCase() + " · " +
                                          (p.proxy_username ? p.proxy_username + "@" : "") +
                                          p.proxy_host + ":" + p.proxy_port
                        parsedProxy.visible = true
                    } else {
                        parsedProxy.visible = false
                    }
                } else {
                    parsedProxy.visible = false
                }

                // Restore IP Result Card if tested
                if (data.ip_address) {
                    ipResultCard.visible       = true
                    ipResultCard.ipAddress     = data.ip_address
                    ipResultCard.ipCountry     = data.ip_country || ""
                    ipResultCard.ipCountryCode = data.ip_country_code || ""
                    ipResultCard.ipCity        = data.ip_city || ""
                    ipResultCard.ipIsp         = data.ip_isp || ""
                    ipResultCard.ipAsn         = data.ip_asn || ""
                    ipResultCard.ipScore       = (data.ip_score !== undefined) ? data.ip_score : -1
                    ipResultCard.ipType        = data.ip_type || ""
                    ipResultCard.ipTested      = data.ip_last_tested || ""
                } else {
                    ipResultCard.visible = false
                }

                // Restore Fingerprint controls
                var fp = data.fingerprint_data || {}
                if (fp.screen_resolution) {
                    var sIdx = resolutionCombo.model.indexOf(fp.screen_resolution)
                    if (sIdx >= 0) resolutionCombo.currentIndex = sIdx
                } else if (fp.screen && fp.screen.width && fp.screen.height) {
                    var resStr = fp.screen.width + "x" + fp.screen.height
                    var sIdx2 = resolutionCombo.model.indexOf(resStr)
                    if (sIdx2 >= 0) resolutionCombo.currentIndex = sIdx2
                }

                if (fp.hardware_concurrency || (fp.navigator && fp.navigator.hardwareConcurrency)) {
                    var hw = (fp.hardware_concurrency || fp.navigator.hardwareConcurrency).toString()
                    var hIdx = cpuCombo.model.indexOf(hw)
                    if (hIdx >= 0) cpuCombo.currentIndex = hIdx
                }

                if (fp.device_memory || (fp.navigator && fp.navigator.deviceMemory)) {
                    var mem = (fp.device_memory || fp.navigator.deviceMemory).toString()
                    var mIdx = ramCombo.model.indexOf(mem)
                    if (mIdx >= 0) ramCombo.currentIndex = mIdx
                }

                if (fp.canvas_noise !== undefined) {
                    noiseSlider.value = fp.canvas_noise
                }
                if (fp.audio_noise !== undefined) {
                    audioNoiseSlider.value = fp.audio_noise
                }
                if (fp.geo_mode) {
                    var gIdx = ["proxy", "custom", "disabled"].indexOf(fp.geo_mode)
                    if (gIdx >= 0) geoModeSelector.currentIndex = gIdx
                }

                // Restore Cookies & Extensions
                cookiesArea.text = data.cookies || "[]"
                analyzeCookies(cookiesArea.text)

                try {
                    var exts = JSON.parse(data.extensions || "[]")
                    root.extensionsList = Array.isArray(exts) ? exts : []
                } catch(e) {
                    root.extensionsList = []
                }
            }
        } else if (isNew) {
            nameField.text  = ""
            notesField.text = ""
            proxyInput.text = ""
            osSelector.currentIndex = 0
            parsedProxy.visible = false
            ipResultCard.visible = false
            cookiesArea.text = "[]"
            root.extensionsList = []
            analyzeCookies("[]")
        }
    }

    // ── IPC Connections (Proxy Test & Fingerprint Generation) ──
    Connections {
        target: typeof ipcClient !== 'undefined' ? ipcClient : null

        function onProxyTestResult(profileId, success, ipData, error) {
            if (root.profileId === profileId || (!root.profileId && profileId === "temp")) {
                root.proxyTesting = false
                ipResultCard.loading = false
                if (success) {
                    ipResultCard.visible       = true
                    ipResultCard.ipAddress     = ipData.ip || ""
                    ipResultCard.ipCountry     = ipData.country || ""
                    ipResultCard.ipCountryCode = ipData.countryCode || ""
                    ipResultCard.ipCity        = ipData.city || ""
                    ipResultCard.ipIsp         = ipData.isp || ""
                    ipResultCard.ipAsn         = ipData.asn || ""
                    ipResultCard.ipScore       = (ipData.score !== undefined) ? ipData.score : -1
                    ipResultCard.ipType        = ipData.type || ""
                    ipResultCard.ipTested      = "Just now"

                    root.profile.ip_address      = ipData.ip || ""
                    root.profile.ip_country      = ipData.country || ""
                    root.profile.ip_country_code = ipData.countryCode || ""
                    root.profile.ip_city         = ipData.city || ""
                    root.profile.ip_timezone     = ipData.timezone || ""
                    root.profile.ip_asn          = ipData.asn || ""
                    root.profile.ip_isp          = ipData.isp || ""
                    root.profile.ip_score        = (ipData.score !== undefined) ? ipData.score : -1
                    root.profile.ip_type         = ipData.type || ""
                    root.profile.ip_lat          = ipData.lat || 0
                    root.profile.ip_lng          = ipData.lng || 0
                    root.profile.ip_last_tested  = (new Date()).toISOString()

                    if (!root.isNew && root.profileId && typeof profileManager !== 'undefined') {
                        profileManager.saveIpResult(root.profileId, ipData)
                    }
                    root.showStatus("Proxy test succeeded ✓ (" + (ipData.ip || "") + ")", true)
                } else {
                    root.showStatus("Proxy test failed: " + (error || "Connection error"), false)
                }
            }
        }

        function onFingerprintGenerated(profileId, success, fp, error) {
            root.fpGenerating = false
            if (success) {
                root.profile.fingerprint_data = fp
                if (fp.screen_resolution) {
                    var sIdx = resolutionCombo.model.indexOf(fp.screen_resolution)
                    if (sIdx >= 0) resolutionCombo.currentIndex = sIdx
                } else if (fp.screen && fp.screen.width && fp.screen.height) {
                    var resStr = fp.screen.width + "x" + fp.screen.height
                    var sIdx2 = resolutionCombo.model.indexOf(resStr)
                    if (sIdx2 >= 0) resolutionCombo.currentIndex = sIdx2
                }

                var cpuVal = fp.hardware_concurrency || (fp.navigator && fp.navigator.hardwareConcurrency)
                if (cpuVal) {
                    var hIdx = cpuCombo.model.indexOf(cpuVal.toString())
                    if (hIdx >= 0) cpuCombo.currentIndex = hIdx
                }

                var ramVal = fp.device_memory || (fp.navigator && fp.navigator.deviceMemory)
                if (ramVal) {
                    var mIdx = ramCombo.model.indexOf(ramVal.toString())
                    if (mIdx >= 0) ramCombo.currentIndex = mIdx
                }

                // Update visual feedback banner
                fpResultBanner.resolutionText = (fp.screen && fp.screen.width) ? (fp.screen.width + "x" + fp.screen.height) : (fp.screen_resolution || "1920x1080")
                fpResultBanner.hardwareText = (cpuVal ? cpuVal + " Cores" : "8 Cores") + " · " + (ramVal ? ramVal + " GB RAM" : "8 GB RAM")
                fpResultBanner.gpuName = (fp.webgl && fp.webgl.renderer) || (fp.gpu && fp.gpu.renderer) || "NVIDIA GeForce RTX 3060 Direct3D11"
                fpResultBanner.visible = true

                if (!root.isNew && root.profileId && typeof profileManager !== 'undefined') {
                    profileManager.saveFingerprint(root.profileId, fp)
                }
                root.showStatus("Fingerprint Generated & Applied ✓", true)
            } else {
                root.showStatus("Fingerprint generation failed: " + (error || "Unknown error"), false)
            }
        }

        function onCookiesParsed(success, count, json, netscape, error) {
            if (success) {
                cookiesArea.text = json
                root.analyzeCookies(json)
                root.showStatus("Parsed " + count + " cookies ✓", true)
            } else {
                root.showStatus("Cookie parse failed: " + (error || "Invalid format"), false)
            }
        }

        function onCookiesExtracted(profileId, success, count, json, netscape, error) {
            if (root.profileId === profileId) {
                if (success) {
                    cookiesArea.text = json
                    root.analyzeCookies(json)
                    root.showStatus("Extracted " + count + " cookies from browser ✓", true)
                } else {
                    root.showStatus("Cookie extraction failed: " + (error || "No active session"), false)
                }
            }
        }
    }

    // ── Collect all fields and save ──
    function saveProfile() {
        if (!nameField.text.trim()) {
            showStatus("Profile name is required", false)
            return
        }

        var data = {
            name:            nameField.text.trim(),
            notes:           notesField.text.trim(),
            proxy_string:    proxyInput.text.trim(),
            os_type:         ["windows10","windows11","linux"][osSelector.currentIndex],
            browser_version: "auto",
            cookies:         cookiesArea.text.trim() || "[]",
            extensions:      JSON.stringify(root.extensionsList)
        }

        // Parse proxy if entered
        if (proxyInput.text.trim()) {
            var parsed = profileManager.parseProxy(proxyInput.text.trim())
            data.proxy_type     = parsed.proxy_type     || "none"
            data.proxy_host     = parsed.proxy_host     || ""
            data.proxy_port     = parsed.proxy_port     || 0
            data.proxy_username = parsed.proxy_username || ""
            data.proxy_password = parsed.proxy_password || ""
        }

        // Retain IP test results if tested
        data.ip_address      = root.profile.ip_address || ""
        data.ip_country      = root.profile.ip_country || ""
        data.ip_country_code = root.profile.ip_country_code || ""
        data.ip_city         = root.profile.ip_city || ""
        data.ip_timezone     = root.profile.ip_timezone || ""
        data.ip_asn          = root.profile.ip_asn || ""
        data.ip_isp          = root.profile.ip_isp || ""
        data.ip_score        = root.profile.ip_score !== undefined ? root.profile.ip_score : -1
        data.ip_type         = root.profile.ip_type || ""
        data.ip_lat          = root.profile.ip_lat || 0
        data.ip_lng          = root.profile.ip_lng || 0
        data.ip_last_tested  = root.profile.ip_last_tested || ""

        // Fingerprint overrides from UI
        var fp = root.profile.fingerprint_data || {}
        fp["screen_resolution"]    = resolutionCombo.currentText
        fp["hardware_concurrency"] = parseInt(cpuCombo.currentText)
        fp["device_memory"]        = parseInt(ramCombo.currentText)
        fp["canvas_noise"]         = noiseSlider.value
        fp["audio_noise"]          = audioNoiseSlider.value
        fp["geo_mode"]             = geoModeSelector.currentText.toLowerCase()

        data.fingerprint_data = fp

        var ok
        if (isNew) {
            ok = profileManager.createProfile(data.name)
            // After create, get new ID and update
            if (ok) {
                var all = profileManager.getAllProfiles()
                if (all.length > 0) {
                    var newId = all[0].id
                    profileManager.updateProfile(newId, data)
                }
            }
        } else {
            ok = profileManager.updateProfile(profileId, data)
        }

        if (ok) {
            showStatus("Profile saved ✓", true)
            Qt.callLater(function() { root.back() })
        } else {
            showStatus("Save failed — check logs", false)
        }
    }

    function showStatus(msg, ok) {
        statusMsg = msg
        statusOk  = ok
        statusTimer.restart()
    }

    Timer {
        id: statusTimer
        interval: 3000
        onTriggered: statusMsg = ""
    }

    // ── Layout ────────────────────────────────────────────────────────────
    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // ── Header ──────────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            height: 56
            color: "transparent"

            RowLayout {
                anchors { fill: parent; leftMargin: 24; rightMargin: 24 }

                // Back button
                Rectangle {
                    width: 32; height: 32; radius: 8; color: surface
                    Text {
                        anchors.centerIn: parent; text: "←"
                        color: textPrimary; font.pixelSize: 16
                    }
                    MouseArea {
                        anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                        onClicked: root.back()
                    }
                }

                Item { width: 12 }

                Column {
                    spacing: 2
                    Text {
                        text: isNew ? "New Profile" : "Edit Profile"
                        color: textPrimary
                        font { pixelSize: 18; weight: Font.Bold; family: "Segoe UI" }
                    }
                    Text {
                        visible: !isNew && root.profile.name
                        text: root.profile.name || ""
                        color: textSub; font.pixelSize: 12
                    }
                }

                Item { Layout.fillWidth: true }

                // Status message
                Text {
                    visible: statusMsg !== ""
                    text: statusMsg
                    color: statusOk ? green : red
                    font { pixelSize: 12; weight: Font.Medium }
                    Behavior on opacity { NumberAnimation { duration: 200 } }
                }

                Item { width: 12 }

                // Save button
                Rectangle {
                    width: 110; height: 36; radius: 10
                    gradient: Gradient {
                        orientation: Gradient.Horizontal
                        GradientStop { position: 0.0; color: accent }
                        GradientStop { position: 1.0; color: "#A855F7" }
                    }
                    Text {
                        anchors.centerIn: parent; text: "💾 Save"
                        color: "white"; font { pixelSize: 13; weight: Font.DemiBold }
                    }
                    MouseArea {
                        anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                        onClicked: root.saveProfile()
                    }
                    scale: saveBtnMa.pressed ? 0.95 : 1.0
                    MouseArea { id: saveBtnMa; anchors.fill: parent; hoverEnabled: true }
                    Behavior on scale { NumberAnimation { duration: 80 } }
                }
            }
        }

        // ── Tab Bar ──────────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true; height: 1; color: border
        }
        CustomTabBar {
            id: editorTabs
            Layout.fillWidth: true
            tabs:     ["Basic", "Proxy", "Fingerprint", "Geo", "Cookies", "Extensions"]
            tabIcons: ["👤",    "🌐",    "🖥",           "📍",  "🍪",      "🧩"]
        }
        Rectangle {
            Layout.fillWidth: true; height: 1; color: border
        }

        // ── Tab Content ──────────────────────────────────────────────────
        StackLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            currentIndex: editorTabs.currentIndex

            // ════════════════════════════════════════════════════════════
            // TAB 0 — Basic
            // ════════════════════════════════════════════════════════════
            ScrollView {
                id: basicScroll
                clip: true; Layout.fillWidth: true; Layout.fillHeight: true
                ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

                Column {
                    width: basicScroll.width; spacing: 0

                    // Padding
                    Item { width: 1; height: 24 }

                    // Profile Name
                    SectionCard {
                        title: "Identity"; icon: "👤"

                        content: Column {
                            spacing: 16; width: parent.width

                            FieldLabel { text: "Profile Name *" }
                            StyledField {
                                id: nameField
                                placeholder: "e.g. Facebook Account #1"
                                width: parent.width
                            }

                            FieldLabel { text: "Notes" }
                            StyledArea {
                                id: notesField
                                placeholder: "Optional notes, tags, or reminders..."
                                width: parent.width; height: 80
                            }
                        }
                    }

                    // OS Selection
                    SectionCard {
                        title: "Operating System"; icon: "💻"

                        content: Column {
                            spacing: 16; width: parent.width

                            FieldLabel { text: "OS Profile" }
                            RowLayout {
                                width: parent.width; spacing: 10

                                Repeater {
                                    id: osSelector
                                    model: [
                                        { id: "windows10", label: "Windows 10", icon: "🪟" },
                                        { id: "windows11", label: "Windows 11", icon: "🪟" },
                                        { id: "linux",     label: "Linux",      icon: "🐧" }
                                    ]
                                    property int currentIndex: 0

                                    Rectangle {
                                        width: 140; height: 68; radius: 10
                                        color: osSelector.currentIndex === index ? "#6C63FF18" : surface
                                        border.color: osSelector.currentIndex === index ? accent : border
                                        border.width: osSelector.currentIndex === index ? 1.5 : 1

                                        Column {
                                            anchors.centerIn: parent; spacing: 4
                                            Text {
                                                anchors.horizontalCenter: parent.horizontalCenter
                                                text: modelData.icon; font.pixelSize: 22
                                            }
                                            Text {
                                                anchors.horizontalCenter: parent.horizontalCenter
                                                text: modelData.label
                                                color: osSelector.currentIndex === index ? textPrimary : textSub
                                                font { pixelSize: 12; weight: Font.Medium }
                                            }
                                        }

                                        MouseArea {
                                            anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                                            onClicked: osSelector.currentIndex = index
                                        }

                                        Behavior on color { ColorAnimation { duration: 150 } }
                                        Behavior on border.color { ColorAnimation { duration: 150 } }
                                    }
                                }
                            }

                            Text {
                                width: parent.width; wrapMode: Text.Wrap
                                text: "• Fonts, Speech Voices, UA Platform, and GPU vendor will auto-match the selected OS."
                                color: textSub; font.pixelSize: 11
                            }
                        }
                    }

                    Item { height: 24 }
                }
            }

            // ════════════════════════════════════════════════════════════
            // TAB 1 — Proxy
            // ════════════════════════════════════════════════════════════
            ScrollView {
                id: proxyScroll
                clip: true; Layout.fillWidth: true; Layout.fillHeight: true
                ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

                Column {
                    width: proxyScroll.width; spacing: 0
                    Item { height: 24 }

                    SectionCard {
                        title: "Proxy Configuration"; icon: "🌐"

                        content: Column {
                            spacing: 16; width: parent.width

                            // Proxy type info chips
                            Row {
                                spacing: 8
                                Repeater {
                                    model: ["HTTP", "HTTPS", "SOCKS4", "SOCKS5", "SSH"]
                                    Rectangle {
                                        width: proxyChipText.implicitWidth + 16; height: 24; radius: 6
                                        color: surface; border.color: border
                                        Text {
                                            id: proxyChipText
                                            anchors.centerIn: parent; text: modelData
                                            color: textSub; font.pixelSize: 11
                                        }
                                    }
                                }
                            }

                            FieldLabel { text: "Proxy String (paste any format)" }

                            // Proxy paste field
                            Rectangle {
                                width: parent.width; height: 44; radius: 8
                                color: "#181B2B"
                                border.color: proxyInput.activeFocus ? accent : "#383E62"
                                border.width: proxyInput.activeFocus ? 2 : 1

                                TextField {
                                    id: proxyInput
                                    anchors { fill: parent; margins: 2 }
                                    placeholderText: "socks5://user:pass@host:port  or  http://host:port:user:pass"
                                    placeholderTextColor: "#737A9E"
                                    color: "#FFFFFF"
                                    background: Item {}
                                    padding: 12
                                    font.family: "Consolas"
                                    font.pixelSize: 13
                                    onTextChanged: parsedProxy.visible = false
                                }
                            }

                            // Parsed preview
                            Rectangle {
                                id: parsedProxy
                                visible: false
                                width: parent.width; height: visible ? 38 : 0; radius: 8
                                color: "#22D3A510"; border.color: "#22D3A530"

                                RowLayout {
                                    anchors { fill: parent; leftMargin: 12; rightMargin: 12 }
                                    Text { text: "✓ Parsed:"; color: green; font.pixelSize: 12 }
                                    Text {
                                        id: parsedText
                                        color: textPrimary; font { pixelSize: 12; family: "Consolas" }
                                        elide: Text.ElideRight
                                        Layout.fillWidth: true
                                    }
                                }
                            }

                            // Buttons row
                            RowLayout {
                                width: parent.width; spacing: 10

                                // Parse button
                                ActionButton {
                                    text: "Parse"
                                    icon: "🔍"
                                    onClicked: {
                                        if (!proxyInput.text.trim()) return
                                        var p = profileManager.parseProxy(proxyInput.text.trim())
                                        if (p.valid) {
                                            parsedText.text = p.proxy_type.toUpperCase() + " · " +
                                                              (p.proxy_username ? p.proxy_username + "@" : "") +
                                                              p.proxy_host + ":" + p.proxy_port
                                            parsedProxy.visible = true
                                        } else {
                                            root.showStatus("Could not parse proxy format", false)
                                        }
                                    }
                                }

                                // Test Proxy button
                                ActionButton {
                                    text: root.proxyTesting ? "Testing..." : "Test IP"
                                    icon: root.proxyTesting ? "⏳" : "⚡"
                                    accent: true
                                    enabled: proxyInput.text.trim() !== "" && !root.proxyTesting
                                    onClicked: {
                                        // Save first then test via IPC
                                        if (!proxyInput.text.trim()) return
                                        root.proxyTesting = true
                                        ipResultCard.loading = true
                                        ipResultCard.visible = true

                                        var parsed = profileManager.parseProxy(proxyInput.text.trim())
                                        // Send TEST_PROXY to Node.js via IPC
                                        // Result arrives via profileManager signal
                                        ipcClient.send("test_proxy", {
                                            profileId: root.profileId || "temp",
                                            proxy: parsed
                                        })
                                    }
                                }

                                Item { Layout.fillWidth: true }

                                // Kill switch toggle
                                RowLayout {
                                    spacing: 8
                                    Text { text: "Kill Switch"; color: textSub; font.pixelSize: 12 }
                                    Switch {
                                        id: killSwitch
                                        checked: true
                                        Material.accent: accent
                                    }
                                }
                            }

                            // Kill switch explanation
                            Text {
                                text: "• Kill Switch: Profile stops working if proxy disconnects. Real IP never leaks."
                                color: textSub; font.pixelSize: 11
                                width: parent.width; wrapMode: Text.Wrap
                            }

                            // IP Result Card
                            ProxyResultCard {
                                id: ipResultCard
                                width: parent.width
                                visible: false
                                ipAddress:    root.profile.ip_address || ""
                                ipCountry:    root.profile.ip_country || ""
                                ipCountryCode:root.profile.ip_country_code || ""
                                ipCity:       root.profile.ip_city || ""
                                ipIsp:        root.profile.ip_isp || ""
                                ipAsn:        root.profile.ip_asn || ""
                                ipScore:      root.profile.ip_score !== undefined ? root.profile.ip_score : -1
                                ipType:       root.profile.ip_type || ""
                                ipTested:     root.profile.ip_last_tested || ""
                            }
                        }
                    }

                    Item { height: 24 }
                }
            }

            // ════════════════════════════════════════════════════════════
            // TAB 2 — Fingerprint
            // ════════════════════════════════════════════════════════════
            ScrollView {
                id: fpScroll
                clip: true; Layout.fillWidth: true; Layout.fillHeight: true
                ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

                Column {
                    width: fpScroll.width; spacing: 0
                    Item { height: 24 }

                    // Generate fingerprint button
                    SectionCard {
                        title: "Fingerprint Generation"; icon: "🖥"

                        content: Column {
                            spacing: 16; width: parent.width

                            RowLayout {
                                width: parent.width; spacing: 10

                                ActionButton {
                                    text: root.fpGenerating ? "Generating..." : "🎲 Randomize / Auto Generate"
                                    icon: root.fpGenerating ? "⏳" : "✨"
                                    accent: true
                                    enabled: !root.fpGenerating
                                    onClicked: {
                                        root.fpGenerating = true
                                        ipcClient.send("generate_fp", {
                                            profileId:  "rand_" + Date.now(),
                                            osType:     ["windows10","windows11","linux"][osSelector.currentIndex],
                                            randomize:  true,
                                            ipData:     {
                                                ip:          root.profile.ip_address,
                                                countryCode: root.profile.ip_country_code,
                                                timezone:    root.profile.ip_timezone,
                                                lat:         root.profile.ip_lat,
                                                lng:         root.profile.ip_lng,
                                            },
                                            noiseLevel: Math.round(noiseSlider.value),
                                        })
                                    }
                                }

                                Text {
                                    text: "1-Click builds a realistic, consistent fingerprint and randomizes hardware"
                                    color: textSub; font.pixelSize: 12
                                    Layout.fillWidth: true; wrapMode: Text.Wrap
                                }
                            }

                            // Live Fingerprint Result Banner
                            Rectangle {
                                id: fpResultBanner
                                visible: false
                                property string gpuName: ""
                                property string resolutionText: ""
                                property string hardwareText: ""

                                width: parent.width; height: 60; radius: 10
                                color: "#22D3A518"; border.color: "#22D3A550"; border.width: 1

                                RowLayout {
                                    anchors { fill: parent; leftMargin: 16; rightMargin: 16 }
                                    spacing: 12
                                    Text { text: "✓"; color: green; font { pixelSize: 20; weight: Font.Bold } }
                                    Column {
                                        Layout.fillWidth: true; spacing: 3
                                        Text {
                                            text: "Fingerprint Generated & Ready: " + fpResultBanner.resolutionText + " · " + fpResultBanner.hardwareText
                                            color: green; font { pixelSize: 13; weight: Font.Bold; family: "Segoe UI" }
                                        }
                                        Text {
                                            text: "GPU: " + fpResultBanner.gpuName
                                            color: textPrimary; font { pixelSize: 11; family: "Consolas" }
                                            elide: Text.ElideRight
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Screen
                    SectionCard {
                        title: "Screen & Display"; icon: "🖥"

                        content: Column {
                            spacing: 16; width: parent.width

                            Row {
                                spacing: 20; width: parent.width

                                Column {
                                    spacing: 6
                                    FieldLabel { text: "Resolution" }
                                    ComboBoxStyled {
                                        id: resolutionCombo
                                        model: ["1920x1080", "2560x1440", "1366x768", "1440x900", "1280x720", "3840x2160"]
                                        width: 160
                                    }
                                }

                                Column {
                                    spacing: 6
                                    FieldLabel { text: "Device Pixel Ratio" }
                                    ComboBoxStyled {
                                        model: ["1.0", "1.25", "1.5", "2.0"]
                                        width: 100
                                    }
                                }
                            }
                        }
                    }

                    // Hardware
                    SectionCard {
                        title: "Hardware"; icon: "⚙️"

                        content: Column {
                            spacing: 16; width: parent.width

                            Row {
                                spacing: 20

                                Column {
                                    spacing: 6
                                    FieldLabel { text: "CPU Cores" }
                                    ComboBoxStyled {
                                        id: cpuCombo
                                        model: ["2", "4", "6", "8", "12", "16"]
                                        currentIndex: 3   // default 8
                                        width: 100
                                    }
                                }

                                Column {
                                    spacing: 6
                                    FieldLabel { text: "RAM (GB)" }
                                    ComboBoxStyled {
                                        id: ramCombo
                                        model: ["2", "4", "8", "16"]
                                        currentIndex: 2   // default 8
                                        width: 100
                                    }
                                }

                                Column {
                                    spacing: 6
                                    FieldLabel { text: "Max Touch Points" }
                                    ComboBoxStyled {
                                        model: ["0 (Desktop)", "1", "5", "10"]
                                        width: 140
                                    }
                                }
                            }
                        }
                    }

                    // Canvas & Audio Noise
                    SectionCard {
                        title: "Anti-Detection Noise"; icon: "🎨"

                        content: Column {
                            spacing: 16; width: parent.width

                            // Canvas noise
                            Column {
                                spacing: 8; width: parent.width

                                RowLayout {
                                    width: parent.width
                                    FieldLabel { text: "Canvas Noise Level" }
                                    Item { Layout.fillWidth: true }
                                    Text {
                                        text: ["Off", "Subtle", "Normal", "Strong"][Math.round(noiseSlider.value)]
                                        color: accent; font { pixelSize: 12; weight: Font.DemiBold }
                                    }
                                }

                                Slider {
                                    id: noiseSlider
                                    width: parent.width
                                    from: 0; to: 3; stepSize: 1; value: 2
                                    Material.accent: accent
                                }

                                Text {
                                    text: "Adds imperceptible pixel noise to <canvas> draws. Breaks canvas fingerprinting without visual change."
                                    color: textSub; font.pixelSize: 11
                                    width: parent.width; wrapMode: Text.Wrap
                                }
                            }

                            // Audio noise
                            Column {
                                spacing: 8; width: parent.width

                                RowLayout {
                                    width: parent.width
                                    FieldLabel { text: "AudioContext Noise Level" }
                                    Item { Layout.fillWidth: true }
                                    Text {
                                        text: ["Off", "Subtle", "Normal", "Strong"][Math.round(audioNoiseSlider.value)]
                                        color: accent; font { pixelSize: 12; weight: Font.DemiBold }
                                    }
                                }

                                Slider {
                                    id: audioNoiseSlider
                                    width: parent.width
                                    from: 0; to: 3; stepSize: 1; value: 1
                                    Material.accent: accent
                                }
                            }

                            // WebGL
                            RowLayout {
                                width: parent.width
                                Text { text: "WebGL Vendor/Renderer Override"; color: textSub; font.pixelSize: 12 }
                                Item { Layout.fillWidth: true }
                                Switch {
                                    checked: true
                                    Material.accent: accent
                                }
                            }

                            // WebRTC
                            RowLayout {
                                width: parent.width
                                Column {
                                    spacing: 2
                                    Text { text: "WebRTC Leak Prevention"; color: textSub; font.pixelSize: 12 }
                                    Text { text: "Disable STUN/ICE — all WebRTC routed via proxy"; color: textSub; font.pixelSize: 10 }
                                }
                                Item { Layout.fillWidth: true }
                                Switch {
                                    checked: true; enabled: false   // always on
                                    Material.accent: accent
                                }
                            }
                        }
                    }

                    Item { height: 24 }
                }
            }

            // ════════════════════════════════════════════════════════════
            // TAB 3 — Geo
            // ════════════════════════════════════════════════════════════
            ScrollView {
                id: geoScroll
                clip: true; Layout.fillWidth: true; Layout.fillHeight: true
                ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

                Column {
                    width: geoScroll.width; spacing: 0
                    Item { height: 24 }

                    SectionCard {
                        title: "Geolocation"; icon: "📍"

                        content: Column {
                            spacing: 16; width: parent.width

                            // Mode selector
                            FieldLabel { text: "Geolocation Mode" }
                            RowLayout {
                                width: parent.width; spacing: 10

                                Repeater {
                                    id: geoModeSelector
                                    property int currentIndex: 0
                                    model: [
                                        { id: "proxy",    label: "From Proxy IP",    icon: "🌐", desc: "Auto coords from exit IP" },
                                        { id: "custom",   label: "Custom",           icon: "📌", desc: "Manual lat/lng" },
                                        { id: "disabled", label: "Disabled",         icon: "🚫", desc: "Block geo requests" },
                                    ]

                                    property string currentText: model[currentIndex].id

                                    Rectangle {
                                        width: 150; height: 80; radius: 10
                                        color: geoModeSelector.currentIndex === index ? "#6C63FF18" : surface
                                        border.color: geoModeSelector.currentIndex === index ? accent : border

                                        Column {
                                            anchors.centerIn: parent; spacing: 4
                                            Text {
                                                anchors.horizontalCenter: parent.horizontalCenter
                                                text: modelData.icon; font.pixelSize: 20
                                            }
                                            Text {
                                                anchors.horizontalCenter: parent.horizontalCenter
                                                text: modelData.label
                                                color: geoModeSelector.currentIndex === index ? textPrimary : textSub
                                                font { pixelSize: 12; weight: Font.Medium }
                                            }
                                            Text {
                                                anchors.horizontalCenter: parent.horizontalCenter
                                                text: modelData.desc
                                                color: textSub; font.pixelSize: 10
                                            }
                                        }

                                        MouseArea {
                                            anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                                            onClicked: geoModeSelector.currentIndex = index
                                        }
                                        Behavior on color { ColorAnimation { duration: 150 } }
                                    }
                                }
                            }

                            // Coordinates (shown when not proxy mode)
                            Rectangle {
                                visible: geoModeSelector.currentIndex === 1
                                width: parent.width; height: visible ? geoCoords.implicitHeight + 24 : 0
                                color: surface; radius: 10; border.color: border; clip: true

                                Column {
                                    id: geoCoords
                                    anchors { fill: parent; margins: 16 }
                                    spacing: 12

                                    Row {
                                        spacing: 16

                                        Column {
                                            spacing: 6
                                            FieldLabel { text: "Latitude" }
                                            StyledField {
                                                placeholder: "40.7128"; width: 180
                                                text: root.profile.ip_lat ? root.profile.ip_lat.toString() : ""
                                            }
                                        }

                                        Column {
                                            spacing: 6
                                            FieldLabel { text: "Longitude" }
                                            StyledField {
                                                placeholder: "-74.0060"; width: 180
                                                text: root.profile.ip_lng ? root.profile.ip_lng.toString() : ""
                                            }
                                        }

                                        Column {
                                            spacing: 6
                                            FieldLabel { text: "Accuracy (m)" }
                                            StyledField { placeholder: "50"; width: 100 }
                                        }
                                    }
                                }
                            }

                            // Show current geo from IP
                            Rectangle {
                                visible: geoModeSelector.currentIndex === 0 && root.profile.ip_lat !== 0
                                width: parent.width; height: visible ? 50 : 0
                                color: "#6C63FF10"; radius: 8; border.color: "#6C63FF30"

                                Row {
                                    anchors { left: parent.left; verticalCenter: parent.verticalCenter; leftMargin: 16 }
                                    spacing: 12
                                    Text { text: "📍"; font.pixelSize: 18 }
                                    Column {
                                        anchors.verticalCenter: parent.verticalCenter; spacing: 2
                                        Text {
                                            text: root.profile.ip_lat.toFixed(4) + ", " + root.profile.ip_lng.toFixed(4)
                                            color: textPrimary; font { pixelSize: 13; family: "Consolas" }
                                        }
                                        Text {
                                            text: root.profile.ip_city + ", " + root.profile.ip_country + " · " + root.profile.ip_timezone
                                            color: textSub; font.pixelSize: 11
                                        }
                                    }
                                }
                            }

                            Text {
                                text: "• Geolocation requests from websites will return the proxy exit location.\n• Timezone and language are also auto-set from IP."
                                color: textSub; font.pixelSize: 11
                                width: parent.width; wrapMode: Text.Wrap
                            }
                        }
                    }

                    Item { height: 24 }
                }
            }

            // ════════════════════════════════════════════════════════════
            // TAB 4 — Cookies
            // ════════════════════════════════════════════════════════════
            ScrollView {
                id: cookiesScroll
                clip: true; Layout.fillWidth: true; Layout.fillHeight: true
                ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

                Column {
                    width: cookiesScroll.width; spacing: 0

                    Item { width: 1; height: 24 }

                    SectionCard {
                        title: "Cookie Manager"; icon: "🍪"

                        content: Column {
                            spacing: 16; width: parent.width

                            // Status bar / Badge
                            Rectangle {
                                width: parent.width; height: 50
                                color: root.cookieCount > 0 ? "#10B98115" : surface
                                radius: 10
                                border.color: root.cookieCount > 0 ? "#10B98140" : border

                                RowLayout {
                                    anchors { fill: parent; leftMargin: 16; rightMargin: 16 }
                                    spacing: 12

                                    Text {
                                        text: root.cookieCount > 0 ? "✓" : "ℹ"
                                        color: root.cookieCount > 0 ? green : textSub
                                        font { pixelSize: 16; weight: Font.Bold }
                                    }

                                    Column {
                                        spacing: 2
                                        Text {
                                            text: root.cookieCount > 0 ?
                                                  root.cookieCount + " Cookies Active" :
                                                  "No Cookies Configured"
                                            color: textPrimary
                                            font { pixelSize: 13; weight: Font.DemiBold }
                                        }
                                        Text {
                                            text: "Format: " + root.cookieFormat + " · Auto-injected via CDP on profile start"
                                            color: textSub
                                            font.pixelSize: 11
                                        }
                                    }

                                    Item { Layout.fillWidth: true }

                                    ActionButton {
                                        text: "Extract from Session"
                                        icon: "🌐"
                                        enabled: !root.isNew && root.profileId !== ""
                                        onClicked: {
                                            if (typeof ipcClient !== 'undefined') {
                                                ipcClient.sendCommand("get_cookies", { profileId: root.profileId })
                                                root.showStatus("Requesting live cookies from browser...", true)
                                            }
                                        }
                                    }
                                }
                            }

                            // Action Toolbar
                            RowLayout {
                                width: parent.width; spacing: 10

                                ActionButton {
                                    text: "Parse / Validate"
                                    icon: "🔍"
                                    accent: true
                                    onClicked: {
                                        if (typeof ipcClient !== 'undefined') {
                                            ipcClient.sendCommand("parse_cookies", { raw: cookiesArea.text })
                                        } else {
                                            root.analyzeCookies(cookiesArea.text)
                                        }
                                    }
                                }

                                ActionButton {
                                    text: "Clear Cookies"
                                    icon: "🧹"
                                    onClicked: {
                                        cookiesArea.text = "[]"
                                        root.analyzeCookies("[]")
                                        root.showStatus("Cookies cleared", true)
                                    }
                                }

                                Item { Layout.fillWidth: true }

                                Text {
                                    text: "Supports JSON (EditThisCookie) & Netscape (cookies.txt)"
                                    color: textSub; font.pixelSize: 11
                                }
                            }

                            // Raw Cookies Text Area
                            Rectangle {
                                width: parent.width; height: 300
                                radius: 10; color: surface; border.color: cookiesArea.activeFocus ? accent : border

                                ScrollView {
                                    anchors.fill: parent
                                    anchors.margins: 8

                                    TextArea {
                                        id: cookiesArea
                                        placeholderText: "Paste cookies here in JSON format (e.g. [{\"name\":\"session\",\"value\":\"...\",\"domain\":\".example.com\"}]) or Netscape cookies.txt format..."
                                        placeholderTextColor: textSub
                                        color: textPrimary
                                        background: Item {}
                                        wrapMode: Text.WrapAnywhere
                                        font { pixelSize: 12; family: "Consolas" }
                                        onTextChanged: root.analyzeCookies(text)
                                    }
                                }
                            }

                            Text {
                                text: "• Injected automatically into the active Chromium page when profile starts.\n• Preserves domains, paths, secure flags, httpOnly flags, and expiration timestamps."
                                color: textSub; font.pixelSize: 11; width: parent.width; wrapMode: Text.Wrap
                            }
                        }
                    }

                    Item { height: 24 }
                }
            }

            // ════════════════════════════════════════════════════════════
            // TAB 5 — Extensions
            // ════════════════════════════════════════════════════════════
            ScrollView {
                id: extScroll
                clip: true; Layout.fillWidth: true; Layout.fillHeight: true
                ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

                Column {
                    width: extScroll.width; spacing: 0

                    Item { width: 1; height: 24 }

                    SectionCard {
                        title: "Extensions Manager"; icon: "🧩"

                        content: Column {
                            spacing: 16; width: parent.width

                            Text {
                                text: "Load unpacked Chrome extensions (e.g. uBlock Origin, MetaMask, Proxy Switcher) directly into this profile on launch."
                                color: textSub; font.pixelSize: 12; width: parent.width; wrapMode: Text.Wrap
                            }

                            // Add Extension Row
                            Rectangle {
                                width: parent.width; height: 52
                                color: "#181B2B"; radius: 10; border.color: "#383E62"; border.width: 1

                                RowLayout {
                                    anchors { fill: parent; margins: 6 }
                                    spacing: 8

                                    TextField {
                                        id: newExtPath
                                        Layout.fillWidth: true
                                        Layout.fillHeight: true
                                        placeholderText: "Folder path to unpacked extension (e.g. D:/extensions/ublock_origin)"
                                        placeholderTextColor: textSub
                                        color: textPrimary
                                        background: Item {}
                                        font { pixelSize: 13; family: "Segoe UI" }
                                    }

                                    ActionButton {
                                        text: "Add Extension"
                                        icon: "➕"
                                        accent: true
                                        onClicked: {
                                            var path = newExtPath.text.trim()
                                            if (!path) {
                                                root.showStatus("Please enter an extension folder path", false)
                                                return
                                            }
                                            var clean = path.replace(/\\/g, "/")
                                            var parts = clean.split("/")
                                            var name = parts[parts.length - 1] || "Extension"

                                            var list = root.extensionsList.slice()
                                            list.push({ path: path, name: name, enabled: true })
                                            root.extensionsList = list
                                            newExtPath.text = ""
                                            root.showStatus("Added extension: " + name, true)
                                        }
                                    }
                                }
                            }

                            // Installed Extension List
                            Column {
                                width: parent.width; spacing: 8

                                Repeater {
                                    model: root.extensionsList

                                    Rectangle {
                                        width: parent.width; height: 56
                                        radius: 10
                                        color: modelData.enabled ? "#1E293B" : surface
                                        border.color: border

                                        RowLayout {
                                            anchors { fill: parent; leftMargin: 16; rightMargin: 16 }
                                            spacing: 12

                                            Text {
                                                text: "🧩"
                                                font.pixelSize: 20
                                                opacity: modelData.enabled ? 1.0 : 0.4
                                            }

                                            Column {
                                                spacing: 2
                                                Layout.fillWidth: true

                                                Text {
                                                    text: modelData.name || "Extension"
                                                    color: modelData.enabled ? textPrimary : textSub
                                                    font { pixelSize: 13; weight: Font.DemiBold }
                                                }
                                                Text {
                                                    text: modelData.path || ""
                                                    color: textSub
                                                    font { pixelSize: 11; family: "Consolas" }
                                                    elide: Text.ElideMiddle
                                                    width: parent.width
                                                }
                                            }

                                            // Enable / Disable toggle button
                                            Rectangle {
                                                width: 80; height: 28; radius: 6
                                                color: modelData.enabled ? "#10B98120" : surface
                                                border.color: modelData.enabled ? green : border

                                                Text {
                                                    anchors.centerIn: parent
                                                    text: modelData.enabled ? "Enabled" : "Disabled"
                                                    color: modelData.enabled ? green : textSub
                                                    font { pixelSize: 11; weight: Font.Medium }
                                                }

                                                MouseArea {
                                                    anchors.fill: parent
                                                    cursorShape: Qt.PointingHandCursor
                                                    onClicked: {
                                                        var list = root.extensionsList.slice()
                                                        list[index].enabled = !list[index].enabled
                                                        root.extensionsList = list
                                                    }
                                                }
                                            }

                                            // Remove button
                                            Rectangle {
                                                width: 32; height: 32; radius: 6; color: surface
                                                border.color: border
                                                Text {
                                                    anchors.centerIn: parent; text: "🗑"
                                                    font.pixelSize: 13
                                                }
                                                MouseArea {
                                                    anchors.fill: parent
                                                    cursorShape: Qt.PointingHandCursor
                                                    onClicked: {
                                                        var list = root.extensionsList.slice()
                                                        list.splice(index, 1)
                                                        root.extensionsList = list
                                                        root.showStatus("Extension removed", true)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                // Empty State
                                Rectangle {
                                    visible: root.extensionsList.length === 0
                                    width: parent.width; height: 75
                                    color: surface; radius: 10; border.color: border

                                    Column {
                                        anchors.centerIn: parent; spacing: 4
                                        Text {
                                            anchors.horizontalCenter: parent.horizontalCenter
                                            text: "No extensions added yet"
                                            color: textSub; font.pixelSize: 12
                                        }
                                        Text {
                                            anchors.horizontalCenter: parent.horizontalCenter
                                            text: "Enter an unpacked extension directory path above to install"
                                            color: textSub; opacity: 0.7; font.pixelSize: 11
                                        }
                                    }
                                }
                            }

                            Text {
                                text: "Extensions are passed via Chromium's --load-extension flag upon browser startup."
                                color: textSub; font.pixelSize: 11; width: parent.width; wrapMode: Text.Wrap
                            }
                        }
                    }

                    Item { height: 24 }
                }
            }

        }  // StackLayout end
    }  // ColumnLayout end

    // ─── Reusable inline components ──────────────────────────────────────

    component SectionCard: Rectangle {
        id: secCard
        property string title: ""
        property string icon: ""
        property Item content

        Layout.fillWidth: true
        width: Math.max(680, parent ? parent.width - 48 : 800)
        anchors.horizontalCenter: parent ? parent.horizontalCenter : undefined
        height: cardCol.implicitHeight + 48
        radius: 14; color: "#131522"; border.color: "#2C324E"; border.width: 1

        Column {
            id: cardCol
            anchors {
                top: parent.top; left: parent.left; right: parent.right
                margins: 20
            }
            spacing: 16

            // Section header
            Row {
                spacing: 8
                Text { text: icon; font.pixelSize: 16 }
                Text {
                    text: title; color: textPrimary
                    font { pixelSize: 14; weight: Font.DemiBold; family: "Segoe UI" }
                }
            }
            Rectangle { width: parent.width; height: 1; color: "#252B44" }
        }

        onContentChanged: {
            if (content) {
                content.parent = cardCol
                content.width = Qt.binding(function() { return cardCol.width })
            }
        }
    }

    component FieldLabel: Text {
        color: textSub; font.pixelSize: 12; font.family: "Segoe UI"
    }

    component StyledField: Rectangle {
        property alias text: tf.text
        property string placeholder: ""
        property bool password: false

        width: parent ? parent.width : 500
        height: 42; radius: 8; color: "#181B2B"
        border.color: tf.activeFocus ? accent : "#383E62"
        border.width: tf.activeFocus ? 2 : 1

        TextField {
            id: tf
            anchors { fill: parent; margins: 2 }
            placeholderText: parent.placeholder
            placeholderTextColor: "#737A9E"
            color: "#FFFFFF"
            background: Item {}
            padding: 12
            font { pixelSize: 13; family: "Segoe UI" }
            echoMode: parent.password ? TextInput.Password : TextInput.Normal
        }
    }

    component StyledArea: Rectangle {
        property alias text: ta.text
        property string placeholder: ""

        width: parent ? parent.width : 500
        radius: 8; color: "#181B2B"
        border.color: ta.activeFocus ? accent : "#383E62"
        border.width: ta.activeFocus ? 2 : 1

        TextArea {
            id: ta
            anchors { fill: parent; margins: 2 }
            padding: 12
            placeholderText: parent.placeholder
            placeholderTextColor: "#737A9E"
            color: "#FFFFFF"
            background: Item {}
            wrapMode: Text.Wrap
            font { pixelSize: 13; family: "Segoe UI" }
        }
    }

    component ComboBoxStyled: ComboBox {
        implicitHeight: 40
        background: Rectangle {
            color: surface; radius: 8; border.color: border
        }
        contentItem: Text {
            leftPadding: 12
            text: parent.displayText
            color: textPrimary
            verticalAlignment: Text.AlignVCenter
            font { pixelSize: 13; family: "Segoe UI" }
        }
        delegate: ItemDelegate {
            width: parent.width
            height: 36
            contentItem: Text {
                leftPadding: 8
                text: modelData
                color: highlighted ? "white" : textPrimary
                font { pixelSize: 13; family: "Segoe UI" }
                verticalAlignment: Text.AlignVCenter
            }
            background: Rectangle {
                color: highlighted ? accent : "transparent"
                radius: 6
            }
            highlighted: parent.highlightedIndex === index
        }
        popup.background: Rectangle { color: bgCard; radius: 8; border.color: border; border.width: 1 }
    }

    component ActionButton: Rectangle {
        property string text: ""
        property string icon: ""
        property bool accent: false
        property bool enabled: true
        signal clicked()

        width: btnRow.implicitWidth + 28; height: 36; radius: 8
        color: {
            if (!enabled) return surface
            if (accent)   return accentDark
            return surface
        }
        border.color: accent ? "transparent" : border
        opacity: enabled ? 1.0 : 0.5

        RowLayout {
            id: btnRow
            anchors.centerIn: parent; spacing: 6
            Text { text: parent.parent.icon; font.pixelSize: 14 }
            Text {
                text: parent.parent.text
                color: parent.parent.accent ? "white" : textPrimary
                font { pixelSize: 13; weight: Font.Medium }
            }
        }

        MouseArea {
            anchors.fill: parent
            cursorShape: parent.enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: if (parent.enabled) parent.clicked()
        }

        Behavior on color { ColorAnimation { duration: 120 } }
    }
}
