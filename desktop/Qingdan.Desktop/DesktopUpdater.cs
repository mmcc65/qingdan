using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json;
using System.Windows;
using Application = System.Windows.Application;
using MessageBox = System.Windows.MessageBox;

namespace Qingdan.Desktop;

internal static class DesktopUpdater
{
    private static readonly HttpClient Client = new() { Timeout = TimeSpan.FromSeconds(20) };
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static DateTime _lastAutomaticCheck = DateTime.MinValue;

    public static async Task CheckAsync(Window owner, string manifestUrl, bool userInitiated)
    {
        if (!Uri.TryCreate(manifestUrl, UriKind.Absolute, out var manifestUri) || manifestUri.Scheme != Uri.UriSchemeHttps)
        {
            if (userInitiated) MessageBox.Show(owner, "此版本尚未配置可信的 HTTPS 更新源。", "暂时无法检查更新", MessageBoxButton.OK, MessageBoxImage.Information);
            return;
        }
        if (!userInitiated && DateTime.UtcNow - _lastAutomaticCheck < TimeSpan.FromHours(6)) return;
        if (!await Gate.WaitAsync(0)) return;
        try
        {
            using var response = await Client.GetAsync(manifestUri);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            var manifest = JsonSerializer.Deserialize<UpdateManifest>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                ?? throw new InvalidDataException("更新清单为空");
            _lastAutomaticCheck = DateTime.UtcNow;
            var current = Assembly.GetExecutingAssembly().GetName().Version ?? new Version(0, 0);
            if (!Version.TryParse(manifest.Version, out var available)) throw new InvalidDataException("更新版本号无效");
            if (available <= current)
            {
                if (userInitiated) MessageBox.Show(owner, $"当前版本：{current.ToString(3)}", "已经是最新版", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }
            var answer = MessageBox.Show(owner, $"清单 {manifest.Version} 已发布。\n\n{manifest.Notes}\n\n是否现在下载并更新？",
                "发现清单更新", MessageBoxButton.YesNo, MessageBoxImage.Information);
            if (answer == MessageBoxResult.Yes) await DownloadAndInstallAsync(owner, manifestUri, manifest);
        }
        catch (Exception)
        {
            if (userInitiated) MessageBox.Show(owner, "请确认网络和更新发布通道可用。", "检查更新失败", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        finally
        {
            Gate.Release();
        }
    }

    private static async Task DownloadAndInstallAsync(Window owner, Uri manifestUri, UpdateManifest manifest)
    {
        if (string.IsNullOrWhiteSpace(manifest.PackageUrl) || string.IsNullOrWhiteSpace(manifest.Sha256)) throw new InvalidDataException("更新清单缺少必要字段");
        var packageUri = new Uri(manifestUri, manifest.PackageUrl);
        if (packageUri.Scheme != Uri.UriSchemeHttps) throw new InvalidDataException("更新包必须使用 HTTPS");
        owner.Title = $"清单 · 正在下载 {manifest.Version}";
        var updateRoot = Path.Combine(Path.GetTempPath(), $"qingdan-update-{Guid.NewGuid():N}");
        var archivePath = Path.Combine(updateRoot, "update.zip");
        var sourcePath = Path.Combine(updateRoot, "package");
        Directory.CreateDirectory(sourcePath);
        try
        {
            using (var response = await Client.GetAsync(packageUri, HttpCompletionOption.ResponseHeadersRead))
            {
                response.EnsureSuccessStatusCode();
                await using var input = await response.Content.ReadAsStreamAsync();
                await using var output = File.Create(archivePath);
                await input.CopyToAsync(output);
            }
            await using var archiveStream = File.OpenRead(archivePath);
            var hash = Convert.ToHexString(await SHA256.HashDataAsync(archiveStream)).ToLowerInvariant();
            if (!hash.Equals(manifest.Sha256, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("更新包校验失败");
            ExtractSafely(archivePath, sourcePath);
            if (!File.Exists(Path.Combine(sourcePath, "Qingdan.exe"))) throw new InvalidDataException("更新包中缺少 Qingdan.exe");
            LaunchUpdateHelper(updateRoot, sourcePath);
            ((App)Application.Current).ShutdownForUpdate();
        }
        catch
        {
            owner.Title = "清单";
            MessageBox.Show(owner, "桌面更新包下载、校验或解压失败，请稍后重试。", "更新失败", MessageBoxButton.OK, MessageBoxImage.Warning);
        }
    }

    private static void ExtractSafely(string archivePath, string destination)
    {
        using var archive = ZipFile.OpenRead(archivePath);
        var root = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
        foreach (var entry in archive.Entries)
        {
            var target = Path.GetFullPath(Path.Combine(destination, entry.FullName));
            if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("更新包路径无效");
        }
        archive.ExtractToDirectory(destination, true);
    }

    private static void LaunchUpdateHelper(string updateRoot, string sourcePath)
    {
        var scriptPath = Path.Combine(updateRoot, "apply-update.ps1");
        File.WriteAllText(scriptPath, """
param([int]$ProcessId, [string]$Source, [string]$Target, [string]$Executable)
$ErrorActionPreference = 'Stop'
try { Get-Process -Id $ProcessId -ErrorAction Stop | Wait-Process } catch { }
Start-Sleep -Milliseconds 500
Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $Target -Recurse -Force
}
Start-Process -FilePath $Executable
""");
        var target = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        var executable = Environment.ProcessPath ?? Path.Combine(target, "Qingdan.exe");
        var start = new ProcessStartInfo("powershell.exe")
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        };
        foreach (var argument in new[] { "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath,
                     "-ProcessId", Environment.ProcessId.ToString(), "-Source", sourcePath, "-Target", target, "-Executable", executable })
            start.ArgumentList.Add(argument);
        Process.Start(start);
    }

    private sealed class UpdateManifest
    {
        public string Version { get; set; } = "";
        public string PackageUrl { get; set; } = "";
        public string Sha256 { get; set; } = "";
        public string Notes { get; set; } = "包含体验改进和问题修复。";
    }
}
