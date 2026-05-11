# Privacy

Exilence BR is an unofficial community fork of Exilence CE.

This product is not affiliated with or endorsed by Grinding Gear Games in any way.

## Path of Exile authorization

The app opens the Path of Exile authorization flow in the browser. Do not enter your Path of Exile password directly into Exilence BR.

At the moment, OAuth and app backend requests still use the existing Exilence backend at `https://api.exilence.de`. This is kept for compatibility while it works. If that service changes or becomes unavailable, login and account-backed features may stop working until this fork has its own OAuth/backend setup.

## Data used by the app

Depending on the features you use, the app may access:

- your Path of Exile account profile
- leagues available to your account
- characters
- selected stash tabs and stash items
- local snapshots, pricing settings, and PoEDB price set data

## Local data

The desktop app stores local settings and app data on your computer through Electron/browser storage. Resetting app data from settings clears local app state.

## Third-party services

The app uses third-party data/services including:

- Path of Exile APIs and OAuth
- poe.ninja price data
- PoEDB pages for historical pricing data
- GitHub Releases for downloads and app update metadata

The public build currently has no Google Analytics tracking id configured.

## Building yourself

The source code is public. Users who do not want to run the published installer can inspect the code and build from source.
