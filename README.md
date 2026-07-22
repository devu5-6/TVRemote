# TVRemote

A clean React Native prototype for an Android TV / Google TV remote app.

## Current Features

- TV discovery screen with saved TV display
- PIN pairing flow placeholder
- Manual IP fallback
- D-pad controls
- Back, Home, Power, Volume, and Mute controls
- Keyboard text input
- Google voice search button placeholder
- Typed service boundary for the future native TV protocol module

## Important Architecture Note

The UI is ready as a React Native app, but real Android TV / Google TV control requires a native protocol layer.

The native layer should implement:

- mDNS / NSD discovery on the local Wi-Fi network
- Android TV Remote Protocol v2 pairing on port `6467`
- Remote command connection on port `6466`
- TLS certificate generation and secure credential storage
- Protobuf message encoding
- Ping / pong keep-alive handling
- Microphone audio streaming for real Google TV voice search behavior

The app currently uses `src/services/tvRemoteService.ts` as a safe placeholder. Replace that service with a native module when implementing real TV control.

## Run Locally

```bash
npm install
npm run android
```

For iOS builds, use macOS:

```bash
npm run ios
```

## Recommended Next Steps

1. Add a native Android/iOS module for Android TV Remote Protocol v2.
2. Store pairing certificates in Android Keystore and iOS Keychain.
3. Replace demo discovery data with real mDNS discovery.
4. Implement Google voice search by streaming microphone audio to the TV protocol.
5. Test on physical phones and a real Android TV / Google TV.
