# Rocket Read — approximate browser prototype v39.01

## v39.01 merged controller and speed-effects baseline

- Preserves all v39 driving, dodge, landing, wall, and supersonic physics changes.
- Adds browser Gamepad API support using Rocket League-style Xbox defaults.
- Left-stick pitch uses the preferred orientation: push forward for nose-down/front flips; pull backward for nose-up/backflips.
- RT accelerates, LT reverses/brakes, A jumps, B boosts, X powerslides/air-rolls, Y toggles Ball Cam, LB/RB provide dedicated air roll.
- Adds a rear-oriented boost particle trail that follows the car on the ground, walls, ramps, and in the air.
- Replaces the old speed-line presentation with subtle radial velocity streaks that fade in based on actual speed.
- Touch controls remain intact and can coexist with controller input.
- Service-worker cache name bumped to ensure browsers load this merged build.

This build branches directly from **v38**. It preserves the v38 rigid-body landing fix, v37 jump/dodge model, v36 controls, and the approved v35 arena/camera baseline.

## v39 edge-settling refinement

- A momentary edge contact no longer permanently locks the chassis to the first face selected.
- The resting face is re-evaluated while the car is balancing.
- Because the car is wider than it is tall, a 40–60 degree edge pose now naturally tips toward the wheels or roof.
- A side landing is retained only when the chassis is genuinely close to flat on that side.
- Slightly earlier settling and stronger contact damping remove rare edge-balanced stalls without auto-uprighting deliberate roof or true side landings.

## v39 forward-flip follow-through

- v38 applied normal aerial pitch damping as soon as the 0.65-second dodge torque window ended. At the `5.5 rad/s` angular-speed cap, that damping prevented a normal front flip from mathematically carrying through a complete rotation.
- v39 preserves dodge-created angular momentum for a short follow-through window after active torque ends.
- Ordinary forward and backward flips can now complete and return to a wheels-down landing.
- Diagonal/side rotation receives the same follow-through on its roll component.
- A deliberate flip cancel still suppresses pitch follow-through.
- Sustained roof/side floor contact cancels the follow-through so it cannot recreate the v37 infinite-tumble problem.

## v39 accelerate radial spacing

- The `A+PS`, `A+B+PS`, and `A+BST` branch fan now opens completely above the permanent control cluster.
- It clears Ball Cam, Powerslide, Boost, Jump, Reverse, and Air Roll Right.
- Longer guide paths keep each branch visually connected to the main ACCEL button without covering another control.

## Run locally

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.


## v39.04
Corrected close-range ball rendering so the visual sphere matches the collision sphere instead of being capped at 104 screen pixels.
