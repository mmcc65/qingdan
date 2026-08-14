# Qingdan

Qingdan is a lightweight, local-first personal task list with optional self-hosted sync. It focuses on reliable reminders across Windows and Android/HarmonyOS.

The project includes a responsive Web/PWA client, a Windows WPF + WebView2 shell, an Android-compatible mobile shell, Supabase synchronization, native reminders, a home-screen widget, and opt-in application updates.

The current public-preview version is `0.5.0 Beta`. See the [Chinese README](README.md) for installation, self-hosting, development, privacy, and release instructions.

## Highlights

- Local-first and offline-capable
- Separate todo, recurring-task, and project workflows
- Optional Supabase sync with per-user Row Level Security
- Windows tray, always-on-top window, and background reminders
- Android/HarmonyOS exact alarms, reboot recovery, and widget
- MIT licensed

## Development

```powershell
pnpm install --frozen-lockfile
pnpm test
```

Please read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [PRIVACY.md](PRIVACY.md) before contributing or distributing a build.
