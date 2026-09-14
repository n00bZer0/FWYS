import QtQuick 2.15
import QtQuick.Layouts 1.15

Row {
    property int status: 0  // 0=idle, 1=running, 2=error, 3=launching

    spacing: 5
    height: 20

    Rectangle {
        width: 7; height: 7; radius: 3.5
        anchors.verticalCenter: parent.verticalCenter
        color: {
            if (status === 1) return "#22D3A5"   // running — green
            if (status === 2) return "#FF6B6B"   // error — red
            if (status === 3) return "#F59E0B"   // launching — amber
            return "#3A3B52"                     // idle — grey
        }
        Behavior on color { ColorAnimation { duration: 200 } }

        // Pulse when running or launching
        SequentialAnimation on opacity {
            running: status === 1 || status === 3
            loops: Animation.Infinite
            NumberAnimation { to: 0.2; duration: 500 }
            NumberAnimation { to: 1.0; duration: 500 }
        }
        opacity: (status === 1 || status === 3) ? 1.0 : 1.0
    }

    Text {
        anchors.verticalCenter: parent.verticalCenter
        text: {
            if (status === 1) return "Running"
            if (status === 2) return "Error"
            if (status === 3) return "Launching…"
            return "Idle"
        }
        color: {
            if (status === 1) return "#22D3A5"
            if (status === 2) return "#FF6B6B"
            if (status === 3) return "#F59E0B"
            return textSub
        }
        font { pixelSize: 11; family: "Segoe UI" }
        Behavior on color { ColorAnimation { duration: 200 } }
    }
}
