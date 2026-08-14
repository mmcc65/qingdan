Option Explicit

Dim shell, files, root, app, candidates, candidate
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")

root = files.GetParentFolderName(WScript.ScriptFullName)
candidates = Array( _
  files.BuildPath(root, "Qingdan.exe"), _
  files.BuildPath(root, "apps\desktop\Qingdan.Desktop\bin\Release\net7.0-windows\Qingdan.exe"), _
  files.BuildPath(root, "apps\desktop\Qingdan.Desktop\bin\Release\net8.0-windows\win-x64\Qingdan.exe"), _
  files.BuildPath(root, "apps\desktop\Qingdan.Desktop\bin\Release\net8.0-windows\Qingdan.exe") _
)

app = ""
For Each candidate In candidates
  If files.FileExists(candidate) Then
    app = candidate
    Exit For
  End If
Next

If Len(app) > 0 Then
  shell.Run Chr(34) & app & Chr(34), 1, False
Else
  MsgBox "Qingdan.exe was not found. Build the desktop app first.", 16, "Qingdan"
End If
