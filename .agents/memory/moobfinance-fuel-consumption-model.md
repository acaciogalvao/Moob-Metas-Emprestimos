---
name: MoobFinance fuel consumption — stable vs instant
description: Why fuel/km-L accounting must never read live GPS-speed-based consumption models directly.
---

MoobFinance (`src/utils/vehicleModels.ts`) has a physics-based consumption model
(e.g. Mottu Sport 110) that derives km/L from **instantaneous GPS speed**, plus an
auto-learned calibration factor updated at each refuel/shift-close.

Rule: any accounting math that must stay stable while driving (fuel tank gauge,
"real" km/L, remaining-km estimate, per-ride fuel cost, suggested refuel liters)
must use `getStableVehicleModelConsumptionKmL` (fixed reference speed), never
`getVehicleModelConsumptionKmL(model, liveSpeed, ...)` directly. The live/instant
variant is only for a small informational "tempo real" readout.

**Why:** using the live-speed variant for accounting made the tank gauge and the
dashboard's "real" km/L number visibly jump every time the speedometer changed,
because the whole trip's fuel-consumed math got recomputed at the new instantaneous
rate on every GPS tick. The user's expectation (and the intended product behavior)
is that km/L stays fixed for the whole shift and only changes when a refuel reveals
a real divergence, which is exactly what the calibration-factor learning already
does — the bug was that live speed was leaking into accounting paths that should
have used the stable/calibrated value instead.

**How to apply:** when adding any new fuel/consumption-derived metric in this app,
check whether it's an "instant readout" (fine to use live speed) or "trip
accounting" (must use the stable function) before wiring it up.
