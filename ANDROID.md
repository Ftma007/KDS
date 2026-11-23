# Sufra KDS Android app

The Android app is the same approved KDS screens as the web version, packaged
inside an Android shell. These files only add the Android part:

- `capacitor.config.json` app name and ID (Sufra KDS, com.sufra.kds)
- `android/` the Android project: full screen when open, can be set as the
  screen's Home app so it starts by itself after a power cycle, and the native
  helper that printing will use
- `.github/workflows/build-android.yml` the cloud build

No screen code (`src/`) is changed by these files.

## One-time setup: signing key

The app is signed with a private key so every update installs over the
previous version. The key is never stored in this repository.

1. Keep `sufra-kds-release.jks` and `SIGNING-KEY-DETAILS.txt` somewhere safe.
   Losing the key means updates can't install over the app any more.
2. Make the key's text form, in PowerShell, in the folder holding the key:
   `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\sufra-kds-release.jks")) | Set-Clipboard`
3. In GitHub: Settings, Secrets and variables, Actions, New repository secret.
   Create the four secrets listed in `SIGNING-KEY-DETAILS.txt`. For
   `ANDROID_KEYSTORE_BASE64`, paste what step 2 copied.

## Getting the app

Every push to `main` builds it. Open Actions, then "Build Android app",
then the latest run, and download the artifact. It contains `app-release.apk`.

## Status

Not yet built or run on a device. The Java was compile-checked only.
