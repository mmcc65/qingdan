using System.Text.Json;
using System.Windows.Threading;

namespace Qingdan.Desktop;

internal sealed class ReminderScheduler
{
    private readonly DispatcherTimer _timer;
    private readonly Action<string, string?, string> _taskAction;
    private readonly HashSet<string> _handledOccurrences = new();
    private readonly Dictionary<string, SnoozedReminder> _snoozed = new();
    private readonly Dictionary<string, ReminderWindow> _openWindows = new();
    private readonly Dictionary<string, ReminderInfo> _openReminders = new();
    private Dictionary<string, string> _taskSignatures = new();
    private string _stateJson = "";

    public ReminderScheduler(Action<string, string?, string> taskAction)
    {
        _taskAction = taskAction;
        // Datetime inputs are minute-precision. A one-second check keeps the desktop
        // notification aligned with the phone instead of introducing a 0-15s delay.
        _timer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
        _timer.Tick += (_, _) => CheckReminders(DateTime.Now);
        _timer.Start();
    }

    public void UpdateState(string stateJson)
    {
        var signatures = CollectTaskSignatures(stateJson);
        foreach (var item in _openReminders.ToList())
        {
            var taskKey = TaskKey(item.Value.TaskId, item.Value.ProjectId);
            if (!signatures.TryGetValue(taskKey, out var signature) || signature != item.Value.Signature)
                _openWindows.GetValueOrDefault(item.Key)?.Close();
        }
        _taskSignatures = signatures;
        _stateJson = stateJson;
        CheckReminders(DateTime.Now);
    }

    public void ShowTestReminder()
    {
        ShowReminder(new ReminderInfo("test", null, "这是一条清单测试提醒", DateTime.Now.AddMinutes(30), $"test|{DateTime.Now.Ticks}", "test"));
    }

    private void CheckReminders(DateTime now)
    {
        if (string.IsNullOrWhiteSpace(_stateJson)) return;
        try
        {
            using var document = JsonDocument.Parse(_stateJson);
            var root = document.RootElement;
            if (root.TryGetProperty("tasks", out var tasks))
                foreach (var task in tasks.EnumerateArray()) CheckTask(task, null, now);
            if (root.TryGetProperty("projects", out var projects))
                CheckProjects(projects, now);
            CheckSnoozed(now);
        }
        catch { }
    }

    private void CheckProjects(JsonElement projects, DateTime now)
    {
        foreach (var project in projects.EnumerateArray())
        {
            var projectId = GetString(project, "id");
            if (project.TryGetProperty("tasks", out var projectTasks))
                foreach (var task in projectTasks.EnumerateArray()) CheckTask(task, projectId, now);
            if (project.TryGetProperty("projects", out var childProjects))
                CheckProjects(childProjects, now);
        }
    }

    private void CheckTask(JsonElement task, string? projectId, DateTime now)
    {
        if (GetString(task, "status") != "active") return;
        var taskId = GetString(task, "id");
        var name = GetString(task, "name");
        if (string.IsNullOrWhiteSpace(taskId) || string.IsNullOrWhiteSpace(name)) return;
        if (!task.TryGetProperty("reminder", out var reminder)) return;

        string mode;
        if (reminder.ValueKind == JsonValueKind.String) mode = reminder.GetString() ?? "none";
        else if (reminder.ValueKind == JsonValueKind.Object) mode = GetString(reminder, "mode");
        else return;

        DateTime? due = null;
        if (mode == "single")
        {
            due = ParseDate(GetString(reminder, "at")) ?? ParseDate(GetString(task, "node"));
        }
        else if (mode == "interval")
        {
            var start = ParseDate(GetString(reminder, "start"));
            var end = ParseDate(GetString(reminder, "end")) ?? ParseDate(GetString(task, "node"));
            if (start is null || end is null || end < start || now < start) return;
            var interval = Math.Max(1, GetInt(reminder, "interval", 30));
            var unit = GetString(reminder, "unit");
            var span = unit switch
            {
                "hour" => TimeSpan.FromHours(interval),
                "day" => TimeSpan.FromDays(interval),
                _ => TimeSpan.FromMinutes(interval)
            };
            var elapsed = now - start.Value;
            var steps = Math.Floor(elapsed.TotalSeconds / span.TotalSeconds);
            due = start.Value.AddSeconds(steps * span.TotalSeconds);
            if (due > end) return;
        }

        if (due is null || due > now || now - due > TimeSpan.FromHours(24)) return;
        var occurrenceKey = $"{projectId}|{taskId}|{due.Value.Ticks}";
        if (_handledOccurrences.Contains(occurrenceKey)) return;
        _handledOccurrences.Add(occurrenceKey);
        var signature = _taskSignatures.GetValueOrDefault(TaskKey(taskId, projectId), "");
        ShowReminder(new ReminderInfo(taskId, projectId, name, ParseDate(GetString(task, "node")), occurrenceKey, signature));
    }

    private void CheckSnoozed(DateTime now)
    {
        foreach (var item in _snoozed.Where(pair => pair.Value.Due <= now).ToList())
        {
            _snoozed.Remove(item.Key);
            var reminder = item.Value.Reminder;
            var taskKey = TaskKey(reminder.TaskId, reminder.ProjectId);
            if (!_taskSignatures.TryGetValue(taskKey, out var currentSignature) || currentSignature != reminder.Signature) continue;
            ShowReminder(reminder with { OccurrenceKey = $"snooze|{item.Key}|{now.Ticks}" });
        }
    }

    private void ShowReminder(ReminderInfo reminder)
    {
        if (_openWindows.ContainsKey(reminder.OccurrenceKey)) return;
        var window = new ReminderWindow(reminder);
        _openWindows[reminder.OccurrenceKey] = window;
        _openReminders[reminder.OccurrenceKey] = reminder;
        window.Closed += (_, _) => { _openWindows.Remove(reminder.OccurrenceKey); _openReminders.Remove(reminder.OccurrenceKey); PositionWindows(); };
        window.Completed += (_, _) =>
        {
            _taskAction(reminder.TaskId, reminder.ProjectId, "complete");
            CloseTaskWindows(reminder.TaskId, reminder.ProjectId);
        };
        window.Snoozed += (_, _) =>
        {
            var key = $"{TaskKey(reminder.TaskId, reminder.ProjectId)}|{DateTime.Now.Ticks}";
            _snoozed[key] = new SnoozedReminder(DateTime.Now.AddMinutes(10), reminder);
        };
        window.Show();
        PositionWindows();
    }

    private void CloseTaskWindows(string taskId, string? projectId)
    {
        foreach (var window in _openWindows.Values.Where(item => item.TaskId == taskId && item.ProjectId == projectId).ToList()) window.Close();
    }

    private void PositionWindows()
    {
        var area = System.Windows.SystemParameters.WorkArea;
        var offset = 0d;
        foreach (var window in _openWindows.Values.Reverse())
        {
            window.Left = area.Right - window.Width - 16;
            window.Top = area.Bottom - window.Height - 16 - offset;
            offset += window.Height + 10;
        }
    }

    private static string GetString(JsonElement element, string property) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() ?? "" : "";

    private static int GetInt(JsonElement element, string property, int fallback) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(property, out var value) && value.TryGetInt32(out var result) ? result : fallback;

    private static DateTime? ParseDate(string value) => DateTime.TryParse(value, out var result) ? result : null;

    private static string TaskKey(string taskId, string? projectId) => $"{projectId ?? ""}|{taskId}";

    private static Dictionary<string, string> CollectTaskSignatures(string stateJson)
    {
        var result = new Dictionary<string, string>();
        try
        {
            using var document = JsonDocument.Parse(stateJson);
            var root = document.RootElement;
            if (root.TryGetProperty("tasks", out var tasks))
                foreach (var task in tasks.EnumerateArray()) AddSignature(result, task, null);
            if (root.TryGetProperty("projects", out var projects))
                CollectProjectSignatures(result, projects);
        }
        catch { }
        return result;
    }

    private static void CollectProjectSignatures(Dictionary<string, string> result, JsonElement projects)
    {
        foreach (var project in projects.EnumerateArray())
        {
            var projectId = GetString(project, "id");
            if (project.TryGetProperty("tasks", out var projectTasks))
                foreach (var task in projectTasks.EnumerateArray()) AddSignature(result, task, projectId);
            if (project.TryGetProperty("projects", out var childProjects))
                CollectProjectSignatures(result, childProjects);
        }
    }

    private static void AddSignature(Dictionary<string, string> result, JsonElement task, string? projectId)
    {
        if (GetString(task, "status") != "active") return;
        var id = GetString(task, "id");
        if (string.IsNullOrEmpty(id)) return;
        var node = GetString(task, "node");
        var reminder = task.TryGetProperty("reminder", out var reminderElement) ? reminderElement.GetRawText() : "";
        result[TaskKey(id, projectId)] = $"{node}|{reminder}";
    }
}

internal sealed record ReminderInfo(string TaskId, string? ProjectId, string Name, DateTime? Node, string OccurrenceKey, string Signature);
internal sealed record SnoozedReminder(DateTime Due, ReminderInfo Reminder);
