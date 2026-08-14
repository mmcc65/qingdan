# 架构说明

清单使用“共享 Web 核心 + 轻量原生外壳”的结构。

## 共享层

- `index.html` 与 `styles.css`：响应式界面
- `src/core.mjs`：数据规范化、排序、日期和搜索逻辑
- `src/app.js`：交互、持久化和原生桥接
- `src/cloud-sync.js`：Supabase 登录与实体同步
- `src/release-config.js`：官方更新清单地址

本地操作先写入 `localStorage`，再异步推送云端。断网不会阻止编辑。

## Windows

WPF 外壳通过 WebView2 加载共享 Web 资源，C# 层负责窗口、托盘、提醒调度和更新安装。Web 与原生层通过 WebView 消息通信。

## Android/HarmonyOS

Android WebView 加载构建时复制的共享资源。Java 层负责精确闹钟、通知、重启恢复、桌面小组件和 APK 更新安装，通过 JavaScript Interface 与 Web 层通信。

## 云端

Supabase Auth 提供邮箱认证，Postgres + RLS 隔离用户实体，Realtime 通知其他在线设备。发布文件桶是可选能力，与用户任务同步不属于同一个信任边界。

## 关键约束

- 不向仓库提交签名私钥或服务端管理密钥。
- Web、桌面和手机对同一数据结构保持向后兼容。
- 提醒和更新必须在网络中断、进程退出或设备重启后有明确恢复路径。
