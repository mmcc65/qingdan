# Qingdan

Qingdan is a lightweight, local-first personal task manager with optional self-hosted sync. It combines one shared task core with native Windows and Android capabilities, so the same data model and interface can still use system trays, exact alarms, reboot recovery, widgets, and application updates.

The goal is practical: capture and edit tasks immediately while offline, keep control of your sync infrastructure, and preserve important reminders when the app is closed or the device restarts.

The current version is `0.7.1 Beta`. See the [Chinese README](../README.md) for complete installation, self-hosting, development, privacy, and release instructions.

[Download the latest release](https://github.com/mmcc65/qingdan/releases/latest) · [Architecture](ARCHITECTURE.md) · [Report an issue](https://github.com/mmcc65/qingdan/issues)

## What makes it different

- **Local first:** edits are stored on-device before asynchronous synchronization, so a network outage does not block work.
- **User-controlled sync:** connect your own Supabase project with per-user Row Level Security instead of relying on a bundled task-data service.
- **Shared core, native reliability:** the Web/PWA, WPF WebView2 shell, and Android WebView share business logic while native layers handle reminders and platform integration.
- **Purposeful task model:** one-off todos, recurring tasks, nested projects, and project tasks remain distinct rather than becoming one flat list.
- **Separated trust boundaries:** application update sources are independent from the Supabase instance selected for task synchronization.

## Feature modules

| Module | Included capabilities |
| --- | --- |
| Todos | Important/normal/later priorities, due nodes, notes, pinning, postponement, completion, cancellation, restore, and permanent deletion |
| Recurring tasks | Daily, weekday, weekly, monthly, and biweekly rules with separate completion and skip history |
| Schedule | A separate day itinerary with date navigation and optional single or interval reminders |
| Projects | Nested projects, project tasks, aggregate progress, collapse, pin, rename, and per-project archives |
| Reminders | Single or interval schedules; native Windows reminder windows; Android exact alarms, catch-up, and rescheduling after reboot or time changes |
| Search and history | Search active task names, notes, and projects; separate completed/cancelled/skipped records |
| Sync | Local-first storage, email authentication, optional user-owned Supabase, Realtime updates, manual sync, and RLS isolation |
| Windows | Resizable/always-on-top window, system tray, 10-minute snooze, stable shortcut, and in-app updates |
| Android/HarmonyOS | Native notifications, reboot recovery, a resizable interactive widget showing up to seven todos, exact-alarm permission helper, and signed APK updates |
| Web/PWA | Responsive UI, offline application-shell cache, and a framework-free static HTTP deployment |

The current `0.7.1` syncs one complete state document per user and resolves versions by timestamp. Fine-grained concurrent field merging is planned rather than claimed as a current capability. Browser/PWA use does not guarantee reminders after the browser closes; use a native client for reliable background reminders.

## User downloads

- Windows x64: [`Qingdan-desktop-release.zip`](https://github.com/mmcc65/qingdan/releases/latest/download/Qingdan-desktop-release.zip)
- Android/HarmonyOS: [`Qingdan-mobile-release.apk`](https://github.com/mmcc65/qingdan/releases/latest/download/Qingdan-mobile-release.apk)

Windows builds are currently unsigned and may show an unknown-publisher warning. Download builds only from this repository's Releases page.

## Development

```powershell
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm test
```

Please read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](../.github/SECURITY.md), and [PRIVACY.md](PRIVACY.md) before contributing or distributing a build.
