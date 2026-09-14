import QtQuick 2.15
import QtQuick.Layouts 1.15
import QtQuick.Controls 2.15

Item {
    id: dashboard
    signal editProfile(string id)

    // New profile dialog state
    property bool showNewDialog: false

    ColumnLayout {
        anchors { fill: parent; margins: 24 }
        spacing: 20

        // ─── Header ──────────────────────────────────────────────────────
        RowLayout {
            Layout.fillWidth: true

            Column {
                spacing: 4
                Text {
                    text: "Browser Profiles"
                    color: textPrimary
                    font { pixelSize: 22; weight: Font.Bold; family: "Segoe UI" }
                }
                Text {
                    text: profileModel.rowCount + " total"
                    color: textSub
                    font { pixelSize: 13 }
                }
            }

            Item { Layout.fillWidth: true }

            // New Profile Button
            Rectangle {
                width: 150; height: 40; radius: 10
                gradient: Gradient {
                    orientation: Gradient.Horizontal
                    GradientStop { position: 0.0; color: accent }
                    GradientStop { position: 1.0; color: "#A855F7" }
                }
                layer.enabled: true
                layer.effect: null

                Text {
                    anchors.centerIn: parent
                    text: "+ New Profile"
                    color: "white"
                    font { pixelSize: 13; weight: Font.DemiBold; family: "Segoe UI" }
                }

                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: newProfileDialog.open()
                }

                scale: newBtnMa.pressed ? 0.95 : 1.0
                MouseArea { id: newBtnMa; anchors.fill: parent; hoverEnabled: true }
                Behavior on scale { NumberAnimation { duration: 100 } }
            }
        }

        // ─── Search bar ───────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            height: 42; radius: 10
            color: surface
            border.color: searchField.activeFocus ? accent : border

            Row {
                anchors { verticalCenter: parent.verticalCenter; left: parent.left; leftMargin: 14 }
                spacing: 10
                Text { text: "🔍"; font.pixelSize: 14; color: textSub }
                TextField {
                    id: searchField
                    width: dashboard.width - 200
                    placeholderText: "Search profiles..."
                    placeholderTextColor: textSub
                    color: textPrimary
                    font { pixelSize: 13; family: "Segoe UI" }
                    background: Item {}
                }
            }
        }

        // ─── Profile Grid ─────────────────────────────────────────────────
        ScrollView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

            GridView {
                id: grid
                width: parent.width
                cellWidth: Math.floor(width / Math.max(1, Math.floor(width / 300)))
                cellHeight: 190
                model: profileModel

                delegate: Item {
                    width: grid.cellWidth
                    height: grid.cellHeight

                    ProfileCard {
                        anchors.fill: parent
                        anchors.margins: 8
                        pid:       profileId
                        pname:     profileName
                        proxy:     profileProxy
                        proxyType: profileProxyType
                        status:    profileStatus
                        onEditClicked: (id) => dashboard.editProfile(id)
                        onDeleteClicked: (id) => {
                            deleteConfirm.targetId = id
                            deleteConfirm.open()
                        }
                    }
                }

                // Empty state
                Item {
                    visible: grid.count === 0
                    anchors.centerIn: parent
                    Column {
                        anchors.centerIn: parent
                        spacing: 16

                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: "⊘"; font.pixelSize: 64; color: "#2A2B3A"
                        }
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: "No profiles yet"
                            color: textSub; font { pixelSize: 16 }
                        }
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: "Click '+ New Profile' to get started"
                            color: "#4A4B62"; font { pixelSize: 13 }
                        }
                    }
                }
            }
        }
    }

    // ─── New Profile Dialog ───────────────────────────────────────────────
    Dialog {
        id: newProfileDialog
        anchors.centerIn: parent
        width: 400
        title: "New Profile"
        modal: true

        background: Rectangle {
            color: bgCard; radius: 16; border.color: border
        }

        header: Item {
            height: 56
            Text {
                anchors { verticalCenter: parent.verticalCenter; left: parent.left; leftMargin: 24 }
                text: "Create New Profile"
                color: textPrimary; font { pixelSize: 16; weight: Font.DemiBold }
            }
        }

        contentItem: Column {
            spacing: 12; padding: 24

            Text { text: "Profile Name"; color: textSub; font.pixelSize: 12 }
            Rectangle {
                width: 352; height: 40; radius: 8
                color: surface; border.color: nameField.activeFocus ? accent : border
                TextField {
                    id: nameField
                    anchors.fill: parent
                    anchors.margins: 1
                    placeholderText: "e.g. Account #1"
                    placeholderTextColor: textSub
                    color: textPrimary
                    background: Item {}
                    padding: 12
                }
            }

            Text { text: "Proxy (optional)"; color: textSub; font.pixelSize: 12 }
            Rectangle {
                width: 352; height: 40; radius: 8
                color: surface; border.color: proxyField.activeFocus ? accent : border
                TextField {
                    id: proxyField
                    anchors.fill: parent
                    anchors.margins: 1
                    placeholderText: "socks5://user:pass@host:port"
                    placeholderTextColor: textSub
                    color: textPrimary
                    background: Item {}
                    padding: 12
                    font.family: "Consolas"
                }
            }

            Item { height: 8 }

            Row {
                spacing: 10; anchors.right: parent.right
                Rectangle {
                    width: 90; height: 36; radius: 8; color: surface
                    Text { anchors.centerIn: parent; text: "Cancel"; color: textSub; font.pixelSize: 13 }
                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                        onClicked: { nameField.text = ""; proxyField.text = ""; newProfileDialog.close() }
                    }
                }
                Rectangle {
                    width: 120; height: 36; radius: 8
                    color: nameField.text.trim() ? accent : "#2A2B3A"
                    Behavior on color { ColorAnimation { duration: 150 } }
                    Text { anchors.centerIn: parent; text: "Create"; color: "white"; font { pixelSize: 13; weight: Font.DemiBold } }
                    MouseArea {
                        anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            if (!nameField.text.trim()) return
                            profileManager.createProfile(nameField.text.trim(), proxyField.text.trim())
                            nameField.text = ""; proxyField.text = ""
                            newProfileDialog.close()
                        }
                    }
                }
            }
        }
    }

    // ─── Delete Confirmation Dialog ───────────────────────────────────────
    Dialog {
        id: deleteConfirm
        property string targetId: ""
        anchors.centerIn: parent; width: 360; modal: true
        background: Rectangle { color: bgCard; radius: 16; border.color: border }
        contentItem: Column {
            spacing: 16; padding: 24
            Text { text: "Delete Profile?"; color: textPrimary; font { pixelSize: 16; weight: Font.Bold } }
            Text { text: "This will delete the profile and all its data.\nThis cannot be undone."; color: textSub; font.pixelSize: 13 }
            Row {
                spacing: 10; anchors.right: parent.right
                Rectangle { width: 80; height: 36; radius: 8; color: surface
                    Text { anchors.centerIn: parent; text: "Cancel"; color: textSub; font.pixelSize: 13 }
                    MouseArea { anchors.fill: parent; onClicked: deleteConfirm.close() }
                }
                Rectangle { width: 100; height: 36; radius: 8; color: Qt.rgba(1,0.35,0.47,0.3)
                    Text { anchors.centerIn: parent; text: "Delete"; color: red; font { pixelSize: 13; weight: Font.DemiBold } }
                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                        onClicked: { profileManager.deleteProfile(deleteConfirm.targetId); deleteConfirm.close() }
                    }
                }
            }
        }
    }
}
