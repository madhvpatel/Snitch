# Mobile Radio Evidence

This note explains what the mobile pilot now collects for Wi-Fi and Bluetooth context, and what is still intentionally missing.

## Why this exists

Venue evidence is stronger when the package includes more than just video and location.

Radio context can help answer questions like:

- was the device on venue Wi-Fi
- was the phone clearly off Wi-Fi and on cellular instead
- did the current build even have the ability to inspect nearby Bluetooth or Wi-Fi data

The important part is honesty. The app should store what it actually observed, and clearly label what it could not observe.

## What the mobile app now captures

Each mobile submission can now include a `radioEvidence` block with:

- `start` snapshot
- `end` snapshot
- collection version
- limitations list

Each snapshot currently contains:

### Wi-Fi

- collection status
- observed transport type
- connection flags
- SSID if the platform/build exposes it
- BSSID if the platform/build exposes it
- signal strength if exposed
- frequency if exposed
- explanatory note

### Bluetooth

- collection status
- observed transport type
- explanatory note

## What this means in practice

Current v1 behavior:

- Android can capture current Wi-Fi connection context more richly when permissions allow it
- iPhone can attempt SSID/BSSID capture in a native build because the app now carries the Wi-Fi entitlement
- nearby BLE scanning can run in a native development or release build
- Expo Go still cannot perform nearby BLE scanning

So the app is not pretending it saw nearby Bluetooth peripherals or enumerated all nearby access points.

In a native build, it is now capable of recording:

- what current network context was available
- SSID/BSSID when the platform returns them
- nearby BLE advertising devices discovered during a short scan window
- what the platform/build would not allow

## iOS SSID behavior

The mobile code now only attempts iOS SSID/BSSID fetch in a native build.

That means:

- Expo Go: no SSID/BSSID fetch
- native dev or release build: SSID/BSSID fetch is attempted

If the platform still returns `null`, treat that as a real platform limitation for that capture, not as a parser bug.

## Client mismatch warning

This app now has two different local launch targets:

- `npm run start:go` for Expo Go
- `npm run start:dev-client` for the installed native development build

If you mix them, Expo often shows `Could not connect to server` before the app even loads.

That error is not a Snitch backend failure. It usually means:

- Expo Go was opened against a `--dev-client` Metro session
- or the installed native dev app was opened against a `--go` Metro session

## Why Bluetooth is still marked unsupported

Nearby BLE discovery is not just a normal JavaScript API feature in this app.

It needs:

- a development build or custom native app
- a native BLE library
- Bluetooth permissions
- platform-specific QA

That work is separate from the current Expo Go-style pilot path.

## Why Wi-Fi is only partial

The mobile pilot now records current network context, not a general nearby Wi-Fi scan.

That means the evidence package can say things like:

- device was on Wi-Fi during capture
- device was on cellular during capture
- current SSID was available
- current SSID was not available in this build

It does **not** yet claim:

- all nearby APs were scanned
- a venue router was definitely present in the local radio neighborhood

## Where this appears

The new radio evidence now shows up in:

- mobile review screen
- mobile submission detail
- backend submission record
- exported evidence package
- portal evidence-package preview

## What is still pending

- true nearby BLE scan results
- any generalized nearby Wi-Fi enumeration
- stronger native-build-only radio capture path with explicit QA per platform

## Practical interpretation

Use the current radio evidence as a corroborating signal, not as a primary proof source.

Right now the strongest proof remains:

- raw video
- audio identification
- location
- venue selection/match
- chain-of-custody fields

Radio context is useful enrichment, but it should not be overclaimed.
