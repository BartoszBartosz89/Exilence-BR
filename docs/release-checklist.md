# Release checklist

Use this checklist before publishing a public Exilence BR release.

## Before tagging

- Confirm `npm run smoke-build-win` passes locally.
- Confirm the generated `dist/latest.yml` points at `Exilence-BR-X.Y.Z.exe`.
- Confirm `package.json` version matches the release tag without the leading `v`.
- Confirm README download links point to this repository.
- Confirm the release notes mention known limitations and whether the build is unsigned.
- Confirm OAuth login, league selection, stash tab fetch, snapshot creation, and poe.ninja price fetching work on a clean profile.
- Confirm PoEDB price set import/export works with a small test file.

## Publishing

1. Merge release changes into `master`.
2. Tag the release, for example:

```bash
git tag v3.28.1
git push origin v3.28.1
```

3. Wait for GitHub Actions to upload release assets.
4. Confirm the release contains:

- `Exilence-BR-X.Y.Z.exe`
- `Exilence-BR-X.Y.Z.exe.blockmap`
- `latest.yml`
- Linux artifacts when the Linux build is enabled and passing

## Update test

The only reliable auto-update test is a two-release test:

1. Install release `vX.Y.Z`.
2. Publish release `vX.Y.Z+1`.
3. Start the installed app.
4. Confirm it detects, downloads, and installs the newer release.

## Known release risks

- Unsigned Windows builds can show Microsoft SmartScreen warnings.
- OAuth currently depends on the existing Exilence backend.
- The app is an unofficial fork and is not affiliated with Grinding Gear Games.
