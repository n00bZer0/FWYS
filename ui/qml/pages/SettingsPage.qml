import QtQuick 2.15
import QtQuick.Layouts 1.15
import QtQuick.Controls 2.15

Item {
    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 28
        spacing: 20

        Text {
            text: "Settings"
            color: textPrimary
            font.pixelSize: 20
            font.weight: Font.Bold
        }

        ScrollView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true

            ColumnLayout {
                width: parent.width
                spacing: 16

                // Chromium Path
                SettingsSection {
                    title: "Browser Engine"
                    content: Column {
                        spacing: 14
                        SettingsRow {
                            label: "Chromium Binary"
                            sublabel: "Path to FWYS patched chrome.exe"
                            control: Rectangle {
                                width: 320
                                height: 36
                                radius: 8
                                color: surface
                                border.color: border
                                Row {
                                    anchors.fill: parent
                                    anchors.margins: 8
                                    spacing: 8
                                    Text {
                                        anchors.verticalCenter: parent.verticalCenter
                                        text: browserLauncher.chromiumPath || "Not detected"
                                        color: browserLauncher.chromiumPath ? textPrimary : textSub
                                        font.pixelSize: 11
                                        font.family: "Consolas"
                                        width: 240
                                        elide: Text.ElideLeft
                                    }
                                    Rectangle {
                                        width: 50
                                        height: 20
                                        radius: 6
                                        color: surface
                                        anchors.verticalCenter: parent.verticalCenter
                                        Text {
                                            anchors.centerIn: parent
                                            text: "Browse"
                                            color: accent
                                            font.pixelSize: 11
                                        }
                                        MouseArea {
                                            anchors.fill: parent
                                            cursorShape: Qt.PointingHandCursor
                                        }
                                    }
                                }
                            }
                        }
                        SettingsRow {
                            label: "Node.js Path"
                            sublabel: "Required for injection layer"
                            control: Rectangle {
                                width: 200
                                height: 36
                                radius: 8
                                color: surface
                                border.color: border
                                TextField {
                                    anchors.fill: parent
                                    anchors.margins: 1
                                    padding: 10
                                    text: browserLauncher.nodejsPath || "node"
                                    color: textPrimary
                                    background: Item {}
                                    font.family: "Consolas"
                                    font.pixelSize: 12
                                }
                            }
                        }
                    }
                }

                // About
                SettingsSection {
                    title: "About"
                    content: Column {
                        spacing: 8
                        Text {
                            text: "FWYS — Finish What You Start"
                            color: textPrimary
                            font.pixelSize: 14
                            font.weight: Font.DemiBold
                        }
                        Text {
                            text: "Version 1.0.0"
                            color: textSub
                            font.pixelSize: 12
                        }
                        Text {
                            text: "Antidetect browser with engine-level fingerprint spoofing."
                            color: textSub
                            font.pixelSize: 12
                        }
                        Text {
                            text: "Base: ungoogled-chromium + Custom C++ patches"
                            color: textSub
                            font.pixelSize: 12
                        }
                        Text {
                            text: "Stack: C++ · Qt 6 · QML · Node.js · Chromium"
                            color: textSub
                            font.pixelSize: 12
                        }
                    }
                }

                Item { height: 20 }
            }
        }
    }

    component SettingsSection: Rectangle {
        property string title: ""
        property Item content
        Layout.fillWidth: true
        height: secCol.implicitHeight + 48
        radius: 14
        color: bgCard
        border.color: border

        Column {
            id: secCol
            anchors.fill: parent
            anchors.margins: 20
            spacing: 14
            Text {
                text: title
                color: textPrimary
                font.pixelSize: 14
                font.weight: Font.DemiBold
            }
            Rectangle {
                width: parent.width
                height: 1
                color: border
            }
        }

        onContentChanged: {
            if (content) {
                content.parent = secCol;
            }
        }
    }

    component SettingsRow: RowLayout {
        property string label: ""
        property string sublabel: ""
        property Item control
        Layout.fillWidth: true

        Column {
            spacing: 3
            Layout.fillWidth: true
            Text {
                text: label
                color: textPrimary
                font.pixelSize: 13
            }
            Text {
                text: sublabel
                color: textSub
                font.pixelSize: 11
            }
        }

        Item {
            id: ctrlSlot
            Layout.alignment: Qt.AlignRight | Qt.AlignVCenter
            implicitWidth: control ? control.implicitWidth || control.width : 0
            implicitHeight: control ? control.implicitHeight || control.height : 0
        }

        onControlChanged: {
            if (control) {
                control.parent = ctrlSlot;
            }
        }
    }
}
