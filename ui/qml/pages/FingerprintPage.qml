import QtQuick 2.15
import QtQuick.Layouts 1.15
import QtQuick.Controls 2.15

Item {
    property string profileId: ""

    ColumnLayout {
        anchors { fill: parent; margins: 28 }
        spacing: 20

        Text {
            text: "Fingerprint Configuration"
            color: textPrimary; font { pixelSize: 20; weight: Font.Bold }
        }
        Text {
            text: "Configure what values your browser will report to websites"
            color: textSub; font.pixelSize: 13
        }

        ScrollView {
            Layout.fillWidth: true; Layout.fillHeight: true; clip: true

            ColumnLayout {
                width: parent.width; spacing: 16

                // WebGL Group
                FpGroup {
                    title: "🎮  WebGL"
                    model: [
                        { key: "webgl_vendor",   label: "GPU Vendor",   val: "Google Inc. (NVIDIA)" },
                        { key: "webgl_renderer",  label: "GPU Renderer", val: "ANGLE (NVIDIA, RTX 3060 Direct3D11)" },
                    ]
                }

                // Navigator Group
                FpGroup {
                    title: "🧭  Navigator"
                    model: [
                        { key: "hardware_concurrency", label: "CPU Threads",    val: "8" },
                        { key: "device_memory",        label: "Device Memory",  val: "8 GB" },
                        { key: "platform",             label: "Platform",       val: "Win32" },
                        { key: "user_agent",           label: "User Agent",     val: "Chrome/128 Windows" },
                    ]
                }

                // Screen Group
                FpGroup {
                    title: "🖥  Screen"
                    model: [
                        { key: "screen_width",  label: "Width",  val: "1920" },
                        { key: "screen_height", label: "Height", val: "1080" },
                    ]
                }

                // Noise Seeds
                FpGroup {
                    title: "🎲  Noise Seeds (auto-generated)"
                    model: [
                        { key: "canvas_seed", label: "Canvas Seed",  val: "Auto" },
                        { key: "audio_seed",  label: "Audio Seed",   val: "Auto" },
                        { key: "font_seed",   label: "Font Seed",    val: "Auto" },
                    ]
                }

                // WebRTC
                Rectangle {
                    Layout.fillWidth: true; height: 90; radius: 14
                    color: bgCard; border.color: border
                    ColumnLayout {
                        anchors { fill: parent; margins: 16 }
                        Text { text: "📡  WebRTC Mode"; color: textPrimary; font { pixelSize: 13; weight: Font.DemiBold } }
                        Row {
                            spacing: 8
                            Repeater {
                                model: ["Allow All", "Filter Local IPs", "Block All"]
                                Rectangle {
                                    width: 130; height: 32; radius: 8
                                    color: index === 1 ? accent : surface
                                    border.color: index === 1 ? "transparent" : border
                                    Text {
                                        anchors.centerIn: parent; text: modelData
                                        color: index === 1 ? "white" : textSub; font.pixelSize: 12
                                    }
                                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor }
                                }
                            }
                        }
                    }
                }

                // Regenerate button
                Rectangle {
                    Layout.fillWidth: true; height: 46; radius: 12
                    color: surface; border.color: accent
                    Text { anchors.centerIn: parent; text: "🔄  Regenerate Fingerprint"; color: accent; font { pixelSize: 14; weight: Font.DemiBold } }
                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor }
                }

                Item { height: 20 }
            }
        }
    }
}

component FpGroup: Rectangle {
    property string title: ""
    property var model: []
    Layout.fillWidth: true
    height: groupCol.implicitHeight + 40
    radius: 14; color: bgCard; border.color: border

    Column {
        id: groupCol; anchors { fill: parent; margins: 16 }; spacing: 12

        Text { text: parent.title; color: textPrimary; font { pixelSize: 13; weight: Font.DemiBold } }
        Rectangle { width: parent.width; height: 1; color: border }

        Repeater {
            model: parent.model
            Row {
                width: parent.width; spacing: 12
                Text {
                    text: modelData.label; color: textSub; font.pixelSize: 12
                    width: 160; anchors.verticalCenter: parent.verticalCenter
                }
                Rectangle {
                    width: parent.width - 172; height: 34; radius: 8
                    color: surface; border.color: border
                    TextField {
                        anchors { fill: parent; margins: 1 }; padding: 10
                        text: modelData.val; color: textPrimary; background: Item {}
                        font.family: "Consolas"; font.pixelSize: 12
                        placeholderText: "Auto"
                    }
                }
            }
        }
    }
}
