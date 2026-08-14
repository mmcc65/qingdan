using Microsoft.Web.WebView2.Core;
using System.ComponentModel;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;

namespace Qingdan.Desktop;

public partial class MainWindow : Window
{
    private bool _allowClose;
    private ReminderScheduler? _reminderScheduler;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        await Browser.EnsureCoreWebView2Async();
        var webRoot = Path.Combine(AppContext.BaseDirectory, "Web");
        Browser.CoreWebView2.SetVirtualHostNameToFolderMapping(
            "app.qingdan.local", webRoot, CoreWebView2HostResourceAccessKind.Allow);
        Browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
        Browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        _reminderScheduler = new ReminderScheduler(SendTaskAction);
        Browser.CoreWebView2.WebMessageReceived += async (_, args) =>
        {
            try
            {
                using var message = JsonDocument.Parse(args.WebMessageAsJson);
                if (!message.RootElement.TryGetProperty("type", out var type)) return;
                if (type.GetString() == "state" && message.RootElement.TryGetProperty("state", out var state))
                {
                    _reminderScheduler.UpdateState(state.GetRawText());
                }
                else if (type.GetString() == "test-reminder")
                {
                    _reminderScheduler.ShowTestReminder();
                }
                else if (type.GetString() == "check-update")
                {
                    var url = message.RootElement.TryGetProperty("manifestUrl", out var manifestUrl) ? manifestUrl.GetString() ?? "" : "";
                    var userInitiated = message.RootElement.TryGetProperty("userInitiated", out var initiated) && initiated.GetBoolean();
                    await DesktopUpdater.CheckAsync(this, url, userInitiated);
                }
            }
            catch { }
        };
        Browser.Source = new Uri("https://app.qingdan.local/index.html");
    }

    private void SendTaskAction(string taskId, string? projectId, string action)
    {
        if (Browser.CoreWebView2 is null) return;
        Browser.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(new
        {
            type = "task-action",
            taskId,
            projectId,
            action
        }));
    }

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 2) WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
        else if (e.ButtonState == MouseButtonState.Pressed) DragMove();
    }

    private void TopmostButton_Click(object sender, RoutedEventArgs e)
    {
        Topmost = !Topmost;
        TopmostButton.Content = Topmost ? "已置顶" : "置顶";
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e) => WindowState = WindowState.Minimized;
    private void CloseButton_Click(object sender, RoutedEventArgs e) => Hide();

    protected override void OnClosing(CancelEventArgs e)
    {
        if (!_allowClose) { e.Cancel = true; Hide(); return; }
        base.OnClosing(e);
    }

    public void AllowClose() => _allowClose = true;

    public void NotifyNativeResume()
    {
        if (Browser.CoreWebView2 is not null)
            Browser.CoreWebView2.ExecuteScriptAsync("window.dispatchEvent(new Event('qingdan-native-resume'))");
    }
}
