; Inno Setup Script for FWYS Antidetect Browser
; Can be compiled with Inno Setup 6 (iscc.exe) to create a single-file Setup.exe

#define MyAppName "FWYS Antidetect Browser"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "FWYS Team"
#define MyAppURL "https://github.com/n00bZer0/FWYS"
#define MyAppExeName "FWYS.exe"

[Setup]
AppId={{D982F920-56B4-4B82-9B5C-2E0F2B0B07F2}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\FWYS
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist\installer_output
OutputBaseFilename=FWYS_Setup_v1.0.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\dist\FWYS_Portable\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
