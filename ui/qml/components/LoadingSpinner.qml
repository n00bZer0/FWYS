import QtQuick 2.15

Item {
    id: spinner
    property color color: "#6C63FF"
    property int size: 32
    property bool running: true

    width: size
    height: size

    Rectangle {
        id: ring
        anchors.fill: parent
        radius: width / 2
        color: "transparent"
        border.color: Qt.rgba(spinner.color.r, spinner.color.g, spinner.color.b, 0.2)
        border.width: 3

        Rectangle {
            width: 8
            height: 8
            radius: 4
            color: spinner.color
            anchors.top: parent.top
            anchors.horizontalCenter: parent.horizontalCenter
        }
    }

    RotationAnimation {
        target: ring
        from: 0
        to: 360
        duration: 900
        loops: Animation.Infinite
        running: spinner.running && spinner.visible
    }
}
