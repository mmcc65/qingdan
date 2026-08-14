# 清单手机端

当前手机端采用轻量 Android APK 兼容路线，目标设备为华为 Pura 70 Pro（HarmonyOS 4.2）。

## 已建立

- 复用现有清单界面和 Supabase 云同步
- 手机本地数据保存与离线使用
- 系统高优先级通知：通知栏消息 + 横幅弹窗
- 单次提醒和循环提醒调度
- 重启手机后恢复提醒
- 桌面小组件显示前三项待办
- 使用与电脑端一致的“清”字图标
- 0.5.0 起支持应用内自动检查、下载、校验并安装正式更新

## 发布手机更新

维护者可在 `src/release-config.js` 中填写 GitHub Releases 或其他可信 HTTPS 更新清单。需要自建 Supabase 发布通道时，在 SQL Editor 运行 `supabase/migrations/002_mobile_releases.sql`，创建公开读取的 `qingdan-releases` 存储桶。

之后运行 `powershell -File tools/publish-mobile.ps1`：脚本会同时构建电脑更新包和正式签名 APK，生成带 SHA-256 的版本清单，再依次上传安装包和版本清单。发布时需要 Supabase Project URL 和 `service_role` key；密钥只在当前进程中使用，不会写入项目文件。不要把该密钥发送给其他人或放入应用。

手机每 6 小时在启动或回到前台时自动检查一次，也可以在“设置 → 数据与同步 → 检查手机更新”中手动检查。系统安全策略仍会保留最后一次安装确认；首次应用内更新还需允许“清单”安装未知应用。

## 构建环境

需要 JDK 17、Android SDK 35、Android Build Tools 和 Gradle。开发工具只安装在电脑上，不进入手机安装包。

首次真机安装后需要允许：通知、提醒/闹钟（如系统询问）以及后台运行。华为手机还应在应用启动管理中允许清单后台活动，避免系统省电策略推迟提醒。
