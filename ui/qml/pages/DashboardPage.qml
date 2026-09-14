import QtQuick 2.15
import QtQuick.Layouts 1.15
import QtQuick.Controls 2.15

Item {
    id: dashboard
    signal editProfile(string id)

    // ── Runtime state ─────────────────────────────────────────────────────────
    // profileId → status map (for real-time status override before model refresh)
    property var runtimeStatus: ({})

    // ── BrowserLauncher signals ────────────────────────────────────────────────
    Connections {
        target: browserLauncher

        // Profile launched successfully → mark as running
        function onProfileLaunched(profileId, pid) {
            var s = runtimeStatus
            s[profileId] = 1
            dashboard.runtimeStatus = s
            profileModel.setStatus(profileId, 1)
            launchToast.show("▶  Browser launched", profileId, "#22D3A5")
        }

        // Profile closed → mark as idle
        function onProfileClosed(profileId) {
            var s = runtimeStatus
            s[profileId] = 0
            dashboard.runtimeStatus = s
            profileModel.setStatus(profileId, 0)
        }

        // Launch error
        function onLaunchError(profileId, error) {
            var s = runtimeStatus
            s[profileId] = 2
            dashboard.runtimeStatus = s
            profileModel.setStatus(profileId, 2)
            launchToast.show("✗  Launch failed: " + error, profileId, "#DC2626")
        }
    }

    // ── ProfileManager signals ────────────────────────────────────────────────
    Connections {
        target: profileManager
        function onProfileCreated(id) { profileModel.refresh() }
        function onProfileDeleted(id) { profileModel.refresh() }
        function onProfileUpdated(id) { profileModel.refresh() }
        function onProfileStatusChanged(id, status) {
            var s = runtimeStatus
            s[id] = status
            dashboard.runtimeStatus = s
        }
    }

    // ── Helper: get live status ───────────────────────────────────────────────
    function liveStatus(profileId, modelStatus) {
        if (runtimeStatus.hasOwnProperty(profileId))
            return runtimeStatus[profileId]
        return modelStatus
    }

    // ── Main layout ───────────────────────────────────────────────────────────
    ColumnLayout {
        anchors { fill: parent; margins: 24 }
        spacing: 18

        // ── Header ────────────────────────────────────────────────────────────
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
                    text: {
                        const total   = profileModel.rowCount
                        const running = countRunning()
                        if (running > 0)
                            return total + " profiles · " + running + " running"
                        return total + " profiles"
                    }
                    color: textSub
                    font.pixelSize: 13
                }
            }

            Item { Layout.fillWidth: true }

            // Stats row
            Row {
                spacing: 12
                visible: profileModel.rowCount > 0

                // Running count pill
                Rectangle {
                    visible: countRunning() > 0
                    height: 32; radius: 10; width: runningRow.implicitWidth + 16
                    color: Qt.rgba(0.42, 0.39, 1.0, 0.15)
                    border.color: Qt.rgba(0.42, 0.39, 1.0, 0.4); border.width: 1
                    Row {
                        id: runningRow
                        anchors.centerIn: parent; spacing: 6
                        Rectangle {
                            width: 8; height: 8; radius: 4; color: "#6C63FF"
                            anchors.verticalCenter: parent.verticalCenter
                            SequentialAnimation on opacity {
                                running: true; loops: Animation.Infinite
                                NumberAnimation { to: 0.3; duration: 700 }
                                NumberAnimation { to: 1.0; duration: 700 }
                            }
                        }
                        Text {
                            text: countRunning() + " active"
                            color: "#A8A4FF"
                            font { pixelSize: 12; weight: Font.DemiBold }
                            anchors.verticalCenter: parent.verticalCenter
                        }
                    }
                }

                // New Profile Button
                Rectangle {
                    width: 140; height: 36; radius: 10
                    gradient: Gradient {
                        orientation: Gradient.Horizontal
                        GradientStop { position: 0.0; color: accent }
                        GradientStop { position: 1.0; color: "#A855F7" }
                    }
                    Text {
                        anchors.centerIn: parent
                        text: "+ New Profile"
                        color: "white"
                        font { pixelSize: 13; weight: Font.DemiBold; family: "Segoe UI" }
                    }
                    scale: newBtnMa.pressed ? 0.95 : 1.0
                    Behavior on scale { NumberAnimation { duration: 100 } }
                    MouseArea {
                        id: newBtnMa; anchors.fill: parent
                        cursorShape: Qt.PointingHandCursor
                        onClicked: newProfileDialog.open()
                    }
                }
            }
        }

        // New Profile button — shown when list empty too
        Rectangle {
            Layout.fillWidth: true
            height: 36; radius: 10; visible: profileModel.rowCount === 0
            gradient: Gradient {
                orientation: Gradient.Horizontal
                GradientStop { position: 0.0; color: accent }
                GradientStop { position: 1.0; color: "#A855F7" }
            }
            Text {
                anchors.centerIn: parent; text: "+ Create Your First Profile"
                color: "white"; font { pixelSize: 13; weight: Font.DemiBold }
            }
            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                onClicked: newProfileDialog.open() }
        }

        // ── Search bar ────────────────────────────────────────────────────────
        Rectangle {
            Layout.fillWidth: true
            height: 40; radius: 10; color: surface
            border.color: searchField.activeFocus ? accent : border

            Row {
                anchors { verticalCenter: parent.verticalCenter
                          left: parent.left; leftMargin: 14 }
                spacing: 10
                Text { text: "🔍"; font.pixelSize: 13; color: textSub }
                TextField {
                    id: searchField
                    width: dashboard.width - 200
                    placeholderText: "Search profiles…"
                    placeholderTextColor: textSub
                    color: textPrimary
                    font { pixelSize: 13; family: "Segoe UI" }
                    background: Item {}
                }
            }
        }

        // ── Profile Grid ──────────────────────────────────────────────────────
        ScrollView {
            Layout.fillWidth: true
            Layout.fillHeight: true
            clip: true
            ScrollBar.horizontal.policy: ScrollBar.AlwaysOff

            GridView {
                id: grid
                width: parent.width
                cellWidth:  Math.floor(width / Math.max(1, Math.floor(width / 320)))
                cellHeight: 218
                model: profileModel

                // Fade-in animation for new items
                add: Transition {
                    NumberAnimation { property: "opacity"; from: 0; to: 1; duration: 250 }
                    NumberAnimation { property: "scale";   from: 0.9; to: 1; duration: 250 }
                }
                remove: Transition {
                    NumberAnimation { property: "opacity"; from: 1; to: 0; duration: 180 }
                }

                delegate: Item {
                    width: grid.cellWidth
                    height: grid.cellHeight

                    // Filter by search
                    visible: searchField.text.trim() === ""
                          || profileName.toLowerCase().includes(searchField.text.trim().toLowerCase())

                    ProfileCard {
                        anchors { fill: parent; margins: 8 }

                        pid:         profileId
                        pname:       profileName
                        proxy:       profileProxy
                        proxyType:   profileProxyType
                        status:      dashboard.liveStatus(profileId, profileStatus)
                        osType:      profileOsType       || "windows10"
                        exitIp:      profileIpAddress    || ""
                        countryFlag: profileCountryFlag  || ""
                        countryCode: profileCountryCode  || ""
                        riskScore:   profileRiskScore    !== undefined ? profileRiskScore : -1
                        lastUsed:    profileLastUsed     || ""

                        onLaunchClicked: (id) => {
                            // Mark as launching immediately (status 3)
                            var s = runtimeStatus
                            s[id] = 3
                            dashboard.runtimeStatus = s
                            profileModel.setStatus(id, 3)
                            browserLauncher.launchProfile(id)
                        }

                        onStopClicked: (id) => {
                            browserLauncher.closeProfile(id)
                        }

                        onEditClicked: (id) => dashboard.editProfile(id)

                        onDeleteClicked: (id) => {
                            deleteConfirm.targetId = id
                            deleteConfirm.targetName = profileName
                            deleteConfirm.open()
                        }
                    }
                }

                // ── Empty state ───────────────────────────────────────────────
                Item {
                    visible: grid.count === 0
                    anchors.centerIn: parent
                    width: 280

                    Column {
                        anchors.centerIn: parent
                        spacing: 14

                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: "⊘"
                            font.pixelSize: 56
                            color: "#1E1F2E"
                        }
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: searchField.text ? "No matching profiles"
                                                   : "No profiles yet"
                            color: textSub
                            font { pixelSize: 15; family: "Segoe UI" }
                        }
                        Text {
                            anchors.horizontalCenter: parent.horizontalCenter
                            text: searchField.text
                                  ? "Try a different search term"
                                  : "Click '+ New Profile' to get started"
                            color: "#3A3B52"
                            font { pixelSize: 12 }
                            horizontalAlignment: Text.AlignHCenter
                        }
                    }
                }
            }
        }
    }

    // ── Toast notification ────────────────────────────────────────────────────
    Rectangle {
        id: launchToast
        property string message: ""
        property string toastColor: "#22D3A5"

        function show(msg, pid, col) {
            message   = msg
            toastColor = col || "#22D3A5"
            showAnim.restart()
        }

        anchors { bottom: parent.bottom; horizontalCenter: parent.horizontalCenter
                  bottomMargin: 24 }
        width: toastText.implicitWidth + 32
        height: 40
        radius: 12
        color: Qt.rgba(0.08, 0.08, 0.15, 0.95)
        border.color: toastColor; border.width: 1
        opacity: 0
        z: 100

        Text {
            id: toastText
            anchors.centerIn: parent
            text: launchToast.message
            color: launchToast.toastColor
            font { pixelSize: 13; weight: Font.DemiBold; family: "Segoe UI" }
        }

        SequentialAnimation {
            id: showAnim
            NumberAnimation { target: launchToast; property: "opacity"
                              to: 1.0; duration: 200 }
            PauseAnimation  { duration: 2500 }
            NumberAnimation { target: launchToast; property: "opacity"
                              to: 0.0; duration: 300 }
        }
    }

    // ── New Profile Dialog ────────────────────────────────────────────────────
    Dialog {
        id: newProfileDialog
        anchors.centerIn: parent
        width: 420
        modal: true
        background: Rectangle {
            color: bgCard; radius: 16
            border.color: border; border.width: 1
        }

        header: Item {
            height: 56
            Text {
                anchors { verticalCenter: parent.verticalCenter
                          left: parent.left; leftMargin: 24 }
                text: "Create New Profile"
                color: textPrimary
                font { pixelSize: 16; weight: Font.DemiBold; family: "Segoe UI" }
            }
        }

        contentItem: Column {
            spacing: 10
            padding: 20

            // Name field
            Text { text: "Profile Name"; color: textSub; font.pixelSize: 12 }
            Rectangle {
                width: 380; height: 40; radius: 8
                color: surface; border.color: nameField.activeFocus ? accent : border
                TextField {
                    id: nameField
                    anchors { fill: parent; margins: 1 }
                    placeholderText: "e.g. Account #1"
                    placeholderTextColor: textSub
                    color: textPrimary
                    background: Item {}
                    padding: 12
                    font.family: "Segoe UI"
                    Keys.onReturnPressed: if (nameField.text.trim()) createAndClose()
                }
            }

            // OS type
            Text { text: "Operating System"; color: textSub; font.pixelSize: 12 }
            Row {
                spacing: 8
                Repeater {
                    model: [
                        { label: "🪟 Win 10",  value: "windows10" },
                        { label: "🪟 Win 11",  value: "windows11" },
                        { label: "🐧 Linux",   value: "linux"     },
                        { label: "🍎 macOS",   value: "macos"     },
                    ]
                    Rectangle {
                        width: 90; height: 32; radius: 8
                        color: osSelector.selected === modelData.value
                               ? Qt.rgba(0.42, 0.39, 1.0, 0.2)
                               : surface
                        border.color: osSelector.selected === modelData.value
                                      ? accent : border
                        border.width: osSelector.selected === modelData.value ? 1.5 : 1
                        Text {
                            anchors.centerIn: parent
                            text: modelData.label
                            color: osSelector.selected === modelData.value
                                   ? "#A8A4FF" : textSub
                            font { pixelSize: 12; family: "Segoe UI" }
                        }
                        MouseArea {
                            anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                            onClicked: osSelector.selected = modelData.value
                        }
                        Behavior on color { ColorAnimation { duration: 120 } }
                    }
                }
                Item { id: osSelector; property string selected: "windows10" }
            }

            // Proxy field
            Text { text: "Proxy (optional)"; color: textSub; font.pixelSize: 12 }
            Rectangle {
                width: 380; height: 40; radius: 8
                color: surface; border.color: proxyField.activeFocus ? accent : border
                TextField {
                    id: proxyField
                    anchors { fill: parent; margins: 1 }
                    placeholderText: "socks5://user:pass@host:port"
                    placeholderTextColor: textSub
                    color: textPrimary
                    background: Item {}
                    padding: 12
                    font.family: "Consolas"
                }
            }

            Item { height: 4 }

            // Buttons
            Row {
                spacing: 10
                anchors.right: parent.right

                Rectangle {
                    width: 90; height: 36; radius: 8; color: surface
                    Text { anchors.centerIn: parent; text: "Cancel"
                           color: textSub; font.pixelSize: 13 }
                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                        onClicked: { nameField.text = ""; proxyField.text = ""; newProfileDialog.close() }
                    }
                }

                Rectangle {
                    width: 120; height: 36; radius: 8
                    color: nameField.text.trim() ? accent : "#1E1F2E"
                    Behavior on color { ColorAnimation { duration: 150 } }
                    Text { anchors.centerIn: parent; text: "Create ▶"
                           color: "white"
                           font { pixelSize: 13; weight: Font.DemiBold } }
                    MouseArea {
                        anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                        onClicked: createAndClose()
                    }
                }
            }
        }

        function createAndClose() {
            if (!nameField.text.trim()) return
            // createProfile with os_type
            var ok = profileManager.createProfile(nameField.text.trim())
            if (ok) {
                // Update OS type and proxy on the newly created profile
                var allP = profileManager.getAllProfiles()
                if (allP.length > 0) {
                    var newId = allP[allP.length - 1].id
                    if (newId) {
                        var data = { os_type: osSelector.selected }
                        if (proxyField.text.trim())
                            data.proxy = proxyField.text.trim()
                        profileManager.updateProfile(newId, data)
                    }
                }
            }
            nameField.text = ""
            proxyField.text = ""
            osSelector.selected = "windows10"
            newProfileDialog.close()
        }
    }

    // ── Delete Confirmation Dialog ─────────────────────────────────────────────
    Dialog {
        id: deleteConfirm
        property string targetId:   ""
        property string targetName: ""
        anchors.centerIn: parent; width: 360; modal: true
        background: Rectangle {
            color: bgCard; radius: 16
            border.color: border; border.width: 1
        }
        contentItem: Column {
            spacing: 16; padding: 24
            Text { text: "Delete Profile?"
                   color: textPrimary; font { pixelSize: 16; weight: Font.Bold } }
            Text {
                text: "\"" + deleteConfirm.targetName + "\" will be permanently deleted.\nThis cannot be undone."
                color: textSub; font.pixelSize: 13; wrapMode: Text.WordWrap
            }
            Row {
                spacing: 10; anchors.right: parent.right
                Rectangle {
                    width: 80; height: 36; radius: 8; color: surface
                    Text { anchors.centerIn: parent; text: "Cancel"
                           color: textSub; font.pixelSize: 13 }
                    MouseArea { anchors.fill: parent; onClicked: deleteConfirm.close() }
                }
                Rectangle {
                    width: 110; height: 36; radius: 8
                    color: Qt.rgba(0.86, 0.15, 0.15, 0.25)
                    border.color: Qt.rgba(0.86, 0.15, 0.15, 0.5); border.width: 1
                    Text { anchors.centerIn: parent; text: "Delete"
                           color: "#FF6B6B"
                           font { pixelSize: 13; weight: Font.DemiBold } }
                    MouseArea {
                        anchors.fill: parent; cursorShape: Qt.PointingHandCursor
                        onClicked: {
                            browserLauncher.closeProfile(deleteConfirm.targetId)
                            profileManager.deleteProfile(deleteConfirm.targetId)
                            deleteConfirm.close()
                        }
                    }
                }
            }
        }
    }

    // ── Helper functions ──────────────────────────────────────────────────────
    function countRunning() {
        var count = 0
        for (var key in runtimeStatus) {
            if (runtimeStatus[key] === 1) count++
        }
        return count
    }
}
