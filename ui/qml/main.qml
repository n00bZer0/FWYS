import QtQuick 2.15
import QtQuick.Controls 2.15
import QtQuick.Controls.Material 2.15
import QtQuick.Layouts 1.15
import QtQuick.Window 2.15

ApplicationWindow {
    id: root
    visible: true
    width: 1280
    height: 780
    minimumWidth: 1000
    minimumHeight: 600
    title: "FWYS — Finish What You Start"

    // ─── Global Design Tokens ───────────────────────────────────────────
    readonly property color bg:          "#0D0E14"
    readonly property color bgCard:      "#13141C"
    readonly property color bgSidebar:   "#0A0B10"
    readonly property color surface:     "#1A1B26"
    readonly property color surfaceHover:"#212235"
    readonly property color accent:      "#6C63FF"
    readonly property color accentGlow:  "#6C63FF44"
    readonly property color accentDark:  "#4E48CC"
    readonly property color green:       "#22D3A5"
    readonly property color red:         "#FF5B7A"
    readonly property color amber:       "#FFAD3A"
    readonly property color textPrimary: "#E8E9F5"
    readonly property color textSub:     "#7879A0"
    readonly property color border:      "#21223A"

    // Active navigation page
    property string currentPage: "dashboard"
    property string selectedProfileId: ""

    Material.theme: Material.Dark
    Material.accent: accent
    color: bg

    // Remove default titlebar
    flags: Qt.Window | Qt.FramelessWindowHint

    // ─── Drag to move (custom titlebar) ─────────────────────────────────
    MouseArea {
        id: dragArea
        anchors { top: parent.top; left: parent.left; right: parent.right }
        height: 44
        property point startPos
        onPressed: startPos = Qt.point(mouse.screenX - root.x, mouse.screenY - root.y)
        onPositionChanged: if (pressed) root.setX(mouse.screenX - startPos.x); root.setY(mouse.screenY - startPos.y)
    }

    RowLayout {
        anchors.fill: parent
        spacing: 0

        // ─── Sidebar ────────────────────────────────────────────────────
        Sidebar {
            id: sidebar
            Layout.fillHeight: true
            Layout.preferredWidth: 220
            currentPage: root.currentPage
            onNavigate: (page) => { root.currentPage = page }
        }

        // ─── Main Content ────────────────────────────────────────────────
        Rectangle {
            Layout.fillHeight: true
            Layout.fillWidth: true
            color: root.bg

            ColumnLayout {
                anchors.fill: parent
                spacing: 0

                // Custom title bar
                Rectangle {
                    Layout.fillWidth: true
                    height: 44
                    color: "transparent"

                    RowLayout {
                        anchors { fill: parent; leftMargin: 20; rightMargin: 12 }

                        Text {
                            text: {
                                switch(root.currentPage) {
                                case "dashboard":   return "Profiles"
                                case "editor":      return "Edit Profile"
                                case "fingerprint": return "Fingerprint"
                                case "proxy":       return "Proxy Manager"
                                case "settings":    return "Settings"
                                default:            return "FWYS"
                                }
                            }
                            font { pixelSize: 18; family: "Segoe UI"; weight: Font.DemiBold }
                            color: root.textPrimary
                        }

                        Item { Layout.fillWidth: true }

                        // Window controls
                        Row {
                            spacing: 8
                            WinBtn { text: "─"; onClicked: root.showMinimized() }
                            WinBtn { text: "□"; onClicked: root.showMaximized() }
                            WinBtn { text: "✕"; isClose: true; onClicked: Qt.quit() }
                        }
                    }
                }

                // Page content
                StackLayout {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    currentIndex: ["dashboard","editor","fingerprint","proxy","settings"].indexOf(root.currentPage)

                    DashboardPage {
                        onEditProfile: (id) => {
                            root.selectedProfileId = id
                            root.currentPage = "editor"
                        }
                    }
                    ProfileEditorPage {
                        profileId: root.selectedProfileId
                        onBack: root.currentPage = "dashboard"
                    }
                    FingerprintPage {
                        profileId: root.selectedProfileId
                    }
                    ProxyPage {}
                    SettingsPage {}
                }
            }
        }
    }

    // ─── Window resize handle (bottom-right) ────────────────────────────
    MouseArea {
        anchors { right: parent.right; bottom: parent.bottom }
        width: 16; height: 16
        cursorShape: Qt.SizeFDiagCursor
        property point startPos
        property size startSize
        onPressed: {
            startPos = Qt.point(mouse.screenX, mouse.screenY)
            startSize = Qt.size(root.width, root.height)
        }
        onPositionChanged: if (pressed) {
            root.width  = Math.max(root.minimumWidth,  startSize.width  + mouse.screenX - startPos.x)
            root.height = Math.max(root.minimumHeight, startSize.height + mouse.screenY - startPos.y)
        }
    }
}

// ─── Mini window button component ──────────────────────────────────────────
component WinBtn: Rectangle {
    property string text: ""
    property bool isClose: false
    signal clicked()

    width: 32; height: 28
    radius: 6
    color: maWin.containsMouse ? (isClose ? "#FF4455" : "#ffffff18") : "transparent"
    Behavior on color { ColorAnimation { duration: 120 } }

    Text {
        anchors.centerIn: parent
        text: parent.text
        color: maWin.containsMouse ? "#fff" : "#7879A0"
        font.pixelSize: 13
    }
    MouseArea {
        id: maWin; anchors.fill: parent; hoverEnabled: true
        onClicked: parent.clicked()
    }
}
