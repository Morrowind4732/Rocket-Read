# Rocket Read — v26

## Steering consistency fix

This build fixes intermittent left/right reversal while driving on curves, walls, and rounded corners.

The arena surface system stores different coordinate directions for each wall and corner quadrant. Previously, increasing the car's surface angle could mean "left" on one surface but "right" on another. That could make the car weave left-right-left-right while the same thumbstick direction remained held.

Steering is now resolved against the car's actual local frame every physics tick:

- stick left always rotates the front of the car toward its local left
- stick right always rotates the front of the car toward its local right
- camera orientation does not influence steering
- opposite walls no longer reverse the steering sign
- rounded corner transitions preserve the same requested turn direction
- floor, wall, ramp, corner, and airborne steering use the same player-facing convention

A small joystick deadzone was also added to suppress noisy sign changes near the center without affecting deliberate input.
