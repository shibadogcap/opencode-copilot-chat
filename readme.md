# opencode-copilot-chat

## Intro

This project provides guides and settings JSON to add **opencode** and **CommandCode** models to your Copilot Chat.

- **Opencode**: see `model-settings.json` / `models/*.json`
- **CommandCode**: see `model-settings-commandcode.json` / `models/commandcode-*.json` (plan-based: `go` < `goat` < `pro` < `max` < `all`)

## Requirement

- Visual Studio Code Version: **1.122.0** or above (tested version)

## Quick Start

- 📄 [Browse Models List](/models/) — Get auto-generated configurations for all model types here

### Opencode

- 📄 [Model Settings JSON (All-in-one)](/models/all.json)
- 📄 [Model Settings JSON (With Provider Info)](/model-settings.json)

### CommandCode (plan-based, `go` < `goat` < `pro` < `max`)

- 📄 [Go (34 models)](/models/commandcode-go.json) · [GOAT (38)](/models/commandcode-goat.json) · [Pro (51)](/models/commandcode-pro.json) · [Max (57)](/models/commandcode-max.json) · [All (57)](/models/commandcode-all.json)
- 📄 [Model Settings JSON (CommandCode, 5 providers)](/model-settings-commandcode.json)

- 👉 [Follow the step-by-step guide](/GUIDE.md)

**GIF Guide:**

![An GIF Guide](/assets/media/guide.gif)

[📹 Video Version](/assets/media/guide.mp4)

## VSCode Configuration

- **[chat.exploreAgent.defaultModel](vscode://settings/chat.exploreAgent.defaultModel)**  
  Select the default language model to use for the Explore subagent from the available providers.

- **[chat.utilityModel](vscode://settings/chat.utilityModel)**  
  Override the language model used by built-in utility flows. Leave empty to use the default model.

- **[chat.utilitySmallModel](vscode://settings/chat.utilitySmallModel)**  
  Override the language model used by built-in small/fast utility flows. A fast and inexpensive model is recommended. Leave empty to use the default model.
- **[chat.byokUtilityModelDefault](vscode://settings/chat.byokUtilityModelDefault)**
  Set to `mainAgent` When you Copliot Error shows [No utility model is configured for 'copilot-utility-small' while the selected main agent model is BYOK.](https://github.com/Pikacnu/opencode-copilot-chat/issues/1)

## Automated Updates

Both model catalogs are automatically updated daily via GitHub Actions (`00:00 UTC`).

- **Opencode**: `model-settings.json` / `models/*.json` via `scripts/update-json.ts`
- **CommandCode**: `model-settings-commandcode.json` / `models/commandcode-*.json` via `scripts/update-commandcode.ts` (plan-based `go` < `goat` < `pro` < `max` < `all`)

You can also run the update scripts locally using [Bun](https://bun.sh/):

```bash
bun install
bun install opencode-ai

# Opencode
bun run scripts/update-json.ts

# CommandCode
bun run scripts/update-commandcode.ts
```

## CLI — Auto-Sync to VS Code

A cross-platform CLI that syncs model definitions directly into VS Code's `chatLanguageModels.json`, with optional cron / scheduled task support.

### Quick Start

1. Download the latest binary from [Releases](https://github.com/Pikacnu/opencode-copilot-chat/releases)
2. Run the sync:

```bash
# One-time sync (Windows: opencode-auto-update-windows-x64.exe)
./opencode-auto-update --sync

# Sync a specific provider + source
./opencode-auto-update --sync --provider "OpenCode Go" --source go
```

Or build from source:

```bash
bun install
bun run build       # → dist/opencode-auto-update (or .exe on Windows)
```

### Install as Scheduled Task

```bash
# Run daily at 2 AM
./dist/opencode-auto-update --install

# Run every hour
./dist/opencode-auto-update --install --schedule hourly

# Run weekly
./dist/opencode-auto-update --install --schedule weekly

# Remove the schedule
./dist/opencode-auto-update --uninstall
```

| Platform | Mechanism                   |
| -------- | --------------------------- |
| Windows  | Task Scheduler (`schtasks`) |
| macOS    | `crontab`                   |
| Linux    | `crontab`                   |

### All Options

| Flag                    | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `-h, --help`            | Show help                                          |
| `-s, --source <type>`   | Model source: `all` \| `zen-free` \| `go` \| `zen` |
| `-p, --provider <name>` | Provider name in VS Code config                    |
| `--sync`                | Run sync — update `chatLanguageModels.json`        |
| `--save`                | Save options to `~/.opencode-auto-update-cli.json` |
| `--install`             | Register as cron / scheduled task                  |
| `--uninstall`           | Remove the schedule                                |
| `--schedule <when>`     | `hourly` \| `daily` \| `weekly` (default: `daily`) |

## Reference

- [VS Code Language Model Configuration Reference](https://code.visualstudio.com/docs/copilot/customization/language-models#_model-configuration-reference) — Official documentation for model configuration in VS Code Copilot Chat.

## Acknowledgments

This project is a fork of [Pikacnu/opencode-copilot-chat](https://github.com/Pikacnu/opencode-copilot-chat). Thanks to [@Pikacnu](https://github.com/Pikacnu) for the original work.
