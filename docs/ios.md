# Building & sideloading on iPhone

The Capacitor iOS target lives at [`ios/`](../ios/). It wraps the same
PWA bundle that the Android APK does, so feature parity is high — with
two iOS-specific caveats spelled out at the bottom.

## Quick reference

| Path | Cost | Validity | Setup time |
| --- | --- | --- | --- |
| **PWA on Safari (Add to Home Screen)** | $0 | Forever | 30 seconds |
| **Sideloadly / AltStore** with free Apple ID | $0 | 7 days, auto-renewed | 15 minutes |
| **Xcode + free Apple ID** | $0 | 7 days, manual | Mac required |
| **Apple Developer Program** ad-hoc IPA | $99/yr | 1 year | Mac required |
| **TestFlight** | $99/yr | 90 days/build, ~10k testers | Mac required |
| **App Store** | $99/yr + review | distribution | Mac required |

## A. PWA on Safari (zero setup)

Open the deployed PWA URL in Safari on iPhone → tap the share icon →
**Add to Home Screen**. The app installs with the Acharya icon, runs
in standalone mode (no Safari chrome), and works offline after the
first load.

What works on iOS Safari PWA:

- Reader, search, autocomplete, in-text find, dictionary lookup,
  multi-script transliteration, lazy chapter loading, history,
  bookmarks, resume position
- IndexedDB, service-worker caching, manifest icons

What **doesn't** work on iOS Safari PWA:

- **Web Speech API** is unavailable in iOS WebView, so voice
  follow-along and voice search are no-ops. The mic button reports
  *unsupported* and stays disabled.
- iOS storage caps lower than Android (~50 MB by default). The app's
  precache fits under that comfortably.

## B. Build an IPA via GitHub Actions (no Mac at home)

`.github/workflows/build-ios.yml` runs on a `macos-14` runner. Every
push to a branch produces an unsigned `.ipa` as a workflow artifact.

To download:

1. Push to a `claude/**` branch (or trigger via the Actions tab)
2. Open the `Build iOS IPA` run
3. Download the `parayananjali-ios-ipa` artifact
4. Sideload it (see section D below)

A signed build runs only when (a) you trigger the workflow with
`Sign? = true` or (b) you publish a GitHub Release. Signed builds need
these repository secrets:

| Secret | What it is |
| --- | --- |
| `IOS_CERT_BASE64` | `base64 cert.p12` of an iOS Distribution certificate exported from Keychain |
| `IOS_CERT_PASSWORD` | The password you set when exporting the .p12 |
| `IOS_PROFILE_BASE64` | `base64 profile.mobileprovision` of an ad-hoc provisioning profile |
| `IOS_PROFILE_NAME` | The provisioning profile name (e.g. `Parayananjali AdHoc`) |
| `IOS_TEAM_ID` | Your Apple developer team ID (10-char alphanumeric) |

Generating these requires a paid Apple Developer Program account. The
unsigned build path needs nothing.

## C. Build locally (Mac required)

Prerequisites: macOS, Xcode 15+, Node 22+, CocoaPods.

```bash
brew install cocoapods   # or `sudo gem install cocoapods`
npm ci
npm run cap:sync         # builds dist/ + syncs ios + regenerates icons
cd ios/App
pod install
open App.xcworkspace
```

In Xcode:

1. Select the `App` scheme.
2. Connect your iPhone, choose it as the run destination.
3. Sign in to your Apple ID under **Xcode → Settings → Accounts**.
4. In the App target's **Signing & Capabilities**, choose your team.
5. Click **Run**. The first time, the OS will prompt to *Trust this
   developer* in **Settings → General → VPN & Device Management**.

Free Apple ID = the app expires in 7 days. Paid Developer Program =
1 year.

## D. Sideloading paths

### Sideloadly (Mac/Windows, free Apple ID, 7-day re-sign)

1. Download Sideloadly from <https://sideloadly.io/>.
2. Install the iOS-WiFi-Service helper on your iPhone (Sideloadly
   prompts you).
3. Drag `parayananjali-<sha>.ipa` onto Sideloadly.
4. Enter your Apple ID + an app-specific password.
5. The app appears on your phone within ~3 minutes.
6. Re-run Sideloadly every ~7 days to refresh the cert.

### AltStore (auto-renewed every 7 days)

1. Install AltServer on Mac/Windows: <https://altstore.io/>.
2. Install AltStore on your iPhone (via the helper).
3. Open AltStore → tap the `+` → choose your IPA.
4. Keep AltServer running on the same Wi-Fi as your phone for the
   automatic 7-day refresh.

### Apple Configurator 2 (Mac only, 7-day cert)

1. Open Apple Configurator from the Mac App Store.
2. Connect your iPhone.
3. Sign in to your Apple ID inside Configurator.
4. Drag the IPA onto the phone in the Configurator window.

### Diawi (paid developer profile only)

If you have an ad-hoc-signed IPA (signed CI build), upload it to
<https://diawi.com/> and share the link. Recipients install via the
Safari OTA prompt. Up to 100 device UDIDs per provisioning profile.

## iOS-specific caveats

1. **Web Speech API is missing in WKWebView.** The mic button is
   disabled. To get voice follow-along on iOS we'd add a native
   plugin around `SFSpeechRecognizer`. Not done here, but the
   `NSSpeechRecognitionUsageDescription` entry is already in
   `Info.plist` so a future plugin works without re-signing.
2. **Mic permission flow.** When voice eventually works on iOS, the
   `NSMicrophoneUsageDescription` rationale already shows the right
   sentence — same wording as the in-app rationale dialog.

## Status / package IDs

- Bundle ID: `net.sringeri.advaita.bhashyaparayana` (matches Android)
- Display name: `Pārāyaṇāñjali`
- Asset catalog: AppIcon (1024×1024) + Splash (2732×2732), both
  generated from `assets/source/shankaracharya.jpg` by
  `scripts/build-ios-icons.ts`.
- Capacitor iOS plugins active: App, Splash Screen, Status Bar.
