import QtQuick 2.15
import QtQuick.Layouts 1.15

// ─── ProxyResultCard ──────────────────────────────────────────────────────
// Displays IP test results in a rich card format.
// Properties to set:
//   ipAddress, ipCountry, ipCountryCode, ipCity, ipIsp, ipAsn
//   ipScore (0-100), ipType, ipTested
//   loading (bool) — show spinner while testing

Item {
    id: root

    property string ipAddress:     ""
    property string ipCountry:     ""
    property string ipCountryCode: ""
    property string ipCity:        ""
    property string ipIsp:         ""
    property string ipAsn:         ""
    property int    ipScore:       -1
    property string ipType:        ""
    property string ipTested:      ""
    property bool   loading:       false
    property bool   hasResult:     ipAddress !== ""

    height: visible ? contentCol.implicitHeight + 32 : 0
    visible: loading || hasResult

    // ── Score color ──
    function scoreColor(score) {
        if (score < 0)   return textSub
        if (score < 20)  return "#22D3A5"   // green — clean
        if (score < 50)  return "#FFAD3A"   // amber — medium
        return "#FF5B7A"                    // red — high risk
    }

    function scoreLabel(score) {
        if (score < 0)   return "Not Tested"
        if (score < 20)  return "Clean"
        if (score < 50)  return "Moderate"
        return "High Risk"
    }

    function typeIcon(t) {
        switch(t) {
        case "residential": return "🏠"
        case "datacenter":  return "🖥"
        case "mobile":      return "📱"
        case "vpn":         return "🔒"
        case "tor":         return "🧅"
        default:            return "❓"
        }
    }

    Rectangle {
        anchors.fill: parent
        radius: 12
        color: "#0D1420"
        border.color: {
            if (root.loading)     return "#21223A"
            if (root.ipScore < 0) return "#21223A"
            if (root.ipScore < 20) return "#22D3A540"
            if (root.ipScore < 50) return "#FFAD3A40"
            return "#FF5B7A40"
        }
        border.width: 1

        // Loading state
        Column {
            id: loadingState
            visible: root.loading
            anchors.centerIn: parent
            spacing: 10

            LoadingSpinner { anchors.horizontalCenter: parent.horizontalCenter }
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: "Testing proxy..."
                color: textSub; font.pixelSize: 12
            }
        }

        // Result state
        Column {
            id: contentCol
            visible: !root.loading && root.hasResult
            anchors {
                top: parent.top; left: parent.left; right: parent.right
                margins: 16
            }
            spacing: 12

            // ── Header row: IP + Score badge ──
            RowLayout {
                width: parent.width

                Column {
                    spacing: 2
                    Text {
                        text: "🌐 " + (root.ipAddress || "—")
                        color: textPrimary
                        font { pixelSize: 15; weight: Font.DemiBold; family: "Consolas" }
                    }
                    Text {
                        text: (root.ipCity ? root.ipCity + ", " : "") + root.ipCountry
                        color: textSub; font.pixelSize: 12
                    }
                }

                Item { Layout.fillWidth: true }

                // Score badge
                Rectangle {
                    width: 90; height: 28; radius: 6
                    color: Qt.rgba(
                        root.scoreColor(root.ipScore) === "#22D3A5" ? 0.13 :
                        root.scoreColor(root.ipScore) === "#FFAD3A" ? 0.25 : 1.0,
                        root.scoreColor(root.ipScore) === "#22D3A5" ? 0.83 :
                        root.scoreColor(root.ipScore) === "#FFAD3A" ? 0.68 : 0.36,
                        root.scoreColor(root.ipScore) === "#22D3A5" ? 0.65 : 0.0,
                        0.2
                    )
                    RowLayout {
                        anchors.centerIn: parent; spacing: 4
                        Text {
                            text: root.ipScore >= 0 ? root.ipScore : "—"
                            color: root.scoreColor(root.ipScore)
                            font { pixelSize: 13; weight: Font.Bold }
                        }
                        Text {
                            text: root.scoreLabel(root.ipScore)
                            color: root.scoreColor(root.ipScore)
                            font.pixelSize: 11
                        }
                    }
                }
            }

            // ── Divider ──
            Rectangle { width: parent.width; height: 1; color: "#21223A" }

            // ── Info grid ──
            GridLayout {
                width: parent.width
                columns: 2; rowSpacing: 8; columnSpacing: 16

                // ISP
                Column {
                    spacing: 2
                    Text { text: "ISP"; color: textSub; font.pixelSize: 11 }
                    Text {
                        text: root.ipIsp || "—"
                        color: textPrimary; font.pixelSize: 12
                        elide: Text.ElideRight; width: 160
                    }
                }

                // Type
                Column {
                    spacing: 2
                    Text { text: "Type"; color: textSub; font.pixelSize: 11 }
                    Text {
                        text: root.typeIcon(root.ipType) + " " + (root.ipType || "—")
                        color: textPrimary; font.pixelSize: 12
                    }
                }

                // ASN
                Column {
                    spacing: 2
                    Text { text: "ASN"; color: textSub; font.pixelSize: 11 }
                    Text {
                        text: root.ipAsn || "—"
                        color: textPrimary; font.pixelSize: 12
                        elide: Text.ElideRight; width: 160
                    }
                }

                // Last tested
                Column {
                    spacing: 2
                    Text { text: "Tested"; color: textSub; font.pixelSize: 11 }
                    Text {
                        text: root.ipTested ? root.ipTested.substring(0, 16).replace("T", " ") : "—"
                        color: textPrimary; font.pixelSize: 12
                    }
                }
            }

            Item { height: 4 }
        }
    }
}
