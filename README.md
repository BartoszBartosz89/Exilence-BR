# Exilence BR

Exilence BR is a community fork of Exilence CE focused on Path of Exile stash valuation, PoEDB historical pricing, economy analysis, and strategy review workflows. It helps calculate how valuable your character, inventory, and stash tabs are, then tracks that value over time.

The original app was Exilence CE, previously Exilence Next and ExileParty.

![Preview image](https://i.imgur.com/IfyINev.png)

## Contents

- [Download](#download)
- [Changelog](https://github.com/BartoszBartosz89/Exilence-BR/blob/master/CHANGELOG.md)
- [Platform](#platform)
- [Release and updates](#release-and-updates)
- [Security and privacy](#security-and-privacy)
- [Contributing with development](#contributing-with-development)
- [PoEDB historical price links](#poedb-historical-price-links)
- [Contact us](#contact-us)
- [Supporting us](#supporting-us)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Download

Download the latest release at https://github.com/BartoszBartosz89/Exilence-BR/releases/latest

Windows builds may be unsigned. If Microsoft SmartScreen warns you, inspect the source code and build locally if you are not comfortable running the published installer.

## Platform

Currently runs with:

- Electron 15.1.0
- React 17.0.1
- mobx 6.0.1
- .NET Core 3.1
- **node 16.x**
- **npm 7.x**

## Release and updates

Release builds are published from GitHub tags named `v*`, for example `v3.28.1`.

The Windows updater reads release metadata from this repository's GitHub Releases page. A release must include:

- `Exilence-BR-X.Y.Z.exe`
- `Exilence-BR-X.Y.Z.exe.blockmap`
- `latest.yml`

The installer uses a separate app identity from upstream Exilence CE, so it should install and update as Exilence BR instead of overwriting the upstream app.

Release checklist:

- `docs/release-checklist.md`

## Security and privacy

Exilence BR is an unofficial community fork of Exilence CE. This product is not affiliated with or endorsed by Grinding Gear Games in any way.

The app currently keeps the existing Exilence backend/OAuth flow for compatibility. Do not enter your Path of Exile password directly into Exilence BR; authorization should happen through pathofexile.com.

Privacy notes:

- `PRIVACY.md`

## Contributing with development

Before submitting a PR, please see our [contributing guidelines](https://github.com/BartoszBartosz89/Exilence-BR/blob/master/CONTRIBUTING.md).

---

**Prerequisite for building LINUX**

You will need to manually set protocol handling. Follow steps below:

1. Create `~/.local/share/applications/ExilenceCE.desktop` with:

```bash
[Desktop Entry]
Name=Exilence BR
Exec=<ABSOLUTE PATH TO ExilenceBR>/ExilenceBRApp/dist/<Exilence-BR-X.Y.Z.AppImage> %u
Icon=<ABSOLUTE PATH TO ExilenceBR>/ExilenceBRApp/public/icon.ico
Terminal=false
Type=Application
MimeType=x-scheme-handler/exilence;
```

2. Run:

- `update-mime-database ~/.local/share/mime`
- `update-desktop-database ~/.local/share/applications`

---

Run the following to get started with the client:

```
npm install
npm run smoke-build-linux (build for linux)
npm run smoke-build-mac (build for macOS)
npm run smoke-build-win (build for windows)
```

These create the AppImage the .desktop file points to.

NOTE: This fork builds with Node 16.20.2. Use the version from `.nvmrc` when building release artifacts.

Other build options:

```
npm start (to serve the project)
npm run build (optional, to build the installer for production)
---
npm run release (optional, to build the installer for production and release)
```

## PoEDB historical price links

PoEDB link generation and hardcoded mapping documentation lives in:

- `docs/poedb-price-links.md`

Quick commands:

- `npm run poedb:generate-links` (default: only missing links)
- `npm run poedb:generate-links:all` (full rescan)
- `npm run poedb:generate-links:report` (retry unresolved items from previous report)

Generated mapping file used by the app:

- `src/data/poedb-item-links.generated.json`

The app ships with this generated map, so users do not need to apply PoEDB links manually after install.

## Contact us

Communicate with us at our Discord https://discord.gg/2T3WXBgjaM

Report bugs at https://github.com/BartoszBartosz89/Exilence-BR/issues

## Acknowledgements

- https://poe.ninja for providing a great API, which lets us calculate net worth of players

## License

This work is licensed under the Creative Commons Attribution-NonCommercial 3.0 Unported License. To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/3.0/ or send a letter to Creative Commons, PO Box 1866, Mountain View, CA 94042, USA.
