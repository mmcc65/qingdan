using System.Windows;

namespace Qingdan.Desktop;

public partial class ReminderWindow : Window
{
    public event EventHandler? Completed;
    public event EventHandler? Snoozed;
    public string TaskId { get; }
    public string? ProjectId { get; }

    internal ReminderWindow(ReminderInfo reminder)
    {
        InitializeComponent();
        TaskId = reminder.TaskId;
        ProjectId = reminder.ProjectId;
        TaskName.Text = reminder.Name;
        NodeText.Text = reminder.Node is null ? "现在" : $"节点：{reminder.Node:MM月dd日 HH:mm}";
    }

    private void Complete_Click(object sender, RoutedEventArgs e) { Completed?.Invoke(this, EventArgs.Empty); Close(); }
    private void Snooze_Click(object sender, RoutedEventArgs e) { Snoozed?.Invoke(this, EventArgs.Empty); Close(); }
    private void Close_Click(object sender, RoutedEventArgs e) => Close();
}
