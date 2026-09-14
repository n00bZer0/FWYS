import QtQuick 2.15
import QtQuick.Layouts 1.15

// ─── TabBar ──────────────────────────────────────────────────────────────
// Reusable horizontal tab bar.
//
// Usage:
//   TabBar {
//       id: tabBar
//       tabs: ["Basic", "Proxy", "Fingerprint", "Geo", "Extensions"]
//       currentIndex: 0
//   }
//   onCurrentIndexChanged: stackLayout.currentIndex = tabBar.currentIndex

Item {
    id: root

    property var    tabs:         []
    property int    currentIndex: 0
    property var    tabIcons:     []   // optional emoji icons per tab

    signal tabChanged(int index)

    height: 44
    implicitHeight: 44

    Rectangle {
        anchors.fill: parent
        color: "transparent"

        // Bottom border line
        Rectangle {
            anchors { bottom: parent.bottom; left: parent.left; right: parent.right }
            height: 1; color: border
        }

        Row {
            id: tabRow
            anchors { top: parent.top; left: parent.left; bottom: parent.bottom }
            spacing: 0

            Repeater {
                model: root.tabs

                Item {
                    id: tabItem
                    property bool isActive: root.currentIndex === index
                    property bool hovered: false

                    width: tabLabel.implicitWidth + 40
                    height: root.height

                    // Active indicator line (bottom)
                    Rectangle {
                        anchors { bottom: parent.bottom; left: parent.left; right: parent.right }
                        height: 2
                        radius: 1
                        color: accent
                        visible: tabItem.isActive
                        Behavior on visible { }
                    }

                    // Hover highlight
                    Rectangle {
                        anchors.fill: parent
                        color: tabItem.hovered && !tabItem.isActive ? "#ffffff08" : "transparent"
                        Behavior on color { ColorAnimation { duration: 100 } }
                    }

                    Row {
                        id: tabLabel
                        anchors.centerIn: parent
                        spacing: 6

                        Text {
                            visible: root.tabIcons.length > index
                            text: root.tabIcons.length > index ? root.tabIcons[index] : ""
                            font.pixelSize: 14
                            anchors.verticalCenter: parent.verticalCenter
                        }

                        Text {
                            text: modelData
                            color: tabItem.isActive ? textPrimary : textSub
                            font {
                                pixelSize: 13
                                weight: tabItem.isActive ? Font.DemiBold : Font.Normal
                                family: "Segoe UI"
                            }
                            Behavior on color { ColorAnimation { duration: 150 } }
                        }
                    }

                    MouseArea {
                        anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        hoverEnabled: true
                        onClicked: {
                            root.currentIndex = index
                            root.tabChanged(index)
                        }
                        onEntered: tabItem.hovered = true
                        onExited:  tabItem.hovered = false
                    }

                    // Active tab scale animation
                    Behavior on opacity { NumberAnimation { duration: 150 } }
                }
            }
        }
    }
}
