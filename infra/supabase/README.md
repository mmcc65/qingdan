# Supabase 云同步配置

1. 在 Supabase 创建项目。
2. 打开项目的 SQL Editor。
3. 新建查询，粘贴并运行 `migrations/001_initial_sync.sql` 的全部内容。
4. 在项目的 API Keys 页面复制 Project URL 和 Publishable key。

只允许把 Publishable key 配置到客户端。不要使用或分享：

- `service_role` key
- Secret key
- 数据库密码

表已启用 Row Level Security。未登录用户无权访问；登录用户只能访问 `user_id` 等于自身账号的记录。

## 可选发布桶

`migrations/002_mobile_releases.sql` 会创建公开读取的 `qingdan-releases` 存储桶，用于自行发布桌面 ZIP、Android APK 和更新清单。普通自托管同步不需要运行它。

发布脚本需要 `service_role` key，只能在维护者控制的本机或受保护的 CI Secret 中使用。客户端永远不需要该密钥。
