# Getting the Android APK

There are three ways to get an installable APK of Bhashya Parayana:

1. **Download from GitHub Actions** — easiest, no local setup.
2. **Build locally** — if you already have Android SDK.
3. **Attach to a GitHub Release** — for signed, versioned distribution.

All three routes produce the same app: the PWA (`dist/`) wrapped in a
[Capacitor](https://capacitorjs.com/) WebView. The full bhāṣya corpus,
search index, icons, and fonts are embedded in the APK, so the app works
offline immediately after install.

## 1. Download from GitHub Actions

Every push to a branch triggers the `Build Android APK` workflow defined in
`.github/workflows/build-apk.yml`. The workflow:

1. Installs Node 20 and the JS deps.
2. Builds the PWA (`npm run build`).
3. Installs JDK 21 + Android SDK platform-34 on the runner.
4. Syncs Capacitor, regenerates the Android icons, and runs
   `./gradlew assembleDebug`.
5. Uploads the resulting APK as a workflow artifact named
   `bhashya-parayana-debug-apk`.

Download steps:

1. Open the repository on GitHub → **Actions** tab.
2. Pick the most recent `Build Android APK` run.
3. Scroll to the **Artifacts** section at the bottom.
4. Click `bhashya-parayana-debug-apk` to download the ZIP.
5. Unzip — inside is `bhashya-parayana-<sha>.apk`.

### Installing on Android

1. Copy the APK to your phone (drive, USB, email, etc.).
2. On Android: **Settings → Apps → Special app access → Install unknown apps**,
   pick your file manager or browser, and toggle **Allow from this source**.
3. Open the APK from your file manager and tap **Install**.

Because the APK is debug-signed, Play Protect may show a warning the first
time. This is expected for sideloaded builds; choose **Install anyway**.

## 2. Build locally

Prerequisites: Node ≥ 20, JDK 21, and Android SDK (`platforms;android-34`,
`build-tools;34.0.0`). Point `ANDROID_HOME` at the SDK.

```bash
npm ci
npm run apk:debug          # produces android/app/build/outputs/apk/debug/app-debug.apk
```

That's a single convenience script for `npm run build && npx cap sync android
&& npm run icons:android && cd android && ./gradlew assembleDebug`.

If you want a release APK (smaller, optimized, with shrinking):

```bash
npm run apk:release        # produces .../apk/release/app-release-unsigned.apk
```

You'll need to sign it — see section 3.

## 3. Sign a release APK

Debug APKs are fine for sideload. For Play Store or signed distribution:

1. Generate a keystore (once):
   ```bash
   keytool -genkey -v -keystore bhashya.keystore \
     -alias bhashya -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Store the keystore securely — never commit it.
3. In CI, add these secrets on the repository:
   - `ANDROID_KEYSTORE_BASE64` — `base64 bhashya.keystore`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
4. Extend `build-apk.yml` to decode the keystore, write
   `android/app/keystore.properties`, and run `./gradlew assembleRelease`
   followed by `./gradlew bundleRelease` for a Play Store AAB.
5. Upload the signed AAB to the Play Console.

A release-signing CI job is intentionally left out of the default workflow
to avoid any accidental publication of test keys.

## What's inside the APK

- **WebView activity** that loads `file:///android_asset/public/index.html`.
- The built PWA (`dist/`) — React bundle, fonts are pulled from the network
  on first run then cached by the service worker.
- All 13 bhāṣya JSONs (~8 MB) + search index (~3 MB), bundled under
  `assets/public/data/`.
- Capacitor plugins for splash screen, status bar, and app lifecycle.

Expected APK size: roughly 20–25 MB debug, smaller for release with R8
shrinking.

## Troubleshooting

- **"App not installed"** — usually means an older APK with the same
  package ID (`net.sringeri.advaita.bhashyaparayana`) is already installed.
  Uninstall it first, then install the new one.
- **"Parse error"** — the APK downloaded incompletely; redownload.
- **Play Protect warning** — debug signing; tap **Install anyway**.
- **Fonts look wrong on first launch** — Google Fonts load on first online
  use; go back online once and the app will cache them for offline.
