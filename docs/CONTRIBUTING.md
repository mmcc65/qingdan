# 参与贡献

感谢你关注清单。项目优先级是：功能可靠、数据安全、同步可靠、轻量，然后才是开发方便。

## 开始之前

1. 先搜索已有 Issue，避免重复工作。
2. 较大的功能请先开 Issue 说明使用场景和范围。
3. 不要提交签名文件、密钥、账号数据、构建缓存或真实任务数据。
4. 修改提醒、同步、存储或更新功能时，请描述失败恢复和兼容策略。

## 本地检查

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test
dotnet build apps/desktop/Qingdan.Desktop/Qingdan.Desktop.csproj -c Release
```

Android 改动还应至少构建 Debug APK；涉及闹钟、通知、重启恢复和小组件的改动需要真机验证。

## Pull Request

- 一次 PR 尽量只解决一个问题。
- 写清用户可见变化、测试结果和已知限制。
- UI 变化附桌面和手机截图。
- 不要在 PR 中包含正式 APK 签名材料或 Supabase 管理密钥。
- 提交代码即表示同意按项目的 MIT License 提供该贡献。
