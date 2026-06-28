# Kaizoku Service Manager

A lightweight GUI for managing Windows services with the visibility `services.msc` never gave you — **filter and group services by the account they run under**, and build **custom views** that keep related services together.

> This repository contains the original PowerShell/WPF prototype. A rewritten **Go (Wails)** desktop app with a modern UI is in progress.

## Why

The built-in Services console can't filter by logon account or let you save your own groupings. If you run a fleet of services under a dedicated account (bots, workers, game servers, app pools), you end up scrolling and squinting. This tool fixes that.

## Features

- **Filter by logon account** — show only the services that run under a chosen user/account.
- **Live status counts** — running / stopped / total at a glance.
- **Multi-select** — `Ctrl+Click` or `Shift+Click` to act on many services at once.
- **Quick actions** — Start, Stop, Restart selected services.
- **Startup types** — set selected services to `Auto`, `Manual`, or `Disabled`.
- **One-click start** — start every `Auto` service that's currently stopped.

## Requirements

- Windows 10/11
- PowerShell 7+
- Administrator rights (required to control services)
- [NSSM](https://nssm.cc/) on `PATH` — only if you manage NSSM-wrapped services; standard services work without it.

## Usage

```powershell
# Run the GUI
pwsh -File .\KaizokuServices.ps1
```

By default the GUI lists **all** services. To scope it to a specific account, set the
filter at the top of `KaizokuServices.ps1`:

```powershell
# Regex matched against each service's logon account (StartName).
# Empty string ('') shows all services.
$AccountFilter = 'MyServiceAccount'
```

## Roadmap

- [ ] Go (Wails) desktop app with a modern UI
- [ ] Custom saved views (arbitrary service groupings)
- [ ] Account sidebar with per-account counts
- [ ] Per-service log viewer
- [ ] Export (CSV / JSON)
- [ ] winget package

## License

See [LICENSE](LICENSE).
