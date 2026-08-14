Option Explicit

Dim shell, files, root, launcher, app, desktop, shortcutPath, shortcut
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")

root = files.GetParentFolderName(WScript.ScriptFullName)
launcher = files.BuildPath(root, "启动清单.vbs")
app = files.BuildPath(root, "Qingdan.exe")
If Not files.FileExists(app) Then
  app = files.BuildPath(root, "apps\desktop\Qingdan.Desktop\bin\Release\net8.0-windows\Qingdan.exe")
End If
desktop = shell.SpecialFolders("Desktop")
shortcutPath = files.BuildPath(desktop, "清单.lnk")

If Not files.FileExists(launcher) Then
  MsgBox "未找到启动清单.vbs，无法创建桌面快捷方式。", 16, "清单"
  WScript.Quit 1
End If

Set shortcut = shell.CreateShortcut(shortcutPath)
shortcut.TargetPath = shell.ExpandEnvironmentStrings("%WINDIR%\System32\wscript.exe")
shortcut.Arguments = Chr(34) & launcher & Chr(34)
shortcut.WorkingDirectory = root
shortcut.Description = "启动清单"
If files.FileExists(app) Then
  shortcut.IconLocation = app & ",0"
End If
shortcut.Save

MsgBox "桌面快捷方式已创建。以后更新或重新构建清单时，无需更换快捷方式。", 64, "清单"
