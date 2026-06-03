[Setup]
AppId={{5D012B5A-EE3C-43D4-A5C1-AAB33F9C7D33}
AppName=TAPO Meteor Network
AppVersion=1.0
AppPublisher=David Marica
; We use {localappdata} instead of Program Files because the app needs to save 'config.json' overrides at runtime.
; Standard Program Files requires Admin rights to write files, but localappdata works perfectly for standard users.
DefaultDirName={localappdata}\TAPOMeteorNetwork
DefaultGroupName=TAPO Meteor Network
AllowNoIcons=yes
PrivilegesRequired=lowest
OutputDir=.\InstallerOutput
OutputBaseFilename=TAPOMeteorNetwork_Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "dist\TAPO_Meteor_Network\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\TAPO Meteor Network"; Filename: "{app}\TAPO_Meteor_Network.exe"
Name: "{userdesktop}\TAPO Meteor Network"; Filename: "{app}\TAPO_Meteor_Network.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\TAPO_Meteor_Network.exe"; Description: "{cm:LaunchProgram,TAPO Meteor Network}"; Flags: nowait postinstall skipifsilent
