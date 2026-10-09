# Jack's Flight Tracker — Native iPhone App

This is a real SwiftUI + Apple MapKit iPhone application, NOT a web clip or embedded website.

**Current scope**: Aircraft registration search with N233ND as default; position, altitude, speed and heading when aircraft data is available; Fort Wayne airborne test airplane; refresh every ~30 seconds while app is open; observed flight trail while app is open.

## Building with Xcode (macOS)

1. Have Xcode 16 or later and XcodeGen installed (`brew install xcodegen`).
2. Open a terminal in `ios` and run `xcodegen generate`.
3. Open `JacksFlightTracker.xcodeproj` in Xcode.
4. Under **Signing & Capabilities**, select the Apple Developer Program team and, if necessary, change the bundle identifier to one registered to that team.
5. Run on an iPhone. Confirm you see *live* position data for a currently airborne test aircraft before distributing.

## Getting into TestFlight

1. Enroll in the paid Apple Developer Program if not already enrolled.
2. In App Store Connect, create an iOS app record with the **same bundle identifier** configured in Xcode.
3. Add a production-quality 1024×1024 App Icon asset and complete the required App Store Connect metadata.
4. In Xcode choose **Product → Archive**, then **Distribute App → App Store Connect → Upload**.
5. When processing finishes, enable your TestFlight build and invite yourself/family (internal or external testing eligibility and Apple review may apply).

The GitHub Actions workflow compiles for the iOS *simulator* without signing. It does **not** automatically create or upload a signed TestFlight build: App Store Connect signing must be set up by the developer first.

## Aircraft data

Flight positions are obtained via adsb.lol's public registration and nearby-aircraft endpoints. It licenses its data under ODbL 1.0; **contact adsb.lol before using its API in production** as requested in its documentation. Consider a licensed or self-hosted ADS-B data source for sustained use.

No guarantee that Jack's particular airplane is transmitting a publicly visible ADS-B position. Coverage may disappear at low altitude or on the ground. The on-screen trail only contains positions observed while the app is open, not complete historical flight records. Never use this app for aviation safety or emergency decisions.
