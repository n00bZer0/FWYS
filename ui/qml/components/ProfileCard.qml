import QtQuick 2.15
import QtQuick.Layouts 1.15
import QtQuick.Controls 2.15

Rectangle {
    id: card
    property string pid: ""
    property string pname: "Profile"
    property string proxy: ""
    property string proxyType: "none"
    property int status: 0           // 0=idle, 1=running, 2=error
    property string createdAt: ""

    signal launchClicked(string profileId)
    signal editClicked(string profileId)
    signal deleteClicked(string profileId)

    radius: 14
    color: cardMa.containsMouse ? surfaceHover : bgCard
    border.color: status === 1 ? Qt.rgba(0.42, 0.39, 1, 0.5) : border
    border.width: status === 1 ? 1.5 : 1
    clip: true

    Behavior on color { ColorAnimation { duration: 120 } }

    // Glow when running
    Rectangle {
        anchors.fill: parent; radius: parent.radius
        color: "transparent"
        border.color: accentGlow
        border.width: status === 1 ? 8 : 0
        Behavior on border.width { NumberAnimation { duration: 300 } }
        opacity: 0.5
    }

    MouseArea {
        id: cardMa; anchors.fill: parent; hoverEnabled: true
    }

    ColumnLayout {
        anchors { fill: parent; margins: 16 }
        spacing: 10

        // Header row
        RowLayout {
            Layout.fillWidth: true
            spacing: 10

            // Avatar
            Rectangle {
                width: 40; height: 40; radius: 12
                gradient: Gradient {
                    orientation: Gradient.Horizontal
                    GradientStop { position: 0.0; color: avatarColor(pname) }
                    GradientStop { position: 1.0; color: Qt.darker(avatarColor(pname), 1.3) }
                }
                Text {
                    anchors.centerIn: parent
                    text: pname.length > 0 ? pname[0].toUpperCase() : "P"
                    color: "white"; font { pixelSize: 18; weight: Font.Bold }
                }
            }

            Column {
                Layout.fillWidth: true
                spacing: 3
                Text {
                    text: pname
                    color: textPrimary
                    font { pixelSize: 14; weight: Font.DemiBold; family: "Segoe UI" }
                    elide: Text.ElideRight; width: parent.width
                }
                StatusBadge { status: card.status }
            }

            // Options button
            ToolButton {
                text: "⋯"
                font.pixelSize: 18
                contentItem: Text {
                    text: "⋯"; color: textSub; font.pixelSize: 18
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                }
                background: Rectangle {
                    radius: 6
                    color: parent.hovered ? surface : "transparent"
                }
                onClicked: optionsMenu.open()

                Menu {
                    id: optionsMenu
                    background: Rectangle { color: surface; radius: 10; border.color: border }
                    MenuItem {
                        text: "✏ Edit Profile"
                        contentItem: Text { text: parent.text; color: textPrimary; font.pixelSize: 13 }
                        background: Rectangle { color: parent.highlighted ? surfaceHover : "transparent"; radius: 6 }
                        onTriggered: card.editClicked(card.pid)
                    }
                    MenuItem {
                        text: "🗑 Delete"
                        contentItem: Text { text: parent.text; color: red; font.pixelSize: 13 }
                        background: Rectangle { color: parent.highlighted ? Qt.rgba(1,0.35,0.47,0.15) : "transparent"; radius: 6 }
                        onTriggered: card.deleteClicked(card.pid)
                    }
                }
            }
        }

        // Proxy info
        Rectangle {
            Layout.fillWidth: true
            height: 30; radius: 8
            color: surface

            Row {
                anchors { verticalCenter: parent.verticalCenter; left: parent.left; leftMargin: 10 }
                spacing: 6

                Text {
                    text: {
                        if (proxyType === "none" || proxy === "") return "No proxy"
                        return proxyType.toUpperCase() + " · " + proxy
                    }
                    color: proxy ? textPrimary : textSub
                    font { pixelSize: 11; family: "Consolas" }
                    elide: Text.ElideRight
                    width: card.width - 60
                }
            }
        }

        // Launch / Stop button
        Rectangle {
            Layout.fillWidth: true
            height: 36; radius: 10
            color: status === 1 ? Qt.rgba(1,0.35,0.47,0.2) : accent
            Behavior on color { ColorAnimation { duration: 200 } }

            Rectangle {
                anchors.fill: parent; radius: parent.radius
                color: launchMa.pressed ? "#00000033" : "transparent"
            }

            Text {
                anchors.centerIn: parent
                text: status === 1 ? "⏹  Stop" : "▶  Launch"
                color: status === 1 ? red : "white"
                font { pixelSize: 13; weight: Font.DemiBold; family: "Segoe UI" }
            }

            MouseArea {
                id: launchMa; anchors.fill: parent
                cursorShape: Qt.PointingHandCursor
                onClicked: {
                    if (card.status === 1) {
                        browserLauncher.closeProfile(card.pid)
                    } else {
                        browserLauncher.launchProfile(card.pid)
                    }
                }
            }
        }
    }

    function avatarColor(name) {
        const colors = ["#6C63FF","#A855F7","#22D3A5","#3B82F6","#F59E0B","#EC4899","#14B8A6"]
        let hash = 0
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
        return colors[Math.abs(hash) % colors.length]
    }
}
