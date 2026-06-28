<div align="center">

# Kaizoku Service Manager

**A modern Windows service manager that does what `services.msc` won't: group and filter services by the account they run under, and save your own custom views.**

[![Release](https://img.shields.io/github/v/release/AnimeKaizoku/Windows-Service-Manager?sort=semver)](https://github.com/AnimeKaizoku/Windows-Service-Manager/releases)
[![Build](https://github.com/AnimeKaizoku/Windows-Service-Manager/actions/workflows/release.yml/badge.svg)](https://github.com/AnimeKaizoku/Windows-Service-Manager/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6?logo=windows)](#)
[![Made with Go + Wails](https://img.shields.io/badge/built%20with-Go%20%2B%20Wails-00ADD8?logo=go)](https://wails.io)

</div>

---

## Why

The built-in Services console can't filter by logon account and can't save groupings. If you run a fleet of services under one or more dedicated accounts (bots, workers, game servers, app pools), you waste time scrolling and squinting. Kaizoku Service Manager fixes exactly that.

## Features

- **Accounts sidebar:** every logon account on the machine, with live counts. Click to see only that account's services.
- **Custom views:** save arbitrary groupings of services (by account substring, an explicit pick list, or both). Switch between them in one click.
- **Live status:** running / stopped / total counts per view, with colour-coded state pills.
- **Multi-select:** checkboxes, `Ctrl`/`Shift`-click ranges, `Ctrl`+`A`, header "select all".
- **Quick actions:** Start, Stop, Restart selected services.
- **Right-click menu:** services.msc-style context menu on any row.
- **Startup types:** set selected services to Automatic, Manual, or Disabled.
- **One-click Start all Auto:** start every stopped Automatic service in the current view.
- **Favorites:** right-click any service to star it; the Favorites view collects them.
- **Search:** instant filter across name, display name, account, state, startup type, and PID.
- **Export:** dump the current view to CSV or JSON.
- **Native:** single signed-able `.exe`, runs elevated, talks directly to the Windows Service Control Manager (no `sc.exe`/`nssm` shelling).

## Install

### Download
Grab the latest `KaizokuServiceManager.exe` from the [Releases](https://github.com/AnimeKaizoku/Windows-Service-Manager/releases) page and run it. It will prompt for administrator rights, which are required to control services.

### winget
> _Coming soon:_
> ```powershell
> winget install AnimeKaizoku.KaizokuServiceManager
> ```

## Build from source

Requirements: [Go](https://go.dev) 1.23+, [Node](https://nodejs.org) 18+, and the [Wails CLI](https://wails.io).

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# live-reload dev
wails dev

# production build -> build/bin/KaizokuServiceManager.exe
wails build
```

## Tech

| Layer    | Stack |
|----------|-------|
| Backend  | Go, `golang.org/x/sys/windows/svc/mgr` (direct SCM access) |
| Shell    | [Wails v2](https://wails.io) + WebView2 |
| Frontend | Vanilla JS + Vite, Catppuccin Mocha theme |

Config (custom views, favorites) is stored at `%APPDATA%\KaizokuServiceManager\config.json`.

## Legacy

The original PowerShell/WPF prototype lives in [`legacy/`](legacy/KaizokuServices.ps1).

## License

[MIT](LICENSE) © TsunayoshiSawada
