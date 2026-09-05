# GameHub v1.8.9

Tower Attack AI vehicle-art integration test.

- Replaces the Stage-1 procedural vehicle atlas artwork with the second generated transparent vehicle pass.
- Keeps the same six-cell atlas contract: Player Scout / Gun Buggy / Tank, then Enemy Scout / Gun Buggy / Tank.
- Generated sprites are automatically cropped, centred and normalised into the existing 256px atlas cells.
- Slightly increases visual sprite scale so the extra painted detail remains readable on the battlefield.
- Keeps all Tower Attack gameplay, routes, economy, AI, combat and deployment logic unchanged.
- Keeps the procedural vehicle renderer as a load-failure fallback.
- The game uses a cleaned/normalised `tower-vehicles.png` derived from the generated transparent sheet.

v1.8.7 remains the stable pre-atlas fallback; v1.8.8 is the procedural-atlas baseline.
