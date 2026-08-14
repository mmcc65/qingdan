using System.Drawing;
using System.IO;
using System.Windows;
using Forms = System.Windows.Forms;

namespace Qingdan.Desktop;

public partial class App : System.Windows.Application
{
    private Forms.NotifyIcon? _trayIcon;
    private MainWindow? _window;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        DispatcherUnhandledException += (_, args) =>
        {
            WriteCrashLog(args.Exception);
            System.Windows.MessageBox.Show(
                $"清单启动时遇到问题。\n\n{args.Exception.Message}\n\n错误记录已保存到程序目录的 Qingdan-error.log。",
                "清单无法继续运行", MessageBoxButton.OK, MessageBoxImage.Error);
            args.Handled = true;
            Shutdown(1);
        };

        try
        {
            _window = new MainWindow();
            _window.Show();
        }
        catch (Exception exception)
        {
            WriteCrashLog(exception);
            System.Windows.MessageBox.Show(
                $"清单启动失败。\n\n{exception.Message}\n\n错误记录已保存到程序目录的 Qingdan-error.log。",
                "清单启动失败", MessageBoxButton.OK, MessageBoxImage.Error);
            Shutdown(1);
            return;
        }

        var menu = new Forms.ContextMenuStrip();
        menu.Items.Add("显示清单", null, (_, _) => ShowWindow());
        menu.Items.Add("退出", null, (_, _) => ExitApplication());
        var appIcon = Icon.ExtractAssociatedIcon(Environment.ProcessPath ?? string.Empty) ?? SystemIcons.Application;
        _trayIcon = new Forms.NotifyIcon
        {
            Text = "清单",
            Icon = appIcon,
            Visible = true,
            ContextMenuStrip = menu
        };
        _trayIcon.DoubleClick += (_, _) => ShowWindow();
    }

    private static void WriteCrashLog(Exception exception)
    {
        try
        {
            File.AppendAllText(Path.Combine(AppContext.BaseDirectory, "Qingdan-error.log"),
                $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}]\n{exception}\n\n");
        }
        catch { }
    }

    private void ShowWindow()
    {
        if (_window is null) return;
        _window.Show();
        if (_window.WindowState == WindowState.Minimized) _window.WindowState = WindowState.Normal;
        _window.Activate();
        _window.NotifyNativeResume();
    }

    private void ExitApplication()
    {
        if (_trayIcon is not null) { _trayIcon.Visible = false; _trayIcon.Dispose(); }
        _window?.AllowClose();
        _window?.Close();
        Shutdown();
    }

    public void ShutdownForUpdate()
    {
        if (_trayIcon is not null) { _trayIcon.Visible = false; _trayIcon.Dispose(); _trayIcon = null; }
        _window?.AllowClose();
        _window?.Close();
        Shutdown();
    }
}
