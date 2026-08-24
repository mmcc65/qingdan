# 变更记录

本项目从公开预览版开始遵循语义化版本号。

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
[0.5.3]: https://github.com/mmcc65/qingdan/releases/tag/v0.5.3
[0.5.2]: https://github.com/mmcc65/qingdan/releases/tag/v0.5.2
[0.5.1]: https://github.com/mmcc65/qingdan/releases/tag/v0.5.1
[0.5.0]: https://github.com/mmcc65/qingdan/releases/tag/v0.5.0
