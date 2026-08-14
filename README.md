# 清单 Qingdan

[![CI](https://github.com/mmcc65/qingdan/actions/workflows/ci.yml/badge.svg)](https://github.com/mmcc65/qingdan/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/mmcc65/qingdan?display_name=tag)](https://github.com/mmcc65/qingdan/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

清单是一款轻量、本地优先、可自托管同步的个人任务管理工具。它不只是把一个待办网页分别打包到电脑和手机，而是让三端共享同一套任务核心，再由 Windows 与 Android 原生层负责系统托盘、精确闹钟、重启恢复、桌面小组件和应用更新。

它想解决一个很具体的问题：个人清单应该打开就能记、离线也能改，同时又不能为了跨设备同步而交出数据控制权，更不能在应用退出或设备重启后失去重要提醒。

当前版本：`0.5.1 Beta`

[下载最新版](https://github.com/mmcc65/qingdan/releases/latest) · [查看架构](docs/ARCHITECTURE.md) · [反馈问题](https://github.com/mmcc65/qingdan/issues)

![清单桌面端](docs/images/qingdan-desktop.png)

![清单手机端](docs/images/qingdan-mobile.png)

## 它解决什么问题

很多个人任务并不需要庞大的团队协作系统，但又超出了“写几行文字”的范围：一次性事项需要节点和延期，规律性事务需要独立的重复规则，长期目标需要多级项目，真正重要的提醒还必须穿过应用退出、断网和设备重启。

清单因此采用了以下取向：

- **先本地、后同步**：编辑立即写入本机，网络故障不会阻塞记录；同步是可选增强能力。
- **数据归用户管理**：跨设备同步连接用户自己的 Supabase 项目，仓库不内置作者控制的任务数据服务。
- **提醒交给操作系统**：共享 Web 核心负责业务规则，Windows 和 Android 原生外壳负责后台调度与通知。
- **按使用场景拆分**：一次性待办、重复任务和项目各自拥有清晰入口，避免所有能力挤在一张平面列表里。

## 设计亮点与差异化

| 设计点 | 清单的实现 | 带来的价值 |
| --- | --- | --- |
| 本地优先 | 所有操作先写入设备，再异步同步 | 断网可用，操作不必等待服务器 |
| 可自托管同步 | Supabase Auth、Postgres、Realtime 与 RLS | 同步基础设施和任务数据由使用者掌控 |
| 共享核心 + 原生能力 | Web/PWA、WPF WebView2、Android WebView 共享界面与业务逻辑 | 三端行为一致，同时保留系统级提醒能力 |
| 可靠提醒链路 | 精确闹钟、后台调度、重启与系统时间变化后重新调度 | 提醒不依赖页面一直打开 |
| 分层任务模型 | 待办、重复任务、多级项目与项目内任务相互独立 | 临时事项、习惯和长期目标不会混成一团 |
| 更新与同步解耦 | 官方更新清单固定在代码中，自托管同步地址由用户配置 | 软件更新来源不会因为更换同步服务器而被悄悄替换 |

这种结构的创新不在于堆更多功能，而在于把“跨平台一致性”“原生提醒可靠性”和“用户掌控数据”放进一个仍然轻量的个人清单中。

## 适合谁

- 想要比便签更完整、又不需要团队项目管理平台的个人用户。
- 在 Windows 与 Android/HarmonyOS 之间工作，并重视系统级提醒的人。
- 希望离线使用，或愿意用自己的 Supabase 获得跨设备同步的人。
- 想研究 Web 核心与轻量原生外壳如何协作的开发者。

## 功能模块详解

### 1. 待办

待办用于只需要完成一次的事情，首页按 **重要、普通、随后** 三个优先级分栏展示。

- 新建和编辑任务名称、优先级、任务节点、备注、提醒方式和置顶状态。
- 置顶任务优先显示；其余任务按照节点时间和创建顺序排列。
- 节点会显示“今天、明天、具体日期”等易读时间，过期节点会单独标识。
- 可将节点一键延后到明天、后天或下周，不用重新选择日期。
- 支持完成、取消和直接删除；完成/取消记录与进行中任务分开展示。
- 已完成或已取消任务可以恢复，也可以永久删除。

### 2. 重复任务

重复模块用于不会因为完成一次就结束的规律性事务，例如每日整理、每周复盘或每月检查。

- 内置每天、每个工作日、每周、每月和每隔两周等重复规则。
- 每个重复任务同样支持优先级、节点、备注、置顶和提醒。
- “完成本次”只生成一条完成记录，原重复计划继续保留。
- “跳过本次”只生成一条跳过记录，不影响下一次计划。
- 完成记录与跳过记录分别归档，可单独永久删除。

> 当前版本记录重复规则和每次完成/跳过事件，但尚未提供复杂的自定义日历规则编辑器。

### 3. 项目

项目用于管理由多项任务组成的长期目标，并支持继续拆分子项目。

- 创建多级项目，在任意项目或子项目中添加任务。
- 项目任务拥有与普通待办一致的优先级、节点、备注、提醒和状态操作。
- 项目卡显示已完成数量、任务总数、子项目数量和汇总进度条。
- 支持折叠项目、置顶项目、重命名，以及继续添加子项目。
- 项目内完成和取消的任务分别进入项目归档，并保留所属项目名称。
- 删除项目会同时删除其中的任务和全部子项目，操作前会二次确认。

### 4. 任务节点与提醒

任务节点表示希望处理或完成任务的时间；提醒则决定系统何时主动通知，两者可以独立设置。

- **单次提醒**：指定一个提醒时间；未单独填写时使用任务节点。
- **循环提醒**：设置开始时间、结束时间、间隔数值，以及分钟/小时/天单位。
- 循环提醒未填写开始时间时从当前时间开始，未填写结束时间时使用任务节点。
- Windows 显示置顶提醒窗口，可直接完成、关闭或延后 10 分钟。
- Android/HarmonyOS 使用高优先级系统通知；获得权限后使用精确闹钟。
- 手机重启、应用更新、系统时间或时区变化后会重新登记提醒，并可补发 24 小时内错过的提醒。
- 设置中提供“测试提醒”，便于确认当前设备的通知权限和展示效果。

> Web/PWA 版负责任务管理和离线使用，不承诺浏览器关闭后的系统级提醒；可靠后台提醒请使用 Windows 或手机客户端。

### 5. 状态记录与快速操作

- 待办和项目任务分为进行中、已完成、已取消三种状态。
- 重复任务保留独立的完成本次与跳过本次历史，不会混入普通待办归档。
- 任务卡可以直接完成、编辑、延后、取消或删除。
- 全局搜索覆盖进行中的待办、重复任务、项目、项目任务及任务备注。
- 支持 `Ctrl/Cmd + K` 打开搜索，`Ctrl/Cmd + Enter` 快速新建待办。

### 6. 本地数据与云同步

- 所有修改首先保存在当前设备，未配置云端时也能完整使用。
- 用户可以填写自己的 Supabase Project URL 和 Publishable key，并通过邮箱注册或登录。
- 登录后自动进行首次同步、延迟上传和 Realtime 变化订阅，也可手动“立即同步”。
- 同步状态会显示尚未配置、等待登录、正在同步、已同步或连接异常。
- Supabase Row Level Security 按登录账户隔离数据；应用拒绝把 Secret/service_role key 当作客户端密钥。
- 当前 `0.5.1` 以每个用户的一份完整状态进行同步，较新的时间戳覆盖较旧状态；复杂的并发字段合并仍是后续工作。

### 7. 数据与应用设置

- 查看本机任务数据和离线缓存占用空间。
- 清理 PWA/页面缓存，但不会删除任务数据。
- 保存或更换 Supabase 连接、注册、登录、退出及手动同步。
- 手机端可检查精确提醒权限并跳转到系统设置。
- Windows 与手机端可手动检查更新，启动或回到前台时也会按策略自动检查。

### 8. Windows 桌面端

- 可调整大小的独立窗口，以及一键置顶/取消置顶。
- 点击关闭时隐藏到系统托盘，避免后台提醒随窗口关闭而停止。
- 双击托盘图标恢复窗口；托盘菜单可以显示清单或彻底退出。
- 原生后台提醒窗口支持完成和延后 10 分钟，多条提醒会依次排列。
- 应用内更新会下载、校验、替换文件并重启，同时保留 WebView 用户数据。
- 发布包附带稳定桌面快捷方式脚本，原目录覆盖更新后无需重建快捷方式。

### 9. Android / HarmonyOS 手机端

- 复用完整的待办、重复、项目、搜索、同步和设置界面。
- 使用 Android 系统闹钟与通知通道提供后台通知和横幅提醒。
- 设备重启、系统时间变化或应用升级后自动恢复提醒计划。
- 桌面小组件显示待办总数和排序后的前三项任务，点击可进入应用。
- 支持应用内检查、下载、SHA-256 校验并调起系统安装更新。
- 当前 HarmonyOS 支持范围是能够安装 Android APK 的版本，不包括 HarmonyOS NEXT 原生系统。

### 10. Web / PWA

- 响应式界面同时适配桌面和手机宽度。
- Service Worker 缓存应用外壳，首次成功加载后可离线打开和编辑。
- 不依赖前端构建工具即可运行，使用任意本地 HTTP 静态服务器即可启动。
- 与 Windows、Android 客户端共享任务模型、界面和 Supabase 同步逻辑。

## 支持平台

| 平台 | 状态 | 说明 |
| --- | --- | --- |
| Web / PWA | 可用 | 现代浏览器，离线缓存 |
| Windows | 已实机验证 | .NET 8、Edge WebView2、托盘和后台提醒 |
| Android | 已实机验证 | Android 8.0（API 26）及以上 |
| HarmonyOS | 已实机验证 | 华为 Pura 70 Pro / HarmonyOS 4.2 兼容 Android APK |

> 当前 HarmonyOS 版本是 Android APK 兼容路线，不是 HarmonyOS NEXT 原生应用。

## 下载与安装

普通用户请从 [GitHub Releases](https://github.com/mmcc65/qingdan/releases/latest) 下载正式安装包，不需要克隆源码，也不要从源码目录里的历史归档安装。

- Windows x64：下载 [`Qingdan-desktop-release.zip`](https://github.com/mmcc65/qingdan/releases/latest/download/Qingdan-desktop-release.zip)，完整解压后运行 `Qingdan.exe`；正式包已包含 .NET 运行时。
- Android/HarmonyOS：下载 [`Qingdan-mobile-release.apk`](https://github.com/mmcc65/qingdan/releases/latest/download/Qingdan-mobile-release.apk)，安装时按系统提示授予通知和精确闹钟权限。

Windows 发布包内附带 `创建桌面快捷方式.vbs`。双击一次即可创建指向同一启动脚本的桌面快捷方式；以后直接在原目录覆盖更新文件，快捷方式不需要重建。不要在创建快捷方式后移动整个程序目录。

> Windows 安装包目前没有商业代码签名，首次运行可能出现“未知发布者”提示。请只从本仓库 Release 页面下载，并可用同页更新清单中的 SHA-256 校验文件完整性。

## 运行 Web 版

Web 版没有运行时框架依赖，但必须通过 HTTP 提供文件，不能直接双击 `apps/web/index.html`：

```powershell
python -m http.server 4173 --directory apps/web
```

然后访问 <http://localhost:4173>。

## 开发与测试

需要 Node.js 22 或更高版本，并启用 pnpm。首次安装 Playwright 浏览器后运行测试：

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test
```

桌面端需要 .NET 8 SDK 和 Edge WebView2：

```powershell
dotnet restore apps/desktop/Qingdan.Desktop/Qingdan.Desktop.csproj
dotnet build apps/desktop/Qingdan.Desktop/Qingdan.Desktop.csproj -c Release
```

手机端需要 JDK 17、Android SDK 35 和 Gradle 8.9。详细步骤见 [手机端说明](apps/mobile/README.md)，桌面说明见 [Windows 端说明](apps/desktop/README.md)。

完整的模块关系见 [架构说明](docs/ARCHITECTURE.md)。CI 会在每次提交后检查核心逻辑、响应式 UI、Windows 构建和 Android Debug APK。

## 自托管同步

1. 创建 Supabase 项目。
2. 在 SQL Editor 运行 `infra/supabase/migrations/001_initial_sync.sql`；需要自建发布通道时再运行 `002_mobile_releases.sql`。
3. 在应用设置中填写 Project URL 和 **Publishable key**。
4. 注册或登录邮箱账号。

不要把数据库密码、Secret key 或 `service_role` key 填入应用。同步表启用了 Row Level Security，每个账户只能访问自己的数据。完整说明见 [Supabase 配置](infra/supabase/README.md) 和 [同步设计](docs/SYNC.md)。

## 官方更新源

数据同步地址和软件更新地址是两个不同的信任边界。当前官方发行版在 `apps/web/src/release-config.js` 中固定使用以下 GitHub Release 更新清单：

```text
https://github.com/mmcc65/qingdan/releases/latest/download/desktop-latest.json
https://github.com/mmcc65/qingdan/releases/latest/download/latest.json
```

二次开发者可以替换这两个地址。配置为空时，旧安装会暂时兼容使用用户 Supabase 的 `qingdan-releases` 桶。

## 数据与隐私

- 未配置同步时，任务仅存放在设备本地。
- 配置 Supabase 后，账户信息由所选 Supabase 项目处理，任务数据写入该项目。
- 项目不内置广告、分析 SDK 或行为追踪。
- 卸载或清除浏览器/应用数据可能删除尚未同步的本地任务。

详见 [隐私说明](docs/PRIVACY.md)。

## 项目结构

```text
apps/
  web/      Web/PWA 核心、资源和发布配置
  desktop/  Windows WPF + WebView2 外壳
  mobile/   Android/HarmonyOS 兼容外壳
infra/      Supabase 数据库迁移与配置
tests/      核心逻辑和响应式 UI 检查
tools/      构建、安装和发布脚本
docs/       截图、架构和开源协作文档
```

## 当前限制

- 云同步是第一版实体同步，复杂的跨设备同时编辑仍需更细致的冲突处理。
- Windows 安装包尚未提供商业代码签名，系统可能显示未知发布者提示。
- 自动更新的 SHA-256 只能验证下载完整性；广泛分发前应增加独立签名验证或平台代码签名。
- 暂不支持图片、视频和大型附件。

## 参与项目

提交问题或代码前请阅读 [贡献指南](docs/CONTRIBUTING.md)。安全问题请按 [安全政策](.github/SECURITY.md) 私下报告，不要公开包含漏洞细节的 Issue。

## 许可证

本项目采用 [MIT License](LICENSE)。
