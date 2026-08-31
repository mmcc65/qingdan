# 变更记录

本项目从公开预览版开始遵循语义化版本号。

## [0.7.0] - 2026-08-31

### 新功能

- 新增独立“日程”模块，可按日期查看当天行程，并使用单次或多时间段循环提醒
- 手机桌面组件可直接勾选完成待办，点击标题、任务或组件空白区域可打开应用

### 改进

- 已完成待办按重要、普通、随后分栏展示
- 组件根据实际高度显示更多待办，2×4 等较高尺寸最多显示七项
- 组件直接完成的数据会在打开应用时与 Web 界面正确合并

### 发布

- Android/HarmonyOS `versionCode` 提升至 14
- 同步发布 Windows、Android/HarmonyOS 安装包和应用内更新清单

## [0.6.2] - 2026-08-29

### 修复

- 使用 Android 官方 2×2 组件尺寸的 dp 回退值，兼容不采用 `targetCellHeight` 的桌面启动器
- 旧组件需移除后重新添加，桌面才会读取新的尺寸规格

### 发布

- Android/HarmonyOS `versionCode` 提升至 13
- 同步发布 Windows、Android/HarmonyOS 安装包和应用内更新清单

## [0.6.1] - 2026-08-29

### 改进

- Android/HarmonyOS 桌面小组件最小尺寸缩小为 2×2，并采用更紧凑的两条待办布局
- 小组件背景改为圆角卡片，改善桌面视觉融合度

### 发布

- Android/HarmonyOS `versionCode` 提升至 12
- 同步发布 Windows、Android/HarmonyOS 安装包和应用内更新清单

## [0.6.0] - 2026-08-29

### 改进

- 项目拥有独立的完成状态，可直接完成大项目而不改变其子项目和任务的状态
- 点击项目名称可进入项目详情，查看该项目及其子项目的完整内容
- 项目频道的“进行中 / 已完成 / 已取消”只统计和展示顶层大项目
- 已完成的小任务保留在所属项目或子项目底部，默认收起，可按需展开查看和恢复

### 发布

- Android/HarmonyOS `versionCode` 提升至 11
- 同步发布 Windows、Android/HarmonyOS 安装包和应用内更新清单

## [0.5.5] - 2026-08-24

### 修复

- 修复顶部“项目”数量把大项目和子项目合并统计的问题
- 项目数量现在只统计顶层大项目，子项目不再单独计数
- 增加项目和任务的“上移一项/下移一项”手动排序操作
- 循环提醒支持在一个任务中添加多个独立提醒时间段，并兼容旧版单时间段数据

### 发布

- Android/HarmonyOS `versionCode` 提升至 10
- 同步发布 Windows、Android/HarmonyOS 安装包和应用内更新清单

## [0.5.3] - 2026-08-23

### 修复

- 修复手机和窄屏布局右下角“＋”始终只能添加待办的问题
- 在重复页面通过“＋”添加重复任务，在项目页面通过“＋”新建项目

### 发布

- Android/HarmonyOS `versionCode` 提升至 8
- 同步发布 Windows、Android/HarmonyOS 安装包和应用内更新清单

## [0.5.2] - 2026-08-15

### 改进

- 手机更新优先使用 Supabase 直连发布通道，失败时自动尝试 GitHub
- 更新失败时记录具体通道异常，便于区分网络与发布配置问题
- 保持 Windows 更新使用 GitHub Release，不改变现有桌面更新流程

### 发布

- Android/HarmonyOS `versionCode` 提升至 7
- 手机 APK 和更新清单同步发布到 Supabase 与 GitHub

## [0.5.1] - 2026-08-15

### 修复

- 修复 Windows Script Host 无法解析无 BOM UTF-8 启动脚本的问题
- 兼容正式发布目录、Windows x64 构建目录和既有数据目录

### 发布

- 重新生成 Windows x64 自包含更新包和已签名 Android/HarmonyOS APK
- 更新应用内更新清单，使 0.5.0 客户端可以检测并升级到 0.5.1

## [0.5.0] - 2026-08-14

### 新增

- Windows 与 Android/HarmonyOS 应用内更新通道
- Windows 桌面稳定快捷方式创建脚本
- 多级子项目与项目内部任务
- 开源许可证、隐私、安全、贡献和架构文档
- 独立于数据同步服务的官方更新清单配置

### 改进

- 统一 Web、Windows 和手机版本号
- 加强跨端提醒可靠性和同步后调度
- 更新公开发布说明和自托管步骤

### 已知限制

- 分实体增量同步和复杂冲突合并仍在开发中
- Windows 发布包尚未提供可信代码签名
- 首次 GitHub Release 创建前，应用内更新地址会返回 404

[0.5.5]: https://github.com/mmcc65/qingdan/releases/tag/v0.5.5
[0.6.0]: https://github.com/mmcc65/qingdan/releases/tag/v0.6.0
[0.6.1]: https://github.com/mmcc65/qingdan/releases/tag/v0.6.1
[0.6.2]: https://github.com/mmcc65/qingdan/releases/tag/v0.6.2
[0.7.0]: https://github.com/mmcc65/qingdan/releases/tag/v0.7.0
[0.5.3]: https://github.com/mmcc65/qingdan/releases/tag/v0.5.3
[0.5.2]: https://github.com/mmcc65/qingdan/releases/tag/v0.5.2
[0.5.1]: https://github.com/mmcc65/qingdan/releases/tag/v0.5.1
[0.5.0]: https://github.com/mmcc65/qingdan/releases/tag/v0.5.0
