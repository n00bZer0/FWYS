cmake_minimum_required(VERSION 3.21)
project(FWYS VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

# Find Qt6 components
find_package(Qt6 REQUIRED COMPONENTS
    Core
    Gui
    Widgets
    Quick
    QuickControls2
    Qml
    Sql
    Network
    WebSockets
)

qt_policy(SET QTP0001 NEW)
qt_policy(SET QTP0004 NEW)

qt_standard_project_setup()

# Source files
set(SOURCES
    src/main.cpp
    src/core/App.cpp
    src/core/DatabaseManager.cpp
    src/core/ProfileManager.cpp
    src/core/ProxyParser.cpp
    src/core/BrowserLauncher.cpp
    src/core/ProxyManager.cpp
    src/core/FingerprintConfig.cpp
    src/core/IPCClient.cpp
    src/models/ProfileListModel.cpp
)

set(HEADERS
    src/core/App.h
    src/core/DatabaseManager.h
    src/core/ProfileManager.h
    src/core/ProxyParser.h
    src/core/BrowserLauncher.h
    src/core/ProxyManager.h
    src/core/FingerprintConfig.h
    src/core/IPCClient.h
    src/models/ProfileListModel.h
)

# QML resources
qt_add_executable(FWYS
    ${SOURCES}
    ${HEADERS}
)

qt_add_qml_module(FWYS
    URI FWYS
    VERSION 1.0
    QML_FILES
        qml/main.qml
        qml/pages/DashboardPage.qml
        qml/pages/ProfileEditorPage.qml
        qml/pages/FingerprintPage.qml
        qml/pages/ProxyPage.qml
        qml/pages/SettingsPage.qml
        qml/components/Sidebar.qml
        qml/components/ProfileCard.qml
        qml/components/StatusBadge.qml
        qml/components/LoadingSpinner.qml
        qml/components/ProxyResultCard.qml
        qml/components/TabBar.qml
        qml/components/CustomTabBar.qml
)

# Include directories
target_include_directories(FWYS PRIVATE src)

# Link Qt libraries
target_link_libraries(FWYS PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Widgets
    Qt6::Quick
    Qt6::QuickControls2
    Qt6::Qml
    Qt6::Sql
    Qt6::Network
    Qt6::WebSockets
)

# Windows: don't show console window in Release
if(WIN32 AND CMAKE_BUILD_TYPE STREQUAL "Release")
    set_target_properties(FWYS PROPERTIES WIN32_EXECUTABLE TRUE)
endif()

# Install
install(TARGETS FWYS RUNTIME DESTINATION bin)
