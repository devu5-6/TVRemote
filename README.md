# TVRemote

Android / Google TV remote app built with **Expo SDK 57** and React Native. It talks to TVs over Wi‑Fi using **Android TV Remote Protocol v2** (same protocol as the official Google TV remote app) — no ADB or developer mode required on the TV.

**Package:** `com.anonymous.TVRemote` · **Version:** 1.0.0

---

## Features

### Connect & discovery
- Scan the local Wi‑Fi for Android TV / Google TV devices (mDNS / Zeroconf)
- Manual IP connect when discovery misses a set
- PIN pairing on first connect (certificates stored on the phone)
- Auto-reconnect to previously paired TVs when Wi‑Fi is available
- Sticky toast when Wi‑Fi / Ethernet is off

### Remote controls
- D-pad (up / down / left / right / OK)
- Power, Home, Back
- Volume up / down with live level + mute / unmute
- Channel rocker
- Number pad for direct channel entry
- On-screen keyboard for typing into TV text fields
- HDMI 1 switch
- Restart TV (power menu → confirm)
- Long-press tips on buttons

### Apps & media
- One-tap shortcuts: **YouTube**, **Prime Video**, **Netflix**, **Share** (Multi-Screen)
- Files / USB launcher (learns the TV’s file manager package)
- Share / Multi-Screen package learned from the TV and remembered

### Voice
- Phone-side speech recognition → TV search or YouTube search  
  Example: *“play shubh new music on youtube”* opens YouTube search results

### UX
- Connect drawer with pairing / saved devices
- Toast feedback for connect, errors, and Wi‑Fi state
- Remote UI dims when disconnected

---

## Requirements

| Item | Notes |
|------|--------|
| Node.js | 22.13+ recommended (Expo 57) |
| Phone | Android device with USB debugging (dev) or sideload APK (release) |
| Network | Phone and TV on the **same Wi‑Fi** (not guest / AP isolation) |
| TV | Android TV / Google TV with Android TV Remote Service (preinstalled on most sets) |

---

## Getting started (development)

### 1. Install dependencies

```bash
npm install
```

`postinstall` applies `patch-package` patches (required for the TV remote library).

### 2. Native Android project

This app uses custom native modules (`react-native-tcp-socket`, Zeroconf, audio, speech). Use a **development build**, not Expo Go:

```bash
npx expo run:android
```

First run generates / builds the `android/` project and installs a debug APK.

### 3. Daily development

With the debug app already installed:

```bash
npx expo start
```

Then open the app on the phone. If the phone is on USB and Wi‑Fi is off, forward Metro:

```bash
adb reverse tcp:8081 tcp:8081
```

Useful scripts:

| Script | Purpose |
|--------|---------|
| `npm start` | Start Metro / Expo |
| `npm run android` | Build & run Android (debug) |
| `npm run typecheck` | TypeScript check |

---

## Release build (standalone APK)

Release embeds JS in the APK — **no Metro** needed on other phones.

On Windows (short Gradle home avoids path-length issues):

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:GRADLE_USER_HOME = "D:\gh"
cd android
.\gradlew.bat :app:assembleRelease -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease --console=plain
```

**APK output:**

```
android/app/build/outputs/apk/release/app-release.apk
```

A copy may also live at:

```
releases/TVRemote-1.0.0-release.apk
```

Install on a connected phone:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

> Release is signed with the **debug keystore** by default — fine for sideloading, not for Play Store.

---

## How to use

1. Connect the phone to the same Wi‑Fi as the TV.
2. Open **TVRemote** → Connect / Scan.
3. Select your TV (or enter its IP) → enter the PIN shown on the TV.
4. Use the remote, shortcuts, keyboard, and voice as usual.

**Tips**
- First-time pairing can take a minute (RSA cert generation on device).
- Open **Share** or **Files** once from the TV if launch fails; the app learns the package and stores it.
- Prefer real deep links / `market://launch?id=…` — bare package IDs can drop the session on some OEMs (e.g. Changhong).

---

## Project structure

```
App.tsx                 # Root UI
src/
  components/           # Remote UI (DPad, volume, connect drawer, toasts, …)
  constants/            # App shortcuts
  hooks/                # useAndroidTvRemote — app state & flows
  services/             # Discovery, connection, credential store
  utils/                # Wi‑Fi checks, voice routing, toasts, …
  types/                # Shared types
patches/                # patch-package fixes for react-native-androidtv-remote
android/                # Native project (generated / local build)
releases/               # Optional copied release APKs
```

### Protocol (high level)

| Port | Role |
|------|------|
| **6467** | Pairing (TLS + PIN) |
| **6466** | Remote commands (keys, apps, IME, voice, volume) |

Discovery uses `_androidtvremote2._tcp` on the LAN.

---

## Stack

- Expo `~57` / React Native `0.86`
- `react-native-androidtv-remote` + `react-native-tcp-socket`
- `react-native-zeroconf` — discovery
- `expo-speech-recognition` + `react-native-audio-record` — voice
- `expo-network` — Wi‑Fi / network state
- `@react-native-async-storage/async-storage` — saved TVs & learned packages
- `patch-package` — durable library patches

Expo docs for this SDK: https://docs.expo.dev/versions/v57.0.0/

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| No TVs found | Same Wi‑Fi; disable AP/client isolation; use manual IP |
| Pairing timeout | TV awake; confirm PIN screen; first pair can be slow |
| “Unable to load script” (debug) | Metro running + `adb reverse tcp:8081 tcp:8081` |
| Wi‑Fi off toast | Connect phone to Wi‑Fi / Ethernet (cellular alone is not enough) |
| Share / Files “item not found” | Open that app once on the TV so the package can be learned |
| Windows release build path errors | Use `GRADLE_USER_HOME=D:\gh` as in the release section |

---

## License

Private project (`"private": true` in `package.json`).
