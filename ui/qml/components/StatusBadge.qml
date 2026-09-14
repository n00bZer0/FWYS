import QtQuick 2.15
import QtQuick.Layouts 1.15

Row {
    property int status: 0  // 0=idle, 1=running, 2=error

    spacing: 6
    height: 20

    Rectangle {
        width: 8; height: 8; radius: 4
        anchors.verticalCenter: parent.verticalCenter
        color: status === 1 ? green : (status === 2 ? red : "#3A3B52")

        SequentialAnimation on opacity {
            running: status === 1
            loops: Animation.Infinite
            NumberAnimation { to: 0.3; duration: 600 }
            NumberAnimation { to: 1.0; duration: 600 }
        }
    }

    Text {
        anchors.verticalCenter: parent.verticalCenter
        text: status === 1 ? "Running" : (status === 2 ? "Error" : "Idle")
        color: status === 1 ? green : (status === 2 ? red : textSub)
        font { pixelSize: 11; family: "Segoe UI" }
    }
}
