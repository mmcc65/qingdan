Option Explicit

Dim shell, files, root, app
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")

root = files.GetParentFolderName(WScript.ScriptFullName)
app = files.BuildPath(root, "Qingdan.exe")
If Not files.FileExists(app) Then
  app = files.BuildPath(root, "apps\desktop\Qingdan.Desktop\bin\Release\net8.0-windows\Qingdan.exe")
End If

If files.FileExists(app) Then
  shell.Run Chr(34) & app & Chr(34), 1, False
Else
  MsgBox "未找到 Qingdan.exe，请先构建桌面版。", 16, "清单"
End If
