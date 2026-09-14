import QtQuick 2.15
import QtQuick.Layouts 1.15
import QtQuick.Controls 2.15

Item {
    property string profileId: ""
    signal back()

    ColumnLayout {
        anchors { fill: parent; margins: 28 }
        spacing: 20

        // Header
        RowLayout {
            Rectangle {
                width: 36; height: 36; radius: 8; color: surface
                Text { anchors.centerIn: parent; text: "←"; color: textPrimary; font.pixelSize: 18 }
                MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: back() }
            }
            Text {
                text: profileId ? "Edit Profile" : "New Profile"
                color: textPrimary; font { pixelSize: 20; weight: Font.Bold }
            }
        }

        ScrollView {
            Layout.fillWidth: true; Layout.fillHeight: true; clip: true

            ColumnLayout {
                width: parent.width; spacing: 20

                // Basic Info Section
                SectionCard {
                    title: "Basic Information"
                    content: Column {
                        spacing: 16

                        FormField { label: "Profile Name"; placeholder: "e.g. Facebook Account #1" }
                        FormField { label: "Notes"; placeholder: "Optional notes..."; multiline: true }
                    }
                }

                // Proxy Section
                SectionCard {
                    title: "Proxy Configuration"
                    content: Column {
                        spacing: 16

                        Row {
                            spacing: 12
                            Repeater {
                                model: ["None", "HTTP", "SOCKS5"]
                                Rectangle {
                                    width: 80; height: 34; radius: 8
                                    color: index === 0 ? accent : surface
                                    border.color: index === 0 ? "transparent" : border
                                    Text {
                                        anchors.centerIn: parent; text: modelData
                                        color: index === 0 ? "white" : textSub
                                        font { pixelSize: 12; weight: Font.Medium }
                                    }
                                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor }
                                }
                            }
                        }

                        FormField { label: "Host"; placeholder: "proxy.example.com" }
                        Row {
                            spacing: 12
                            FormField { label: "Port"; placeholder: "1080"; width_: 120 }
                            FormField { label: "Username"; placeholder: "Optional" }
                            FormField { label: "Password"; placeholder: "Optional"; password: true }
                        }

                        // Test proxy button
                        Rectangle {
                            width: 130; height: 36; radius: 8; color: surface; border.color: border
                            Text { anchors.centerIn: parent; text: "⚡ Test Proxy"; color: accent; font { pixelSize: 13 } }
                            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor }
                        }
                    }
                }

                // Save button
                Rectangle {
                    Layout.fillWidth: true; height: 46; radius: 12
                    gradient: Gradient {
                        orientation: Gradient.Horizontal
                        GradientStop { position: 0.0; color: accent }
                        GradientStop { position: 1.0; color: "#A855F7" }
                    }
                    Text { anchors.centerIn: parent; text: "Save Profile"; color: "white"; font { pixelSize: 14; weight: Font.DemiBold } }
                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: back() }
                }

                Item { height: 20 }
            }
        }
    }
}

component SectionCard: Rectangle {
    property string title: ""
    property Item content
    Layout.fillWidth: true
    height: contentColumn.implicitHeight + 56
    radius: 14; color: bgCard; border.color: border

    Column {
        id: contentColumn
        anchors { fill: parent; margins: 20 }
        spacing: 16

        Text {
            text: title; color: textPrimary
            font { pixelSize: 14; weight: Font.DemiBold }
        }
        Rectangle { width: parent.width; height: 1; color: border }
        Loader { sourceComponent: content ? content : null }
    }
}

component FormField: Column {
    property string label: ""
    property string placeholder: ""
    property bool multiline: false
    property bool password: false
    property int width_: 0

    spacing: 6
    width: width_ > 0 ? width_ : parent.width

    Text { text: label; color: textSub; font.pixelSize: 12 }
    Rectangle {
        width: parent.width
        height: multiline ? 80 : 40; radius: 8
        color: surface; border.color: border

        TextArea {
            visible: multiline
            anchors.fill: parent; padding: 10
            placeholderText: placeholder; placeholderTextColor: textSub
            color: textPrimary; background: Item {}; wrapMode: Text.Wrap
        }
        TextField {
            visible: !multiline
            anchors.fill: parent; padding: 12
            placeholderText: placeholder; placeholderTextColor: textSub
            color: textPrimary; background: Item {}
            echoMode: password ? TextInput.Password : TextInput.Normal
        }
    }
}
