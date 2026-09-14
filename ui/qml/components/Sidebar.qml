import QtQuick 2.15
import QtQuick.Layouts 1.15

Rectangle {
    id: sidebar
    color: bgSidebar

    property string currentPage: "dashboard"
    signal navigate(string page)

    // Right border divider
    Rectangle {
        anchors { right: parent.right; top: parent.top; bottom: parent.bottom }
        width: 1
        color: border
    }

    ColumnLayout {
        anchors { fill: parent; topMargin: 16; bottomMargin: 16 }
        spacing: 0

        // Logo / Brand
        Item {
            Layout.fillWidth: true
            height: 64

            Column {
                anchors.centerIn: parent
                spacing: 4

                Row {
                    anchors.horizontalCenter: parent.horizontalCenter
                    spacing: 8

                    Rectangle {
                        width: 32; height: 32; radius: 8
                        gradient: Gradient {
                            orientation: Gradient.Horizontal
                            GradientStop { position: 0.0; color: accent }
                            GradientStop { position: 1.0; color: "#A855F7" }
                        }
                        Text {
                            anchors.centerIn: parent
                            text: "F"; color: "white"
                            font { pixelSize: 18; weight: Font.Bold }
                        }
                    }

                    Text {
                        anchors.verticalCenter: parent.verticalCenter
                        text: "FWYS"
                        color: textPrimary
                        font { pixelSize: 20; weight: Font.Bold; family: "Segoe UI" }
                    }
                }

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: "Antidetect Browser"
                    color: textSub
                    font { pixelSize: 10; family: "Segoe UI" }
                }
            }
        }

        // Divider
        Rectangle {
            Layout.fillWidth: true
            Layout.leftMargin: 16; Layout.rightMargin: 16
            height: 1; color: border
            Layout.bottomMargin: 12
        }

        // Nav items
        NavItem { icon: "⊞"; label: "Profiles"; page: "dashboard"; currentPage: sidebar.currentPage; onClicked: sidebar.navigate("dashboard") }
        NavItem { icon: "◈"; label: "Fingerprint"; page: "fingerprint"; currentPage: sidebar.currentPage; onClicked: sidebar.navigate("fingerprint") }
        NavItem { icon: "⇄"; label: "Proxy"; page: "proxy"; currentPage: sidebar.currentPage; onClicked: sidebar.navigate("proxy") }

        Item { Layout.fillHeight: true }

        // Divider
        Rectangle {
            Layout.fillWidth: true
            Layout.leftMargin: 16; Layout.rightMargin: 16; Layout.bottomMargin: 8
            height: 1; color: border
        }

        NavItem { icon: "⚙"; label: "Settings"; page: "settings"; currentPage: sidebar.currentPage; onClicked: sidebar.navigate("settings") }

        // Bottom stats
        Rectangle {
            Layout.fillWidth: true
            Layout.leftMargin: 12; Layout.rightMargin: 12
            Layout.topMargin: 8
            height: 56; radius: 10
            color: surface

            RowLayout {
                anchors { fill: parent; margins: 12 }
                Column {
                    spacing: 2
                    Text { text: "Active"; color: textSub; font.pixelSize: 10 }
                    Text {
                        text: "0 Profiles"
                        color: green; font { pixelSize: 14; weight: Font.DemiBold }
                    }
                }
                Item { Layout.fillWidth: true }
                Rectangle {
                    width: 8; height: 8; radius: 4
                    color: green
                    SequentialAnimation on opacity {
                        loops: Animation.Infinite
                        NumberAnimation { to: 0.3; duration: 800 }
                        NumberAnimation { to: 1.0; duration: 800 }
                    }
                }
            }
        }

        Item { height: 8 }
    }
}

component NavItem: Rectangle {
    property string icon: ""
    property string label: ""
    property string page: ""
    property string currentPage: ""
    signal clicked()

    Layout.fillWidth: true
    Layout.leftMargin: 10; Layout.rightMargin: 10
    Layout.bottomMargin: 4
    height: 44; radius: 10

    readonly property bool isActive: currentPage === page

    color: isActive ? accentGlow : (navMa.containsMouse ? surfaceHover : "transparent")
    Behavior on color { ColorAnimation { duration: 150 } }

    // Active indicator bar
    Rectangle {
        anchors { left: parent.left; verticalCenter: parent.verticalCenter }
        width: 3; height: isActive ? 24 : 0; radius: 2
        color: accent
        Behavior on height { NumberAnimation { duration: 200; easing.type: Easing.OutCubic } }
    }

    RowLayout {
        anchors { fill: parent; leftMargin: 16; rightMargin: 12 }
        spacing: 12

        Text {
            text: icon
            color: isActive ? accent : textSub
            font.pixelSize: 16
            Behavior on color { ColorAnimation { duration: 150 } }
        }

        Text {
            text: label
            color: isActive ? textPrimary : textSub
            font { pixelSize: 13; family: "Segoe UI"; weight: isActive ? Font.DemiBold : Font.Normal }
            Behavior on color { ColorAnimation { duration: 150 } }
        }
    }

    MouseArea {
        id: navMa; anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: parent.clicked()
    }
}
