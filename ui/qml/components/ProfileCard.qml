import QtQuick 2.15
import QtQuick.Layouts 1.15
import QtQuick.Controls 2.15

Rectangle {
    id: card

    // ── Properties ────────────────────────────────────────────────────────────
    property string pid:        ""
    property string pname:      "Profile"
    property string proxy:      ""
    property string proxyType:  "none"
    property int    status:     0       // 0=idle, 1=running, 2=error, 3=launching
    property string osType:     "windows10"
    property string exitIp:     ""      // e.g. "142.250.10.1"
    property string countryFlag: ""     // e.g. "🇺🇸"
    property string countryCode: ""     // e.g. "US"
    property int    riskScore:  -1      // -1 = not tested, 0-100
    property string lastUsed:   ""

    signal launchClicked(string profileId)
    signal stopClicked(string profileId)
    signal editClicked(string profileId)
    signal deleteClicked(string profileId)

    // ── Appearance ────────────────────────────────────────────────────────────
    radius: 14
    color: cardMa.containsMouse
           ? Qt.lighter(bgCard, 1.08)
           : (status === 1 ? Qt.rgba(0.1, 0.09, 0.22, 1) : bgCard)
    border.color: {
        if (status === 1) return Qt.rgba(0.42, 0.39, 1.0, 0.70)
        if (status === 2) return Qt.rgba(1.0, 0.35, 0.47, 0.60)
        if (status === 3) return Qt.rgba(0.13, 0.85, 0.64, 0.50)
        return borderColor
    }
    border.width: (status === 1 || status === 2 || status === 3) ? 1.5 : 1
    clip: true

    Behavior on color        { ColorAnimation { duration: 150 } }
    Behavior on border.color { ColorAnimation { duration: 150 } }

    // Running glow pulse
    Rectangle {
        id: glowRing
        anchors.fill: parent
        radius: parent.radius
        color: "transparent"
        border.color: status === 1 ? "#6C63FF"
                    : status === 3 ? "#22D3A5"
                    : "transparent"
        border.width: 8
        opacity: 0
        visible: status === 1 || status === 3

        SequentialAnimation on opacity {
            running: glowRing.visible
            loops: Animation.Infinite
            NumberAnimation { to: 0.35; duration: 900; easing.type: Easing.InOutSine }
            NumberAnimation { to: 0.0;  duration: 900; easing.type: Easing.InOutSine }
        }
    }

    MouseArea { id: cardMa; anchors.fill: parent; hoverEnabled: true }

    ColumnLayout {
        anchors { fill: parent; margins: 14 }
        spacing: 9

        // ── Row 1: Avatar + Name + Status + Menu ─────────────────────────────
        RowLayout {
            Layout.fillWidth: true
            spacing: 10

            // Avatar — gradient + initials
            Rectangle {
                width: 42; height: 42; radius: 12
                gradient: Gradient {
                    orientation: Gradient.Horizontal
                    GradientStop { position: 0.0; color: avatarColor(pname) }
                    GradientStop { position: 1.0; color: Qt.darker(avatarColor(pname), 1.4) }
                }
                // Running indicator dot
                Rectangle {
                    width: 10; height: 10; radius: 5
                    anchors { top: parent.top; right: parent.right; margins: -2 }
                    color: status === 1 ? "#22D3A5"
                         : status === 3 ? "#F59E0B"
                         : status === 2 ? "#FF6B6B"
                         : "transparent"
                    border.color: bgCard; border.width: 1.5
                    visible: status !== 0
                    SequentialAnimation on scale {
                        running: status === 1
                        loops: Animation.Infinite
                        NumberAnimation { to: 1.3; duration: 600 }
                        NumberAnimation { to: 1.0; duration: 600 }
                    }
                }
                Text {
                    anchors.centerIn: parent
                    text: pname.length > 0 ? pname[0].toUpperCase() : "P"
                    color: "white"
                    font { pixelSize: 18; weight: Font.Bold; family: "Segoe UI" }
                }
            }

            // Name + status badge
            Column {
                Layout.fillWidth: true
                spacing: 4
                Text {
                    text: pname
                    color: textPrimary
                    font { pixelSize: 14; weight: Font.DemiBold; family: "Segoe UI" }
                    elide: Text.ElideRight
                    width: parent.width
                }
                Row {
                    spacing: 5
                    StatusBadge { status: card.status }
                    // OS icon
                    Text {
                        text: osIcon(card.osType)
                        font.pixelSize: 12
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }
            }

            // Options menu button
            ToolButton {
                width: 28; height: 28
                contentItem: Text {
                    text: "⋯"; color: textSub; font.pixelSize: 16
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }
                background: Rectangle {
                    radius: 6
                    color: parent.hovered ? surface : "transparent"
                    Behavior on color { ColorAnimation { duration: 100 } }
                }
                onClicked: optionsMenu.open()

                Menu {
                    id: optionsMenu
                    background: Rectangle {
                        color: bgCard; radius: 10
                        border.color: borderColor; border.width: 1
                    }
                    MenuItem {
                        text: "✏  Edit Profile"
                        contentItem: Text {
                            text: parent.text; color: textPrimary; font.pixelSize: 13
                            leftPadding: 6
                        }
                        background: Rectangle {
                            color: parent.highlighted ? surface : "transparent"
                            radius: 6; implicitHeight: 36
                        }
                        onTriggered: card.editClicked(card.pid)
                    }
                    MenuSeparator {
                        contentItem: Rectangle { implicitHeight: 1; color: borderColor }
                    }
                    MenuItem {
                        text: "🗑  Delete"
                        contentItem: Text {
                            text: parent.text; color: "#FF6B6B"; font.pixelSize: 13
                            leftPadding: 6
                        }
                        background: Rectangle {
                            color: parent.highlighted
                                   ? Qt.rgba(1, 0.35, 0.47, 0.12)
                                   : "transparent"
                            radius: 6; implicitHeight: 36
                        }
                        onTriggered: card.deleteClicked(card.pid)
                    }
                }
            }
        }

        // ── Row 2: IP badge + Risk score ─────────────────────────────────────
        RowLayout {
            Layout.fillWidth: true
            spacing: 6
            visible: exitIp !== "" || riskScore >= 0

            // IP badge
            Rectangle {
                visible: exitIp !== ""
                height: 24; radius: 7
                width: ipRow.implicitWidth + 16
                color: surface
                Row {
                    id: ipRow
                    anchors.centerIn: parent
                    spacing: 4
                    Text {
                        text: countryFlag !== "" ? countryFlag : "🌐"
                        font.pixelSize: 12
                        anchors.verticalCenter: parent.verticalCenter
                    }
                    Text {
                        text: exitIp
                        color: textPrimary
                        font { pixelSize: 11; family: "Consolas" }
                        anchors.verticalCenter: parent.verticalCenter
                    }
                }
            }

            Item { Layout.fillWidth: true }

            // Risk score badge
            Rectangle {
                visible: riskScore >= 0
                height: 24; width: 60; radius: 7
                color: riskColor(riskScore)
                Text {
                    anchors.centerIn: parent
                    text: riskScore < 0 ? "--"
                        : riskScore <= 30 ? "✓ " + riskScore
                        : riskScore <= 60 ? "⚠ " + riskScore
                        : "✗ " + riskScore
                    color: "white"
                    font { pixelSize: 11; weight: Font.DemiBold }
                }
                ToolTip.visible: riskMa.containsMouse
                ToolTip.text: riskScore <= 30 ? "Low risk — good proxy"
                            : riskScore <= 60 ? "Medium risk — check proxy"
                            : "High risk — IP flagged!"
                ToolTip.delay: 400
                MouseArea { id: riskMa; anchors.fill: parent; hoverEnabled: true }
            }
        }

        // ── Row 3: Proxy info ─────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            height: 28; radius: 8
            color: surface

            Row {
                anchors { verticalCenter: parent.verticalCenter
                          left: parent.left; leftMargin: 10 }
                spacing: 6

                Text {
                    text: proxyTypeIcon(proxyType)
                    font.pixelSize: 11
                    color: proxy !== "" ? accent : textSub
                    anchors.verticalCenter: parent.verticalCenter
                }
                Text {
                    text: proxy !== "" ? proxyType.toUpperCase() + " · " + proxyHost()
                                       : "No proxy configured"
                    color: proxy !== "" ? textPrimary : textSub
                    font { pixelSize: 11; family: "Consolas" }
                    elide: Text.ElideRight
                    width: card.width - 80
                    anchors.verticalCenter: parent.verticalCenter
                }
            }
        }

        // ── Row 4: Launch / Stop button ───────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            height: 34; radius: 10

            color: {
                if (status === 1) return Qt.rgba(1, 0.35, 0.47, 0.18)
                if (status === 3) return Qt.rgba(0.13, 0.85, 0.64, 0.18)
                if (status === 2) return Qt.rgba(1, 0.35, 0.47, 0.18)
                return accent
            }
            Behavior on color { ColorAnimation { duration: 200 } }

            border.color: {
                if (status === 1) return Qt.rgba(1, 0.35, 0.47, 0.5)
                if (status === 3) return Qt.rgba(0.13, 0.85, 0.64, 0.5)
                return "transparent"
            }
            border.width: 1

            // Press ripple
            Rectangle {
                anchors.fill: parent; radius: parent.radius
                color: launchMa.pressed ? "#00000030" : "transparent"
            }

            // Launching spinner dot
            Row {
                anchors.centerIn: parent
                spacing: 8
                visible: status === 3

                Repeater {
                    model: 3
                    Rectangle {
                        width: 5; height: 5; radius: 2.5
                        color: "#22D3A5"
                        SequentialAnimation on opacity {
                            running: true; loops: Animation.Infinite
                            PauseAnimation { duration: index * 150 }
                            NumberAnimation { to: 1.0; duration: 200 }
                            NumberAnimation { to: 0.2; duration: 400 }
                            PauseAnimation { duration: (2 - index) * 150 }
                        }
                    }
                }
            }

            Text {
                anchors.centerIn: parent
                visible: status !== 3
                text: status === 1 ? "⏹   Stop"
                    : status === 2 ? "⟳   Retry"
                    : "▶   Launch"
                color: status === 1 ? "#FF6B6B"
                     : status === 2 ? "#F59E0B"
                     : "white"
                font { pixelSize: 13; weight: Font.DemiBold; family: "Segoe UI" }
            }

            MouseArea {
                id: launchMa
                anchors.fill: parent
                cursorShape: status === 3 ? Qt.BusyCursor : Qt.PointingHandCursor
                enabled: status !== 3

                onClicked: {
                    if (status === 1) {
                        card.stopClicked(card.pid)
                    } else {
                        card.launchClicked(card.pid)
                    }
                }
            }
        }

        // ── Row 5: Last used ──────────────────────────────────────────────────
        Text {
            Layout.fillWidth: true
            visible: lastUsed !== ""
            text: "Last used: " + formatRelative(lastUsed)
            color: textSub
            font { pixelSize: 10; family: "Segoe UI" }
            horizontalAlignment: Text.AlignRight
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function avatarColor(name) {
        const colors = ["#6C63FF","#A855F7","#22D3A5","#3B82F6",
                        "#F59E0B","#EC4899","#14B8A6","#F97316"]
        let hash = 0
        for (let i = 0; i < name.length; i++)
            hash = name.charCodeAt(i) + ((hash << 5) - hash)
        return colors[Math.abs(hash) % colors.length]
    }

    function osIcon(os) {
        if (!os) return "🖥"
        const o = os.toLowerCase()
        if (o.includes("win")) return "🪟"
        if (o.includes("mac")) return "🍎"
        if (o.includes("linux")) return "🐧"
        if (o.includes("android")) return "🤖"
        return "🖥"
    }

    function proxyTypeIcon(t) {
        if (!t || t === "none") return "⛔"
        if (t === "socks5") return "🔒"
        if (t === "socks4") return "🔑"
        if (t === "http" || t === "https") return "🌐"
        if (t === "ssh") return "🛡"
        return "🔌"
    }

    function proxyHost() {
        if (!proxy) return ""
        // Extract host:port from full proxy string
        let p = proxy
        // Strip protocol prefix
        p = p.replace(/^(https?|socks[45]|ssh):\/\//i, "")
        // Strip user:pass@
        const at = p.lastIndexOf("@")
        if (at >= 0) p = p.substring(at + 1)
        return p
    }

    function riskColor(score) {
        if (score < 0)  return surface
        if (score <= 30) return "#16A34A"   // green
        if (score <= 60) return "#D97706"   // amber
        return "#DC2626"                    // red
    }

    function formatRelative(dateStr) {
        if (!dateStr) return ""
        const d = new Date(dateStr)
        if (isNaN(d)) return dateStr
        const diff = (Date.now() - d.getTime()) / 1000
        if (diff < 60)    return "just now"
        if (diff < 3600)  return Math.floor(diff/60) + "m ago"
        if (diff < 86400) return Math.floor(diff/3600) + "h ago"
        return Math.floor(diff/86400) + "d ago"
    }
}
