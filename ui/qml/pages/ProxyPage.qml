import QtQuick 2.15
import QtQuick.Layouts 1.15
import QtQuick.Controls 2.15

Item {
    ColumnLayout {
        anchors { fill: parent; margins: 28 }; spacing: 20

        Text { text: "Proxy Manager"; color: textPrimary; font { pixelSize: 20; weight: Font.Bold } }
        Text { text: "Proxies are set per-profile in the Profile Editor"; color: textSub; font.pixelSize: 13 }

        // Quick test panel
        Rectangle {
            Layout.fillWidth: true; height: 130; radius: 14
            color: bgCard; border.color: border

            ColumnLayout {
                anchors { fill: parent; margins: 20 }; spacing: 12
                Text { text: "⚡  Quick Proxy Test"; color: textPrimary; font { pixelSize: 14; weight: Font.DemiBold } }

                RowLayout {
                    spacing: 12
                    Rectangle {
                        Layout.fillWidth: true; height: 40; radius: 8
                        color: surface; border.color: border
                        TextField {
                            anchors { fill: parent; margins: 1 }; padding: 12
                            placeholderText: "socks5://user:pass@host:1080"
                            placeholderTextColor: textSub; color: textPrimary
                            background: Item {}; font.family: "Consolas"
                        }
                    }
                    Rectangle {
                        width: 100; height: 40; radius: 8; color: accent
                        Text { anchors.centerIn: parent; text: "Test"; color: "white"; font { pixelSize: 13; weight: Font.DemiBold } }
                        MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor }
                    }
                }

                Text { text: "Enter proxy address above and click Test to check connectivity"; color: textSub; font.pixelSize: 11 }
            }
        }

        // Info card
        Rectangle {
            Layout.fillWidth: true; height: 80; radius: 14
            color: Qt.rgba(0.42, 0.39, 1, 0.08); border.color: Qt.rgba(0.42, 0.39, 1, 0.3)
            Row {
                anchors { fill: parent; margins: 16 }; spacing: 14
                Text { text: "ℹ"; font.pixelSize: 24; color: accent; anchors.verticalCenter: parent.verticalCenter }
                Column {
                    anchors.verticalCenter: parent.verticalCenter; spacing: 4
                    Text { text: "Proxies are configured per profile"; color: textPrimary; font { pixelSize: 13; weight: Font.DemiBold } }
                    Text { text: "Go to Profile Editor to set proxy for a specific profile"; color: textSub; font.pixelSize: 12 }
                }
            }
        }

        Item { Layout.fillHeight: true }
    }
}
