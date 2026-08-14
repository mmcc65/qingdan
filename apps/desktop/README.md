# Windows 桌面版

桌面壳使用 .NET 8 与系统已有的 Edge WebView2，提供：

- 原生可调整大小窗口
- 一键置顶/取消置顶
- 最小化和关闭到系统托盘
- 双击托盘图标恢复窗口
- 独立的本机数据目录
- 0.5.0 起支持应用内检查、下载、校验、替换并重启更新

桌面版从 `apps/web/src/release-config.js` 读取官方更新清单。为了兼容旧安装，未配置官方地址时会回退到同步项目的 Supabase `qingdan-releases` 桶。启动和从托盘恢复时会自动检查，也可以在“设置 → 数据与同步 → 检查电脑更新”中手动检查。更新包先解压到系统临时目录；校验通过后，辅助进程会等待清单退出、覆盖程序文件并自动重启，不会删除 WebView 用户数据。

构建前需要恢复官方 `Microsoft.Web.WebView2` NuGet 开发包。它只用于编译和运行嵌入式页面，用户电脑已有 WebView2 运行时，无需重复打包浏览器。

正式 ZIP 使用 Windows x64 自包含发布，会打包 .NET 运行时；普通用户无需预装 .NET SDK。开发构建仍需 .NET 8 SDK。

```powershell
dotnet restore apps/desktop/Qingdan.Desktop/Qingdan.Desktop.csproj
dotnet build apps/desktop/Qingdan.Desktop/Qingdan.Desktop.csproj -c Release
```
