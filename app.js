(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const scene = $('scene');
  const ctx = scene.getContext('2d');
  const topPad = $('topPad');
  const topCtx = topPad.getContext('2d');
  const sidePad = $('sidePad');
  const sideCtx = sidePad.getContext('2d');
  const carPad = $('carPad');
  const carCtx = carPad.getContext('2d');
  const carSidePad = $('carSidePad');
  const carSideCtx = carSidePad.getContext('2d');

  const C = {
    SIDE_X: 4096,
    BACK_Y: 5120,
    CEILING_Z: 2044,
    CORNER_R: 1152,
    RAMP_R: 320,
    BALL_R: 91.25,
    GRAVITY: 650,
    BALL_MAX_SPEED: 6000,
    MAX_SPIN: 6,
    MASS: 30,
    TICK: 1 / 120,
    GOAL_HALF_W: 893,
    GOAL_H: 643,
    GOAL_DEPTH: 880,
    CAR_HALF_L: 59,
    CAR_HALF_W: 42,
    CAR_HALF_H: 22,
    CAR_Z: 28,
    CAR_MAX_SPEED: 2300,
    CAR_MASS: 180,
  };

  const PRO_CAMERA = { distance: 270, height: 100, angle: -4 * Math.PI / 180, fov: 110 };
  const DRIVE_PHYS = {
    throttleSpeed: 1410,
    reverseMaxSpeed: 1400,
    maxSpeed: 2300,
    supersonicEnter: 2200,
    supersonicExit: 2100,
    supersonicGrace: 1.0,
    throttleAccelLow: 1600,
    boostAccelGround: 991.666,
    boostAccelAir: 1058.333,
    coastDecel: 525,
    brakeDecel: 3500,
    jumpSpeed: 291.667,
    jumpHoldAccel: 1458.333,
    jumpHoldMin: 0.025,
    jumpHoldMax: 0.20,
    jumpStickyAccel: 325,
    jumpStickyTicks: 3,
    secondJumpWindow: 1.25,
    dodgeDeadzone: 0.50,
    dodgeImpulse: 500,
    dodgeDuration: 0.65,
    dodgePitchTorque: 224,
    dodgeSideTorque: 260,
    dodgeTorqueToAccel: 0.12,
    dodgeVerticalDampStart: 0.15,
    dodgeVerticalDampEnd: 0.21,
    dodgeVerticalDampPerTick: 0.65,
    dodgePitchLockAfter: 0.30,
    // Keep the angular momentum from a dodge after the active torque window.
    // v38 applied ordinary aerial damping immediately, which mathematically
    // prevented a front flip from ever completing a full rotation.
    dodgeFollowThroughDuration: 0.64,
    dodgeFollowThroughDamping: 0.18,
    airThrottleForward: 66.667,
    airThrottleReverse: 33.334,
    pitchAccel: 12.46,
    yawAccel: 9.11,
    rollAccel: 38.34,
    pitchDampingRaw: 30,
    yawDampingRaw: 20,
    rollDampingRaw: 50,
    angularDampingScale: 0.10,
    maxAngularSpeed: 5.5,
    lateralGrip: 13.5,
    landingLevelRate: 3.2,
    powerslideGrip: 1.35,
    powerslideSteerMultiplier: 2.15,
    powerslideSpeedRetention: 0.985,
    powerslideEngageRate: 9.0,
    powerslideReleaseRate: 6.0,
    carWorldFriction: 0.30,
    carWorldRestitution: 0.30,
    bodyRestitution: 0.10,
    suspensionStiffness: 500,
    suspensionCompressionDamping: 25,
    suspensionRelaxationDamping: 40,
    suspensionTravel: 12,
    surfaceAdhesionBase: 325,
    surfaceAdhesionFull: 975,
    surfaceFullStickSpeed: 25,
    wallDetachDelay: 0.58,
    selfRightImpulse: 200,
    selfRightTorque: 50,
    selfRightDuration: 0.40,
    selfRightRollThreshold: 2.8,
    bodyBounceThreshold: 42,
    bodySettleDelay: 0.050,
    bodySettleAngularLimit: 3.05,
    bodySettleSpring: 25.5,
    bodySettleDamping: 9.2,
    // A side face is only a stable resting choice when the car is genuinely
    // close to flat on that side. Edge-balanced 40–60 degree poses now tip
    // toward the wheels or roof instead of being captured as a side landing.
    bodySideRestCapture: 0.49,
    bodySideRestHysteresis: 0.08,
    bodySleepAngle: 0.026,
    bodySleepAngularSpeed: 0.17,
    bodyRestLinearDamping: 5.1,
  };


  const state = {
    shotNo: 0,
    mode: 'mixed',
    spinMode: 'off',
    speedMode: 'normal',
    restitution: 0.6,
    grip: 0.35,
    shot: null,
    revealed: false,
    playing: false,
    playMode: 'preview',
    playStart: 0,
    playhead: 0,
    playbackRate: 1,
    guessHeading: Math.PI / 2,
    guessElevation: 0.18,
    carGuessHeading: Math.PI / 2,
    carGuessElevation: 0.35,
    carGuessSpeed: 1500,
    carLaunchDelay: 0,
    carResult: null,
    pathHint: null,
    optimumMode: false,
    optimumPreviousRevealed: false,
    dragTop: false,
    dragSide: false,
    dragCar: false,
    dragCarSide: false,
    activeTab: 'ball',
    renderBasis: null,
    cameraTouchMode: true,
    viewMode: 'arena',
    carCam: { yawOffset: 0, pitchOffset: 0, dragging: false },
    camera: { yaw: -0.82, pitch: 0.28, distance: 3150, target: v3(0, 0, 550) },
    score: { blue: 0, orange: 0 },
    goalCelebration: { active: false, scoredBy: null, enteredGoal: null, startedAt: 0, endsAt: 0, origin: v3(), particles: [], shockwave: 0 },
    bot: { difficultyIndex: 0, car: null, thinkTimer: 0, steer: 0, throttle: 0, boost: false, powerslide: false, jumpCooldown: 0, stuckTimer: 0, lastTargetDistance: Infinity, recoveryTimer: 0, target: null },
    drive: { active: false, started: false, paused: false, cameraMode: 'ball', steerX: 0, steerY: 0, accel: false, reverse: false, controllerAccel: 0, controllerReverse: 0, boost: false, powerslide: false, airRollLeft: false, airRollRight: false, powerslideAmount: 0, jumpHeld: false, justJump: false, joyPointer: null, hitCooldown: 0, ball: null, car: null, boostTrail: [], boostEmitCarry: 0, lastTime: 0, ballCamOrbit: null, ballCamLastUpdate: 0, ballCamTargetLift: 0, ballCamPullback: 0, ballCamHeightLift: 0, accelBranch: 'accel' },
    pvp: { active: false, connecting: false, connected: false, channel: null, client: null, clientId: '', joinedAt: 0, role: null, team: null, opponentId: null, countdownStart: 0, countdownEnd: 0, countdownTimer: null, lastStateSend: 0, lastBallSend: 0, lastRemoteAt: 0, kickoffSerial: 0, remoteTarget: null, remoteHitCooldown: 0 },
    pointer: new Map(),
    pinchDistance: null,
  };

  function v3(x = 0, y = 0, z = 0) { return { x, y, z }; }
  function add(a, b) { return v3(a.x + b.x, a.y + b.y, a.z + b.z); }
  function sub(a, b) { return v3(a.x - b.x, a.y - b.y, a.z - b.z); }
  function mul(a, s) { return v3(a.x * s, a.y * s, a.z * s); }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) { return v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  function len(a) { return Math.hypot(a.x, a.y, a.z); }
  function len2D(a) { return Math.hypot(a.x, a.y); }
  function dist2D(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function norm(a) { const n = len(a) || 1; return mul(a, 1 / n); }
  function norm2D(a) { const n = Math.hypot(a.x, a.y) || 1; return v3(a.x / n, a.y / n, 0); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function choice(list) { return list[Math.floor(Math.random() * list.length)]; }
  function copyState(s) { return { p: v3(s.p.x, s.p.y, s.p.z), v: v3(s.v.x, s.v.y, s.v.z), w: v3(s.w.x, s.w.y, s.w.z) }; }
  function angleWrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function deg(rad) { return rad * 180 / Math.PI; }

  function capBall(s) {
    const speed = len(s.v);
    if (speed > C.BALL_MAX_SPEED) s.v = mul(s.v, C.BALL_MAX_SPEED / speed);
    const spin = len(s.w);
    if (spin > C.MAX_SPIN) s.w = mul(s.w, C.MAX_SPIN / spin);
  }


  // Rocket League layers a gameplay-oriented impulse on top of the ordinary
  // rigid-body collision. This is what gives light pops useful lift instead of
  // making the ball feel unusually heavy despite using the correct 650 uu/s²
  // gravity. The exact Psyonix curve is proprietary; this smooth approximation
  // follows the measured model while staying conservative at dribble speeds.
  function psyonixBallHitScale(relativeSpeed) {
    const t = clamp((relativeSpeed - 250) / 2350, 0, 1);
    const smooth = t * t * (3 - 2 * t);
    return 0.16 + 0.18 * smooth;
  }

  function psyonixBallHitNormal(ballPosition, carPosition, carForward) {
    let n = sub(ballPosition, carPosition);
    n.z *= 0.35;
    n = sub(n, mul(carForward, 0.35 * dot(n, carForward)));
    return norm(n);
  }

  function contactResponse(s, normal, penetration, surface) {
    s.p = add(s.p, mul(normal, penetration + 0.01));
    const r = mul(normal, -C.BALL_R);
    const contactVel = add(s.v, cross(s.w, r));
    const vn = dot(contactVel, normal);
    if (vn >= 0) return;

    let e = state.restitution;
    if (surface === 'floor' && Math.abs(vn) < 34) e = 0;
    const jn = -(1 + e) * vn * C.MASS;
    const impulseN = mul(normal, jn);

    const tangential = sub(contactVel, mul(normal, vn));
    const tangentSpeed = len(tangential);
    let impulseT = v3();
    if (tangentSpeed > 0.001) {
      const desired = mul(tangential, -C.MASS / 3.5);
      const maxT = state.grip * Math.abs(jn);
      const desiredLen = len(desired);
      impulseT = desiredLen > maxT ? mul(desired, maxT / desiredLen) : desired;
    }

    const impulse = add(impulseN, impulseT);
    s.v = add(s.v, mul(impulse, 1 / C.MASS));
    const inertia = 0.4 * C.MASS * C.BALL_R * C.BALL_R;
    s.w = add(s.w, mul(cross(r, impulse), 1 / inertia));

    if (surface === 'floor' && Math.abs(s.v.z) < 10) s.v.z = 0;
    capBall(s);
  }

  function collideArena(s) {
    const contacts = [];
    const r = C.BALL_R;

    if (s.p.z < r) contacts.push({ n: v3(0, 0, 1), d: r - s.p.z, surface: 'floor' });
    if (s.p.z > C.CEILING_Z - r) contacts.push({ n: v3(0, 0, -1), d: s.p.z - (C.CEILING_Z - r), surface: 'ceiling' });

    const ax = Math.abs(s.p.x);
    const ay = Math.abs(s.p.y);
    const sx = Math.sign(s.p.x) || 1;
    const sy = Math.sign(s.p.y) || 1;
    const straightXEnd = C.BACK_Y - C.CORNER_R;
    const straightYEnd = C.SIDE_X - C.CORNER_R;
    const xLimit = C.SIDE_X - r;
    const yLimit = C.BACK_Y - r;
    const cornerRadius = C.CORNER_R - r;

    const goalOpening = insideGoalMouth(s.p, r);
    const beyondGoalLine = ay > C.BACK_Y - r;
    const inGoalVolume = beyondGoalLine
      && ay < C.BACK_Y + C.GOAL_DEPTH + r
      && ax < C.GOAL_HALF_W + r
      && s.p.z < C.GOAL_H + r;

    if (ax > straightYEnd && ay > straightXEnd) {
      const cx = straightYEnd;
      const cy = straightXEnd;
      const dx = ax - cx;
      const dy = ay - cy;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance > cornerRadius) {
        contacts.push({ n: v3(-sx * dx / distance, -sy * dy / distance, 0), d: distance - cornerRadius, surface: 'corner' });
      }
    } else {
      if (ax > xLimit) contacts.push({ n: v3(-sx, 0, 0), d: ax - xLimit, surface: 'wall' });
      if (ay > yLimit && !goalOpening && !inGoalVolume) contacts.push({ n: v3(0, -sy, 0), d: ay - yLimit, surface: 'backboard' });
    }

    // Once the ball passes through the carved goal mouth, contain it inside a
    // simple goal box rather than colliding with the old backboard plane.
    if ((goalOpening || inGoalVolume) && beyondGoalLine) {
      const goalSideLimit = C.GOAL_HALF_W - r;
      const goalRoofLimit = C.GOAL_H - r;
      const goalBackLimit = C.BACK_Y + C.GOAL_DEPTH - r;
      if (ax > goalSideLimit) contacts.push({ n: v3(-sx, 0, 0), d: ax - goalSideLimit, surface: 'goal-side' });
      if (s.p.z > goalRoofLimit) contacts.push({ n: v3(0, 0, -1), d: s.p.z - goalRoofLimit, surface: 'goal-roof' });
      if (ay > goalBackLimit) contacts.push({ n: v3(0, -sy, 0), d: ay - goalBackLimit, surface: 'goal-back' });
    }

    if (s.p.z < C.RAMP_R && s.p.z >= r) {
      const effectiveRadius = C.RAMP_R - r;
      const qz = s.p.z - C.RAMP_R;
      const lateral = Math.sqrt(Math.max(0, effectiveRadius * effectiveRadius - qz * qz));
      const rampXLimit = C.SIDE_X - C.RAMP_R + lateral;
      const rampYLimit = C.BACK_Y - C.RAMP_R + lateral;
      if (ay <= straightXEnd && ax > rampXLimit) {
        const qx = ax - (C.SIDE_X - C.RAMP_R);
        const distance = Math.hypot(qx, qz) || 1;
        contacts.push({ n: v3(-sx * qx / distance, 0, -qz / distance), d: distance - effectiveRadius, surface: 'ramp' });
      }
      if (ax <= straightYEnd && ay > rampYLimit && !goalOpening && !inGoalVolume) {
        const qy = ay - (C.BACK_Y - C.RAMP_R);
        const distance = Math.hypot(qy, qz) || 1;
        contacts.push({ n: v3(0, -sy * qy / distance, -qz / distance), d: distance - effectiveRadius, surface: 'ramp' });
      }
    }

    contacts.sort((a, b) => b.d - a.d);
    for (const contact of contacts.slice(0, 3)) {
      if (contact.d > -0.02) contactResponse(s, contact.n, Math.max(0, contact.d), contact.surface);
    }
    return contacts.length ? contacts[0] : null;
  }

  function stepBall(s) {
    s.v.z -= C.GRAVITY * C.TICK;
    s.p = add(s.p, mul(s.v, C.TICK));
    let first = null;
    for (let i = 0; i < 3; i += 1) {
      const contact = collideArena(s);
      if (!first && contact) first = contact;
      if (!contact) break;
    }
    capBall(s);
    return first;
  }

  function simulate(initial, seconds = 5.2, captureEvery = 2) {
    const s = copyState(initial);
    const points = [{ p: v3(s.p.x, s.p.y, s.p.z), v: v3(s.v.x, s.v.y, s.v.z), t: 0 }];
    let firstBounce = null;
    let postState = null;
    let lastSurface = null;
    const ticks = Math.ceil(seconds / C.TICK);
    for (let i = 1; i <= ticks; i += 1) {
      const contact = stepBall(s);
      if (contact && !firstBounce) {
        firstBounce = { index: points.length, p: v3(s.p.x, s.p.y, s.p.z), t: i * C.TICK, surface: contact.surface, n: contact.n };
        postState = copyState(s);
      }
      if (contact) lastSurface = contact.surface;
      if (i % captureEvery === 0) points.push({ p: v3(s.p.x, s.p.y, s.p.z), v: v3(s.v.x, s.v.y, s.v.z), t: i * C.TICK });
    }
    return { points, firstBounce, postState, lastSurface };
  }

  function simulateToRest(initial, maxSeconds = 12, captureEvery = 2, restSpeed = 40) {
    const s = copyState(initial);
    const points = [{ p: v3(s.p.x, s.p.y, s.p.z), v: v3(s.v.x, s.v.y, s.v.z), t: 0 }];
    let firstBounce = null;
    let postState = null;
    let lastSurface = null;
    let quietTicks = 0;
    const ticks = Math.ceil(maxSeconds / C.TICK);
    for (let i = 1; i <= ticks; i += 1) {
      const contact = stepBall(s);
      if (contact && !firstBounce) {
        firstBounce = { index: points.length, p: v3(s.p.x, s.p.y, s.p.z), t: i * C.TICK, surface: contact.surface, n: contact.n };
        postState = copyState(s);
      }
      if (contact) lastSurface = contact.surface;
      if (i % captureEvery === 0) points.push({ p: v3(s.p.x, s.p.y, s.p.z), v: v3(s.v.x, s.v.y, s.v.z), t: i * C.TICK });
      const speed = len(s.v);
      const settled = speed < restSpeed && s.p.z <= C.BALL_R + 5 && Math.abs(s.v.z) < 18;
      quietTicks = settled ? quietTicks + 1 : 0;
      if (quietTicks >= 30) break;
    }
    return { points, firstBounce, postState, lastSurface };
  }

  function spinForMode() {
    if (state.spinMode === 'off') return v3();
    const max = state.spinMode === 'light' ? 2.2 : 5.8;
    return v3(rand(-max, max), rand(-max, max), rand(-max, max));
  }

  function speedRange() {
    if (state.speedMode === 'fast') return [3000, 5200];
    if (state.speedMode === 'any') return [1200, 5400];
    return [1700, 3600];
  }

  function makeTowardTarget(target, normalIn, desiredSurface) {
    const [minSpeed, maxSpeed] = speedRange();
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const distance = rand(1000, 2600);
      const sideOffset = v3(rand(-700, 700), rand(-700, 700), rand(-260, 360));
      const tangentOffset = sub(sideOffset, mul(normalIn, dot(sideOffset, normalIn)));
      let start = add(target, add(mul(normalIn, distance), tangentOffset));
      start.x = clamp(start.x, -3600, 3600);
      start.y = clamp(start.y, -4650, 4650);
      start.z = clamp(start.z, 180, 1700);
      const t = rand(0.55, 1.25);
      const accelerationTerm = v3(0, 0, -0.5 * C.GRAVITY * t * t);
      const velocity = mul(sub(sub(target, start), accelerationTerm), 1 / t);
      const speed = len(velocity);
      if (speed < minSpeed || speed > maxSpeed) continue;
      const initial = { p: start, v: velocity, w: spinForMode() };
      const sim = simulate(initial, 5.2, 2);
      if (!sim.firstBounce || !sim.postState) continue;
      if (desiredSurface && sim.firstBounce.surface !== desiredSurface && !(desiredSurface === 'wall' && sim.firstBounce.surface === 'ramp')) continue;
      return { initial, sim };
    }
    return null;
  }

  function insideFieldXY(p, margin = 0) {
    const ax = Math.abs(p.x);
    const ay = Math.abs(p.y);
    const xStraight = C.SIDE_X - C.CORNER_R;
    const yStraight = C.BACK_Y - C.CORNER_R;
    if (ax > C.SIDE_X - margin || ay > C.BACK_Y - margin) return false;
    if (ax <= xStraight || ay <= yStraight) return true;
    const dx = ax - xStraight;
    const dy = ay - yStraight;
    return Math.hypot(dx, dy) <= C.CORNER_R - margin;
  }


  function insideGoalMouth(p, margin = 0) {
    return Math.abs(p.x) <= C.GOAL_HALF_W - margin
      && p.z <= C.GOAL_H - margin;
  }

  function insideGoalTunnel(p, margin = 0) {
    return Math.abs(p.y) >= C.BACK_Y - margin
      && Math.abs(p.y) <= C.BACK_Y + C.GOAL_DEPTH - margin
      && Math.abs(p.x) <= C.GOAL_HALF_W - margin
      && p.z <= C.GOAL_H - margin;
  }

  function sampleTimedPath(path, t) {
    if (!path || !path.length) return { p: v3(), v: v3(), t: 0 };
    if (t <= path[0].t) return path[0];
    const last = path[path.length - 1];
    if (t >= last.t) return last;
    let lo = 0;
    let hi = path.length - 1;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (path[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = path[lo];
    const b = path[hi];
    const f = clamp((t - a.t) / Math.max(0.0001, b.t - a.t), 0, 1);
    return {
      p: add(a.p, mul(sub(b.p, a.p), f)),
      v: add(a.v || v3(), mul(sub(b.v || v3(), a.v || v3()), f)),
      t,
    };
  }

  function makeGoalShotPath(start, goal, attackSign) {
    const horizontalDistance = dist2D(start, goal);
    let flight = clamp(horizontalDistance / 3300, 0.45, 2.1);
    let targetZ = clamp(230 + Math.min(120, horizontalDistance * 0.025), 220, 390);
    let velocity = v3(
      (goal.x - start.x) / flight,
      (goal.y - start.y) / flight,
      (targetZ - start.z + 0.5 * C.GRAVITY * flight * flight) / flight,
    );
    if (len(velocity) > C.BALL_MAX_SPEED) {
      flight *= len(velocity) / C.BALL_MAX_SPEED;
      velocity = v3(
        (goal.x - start.x) / flight,
        (goal.y - start.y) / flight,
        (targetZ - start.z + 0.5 * C.GRAVITY * flight * flight) / flight,
      );
    }
    const points = [];
    const frames = Math.ceil(flight * 60);
    for (let i = 0; i <= frames; i += 1) {
      const t = Math.min(flight, i / 60);
      const p = v3(
        start.x + velocity.x * t,
        start.y + velocity.y * t,
        start.z + velocity.z * t - 0.5 * C.GRAVITY * t * t,
      );
      points.push({ p, v: v3(velocity.x, velocity.y, velocity.z - C.GRAVITY * t), t });
    }
    return { points, velocity, duration: flight, attackSign };
  }

  function buildCarPlan(shot) {
    const bounceP = shot.bounce?.p || shot.path[Math.floor(shot.path.length * 0.25)].p;
    const bounceT = shot.bounce?.t || 0.8;
    const attackSign = bounceP.y <= 0 ? 1 : -1;
    const targetName = attackSign > 0 ? 'ORANGE' : 'BLUE';
    const teamName = attackSign > 0 ? 'BLUE' : 'ORANGE';
    const goal = v3(0, attackSign * C.BACK_Y, 280);
    const options = [];
    const desiredElevation = rand(0.10, 0.82);
    const desiredTiming = bounceT + rand(0.85, 1.85);

    for (let i = 0; i < shot.path.length; i += 2) {
      const point = shot.path[i];
      if (point.t < bounceT + 0.35 || point.t > 4.8) continue;
      if (point.p.z > 1520 || point.p.z < C.BALL_R - 5) continue;
      if (attackSign * (goal.y - point.p.y) < 520) continue;

      const strikeDirection = norm(sub(goal, point.p));
      const strikeHorizontal = norm2D(strikeDirection);
      const contactCar = add(point.p, mul(strikeDirection, -(C.BALL_R + C.CAR_HALF_L + 12)));
      contactCar.z = Math.max(C.CAR_Z, contactCar.z);
      if (!insideFieldXY(contactCar, 120)) continue;

      for (let horizontalSpeed = 650; horizontalSpeed <= 2200; horizontalSpeed += 75) {
        const travel = horizontalSpeed * point.t;
        if (travel < 550 || travel > 7600) continue;
        const start = add(contactCar, mul(strikeHorizontal, -travel));
        start.z = C.CAR_Z;
        if (!insideFieldXY(start, 160)) continue;
        if (attackSign * start.y > attackSign * contactCar.y - 180) continue;

        const launchVz = (contactCar.z - C.CAR_Z + 0.5 * C.GRAVITY * point.t * point.t) / point.t;
        if (launchVz < -20) continue;
        const launchSpeed = Math.hypot(horizontalSpeed, launchVz);
        if (launchSpeed > C.CAR_MAX_SPEED || launchSpeed < 600) continue;
        const launchElevation = Math.atan2(launchVz, horizontalSpeed);
        if (launchElevation < 0 || launchElevation > 1.30) continue;

        const impactVelocity = v3(
          strikeHorizontal.x * horizontalSpeed,
          strikeHorizontal.y * horizontalSpeed,
          launchVz - C.GRAVITY * point.t,
        );
        const impactAlignment = deg(Math.acos(clamp(dot(norm(impactVelocity), strikeDirection), -1, 1)));
        const elevationBias = Math.abs(launchElevation - desiredElevation) * 115;
        const timingBias = Math.abs(point.t - desiredTiming) * 50;
        const alignmentBias = impactAlignment * 5.2;
        const centerBias = Math.abs(start.x) * 0.025;
        const speedBias = Math.abs(launchSpeed - 1550) * 0.04;
        options.push({
          score: elevationBias + timingBias + alignmentBias + centerBias + speedBias + rand(0, 55),
          start,
          contactCar,
          contactBall: v3(point.p.x, point.p.y, point.p.z),
          interceptTime: point.t,
          optimumHeading: Math.atan2(strikeHorizontal.y, strikeHorizontal.x),
          optimumElevation: launchElevation,
          optimumSpeed: launchSpeed,
          horizontalSpeed,
          launchVz,
          impactAlignment,
          direction: strikeDirection,
        });
      }
    }

    if (!options.length) {
      const point = sampleTimedPath(shot.path, clamp(bounceT + 1.35, 1.2, 4.5));
      const strikeDirection = norm(sub(goal, point.p));
      const strikeHorizontal = norm2D(strikeDirection);
      const contactCar = add(point.p, mul(strikeDirection, -(C.BALL_R + C.CAR_HALF_L + 12)));
      contactCar.z = Math.max(C.CAR_Z, contactCar.z);
      const interceptTime = point.t;
      let horizontalSpeed = 1050;
      let launchVz = (contactCar.z - C.CAR_Z + 0.5 * C.GRAVITY * interceptTime * interceptTime) / interceptTime;
      let launchSpeed = Math.hypot(horizontalSpeed, launchVz);
      if (launchSpeed > C.CAR_MAX_SPEED) {
        horizontalSpeed *= C.CAR_MAX_SPEED / launchSpeed;
        launchVz *= C.CAR_MAX_SPEED / launchSpeed;
        launchSpeed = C.CAR_MAX_SPEED;
      }
      const start = add(contactCar, mul(strikeHorizontal, -horizontalSpeed * interceptTime));
      start.x = clamp(start.x, -3400, 3400);
      start.y = clamp(start.y, -4300, 4300);
      start.z = C.CAR_Z;
      options.push({
        score: 0,
        start,
        contactCar,
        contactBall: v3(point.p.x, point.p.y, point.p.z),
        interceptTime,
        optimumHeading: Math.atan2(strikeHorizontal.y, strikeHorizontal.x),
        optimumElevation: Math.atan2(launchVz, horizontalSpeed),
        optimumSpeed: launchSpeed,
        horizontalSpeed,
        launchVz,
        impactAlignment: 0,
        direction: strikeDirection,
      });
    }

    options.sort((a, b) => a.score - b.score);
    const plan = choice(options.slice(0, Math.min(20, options.length)));
    const goalShot = makeGoalShotPath(plan.contactBall, goal, attackSign);
    return {
      ...plan,
      attackSign,
      targetName,
      teamName,
      goal,
      goalShot,
    };
  }

  function generateShot(mode) {
    const selected = mode === 'mixed' ? choice(['wall', 'backboard', 'corner', 'floor']) : mode;
    let built = null;

    if (selected === 'wall') {
      const sign = choice([-1, 1]);
      const target = v3(sign * (C.SIDE_X - C.BALL_R), rand(-2800, 2800), rand(320, 1450));
      built = makeTowardTarget(target, v3(-sign, 0, 0), 'wall');
    } else if (selected === 'backboard') {
      const sign = choice([-1, 1]);
      const target = v3(rand(-2500, 2500), sign * (C.BACK_Y - C.BALL_R), rand(500, 1720));
      built = makeTowardTarget(target, v3(0, -sign, 0), 'backboard');
    } else if (selected === 'corner') {
      const sx = choice([-1, 1]);
      const sy = choice([-1, 1]);
      const theta = rand(0.22, 1.35);
      const cx = sx * (C.SIDE_X - C.CORNER_R);
      const cy = sy * (C.BACK_Y - C.CORNER_R);
      const radial = v3(sx * Math.cos(theta), sy * Math.sin(theta), 0);
      const target = v3(cx + radial.x * (C.CORNER_R - C.BALL_R), cy + radial.y * (C.CORNER_R - C.BALL_R), rand(300, 1350));
      built = makeTowardTarget(target, mul(radial, -1), 'corner');
    } else {
      const target = v3(rand(-3100, 3100), rand(-4000, 4000), C.BALL_R);
      built = makeTowardTarget(target, v3(0, 0, 1), 'floor');
    }

    if (!built) {
      const fallback = { p: v3(0, -1500, 700), v: v3(2600, 1700, 200), w: spinForMode() };
      built = { initial: fallback, sim: simulate(fallback, 5.2, 2) };
    }

    const bounce = built.sim.firstBounce;
    const actualDir = norm(built.sim.postState?.v || built.initial.v);
    const actualHeading = Math.atan2(actualDir.y, actualDir.x);
    const actualElevation = Math.asin(clamp(actualDir.z, -1, 1));
    const incoming = norm(built.initial.v);
    const shot = {
      type: selected,
      initial: built.initial,
      path: built.sim.points,
      bounce,
      postState: built.sim.postState,
      actualDir,
      actualHeading,
      actualElevation,
      incoming,
      surface: bounce ? bounce.surface : selected,
      speed: len(built.initial.v),
    };
    shot.carPlan = buildCarPlan(shot);
    return shot;
  }

  function initialMirrorGuess(shot) {
    if (!shot.bounce) return v3(1, 0, 0.2);
    const n = shot.bounce.n;
    const incoming = norm(shot.initial.v);
    return norm(sub(incoming, mul(n, 2 * dot(incoming, n))));
  }

  function guessDir() {
    const c = Math.cos(state.guessElevation);
    return v3(Math.cos(state.guessHeading) * c, Math.sin(state.guessHeading) * c, Math.sin(state.guessElevation));
  }

  function carGuessDir() {
    const c = Math.cos(state.carGuessElevation);
    return v3(
      Math.cos(state.carGuessHeading) * c,
      Math.sin(state.carGuessHeading) * c,
      Math.sin(state.carGuessElevation),
    );
  }

  function carPositionAt(plan, heading, elevation, speed, t, delay = 0) {
    const elapsed = Math.max(0, t - delay);
    if (elapsed <= 0) return v3(plan.start.x, plan.start.y, plan.start.z);
    const horizontal = Math.max(0, speed) * Math.cos(elevation);
    const launchVz = Math.max(0, speed) * Math.sin(elevation);
    const position = v3(
      plan.start.x + Math.cos(heading) * horizontal * elapsed,
      plan.start.y + Math.sin(heading) * horizontal * elapsed,
      plan.start.z + launchVz * elapsed - 0.5 * C.GRAVITY * elapsed * elapsed,
    );
    if (position.z < C.CAR_Z) position.z = C.CAR_Z;
    return position;
  }

  function carVelocityAt(plan, heading, elevation, speed, t, delay = 0) {
    const elapsed = t - delay;
    if (elapsed < 0) return v3();
    const horizontal = Math.max(0, speed) * Math.cos(elevation);
    const launchVz = Math.max(0, speed) * Math.sin(elevation);
    const rawZ = plan.start.z + launchVz * elapsed - 0.5 * C.GRAVITY * elapsed * elapsed;
    return v3(
      Math.cos(heading) * horizontal,
      Math.sin(heading) * horizontal,
      rawZ <= C.CAR_Z && launchVz - C.GRAVITY * elapsed < 0 ? 0 : launchVz - C.GRAVITY * elapsed,
    );
  }

  function makeCarPath(plan, heading, elevation, speed, duration = plan.interceptTime, delay = 0) {
    const points = [];
    const frames = Math.max(2, Math.ceil(duration * 60));
    for (let i = 0; i <= frames; i += 1) {
      const t = duration * i / frames;
      points.push(carPositionAt(plan, heading, elevation, speed, t, delay));
    }
    return points;
  }

  function carAxes(heading, elevation) {
    const forward = norm(v3(
      Math.cos(heading) * Math.cos(elevation),
      Math.sin(heading) * Math.cos(elevation),
      Math.sin(elevation),
    ));
    const right = norm(v3(-Math.sin(heading), Math.cos(heading), 0));
    const up = norm(cross(forward, right));
    return { forward, right, up };
  }

  function sphereCarClearance(ballP, carP, heading, elevation) {
    const axes = carAxes(heading, elevation);
    const relative = sub(ballP, carP);
    const local = {
      forward: dot(relative, axes.forward),
      right: dot(relative, axes.right),
      up: dot(relative, axes.up),
    };
    const closest = add(
      add(
        add(carP, mul(axes.forward, clamp(local.forward, -C.CAR_HALF_L, C.CAR_HALF_L))),
        mul(axes.right, clamp(local.right, -C.CAR_HALF_W, C.CAR_HALF_W)),
      ),
      mul(axes.up, clamp(local.up, -C.CAR_HALF_H, C.CAR_HALF_H)),
    );
    const offset = sub(ballP, closest);
    const distance = len(offset);
    const fallback = len(relative) > 0.001 ? norm(relative) : axes.forward;
    return {
      clearance: distance - C.BALL_R,
      closest,
      normal: distance > 0.001 ? mul(offset, 1 / distance) : fallback,
    };
  }

  function makePostHitPath(hit) {
    const relativeVelocity = sub(hit.ball.v, hit.carVelocity);
    let normalSpeed = dot(relativeVelocity, hit.normal);
    if (normalSpeed > 0) normalSpeed = -Math.abs(normalSpeed) * 0.25;
    let outgoing = sub(hit.ball.v, mul(hit.normal, (1 + 0.68) * normalSpeed));
    outgoing = add(outgoing, mul(hit.carVelocity, 0.08));
    const outgoingSpeed = len(outgoing);
    if (outgoingSpeed > C.BALL_MAX_SPEED) outgoing = mul(outgoing, C.BALL_MAX_SPEED / outgoingSpeed);
    const initial = {
      p: add(hit.ball.p, mul(hit.normal, 3)),
      v: outgoing,
      w: v3(state.shot.initial.w.x, state.shot.initial.w.y, state.shot.initial.w.z),
    };
    const simulated = simulateToRest(initial, 12, 2, 40);
    const points = simulated.points.map((point) => ({
      p: point.p,
      v: point.v,
      t: point.t + hit.time,
    }));
    const plan = state.shot.carPlan;
    const goalBound = points.some((point) => (
      plan.attackSign * point.p.y >= C.BACK_Y - C.BALL_R - 22
      && Math.abs(point.p.x) <= C.GOAL_HALF_W - C.BALL_R + 35
      && point.p.z <= C.GOAL_H - C.BALL_R + 35
    ));
    return { points, outgoing, goalBound };
  }

  function predictedBallPositionAt(t) {
    const shot = state.shot;
    if (!shot) return v3();
    const bounceP = shot.bounce?.p || shot.postState?.p || shot.initial.p;
    const postSpeed = len(shot.postState?.v || shot.initial.v);
    const ballV = mul(guessDir(), postSpeed);
    return v3(
      bounceP.x + ballV.x * t,
      bounceP.y + ballV.y * t,
      Math.max(C.BALL_R, bounceP.z + ballV.z * t - 0.5 * C.GRAVITY * t * t),
    );
  }

  function closestPointsOnSegments(p1, q1, p2, q2) {
    const d1 = sub(q1, p1);
    const d2 = sub(q2, p2);
    const r = sub(p1, p2);
    const a = dot(d1, d1);
    const e = dot(d2, d2);
    const f = dot(d2, r);
    let s = 0;
    let t = 0;
    const eps = 1e-7;
    if (a <= eps && e <= eps) {
      return { a: p1, b: p2, distance: len(sub(p1, p2)) };
    }
    if (a <= eps) {
      t = clamp(f / e, 0, 1);
    } else {
      const c = dot(d1, r);
      if (e <= eps) {
        s = clamp(-c / a, 0, 1);
      } else {
        const b = dot(d1, d2);
        const denom = a * e - b * b;
        if (denom !== 0) s = clamp((b * f - c * e) / denom, 0, 1);
        const tNom = b * s + f;
        if (tNom < 0) {
          t = 0;
          s = clamp(-c / a, 0, 1);
        } else if (tNom > e) {
          t = 1;
          s = clamp((b - c) / a, 0, 1);
        } else {
          t = tNom / e;
        }
      }
    }
    const ca = add(p1, mul(d1, s));
    const cb = add(p2, mul(d2, t));
    return { a: ca, b: cb, distance: len(sub(ca, cb)) };
  }

  function evaluateGuessPathHint() {
    if (!state.shot) return { level: 'neutral', label: 'PATH CHECK — set your ball and car guess' };
    const shot = state.shot;
    const plan = shot.carPlan;
    const bounceP = shot.bounce?.p || shot.postState?.p || shot.initial.p;
    const ballSpeed = len(shot.postState?.v || shot.initial.v);
    const ballPoints = ballisticPath(bounceP, mul(guessDir(), ballSpeed), 2.4);
    const carDuration = Math.max(3.6, plan.interceptTime + 1.2, state.carLaunchDelay + 3.0);
    const carPoints = makeCarPath(
      plan,
      state.carGuessHeading,
      state.carGuessElevation,
      state.carGuessSpeed,
      carDuration,
      state.carLaunchDelay,
    );
    let best = { distance: Infinity, ballP: null, carP: null };
    for (let i = 1; i < ballPoints.length; i += 1) {
      for (let j = 1; j < carPoints.length; j += 1) {
        const result = closestPointsOnSegments(ballPoints[i - 1], ballPoints[i], carPoints[j - 1], carPoints[j]);
        if (result.distance < best.distance) {
          best = { distance: result.distance, ballP: result.a, carP: result.b };
        }
      }
    }
    if (best.distance <= C.BALL_R + C.CAR_HALF_H) {
      return { level: 'green', label: `PATH CHECK — lines overlap (${Math.round(best.distance)} uu)`, ...best };
    }
    if (best.distance <= 220) {
      return { level: 'yellow', label: `PATH CHECK — close paths (${Math.round(best.distance)} uu)`, ...best };
    }
    return { level: 'red', label: `PATH CHECK — paths stay apart (${Math.round(best.distance)} uu)`, ...best };
  }

  function updatePathHint() {
    const hint = evaluateGuessPathHint();
    state.pathHint = hint;
    const el = $('pathHint');
    if (!el) return;
    el.textContent = hint.label;
    el.className = `path-hint ${hint.level || 'neutral'}`;
  }

  function evaluateTimedCollision(plan) {
    const path = state.shot.path;
    const lastTime = path[path.length - 1]?.t || 5.2;
    const maxTime = Math.min(lastTime, Math.max(4.4, plan.interceptTime + 2.2, state.carLaunchDelay + 3.2));
    const dt = C.TICK;
    let best = null;
    let previous = null;
    let hit = null;

    const sampleAt = (t) => {
      const ball = sampleTimedPath(path, t);
      const carP = carPositionAt(plan, state.carGuessHeading, state.carGuessElevation, state.carGuessSpeed, t, state.carLaunchDelay);
      const carVelocity = carVelocityAt(plan, state.carGuessHeading, state.carGuessElevation, state.carGuessSpeed, t, state.carLaunchDelay);
      const contact = sphereCarClearance(ball.p, carP, state.carGuessHeading, state.carGuessElevation);
      return { time: t, ball, carP, carVelocity, ...contact };
    };

    for (let t = 0; t <= maxTime + 0.0001; t += dt) {
      const current = sampleAt(Math.min(t, maxTime));
      if (!best || current.clearance < best.clearance) best = current;
      if (current.clearance <= 0) {
        let low = previous ? previous.time : Math.max(0, current.time - dt);
        let high = current.time;
        for (let i = 0; i < 9; i += 1) {
          const mid = (low + high) / 2;
          const sample = sampleAt(mid);
          if (sample.clearance <= 0) high = mid;
          else low = mid;
        }
        hit = sampleAt(high);
        break;
      }
      previous = current;
    }

    const headingError = Math.abs(deg(angleWrap(state.carGuessHeading - plan.optimumHeading)));
    const elevationError = Math.abs(deg(state.carGuessElevation - plan.optimumElevation));
    const speedError = Math.abs(state.carGuessSpeed - plan.optimumSpeed);
    const postHit = hit ? makePostHitPath(hit) : null;
    const missDistance = hit ? 0 : Math.max(0, best?.clearance ?? 9999);
    const delayPenalty = hit ? Math.abs(hit.time - plan.interceptTime) * 2.5 : state.carLaunchDelay * 1.5;
    const score = Math.round(clamp(
      100
      - headingError * 0.8
      - elevationError * 1.1
      - speedError / 35
      - missDistance / 32
      - delayPenalty
      + (postHit?.goalBound ? 10 : 0),
      0,
      100,
    ));
    return {
      hit: Boolean(hit),
      hitTime: hit?.time ?? null,
      hitSample: hit,
      closest: best,
      missDistance,
      headingError,
      elevationError,
      speedError,
      score,
      postHitPath: postHit?.points || null,
      outgoingVelocity: postHit?.outgoing || null,
      goalBound: Boolean(postHit?.goalBound),
    };
  }

  function optimalCarPositionAt(plan, t) {
    if (t >= plan.interceptTime) return plan.contactCar;
    return carPositionAt(plan, plan.optimumHeading, plan.optimumElevation, plan.optimumSpeed, t);
  }

  function currentAnimationDuration() {
    if (!state.shot) return 0;
    if (state.playMode === 'compare' && state.revealed) {
      const plan = state.shot.carPlan;
      const idealEnd = plan.interceptTime + plan.goalShot.duration;
      const pathEnd = state.shot.path[state.shot.path.length - 1]?.t || 5.2;
      const userEnd = state.carResult?.postHitPath?.length
        ? state.carResult.postHitPath[state.carResult.postHitPath.length - 1].t
        : Math.min(pathEnd, Math.max(4.4, state.carLaunchDelay + 3.2));
      return Math.max(idealEnd, userEnd);
    }
    return Math.max(0.45, state.shot.bounce?.t || 1.2);
  }

  function animationTime(now) {
    if (!state.playing) return state.playhead;
    const duration = currentAnimationDuration();
    const pause = state.playMode === 'compare' ? 0.75 : 0.45;
    const elapsed = (now - state.playStart) / 1000 * state.playbackRate;
    const cycle = duration + pause;
    const cycleTime = cycle > 0 ? elapsed % cycle : 0;
    state.playhead = Math.min(duration, cycleTime);
    return state.playhead;
  }

  function startPlayback(mode, restart = true) {
    if (!state.shot) return;
    state.playMode = mode;
    if (restart) state.playhead = 0;
    state.playStart = performance.now() - state.playhead * 1000 / Math.max(0.01, state.playbackRate);
    state.playing = true;
    $('phaseBadge').textContent = mode === 'compare'
      ? 'BOUNCE → AERIAL INTERCEPT → TARGET GOAL'
      : 'INCOMING PATH — WATCH THE LOOP';
    $('phaseText').textContent = mode === 'compare' ? 'Study the full solution loop' : 'Watch the approach';
    updatePlaybackButtons();
    drawAll(state.playStart);
  }

  function togglePlayback() {
    if (!state.shot) return;
    if (state.drive.active) {
      if (!state.drive.started) startDriveIfNeeded();
      state.drive.paused = !state.drive.paused;
      updateDriveUI();
      drawAll();
      return;
    }
    if (state.playing) {
      state.playing = false;
    } else {
      startPlayback(state.playMode, false);
    }
    updatePlaybackButtons();
    drawAll();
  }

  function updatePlaybackButtons() {
    if (state.drive.active) { $('playButton').textContent = state.drive.paused ? 'Resume' : 'Pause'; $('replayButton').textContent = 'Restart loop'; return; }
    $('playButton').textContent = state.playing ? 'Pause' : 'Play';
    $('replayButton').textContent = 'Restart loop';
  }

  function newShot() {
    state.mode = $('modeSelect').value;
    state.spinMode = $('spinSelect').value;
    state.speedMode = $('speedSelect').value;
    state.playbackRate = Number($('playbackSelect').value);
    state.shot = generateShot(state.mode);
    state.shotNo += 1;
    state.revealed = false;
    state.playing = false;
    state.playMode = 'preview';
    state.playhead = 0;
    state.drive.active = false;
    state.optimumMode = false;

    const reflected = initialMirrorGuess(state.shot);
    state.guessHeading = Math.atan2(reflected.y, reflected.x);
    state.guessElevation = Math.asin(clamp(reflected.z, -1, 1));

    const plan = state.shot.carPlan;
    const visibleAim = norm(sub(state.shot.bounce?.p || plan.contactBall, plan.start));
    state.carGuessHeading = Math.atan2(visibleAim.y, visibleAim.x);
    state.carGuessElevation = clamp(Math.asin(clamp(visibleAim.z, -1, 1)), 0, 1.25);
    state.carGuessSpeed = clamp(dist2D(plan.start, state.shot.bounce?.p || plan.contactBall) / Math.max(0.75, plan.interceptTime), 600, 2100);
    $('carSpeedRange').value = String(Math.round(state.carGuessSpeed / 10) * 10);
    state.carGuessSpeed = Number($('carSpeedRange').value);
    state.carLaunchDelay = 0;
    state.carResult = null;
    $('carDelayRange').value = '0';

    $('lockButton').disabled = false;
    $('carSpeedRange').disabled = false;
    $('carDelayRange').disabled = true;
    $('phaseBadge').textContent = 'INCOMING PATH — WATCH THE LOOP';
    $('phaseText').textContent = 'Watch the approach';
    $('resultLabel').textContent = 'Watch the loop, set both tabs, then lock your read.';
    delete $('resultLabel').dataset.bounceLabel;
    $('scoreText').textContent = '—';
    $('angleError').textContent = '—';
    $('horizontalError').textContent = '—';
    $('verticalError').textContent = '—';
    $('carResultLabel').textContent = '';
    $('carScoreText').textContent = '—';
    $('carHeadingError').textContent = '—';
    $('carElevationError').textContent = '—';
    $('carSpeedError').textContent = '—';
    $('carDelayReadout').textContent = '—';
    $('carContactError').textContent = '—';
    $('optimalSpeed').textContent = '—';
    $('ballTabScore').textContent = '—';
    $('carTabScore').textContent = '—';
    $('resultBar').classList.remove('revealed');
    $('carTimingStatus').textContent = 'Available after Lock read';
    $('carTimingStatus').className = 'timing-status';
    $('carDelayMinus').disabled = true;
    $('carDelayPlus').disabled = true;

    updateOptimumNotches();
    updatePathHint();
    updateCarSpeedOutput();
    updateCarDelayOutput();
    updateAngleOutputs();
    updateGoalBadge();
    autoCamera(state.shot);
    updateHud();
    resetDriveSession();
    state.viewMode = 'car';
    setActiveTab('car');
    updateViewModeUI();
    updateDriveUI();
    updateOptimumUI();
    resizeCanvases();
    startPlayback('preview');
  }

  function evaluateCarGuess(plan) {
    return evaluateTimedCollision(plan);
  }

  function updateBounceResultUI() {
    if (!state.shot || !state.revealed) return;
    const guess = guessDir();
    const actual = state.shot.actualDir;
    const angle = deg(Math.acos(clamp(dot(guess, actual), -1, 1)));
    const horizontalError = Math.abs(deg(angleWrap(state.guessHeading - state.shot.actualHeading)));
    const verticalError = Math.abs(deg(state.guessElevation - state.shot.actualElevation));
    const bounceScore = Math.round(clamp(100 - angle * 3.15, 0, 100));
    const bounceLabel = bounceScore >= 92 ? 'Nailed the bounce.' : bounceScore >= 78 ? 'Great bounce read.' : bounceScore >= 60 ? 'Close bounce read.' : bounceScore >= 35 ? 'Readable, but off.' : 'That bounce got you.';
    $('scoreText').textContent = String(bounceScore);
    $('ballTabScore').textContent = String(bounceScore);
    $('angleError').textContent = `${angle.toFixed(1)}°`;
    $('horizontalError').textContent = `${horizontalError.toFixed(1)}°`;
    $('verticalError').textContent = `${verticalError.toFixed(1)}°`;
    $('resultLabel').dataset.bounceLabel = bounceLabel;
  }

  function refreshRevealedUI(restartPlayback = false) {
    if (!state.shot || !state.revealed) return;
    updateBounceResultUI();
    updateCarResultUI(restartPlayback);
  }

  function updateCarResultUI(restartPlayback = false) {
    if (!state.shot || !state.revealed) return;
    const result = evaluateCarGuess(state.shot.carPlan);
    state.carResult = result;
    const contactText = result.hit ? 'HIT' : `${Math.round(result.missDistance)} uu`;
    let carLabel;
    if (result.hit && result.goalBound) carLabel = `Contact at ${result.hitTime.toFixed(2)}s — your touch is goal-bound.`;
    else if (result.hit) carLabel = `Contact at ${result.hitTime.toFixed(2)}s — the resulting path is not on target.`;
    else if (result.missDistance < 80) carLabel = `Near miss: ${Math.round(result.missDistance)} uu at ${result.closest.time.toFixed(2)}s.`;
    else if (result.closest.time < state.carLaunchDelay + 0.04) carLabel = `Too late: the closest pass occurs before your launch develops.`;
    else carLabel = `No collision — closest pass is ${Math.round(result.missDistance)} uu.`;

    $('carResultLabel').textContent = carLabel;
    $('carScoreText').textContent = String(result.score);
    $('carTabScore').textContent = String(result.score);
    $('carHeadingError').textContent = `${result.headingError.toFixed(1)}°`;
    $('carElevationError').textContent = `${result.elevationError.toFixed(1)}°`;
    $('carSpeedError').textContent = `${Math.round(result.speedError)}`;
    $('carDelayReadout').textContent = `${state.carLaunchDelay.toFixed(2)}s`;
    $('carContactError').textContent = contactText;
    $('optimalSpeed').textContent = `${Math.round(state.shot.carPlan.optimumSpeed)}`;
    $('carTimingStatus').textContent = carLabel;
    $('carTimingStatus').className = `timing-status ${result.hit ? 'hit' : 'miss'}`;
    updateOptimumNotches();

    const bouncePrefix = $('resultLabel').dataset.bounceLabel || '';
    $('resultLabel').textContent = `${bouncePrefix} ${carLabel}`.trim();
    if (restartPlayback) startPlayback('compare');
    else drawAll();
  }

  function lockGuess() {
    if (!state.shot || state.revealed) return;
    state.revealed = true;
    $('lockButton').disabled = true;
    $('resultBar').classList.add('revealed');
    $('carDelayRange').disabled = false;
    $('carDelayMinus').disabled = false;
    $('carDelayPlus').disabled = false;
    refreshRevealedUI(false);
    startPlayback('compare');
  }

  function updateCarSpeedOutput() {
    $('carSpeedOutput').textContent = `${Math.round(state.carGuessSpeed)} uu/s`;
  }

  function updateCarDelayOutput() {
    $('carDelayOutput').textContent = `${state.carLaunchDelay.toFixed(2)} s`;
  }

  function setRangeTarget(id, value, min, max, hidden = false) {
    const el = $(id);
    if (!el) return;
    const ratio = clamp((value - min) / Math.max(0.0001, max - min), 0, 1);
    el.style.left = `${(ratio * 100).toFixed(2)}%`;
    el.hidden = hidden;
  }

  function updateOptimumNotches() {
    if (!state.shot || !state.revealed) {
      setRangeTarget('carSpeedTarget', 0, 0, 2300, true);
      setRangeTarget('carDelayTarget', 0, 0, 3, true);
      return;
    }
    setRangeTarget('carSpeedTarget', state.shot.carPlan.optimumSpeed || 0, 0, 2300, false);
    setRangeTarget('carDelayTarget', 0, 0, 3, false);
  }

  function signedDegrees(angle) {
    return Math.round(deg(angleWrap(angle)));
  }

  function updateAngleOutputs() {
    $('ballHeadingOutput').textContent = `${signedDegrees(state.guessHeading)}°`;
    $('ballElevationOutput').textContent = `${Math.round(deg(state.guessElevation))}°`;
    $('carHeadingOutput').textContent = `${signedDegrees(state.carGuessHeading)}°`;
    $('carElevationOutput').textContent = `${Math.round(deg(state.carGuessElevation))}°`;
  }

  function resizeCanvasToDisplaySize(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.max(2, Math.round(rect.width * ratio));
    const height = Math.max(2, Math.round(rect.height * ratio));
    if (canvas.width === width && canvas.height === height) return false;
    canvas.width = width;
    canvas.height = height;
    return true;
  }

  function resizeCanvases() {
    [scene, topPad, sidePad, carPad, carSidePad].forEach(resizeCanvasToDisplaySize);
    drawAll();
  }

  function setActiveTab(tab) {
    state.activeTab = tab === 'car' ? 'car' : 'ball';
    const ballActive = state.activeTab === 'ball';
    $('ballPanel').hidden = !ballActive;
    $('carPanel').hidden = ballActive;
    $('ballTabButton').classList.toggle('active', ballActive);
    $('carTabButton').classList.toggle('active', !ballActive);
    $('ballTabButton').setAttribute('aria-selected', String(ballActive));
    $('carTabButton').setAttribute('aria-selected', String(!ballActive));
    requestAnimationFrame(resizeCanvases);
  }

  function updateGoalBadge() {
    const badge = $('targetGoalBadge');
    const name = state.shot?.carPlan?.targetName || 'ORANGE';
    badge.textContent = `TARGET: ${name} GOAL`;
    badge.classList.toggle('orange', name === 'ORANGE');
    badge.classList.toggle('blue', name === 'BLUE');
  }

  function updateHud() {
    $('shotCounter').textContent = state.shotNo;
    $('modeReadout').textContent = (state.shot?.type || state.mode).toUpperCase();
    const speed = state.shot?.speed || 0;
    $('speedText').textContent = Math.round(speed);
    const pct = clamp(speed / C.BALL_MAX_SPEED, 0, 1);
    $('gaugeNeedle').style.transform = `rotate(${(-80 + pct * 160).toFixed(1)}deg)`;
    if (state.pvp.active) updatePvpNetwork(performance.now());
  }

  function autoCamera(shot) {
    const p = shot.bounce?.p || shot.initial.p;
    const plan = shot.carPlan;
    const midpoint = mul(add(plan.start, plan.contactBall), 0.5);
    state.camera.target = v3(midpoint.x * 0.45 + p.x * 0.25, midpoint.y * 0.45 + p.y * 0.25, clamp(p.z, 320, 760));
    if (shot.type === 'wall') {
      state.camera.yaw = p.x > 0 ? 2.65 : -0.5;
      state.camera.pitch = 0.19;
      state.camera.distance = 3600;
    } else if (shot.type === 'backboard') {
      state.camera.yaw = p.y > 0 ? -1.55 : 1.55;
      state.camera.pitch = 0.22;
      state.camera.distance = 3900;
    } else if (shot.type === 'corner') {
      state.camera.yaw = Math.atan2(p.y, p.x) + Math.PI;
      state.camera.pitch = 0.22;
      state.camera.distance = 3800;
    } else {
      state.camera.yaw = -0.8;
      state.camera.pitch = 0.38;
      state.camera.distance = 3800;
    }
  }

  function driveCarFrame(car) {
    if (!car) return { forward: v3(1, 0, 0), up: v3(0, 0, 1), right: v3(0, -1, 0) };
    let forward;
    let up;
    if (car.surfaceForward && car.surfaceUp) {
      forward = norm(car.surfaceForward);
      up = norm(car.surfaceUp);
    } else {
      forward = norm(v3(
        Math.cos(car.heading || 0) * Math.cos(car.pitch || 0),
        Math.sin(car.heading || 0) * Math.cos(car.pitch || 0),
        Math.sin(car.pitch || 0),
      ));
      const worldRight = norm(v3(-Math.sin(car.heading || 0), Math.cos(car.heading || 0), 0));
      up = norm(cross(forward, worldRight));
      if (len(up) < 0.1) up = v3(0, 0, 1);
    }
    let right = norm(cross(forward, up));
    if (len(right) < 0.1) right = v3(0, -1, 0);
    up = norm(cross(right, forward));
    const roll = Number.isFinite(car.roll) ? car.roll : 0;
    if (Math.abs(roll) > 0.0001 && !car.surfaceAxis) {
      up = norm(rotateAroundAxis(up, forward, roll));
      right = norm(cross(forward, up));
      up = norm(cross(right, forward));
    }
    return { forward, up, right };
  }

  function followedCarState() {
    if (state.drive.active && state.drive.car) {
      const frame = driveCarFrame(state.drive.car);
      return { center: state.drive.car.p, heading: state.drive.car.heading, elevation: state.drive.car.pitch || 0, ...frame };
    }
    if (!state.shot) return { center: v3(0, 0, C.CAR_Z), heading: 0, elevation: 0, forward: v3(1,0,0), up: v3(0,0,1), right: v3(0,-1,0) };
    const plan = state.shot.carPlan;
    if (state.optimumMode) {
      const t = state.playing ? state.playhead : state.playhead;
      const center = optimalCarPositionAt(plan, Math.min(t, plan.interceptTime));
      const forward = norm(v3(Math.cos(plan.optimumHeading) * Math.cos(plan.optimumElevation), Math.sin(plan.optimumHeading) * Math.cos(plan.optimumElevation), Math.sin(plan.optimumElevation)));
      const right = norm(v3(-Math.sin(plan.optimumHeading), Math.cos(plan.optimumHeading), 0));
      const up = norm(cross(forward, right));
      return { center, heading: plan.optimumHeading, elevation: plan.optimumElevation, forward, up, right };
    }
    if (!state.revealed) {
      const forward = v3(Math.cos(state.carGuessHeading), Math.sin(state.carGuessHeading), 0);
      const right = v3(-Math.sin(state.carGuessHeading), Math.cos(state.carGuessHeading), 0);
      return { center: plan.start, heading: state.carGuessHeading, elevation: 0, forward, up: v3(0,0,1), right };
    }
    const t = state.playing ? state.playhead : state.playhead;
    const center = carPositionAt(plan, state.carGuessHeading, state.carGuessElevation, state.carGuessSpeed, t, state.carLaunchDelay);
    const forward = norm(v3(Math.cos(state.carGuessHeading) * Math.cos(state.carGuessElevation), Math.sin(state.carGuessHeading) * Math.cos(state.carGuessElevation), Math.sin(state.carGuessElevation)));
    const right = norm(v3(-Math.sin(state.carGuessHeading), Math.cos(state.carGuessHeading), 0));
    const up = norm(cross(forward, right));
    return { center, heading: state.carGuessHeading, elevation: state.carGuessElevation, forward, up, right };
  }

  function computeCameraBasis() {
    if (state.viewMode === 'car' && state.shot) {
      const follow = followedCarState();
      const localForward = norm(follow.forward || v3(Math.cos(follow.heading), Math.sin(follow.heading), 0));
      const localUp = norm(follow.up || v3(0, 0, 1));
      const localRight = norm(follow.right || cross(localForward, localUp));
      let mount;
      let target;
      if (state.drive.active && state.drive.cameraMode === 'ball') {
        const ball = state.drive.ball?.p || state.shot.initial.p;
        const worldUp = v3(0, 0, 1);
        const carAnchor = add(follow.center, v3(0, 0, 52));
        const toBall = sub(ball, carAnchor);
        const verticalBall = dot(toBall, worldUp);
        let horizontalBall = sub(toBall, mul(worldUp, verticalBall));
        if (len(horizontalBall) < 12) {
          horizontalBall = sub(localForward, mul(worldUp, dot(localForward, worldUp)));
          if (len(horizontalBall) < 12) horizontalBall = v3(1, 0, 0);
        }
        const ballBearing = norm(horizontalBall);
        const horizontalDistance = len(horizontalBall);

        // Close-range Ball Cam needs to stay visually anchored to the car. When the
        // ball passes beside the nose, its bearing can rotate extremely quickly;
        // following that bearing 1:1 makes the camera whip around the car and
        // changes the apparent driving line. Blend toward the car's forward axis
        // at close range, then smoothly return to full ball tracking farther away.
        let flatCarForward = sub(localForward, mul(worldUp, dot(localForward, worldUp)));
        if (len(flatCarForward) < 0.01) flatCarForward = ballBearing;
        flatCarForward = norm(flatCarForward);
        const closeBlend = 1 - clamp((horizontalDistance - 320) / 900, 0, 1);
        const desiredOrbit = norm(add(mul(ballBearing, 1 - closeBlend * 0.52), mul(flatCarForward, closeBlend * 0.52)));
        const now = performance.now();
        const dt = state.drive.ballCamLastUpdate ? clamp((now - state.drive.ballCamLastUpdate) / 1000, 0, 0.05) : 1 / 60;
        state.drive.ballCamLastUpdate = now;
        if (!state.drive.ballCamOrbit || len(state.drive.ballCamOrbit) < 0.1) state.drive.ballCamOrbit = desiredOrbit;
        const followRate = 1 - Math.exp(-(horizontalDistance < 700 ? 8.5 : 13.0) * dt);
        state.drive.ballCamOrbit = norm(add(mul(state.drive.ballCamOrbit, 1 - followRate), mul(desiredOrbit, followRate)));
        const orbitForward = state.drive.ballCamOrbit;

        // Track the ball vertically as well as horizontally. High bounces raise the
        // look target and pull the camera farther behind the car so the ball stays
        // visible without an abrupt straight-up snap. The smoothing values are
        // stored separately from the horizontal orbit to keep both movements calm.
        const elevationAngle = Math.atan2(verticalBall, Math.max(horizontalDistance, 180));
        const highBall = Math.max(0, verticalBall);
        const desiredTargetLift = clamp(verticalBall * 0.34, -28, 720);
        const desiredPullback = clamp(highBall * 0.11 + Math.max(0, elevationAngle) * 210, 0, 285);
        const desiredHeightLift = clamp(verticalBall * 0.055 + Math.max(0, elevationAngle) * 110, -26, 150);
        const verticalRate = 1 - Math.exp(-6.8 * dt);
        state.drive.ballCamTargetLift += (desiredTargetLift - state.drive.ballCamTargetLift) * verticalRate;
        state.drive.ballCamPullback += (desiredPullback - state.drive.ballCamPullback) * verticalRate;
        state.drive.ballCamHeightLift += (desiredHeightLift - state.drive.ballCamHeightLift) * verticalRate;

        const distance = PRO_CAMERA.distance + clamp(horizontalDistance * 0.010, 0, 46) + state.drive.ballCamPullback;
        const heightLift = PRO_CAMERA.height + 20 + state.drive.ballCamHeightLift;
        mount = add(add(carAnchor, mul(orbitForward, -distance)), mul(worldUp, heightLift));
        target = add(carAnchor, v3(0, 0, state.drive.ballCamTargetLift));
      } else {
        mount = add(add(follow.center, mul(localForward, -PRO_CAMERA.distance)), mul(localUp, PRO_CAMERA.height + 22));
        target = add(add(follow.center, mul(localForward, 165)), mul(localUp, 58));
      }
      const forward = norm(sub(target, mount));
      const cameraUpReference = state.drive.active && state.drive.cameraMode === 'ball' ? v3(0, 0, 1) : localUp;
      let right = norm(cross(forward, cameraUpReference));
      if (len(right) < 0.1) right = localRight;
      let up = norm(cross(right, forward));
      if (dot(up, cameraUpReference) < 0) { right = mul(right, -1); up = mul(up, -1); }
      const scaleBase = scene.width / (2 * Math.tan((PRO_CAMERA.fov * Math.PI / 180) / 2));
      return { pos: mount, forward, right, up, scaleBase, target };
    }
    const camera = state.camera;
    const cp = Math.cos(camera.pitch);
    const offset = v3(Math.cos(camera.yaw) * cp * camera.distance, Math.sin(camera.yaw) * cp * camera.distance, Math.sin(camera.pitch) * camera.distance);
    const pos = add(camera.target, offset);
    const forward = norm(sub(camera.target, pos));
    let right = norm(cross(forward, v3(0, 0, 1)));
    if (len(right) < 0.1) right = v3(1, 0, 0);
    const up = norm(cross(right, forward));
    return { pos, forward, right, up, scaleBase: scene.width / 2.2, target: camera.target };
  }

  function cameraBasis() {
    return state.renderBasis || computeCameraBasis();
  }

  function projectWithBasis(p, basis) {
    const rel = sub(p, basis.pos);
    const depth = dot(rel, basis.forward);
    if (depth < 42) return null;
    const aspectScale = basis.scaleBase || (scene.width / 2.2);
    return {
      x: scene.width * 0.5 + dot(rel, basis.right) * aspectScale / depth,
      y: scene.height * 0.53 - dot(rel, basis.up) * aspectScale / depth,
      depth,
      scale: aspectScale / depth,
    };
  }

  function project(p) {
    return projectWithBasis(p, cameraBasis());
  }

  function clipSegmentToNear(a, b, basis, near = 42) {
    const relA = sub(a, basis.pos);
    const relB = sub(b, basis.pos);
    const da = dot(relA, basis.forward);
    const db = dot(relB, basis.forward);
    if (da < near && db < near) return null;
    let p0 = a;
    let p1 = b;
    if (da < near || db < near) {
      const t = (near - da) / (db - da || 1e-6);
      const clipped = add(a, mul(sub(b, a), clamp(t, 0, 1)));
      if (da < near) p0 = clipped;
      else p1 = clipped;
    }
    return [projectWithBasis(p0, basis), projectWithBasis(p1, basis)];
  }

  function sampleRoundedLoop(z, inset = 0, samples = 128) {
    const safeInset = clamp(inset, 0, C.CORNER_R - 140);
    const w = C.SIDE_X - safeInset;
    const l = C.BACK_Y - safeInset;
    const r = Math.max(140, C.CORNER_R - safeInset);
    const cx = w - r;
    const cy = l - r;
    const straightX = Math.max(0, cx * 2);
    const straightY = Math.max(0, cy * 2);
    const arcLength = Math.PI * 0.5 * r;
    const pieces = [straightX, arcLength, straightY, arcLength, straightX, arcLength, straightY, arcLength];
    const perimeter = pieces.reduce((sum, value) => sum + value, 0);
    const count = Math.max(32, Math.round(samples));
    const points = [];

    function pointAtDistance(distance) {
      let d = ((distance % perimeter) + perimeter) % perimeter;
      const pieceIndex = pieces.findIndex((pieceLength) => {
        if (d <= pieceLength) return true;
        d -= pieceLength;
        return false;
      });
      const index = pieceIndex < 0 ? pieces.length - 1 : pieceIndex;
      const pieceLength = Math.max(0.0001, pieces[index]);
      const t = clamp(d / pieceLength, 0, 1);

      switch (index) {
        case 0: return v3(cx - straightX * t, l, z);
        case 1: {
          const a = Math.PI / 2 + Math.PI / 2 * t;
          return v3(-cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
        }
        case 2: return v3(-w, cy - straightY * t, z);
        case 3: {
          const a = Math.PI + Math.PI / 2 * t;
          return v3(-cx + Math.cos(a) * r, -cy + Math.sin(a) * r, z);
        }
        case 4: return v3(-cx + straightX * t, -l, z);
        case 5: {
          const a = Math.PI * 1.5 + Math.PI / 2 * t;
          return v3(cx + Math.cos(a) * r, -cy + Math.sin(a) * r, z);
        }
        case 6: return v3(w, -cy + straightY * t, z);
        default: {
          const a = Math.PI / 2 * t;
          return v3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
        }
      }
    }

    for (let i = 0; i < count; i += 1) points.push(pointAtDistance(perimeter * i / count));
    points.push(v3(points[0].x, points[0].y, z));
    return points;
  }

  function roundedBoundary(z, samples = 84) {
    return sampleRoundedLoop(z, 0, samples);
  }

  function roundedBoundaryInset(z, inset = 0, samples = 128) {
    return sampleRoundedLoop(z, inset, samples);
  }

  function cameraOutsideFieldDistance(pos) {
    const ax = Math.abs(pos.x);
    const ay = Math.abs(pos.y);
    const cx = C.SIDE_X - C.CORNER_R;
    const cy = C.BACK_Y - C.CORNER_R;
    if (ax <= cx) return Math.max(0, ay - C.BACK_Y);
    if (ay <= cy) return Math.max(0, ax - C.SIDE_X);
    return Math.max(0, Math.hypot(ax - cx, ay - cy) - C.CORNER_R);
  }

  function isGoalOpeningSegment(a, b) {
    const mid = mul(add(a, b), 0.5);
    const onBackWall = Math.abs(Math.abs(mid.y) - C.BACK_Y) < 38;
    return onBackWall && Math.abs(mid.x) < C.GOAL_HALF_W + 24 && mid.z < C.GOAL_H + 18;
  }

  function isGoalRampSegment(a, b) {
    const mid = mul(add(a, b), 0.5);
    return Math.abs(mid.y) > C.BACK_Y - C.RAMP_R - 36
      && Math.abs(mid.x) < C.GOAL_HALF_W + 36
      && mid.z < C.GOAL_H + 18;
  }

  function drawArenaRailSegments(points, stroke, width, basis, skipGoalOpening = false) {
    if (!points || points.length < 2) return;
    // Deliberately render every rail section as its own tiny goal-like segment.
    // A clipped/hidden section can no longer reset or cancel the rest of the ring.
    for (let i = 1; i < points.length; i += 1) {
      if (skipGoalOpening && isGoalOpeningSegment(points[i - 1], points[i])) continue;
      drawPolyline([points[i - 1], points[i]], stroke, width, [], basis);
    }
  }

  function drawPersistentArenaBoundary() {
    const basis = cameraBasis();
    // Goal-style rendering, but now with uniformly sampled geometry across the
    // entire perimeter — straight walls and curved corners alike.
    const lower = roundedBoundary(18, 420);
    const lowerInner = roundedBoundaryInset(18, 18, 420);
    const middle = roundedBoundary(205, 420);
    const upper = roundedBoundary(420, 420);

    drawArenaRailSegments(lower, 'rgba(105,226,255,.98)', 5.4, basis, true);
    drawArenaRailSegments(lowerInner, 'rgba(175,245,255,.34)', 1.7, basis, true);
    drawArenaRailSegments(middle, 'rgba(105,226,255,.48)', 2.25, basis, true);
    drawArenaRailSegments(upper, 'rgba(105,226,255,.64)', 3.05, basis, true);

    const supportSpacing = 240;
    const perimeterEstimate = lower.length - 1;
    const supportStep = Math.max(2, Math.round(perimeterEstimate / Math.max(32, Math.floor((2 * (C.SIDE_X + C.BACK_Y) + 2 * Math.PI * C.CORNER_R) / supportSpacing))));
    const supportCount = Math.max(0, Math.min(lower.length, middle.length, upper.length) - 1);
    for (let i = 0; i < supportCount; i += supportStep) {
      if (isGoalOpeningSegment(lower[i], upper[i])) continue;
      drawPolyline([lower[i], middle[i]], 'rgba(145,232,255,.18)', 1.25, [], basis);
      drawPolyline([middle[i], upper[i]], 'rgba(105,226,255,.30)', 1.6, [], basis);
    }
  }

  function transitionBoundary(z, samples = 84) {
    const zz = clamp(z, 0, C.RAMP_R);
    const radial = Math.sqrt(Math.max(0, C.RAMP_R * C.RAMP_R - (zz - C.RAMP_R) * (zz - C.RAMP_R)));
    const inset = C.RAMP_R - radial;
    return sampleRoundedLoop(zz, inset, samples);
  }

  function drawFloorTransition() {
    if (state.drive.active) {
      // Only draw the upper seam in Drive mode. Segment it and leave the goal
      // mouth open so the visual ramp agrees with the carved collision opening.
      const basis = cameraBasis();
      drawArenaRailSegments(transitionBoundary(C.RAMP_R, 240), 'rgba(130,211,241,.22)', 1.5, basis, true);
      return;
    }
    const basis = cameraBasis();
    const rings = [0, C.RAMP_R * 0.25, C.RAMP_R * 0.5, C.RAMP_R * 0.75, C.RAMP_R].map((z) => transitionBoundary(z, 240));
    ctx.save();
    for (let r = 0; r < rings.length - 1; r += 1) {
      const lower = rings[r];
      const upper = rings[r + 1];
      const segmentCount = Math.max(0, Math.min(lower.length, upper.length) - 1);
      for (let i = 0; i < segmentCount; i += 1) {
        if (isGoalRampSegment(lower[i], upper[i + 1])) continue;
        const a0 = projectWithBasis(lower[i], basis);
        const a1 = projectWithBasis(lower[i + 1], basis);
        const b1 = projectWithBasis(upper[i + 1], basis);
        const b0 = projectWithBasis(upper[i], basis);
        if (!a0 || !a1 || !b1 || !b0) continue;
        const alpha = 0.05 + r * 0.025;
        const grad = ctx.createLinearGradient(a0.x, a0.y, b0.x, b0.y);
        grad.addColorStop(0, `rgba(120, 222, 255, ${alpha})`);
        grad.addColorStop(1, `rgba(120, 222, 255, ${alpha + 0.03})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(a1.x, a1.y);
        ctx.lineTo(b1.x, b1.y);
        ctx.lineTo(b0.x, b0.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    drawArenaRailSegments(transitionBoundary(0, 240), 'rgba(130,211,241,.26)', 2, basis, true);
    drawArenaRailSegments(transitionBoundary(C.RAMP_R * 0.52, 240), 'rgba(130,211,241,.18)', 1.5, basis, true);
    drawArenaRailSegments(transitionBoundary(C.RAMP_R, 240), 'rgba(130,211,241,.22)', 2, basis, true);
    ctx.restore();
  }

  function drawWallFog() {
    if (state.drive.active) return;
    const basis = cameraBasis();
    const lower = roundedBoundary(0, 240);
    const upper = roundedBoundary(420, 240);
    ctx.save();
    for (let i = 0; i < lower.length - 1; i += 1) {
      const a0 = lower[i];
      const a1 = lower[i + 1];
      const b1 = upper[i + 1];
      const b0 = upper[i];
      if (isGoalOpeningSegment(a0, b1)) continue;
      const qa = projectWithBasis(a0, basis);
      const qb = projectWithBasis(a1, basis);
      const qc = projectWithBasis(b1, basis);
      const qd = projectWithBasis(b0, basis);
      if (!qa || !qb || !qc || !qd) continue;
      const mid = v3((a0.x + a1.x) * 0.5, (a0.y + a1.y) * 0.5, 210);
      const toCam = norm(sub(basis.pos, mid));
      const tangent = norm(sub(a1, a0));
      const normal = norm(cross(tangent, v3(0, 0, 1)));
      const facing = Math.abs(dot(normal, toCam));
      const alpha = clamp(0.04 + facing * 0.14, 0.05, 0.18);
      const grad = ctx.createLinearGradient(qa.x, qa.y, qd.x, qd.y);
      grad.addColorStop(0, `rgba(125,220,255,${alpha * 0.45})`);
      grad.addColorStop(1, `rgba(125,220,255,${alpha})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(qa.x, qa.y);
      ctx.lineTo(qb.x, qb.y);
      ctx.lineTo(qc.x, qc.y);
      ctx.lineTo(qd.x, qd.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPolyline(points, stroke, width = 2, dash = [], suppliedBasis = null) {
    if (!points || points.length < 2) return;
    const basis = suppliedBasis || cameraBasis();
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    let started = false;
    for (let i = 1; i < points.length; i += 1) {
      const clipped = clipSegmentToNear(points[i - 1], points[i], basis);
      if (!clipped || !clipped[0] || !clipped[1]) { started = false; continue; }
      const [a, b] = clipped;
      if (!started) { ctx.moveTo(a.x, a.y); started = true; }
      else ctx.lineTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    if (started) ctx.stroke();
    ctx.restore();
  }

  function fillWorldPolygon(points, fill, stroke = null, width = 1, suppliedBasis = null) {
    if (!points || points.length < 3) return;
    const basis = suppliedBasis || cameraBasis();
    const projected = points.map((point) => projectWithBasis(point, basis));
    if (projected.some((point) => !point)) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(projected[0].x, projected[0].y);
    for (let i = 1; i < projected.length; i += 1) ctx.lineTo(projected[i].x, projected[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSegmentedWorldLine(a, b, segmentLength, stroke, width = 2, dashEveryOther = false, suppliedBasis = null) {
    const distance = len(sub(b, a));
    const segments = Math.max(1, Math.ceil(distance / Math.max(20, segmentLength)));
    const basis = suppliedBasis || cameraBasis();
    for (let i = 0; i < segments; i += 1) {
      if (dashEveryOther && i % 2 === 1) continue;
      const t0 = i / segments;
      const t1 = (i + 1) / segments;
      drawPolyline([
        add(a, mul(sub(b, a), t0)),
        add(a, mul(sub(b, a), t1)),
      ], stroke, width, [], basis);
    }
  }

  function drawWorldCircle(center, radius, stroke, width = 2, segments = 64, suppliedBasis = null) {
    const basis = suppliedBasis || cameraBasis();
    for (let i = 0; i < segments; i += 1) {
      const a0 = Math.PI * 2 * i / segments;
      const a1 = Math.PI * 2 * (i + 1) / segments;
      drawPolyline([
        v3(center.x + Math.cos(a0) * radius, center.y + Math.sin(a0) * radius, center.z),
        v3(center.x + Math.cos(a1) * radius, center.y + Math.sin(a1) * radius, center.z),
      ], stroke, width, [], basis);
    }
  }

  function drawWorldBox(cx, cy, sx, sy, height, fill, stroke, suppliedBasis = null) {
    const basis = suppliedBasis || cameraBasis();
    const x0 = cx - sx * 0.5;
    const x1 = cx + sx * 0.5;
    const y0 = cy - sy * 0.5;
    const y1 = cy + sy * 0.5;
    const z0 = 0;
    const z1 = height;
    const faces = [
      [v3(x0,y0,z0),v3(x1,y0,z0),v3(x1,y0,z1),v3(x0,y0,z1)],
      [v3(x1,y0,z0),v3(x1,y1,z0),v3(x1,y1,z1),v3(x1,y0,z1)],
      [v3(x1,y1,z0),v3(x0,y1,z0),v3(x0,y1,z1),v3(x1,y1,z1)],
      [v3(x0,y1,z0),v3(x0,y0,z0),v3(x0,y0,z1),v3(x0,y1,z1)],
      [v3(x0,y0,z1),v3(x1,y0,z1),v3(x1,y1,z1),v3(x0,y1,z1)],
    ];
    const visible = [];
    for (const face of faces) {
      const projected = face.map((point) => projectWithBasis(point, basis));
      if (projected.some((point) => !point)) continue;
      const depth = projected.reduce((sum, point) => sum + point.depth, 0) / projected.length;
      visible.push({ face, depth });
    }
    visible.sort((a,b) => b.depth - a.depth);
    for (const item of visible) fillWorldPolygon(item.face, fill, stroke, 1, basis);
  }

  function drawWorldBackdrop() {
    const basis = cameraBasis();
    const landmarks = [
      [-5350,-4200,620,760,1250],[-5550,-1850,820,680,1760],[-5480,900,700,840,1420],[-5300,3600,760,700,1650],
      [5350,-3900,680,720,1580],[5520,-1100,760,820,1320],[5480,1700,700,700,1810],[5300,4200,850,690,1450],
      [-3000,-6420,760,620,1450],[0,-6600,980,760,1940],[3000,-6420,720,640,1550],
      [-3000,6420,720,620,1580],[0,6600,980,760,1880],[3000,6420,760,640,1480],
    ];
    for (let i = 0; i < landmarks.length; i += 1) {
      const [x,y,w,d,h] = landmarks[i];
      const alpha = 0.18 + (i % 3) * 0.035;
      drawWorldBox(x,y,w,d,h,`rgba(5,31,52,${alpha})`,'rgba(82,156,194,.12)',basis);
    }
    // Fixed light pylons and upper stadium rails provide strong parallax cues.
    const pylons = [[-4900,-5000],[-4900,0],[-4900,5000],[4900,-5000],[4900,0],[4900,5000],[-3600,-6100],[3600,-6100],[-3600,6100],[3600,6100]];
    for (const [x,y] of pylons) {
      drawSegmentedWorldLine(v3(x,y,0),v3(x,y,2050),260,'rgba(116,201,238,.18)',3,false,basis);
      drawPolyline([v3(x-150,y,1880),v3(x+150,y,1880)],'rgba(183,229,248,.23)',5,[],basis);
    }
  }

  function drawFieldMarkings() {
    const basis = cameraBasis();
    const z = 2.2;
    // Muted team-colored halves and alternating mowing strips.
    fillWorldPolygon([v3(-3800,-4720,z),v3(3800,-4720,z),v3(3800,0,z),v3(-3800,0,z)],'rgba(30,118,165,.075)',null,1,basis);
    fillWorldPolygon([v3(-3800,0,z),v3(3800,0,z),v3(3800,4720,z),v3(-3800,4720,z)],'rgba(202,111,37,.060)',null,1,basis);
    for (let y = -4608, stripe = 0; y < 4608; y += 512, stripe += 1) {
      if (stripe % 2 === 0) fillWorldPolygon([v3(-3700,y,z+.2),v3(3700,y,z+.2),v3(3700,Math.min(4608,y+512),z+.2),v3(-3700,Math.min(4608,y+512),z+.2)],'rgba(168,224,197,.018)',null,1,basis);
    }

    // Segment everything important so end-on camera angles cannot erase it.
    drawSegmentedWorldLine(v3(-4090,0,z+1),v3(4090,0,z+1),220,'rgba(236,249,255,.62)',3,false,basis);
    drawWorldCircle(v3(0,0,z+1),900,'rgba(236,249,255,.45)',2.5,72,basis);
    drawWorldCircle(v3(0,0,z+1),110,'rgba(236,249,255,.62)',2,28,basis);

    const boxHalfW = 1850;
    const boxDepth = 1120;
    for (const sign of [-1,1]) {
      const yGoal = sign * (C.BACK_Y - 90);
      const yFront = sign * (C.BACK_Y - boxDepth);
      drawSegmentedWorldLine(v3(-boxHalfW,yGoal,z+1),v3(-boxHalfW,yFront,z+1),180,'rgba(236,249,255,.30)',2,false,basis);
      drawSegmentedWorldLine(v3(boxHalfW,yGoal,z+1),v3(boxHalfW,yFront,z+1),180,'rgba(236,249,255,.30)',2,false,basis);
      drawSegmentedWorldLine(v3(-boxHalfW,yFront,z+1),v3(boxHalfW,yFront,z+1),180,'rgba(236,249,255,.30)',2,false,basis);
    }

    const pads = [
      [-3072,-4096], [0,-4240], [3072,-4096], [-3584,-1024], [3584,-1024], [-1792,-2048], [1792,-2048],
      [-3072,4096], [0,4240], [3072,4096], [-3584,1024], [3584,1024], [-1792,2048], [1792,2048],
    ];
    for (const [x,y] of pads) {
      drawWorldCircle(v3(x,y,z+1),105,'rgba(255,220,101,.30)',2,24,basis);
      drawWorldCircle(v3(x,y,z+1),45,'rgba(255,220,101,.18)',1.2,18,basis);
    }
  }

  function drawColoredRampBase() {
    const basis = cameraBasis();
    const rings = [0, C.RAMP_R * 0.34, C.RAMP_R * 0.68, C.RAMP_R].map((height) => transitionBoundary(height, 300));
    for (let r = 0; r < rings.length - 1; r += 1) {
      const lower = rings[r];
      const upper = rings[r + 1];
      const count = Math.min(lower.length, upper.length) - 1;
      for (let i = 0; i < count; i += 1) {
        const quad = [lower[i],lower[i+1],upper[i+1],upper[i]];
        const mid = mul(add(lower[i],lower[i+1]),0.5);
        if (isGoalRampSegment(lower[i], upper[i+1])) continue;
        const orange = mid.y >= 0;
        const alpha = 0.23 + r * 0.055;
        const fill = orange ? `rgba(232,119,43,${alpha})` : `rgba(34,139,205,${alpha})`;
        const edge = orange ? 'rgba(255,174,93,.24)' : 'rgba(99,205,255,.24)';
        fillWorldPolygon(quad,fill,edge,0.8,basis);
      }
    }
  }

  function drawGoal(sign, color, highlighted) {
    const frontY = sign * C.BACK_Y;
    const backY = sign * (C.BACK_Y + C.GOAL_DEPTH);
    const stroke = highlighted ? color : color.replace('1)', '.76)');
    const rearStroke = color.replace('1)', '.40)');
    const frontLeftBottom = v3(-C.GOAL_HALF_W, frontY, 0);
    const frontLeftTop = v3(-C.GOAL_HALF_W, frontY, C.GOAL_H);
    const frontRightTop = v3(C.GOAL_HALF_W, frontY, C.GOAL_H);
    const frontRightBottom = v3(C.GOAL_HALF_W, frontY, 0);
    const backLeftBottom = v3(-C.GOAL_HALF_W, backY, 0);
    const backLeftTop = v3(-C.GOAL_HALF_W, backY, C.GOAL_H);
    const backRightTop = v3(C.GOAL_HALF_W, backY, C.GOAL_H);
    const backRightBottom = v3(C.GOAL_HALF_W, backY, 0);

    const tunnelFill = sign > 0 ? 'rgba(224,105,35,.095)' : 'rgba(35,137,211,.105)';
    fillWorldPolygon([frontLeftBottom,frontRightBottom,backRightBottom,backLeftBottom],tunnelFill,null);
    fillWorldPolygon([frontLeftBottom,backLeftBottom,backLeftTop,frontLeftTop],tunnelFill,null);
    fillWorldPolygon([frontRightBottom,frontRightTop,backRightTop,backRightBottom],tunnelFill,null);
    fillWorldPolygon([frontLeftTop,backLeftTop,backRightTop,frontRightTop],tunnelFill,null);

    drawPolyline([frontLeftBottom,frontLeftTop,frontRightTop,frontRightBottom],stroke,highlighted ? 13 : 8);
    drawPolyline([backLeftBottom,backLeftTop,backRightTop,backRightBottom],rearStroke,highlighted ? 7 : 5);
    for (const pair of [[frontLeftBottom,backLeftBottom],[frontRightBottom,backRightBottom],[frontLeftTop,backLeftTop],[frontRightTop,backRightTop]]) {
      drawSegmentedWorldLine(pair[0],pair[1],150,rearStroke,highlighted ? 5 : 3);
    }
    // Sparse net ribs make the opening/depth readable without becoming visual noise.
    for (let i = 1; i < 5; i += 1) {
      const x = -C.GOAL_HALF_W + i * (C.GOAL_HALF_W * 2 / 5);
      drawSegmentedWorldLine(v3(x,frontY,C.GOAL_H),v3(x,backY,C.GOAL_H),150,'rgba(225,242,250,.16)',1.5);
    }
    if (highlighted) {
      drawSegmentedWorldLine(v3(-C.GOAL_HALF_W, frontY - sign * 30, 15),v3(C.GOAL_HALF_W, frontY - sign * 30, 15),140,'rgba(255,255,255,.85)',4,true);
    }
  }

  function ballPositionForPlayback(t) {
    const shot = state.shot;
    if (!shot) return v3();
    if (state.optimumMode) {
      const plan = shot.carPlan;
      if (t >= plan.interceptTime) {
        const goalT = clamp(t - plan.interceptTime, 0, plan.goalShot.duration);
        return sampleTimedPath(plan.goalShot.points, goalT).p;
      }
      return sampleTimedPath(shot.path, t).p;
    }
    if (
      state.revealed
      && state.playMode === 'compare'
      && state.carResult?.hit
      && state.carResult.postHitPath
      && t >= state.carResult.hitTime
    ) {
      return sampleTimedPath(state.carResult.postHitPath, t).p;
    }
    return sampleTimedPath(shot.path, t).p;
  }

  function drawScene(time = performance.now()) {
    // Ball Cam smoothing is stateful. Compute it once per rendered frame, then
    // freeze that exact basis for every world-space layer. Recomputing it for
    // walls, floor, car, and ball separately allowed the moving ball to shift
    // the camera during one frame and push entire rails behind the near plane.
    state.renderBasis = null;
    state.renderBasis = computeCameraBasis();
    const w = scene.width;
    const h = scene.height;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2c83bd');
    sky.addColorStop(0.43, '#0d4d78');
    sky.addColorStop(0.44, '#183f3b');
    sky.addColorStop(1, '#071b1d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Background landmarks are placed in world space so turning the camera
    // produces real parallax instead of rotating a flat skyline with the player.
    drawWorldBackdrop();
    drawFieldMarkings();
    drawColoredRampBase();
    drawFloorTransition();
    drawWallFog();
    // A tiny vertical separation prevents coplanar floor/grid/boundary strokes from
    // fighting as the camera pans. The grid is also kept inside the drivable floor.
    for (let x = -3840; x <= 3840; x += 512) drawPolyline([v3(x, -4800, 1.5), v3(x, 4800, 1.5)], 'rgba(130,211,241,.12)', 1);
    for (let y = -4608; y <= 4608; y += 512) drawPolyline([v3(-3800, y, 1.5), v3(3800, y, 1.5)], 'rgba(130,211,241,.12)', 1);
    // The center line is already rendered as short independent segments in
    // drawFieldMarkings(), matching the reliable wall-border draw strategy.
    const targetSign = state.shot?.carPlan?.attackSign || 1;
    drawGoal(1, 'rgba(255,156,67,1)', targetSign === 1);
    drawGoal(-1, 'rgba(61,184,255,1)', targetSign === -1);

    if (!state.shot) return;
    const shot = state.shot;
    const driveActive = state.drive.active;
    const plan = shot.carPlan;
    const bounceIndex = shot.bounce?.index || Math.floor(shot.path.length * 0.2);
    const incomingPoints = shot.path.slice(0, Math.min(shot.path.length, bounceIndex + 1)).map((point) => point.p);
    if (!driveActive) drawDottedPath(incomingPoints, 'rgba(255,255,255,.92)', 8);

    const bounceP = shot.bounce?.p || incomingPoints[incomingPoints.length - 1];
    const guess = guessDir();
    const guessPoints = ballisticPath(bounceP, mul(guess, len(shot.postState?.v || shot.initial.v)), 1.45);
    if (!driveActive && !state.optimumMode) drawPolyline(guessPoints, state.revealed ? 'rgba(92,226,255,.95)' : 'rgba(255,255,255,.78)', 5, [18, 10]);

    const userPathDuration = state.revealed
      ? Math.min(currentAnimationDuration(), Math.max(plan.interceptTime + 1.2, state.carLaunchDelay + 3.2))
      : plan.interceptTime;
    const guessedCarPath = makeCarPath(
      plan,
      state.carGuessHeading,
      state.carGuessElevation,
      state.carGuessSpeed,
      userPathDuration,
      state.carLaunchDelay,
    );
    const guessLineColor = state.pathHint?.level === 'green' ? 'rgba(100,240,170,.95)' : state.pathHint?.level === 'yellow' ? 'rgba(255,214,88,.92)' : (state.revealed ? 'rgba(92,226,255,.92)' : 'rgba(255,255,255,.75)');
    if (!driveActive && !state.optimumMode) drawPolyline(guessedCarPath, guessLineColor, 5, [16, 10]);


    if (!driveActive && !state.optimumMode && !state.revealed && state.pathHint?.ballP && state.pathHint?.carP && state.pathHint.level !== 'red') {
      drawPolyline([state.pathHint.carP, state.pathHint.ballP], state.pathHint.level === 'green' ? 'rgba(100,240,170,.92)' : 'rgba(255,214,88,.92)', 4, [8, 6]);
      drawContactMarker(state.pathHint.ballP, state.pathHint.level === 'green' ? 'rgba(100,240,170,.98)' : 'rgba(255,214,88,.98)', state.pathHint.level === 'green' ? 'CROSS' : 'CLOSE');
    }

    if (!driveActive && state.revealed) {
      const shownBallEnd = state.carResult?.hitTime ?? Math.min(
        shot.path[shot.path.length - 1]?.t || 5.2,
        Math.max(plan.interceptTime + 1.4, state.carLaunchDelay + 2.4),
      );
      const actualBeforeContact = shot.path
        .filter((point) => point.t >= (shot.bounce?.t || 0) && point.t <= shownBallEnd)
        .map((point) => point.p);
      drawDottedPath(actualBeforeContact, 'rgba(255,171,69,.96)', 8);
      const goalColor = plan.attackSign > 0 ? 'rgba(255,156,67,.98)' : 'rgba(61,184,255,.98)';
      drawPolyline(plan.goalShot.points.map((point) => point.p), goalColor, 7, [15, 8]);
      drawPolyline(
        makeCarPath(plan, plan.optimumHeading, plan.optimumElevation, plan.optimumSpeed, plan.interceptTime),
        'rgba(67,230,165,.95)',
        7,
      );
      drawContactMarker(plan.contactBall, goalColor, 'BEST');

      if (state.carResult?.hit && state.carResult.postHitPath) {
        drawPolyline(state.carResult.postHitPath.map((point) => point.p), 'rgba(92,226,255,.98)', 7, [12, 6]);
        drawContactMarker(state.carResult.hitSample.ball.p, 'rgba(92,226,255,.98)', 'HIT');
      } else if (state.carResult?.closest) {
        drawPolyline(
          [state.carResult.closest.carP, state.carResult.closest.ball.p],
          'rgba(255,91,104,.95)',
          5,
          [8, 6],
        );
        drawContactMarker(state.carResult.closest.ball.p, 'rgba(255,91,104,.95)', 'MISS');
      }
    }

    const playbackT = animationTime(time);
    let ballP = shot.initial.p;
    if (driveActive && state.drive.ball) ballP = state.drive.ball.p;
    else if (state.playing || state.playhead > 0) ballP = ballPositionForPlayback(playbackT);

    // Render the persistent boundary before foreground objects. The border stays
    // visible from every angle, but can no longer paint over the ball or car.
    drawPersistentArenaBoundary();

    // Ground-space cues belong behind both moving objects.
    drawBallGroundIndicator(ballP);
    if (!driveActive) drawImpactMarker(bounceP, shot.bounce?.n || v3(0, 0, 1));

    // Draw the ball before the cars. The player's car is intentionally the final
    // world-space layer so its full silhouette and angle controls remain readable
    // during close contact instead of looking transparent through the ball.
    drawBall(ballP);
    if (driveActive && state.goalCelebration.active) {
      try {
        drawGoalExplosionWorld(time);
      } catch (error) {
        console.error('Goal explosion draw failed; disabling visual effect only.', error);
        state.goalCelebration.particles = [];
        state.goalCelebration.shockwave = 0;
      }
    }

    if (driveActive && state.drive.car) {
      drawBoostTrail();
      const localOrange = state.pvp.active && state.pvp.team === 'orange';
      const teamColor = localOrange ? 'rgba(255,145,54,.98)' : 'rgba(45,145,255,.98)';
      drawCar(state.drive.car.p, state.drive.car.heading, state.drive.car.pitch || 0, teamColor, 'YOU', driveCarFrame(state.drive.car));
      if (state.bot.car) {
        const remoteColor = localOrange ? 'rgba(45,145,255,.98)' : 'rgba(255,145,54,.98)';
        const remoteLabel = state.pvp.active ? 'RIVAL' : currentBotLevel().name;
        drawCar(state.bot.car.p, state.bot.car.heading, state.bot.car.pitch || 0, remoteColor, remoteLabel, driveCarFrame(state.bot.car));
      }
    } else if (state.optimumMode) {
      const optimalP = optimalCarPositionAt(plan, Math.min(playbackT, plan.interceptTime));
      drawCar(optimalP, plan.optimumHeading, plan.optimumElevation, 'rgba(67,230,165,.98)', 'OPT');
    } else if (state.revealed) {
      const optimalP = optimalCarPositionAt(plan, Math.min(playbackT, plan.interceptTime));
      const guessedP = carPositionAt(
        plan,
        state.carGuessHeading,
        state.carGuessElevation,
        state.carGuessSpeed,
        playbackT,
        state.carLaunchDelay,
      );
      drawCar(optimalP, plan.optimumHeading, plan.optimumElevation, 'rgba(67,230,165,.95)', 'OPT');
      drawCar(guessedP, state.carGuessHeading, state.carGuessElevation, 'rgba(92,226,255,.9)', 'YOU');
    } else {
      const teamColor = 'rgba(45,145,255,.96)';
      drawCar(plan.start, state.carGuessHeading, 0, teamColor, 'YOU');
    }
    if (driveActive) drawVelocityStreaks(time);
  }


  function drawGoalExplosionWorld(time) {
    const celebration = state.goalCelebration;
    if (!celebration.active) return;

    const elapsed = Math.max(0, (time - celebration.startedAt) / 1000);
    const duration = Math.max(0.001, (celebration.endsAt - celebration.startedAt) / 1000);
    const progress = clamp(elapsed / duration, 0, 1);
    const fade = Math.pow(Math.max(0, 1 - progress), 0.65);
    const ignition = clamp(elapsed / 0.12, 0, 1);
    const projected = project(celebration.origin);
    const anchorX = projected?.x ?? scene.width * 0.5;
    const anchorY = projected?.y ?? scene.height * 0.43;
    const maxDim = Math.max(scene.width, scene.height);
    const teamRgb = celebration.scoredBy === 'blue' ? '54,185,255' : '255,128,31';

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // Instant white ignition flash.
    if (elapsed < 0.24) {
      const a = (1 - elapsed / 0.24) * 0.72;
      ctx.fillStyle = `rgba(255,245,220,${a})`;
      ctx.fillRect(0, 0, scene.width, scene.height);
    }

    // Stadium light wash that lingers after the initial flash.
    const wash = Math.max(0, 1 - elapsed / 1.45) * 0.22;
    if (wash > 0) {
      const g = ctx.createRadialGradient(anchorX, anchorY, 0, anchorX, anchorY, maxDim * 0.9);
      g.addColorStop(0, `rgba(${teamRgb},${wash * 1.8})`);
      g.addColorStop(0.42, `rgba(${teamRgb},${wash * 0.55})`);
      g.addColorStop(1, `rgba(${teamRgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, scene.width, scene.height);
    }

    // Dense volumetric fireball made from overlapping plasma lobes.
    const fireExpand = 1 - Math.exp(-elapsed * 5.2);
    const fireFade = Math.max(0, 1 - elapsed / 1.55);
    for (let i = 0; i < 23; i += 1) {
      const seed = Math.sin((i + 3) * 78.233) * 43758.5453;
      const seed2 = Math.sin((i + 11) * 31.719) * 24634.6345;
      const a = (seed - Math.floor(seed)) * Math.PI * 2;
      const radial = (seed2 - Math.floor(seed2));
      const orbit = maxDim * fireExpand * (0.015 + radial * 0.13);
      const cx = anchorX + Math.cos(a) * orbit;
      const cy = anchorY + Math.sin(a) * orbit * 0.72;
      const radius = maxDim * fireExpand * (0.07 + (i % 7) * 0.009);
      const plasma = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      plasma.addColorStop(0, `rgba(255,255,235,${0.98 * fireFade})`);
      plasma.addColorStop(0.18, `rgba(255,225,120,${0.94 * fireFade})`);
      plasma.addColorStop(0.48, `rgba(255,112,24,${0.78 * fireFade})`);
      plasma.addColorStop(0.78, `rgba(${teamRgb},${0.34 * fireFade})`);
      plasma.addColorStop(1, `rgba(${teamRgb},0)`);
      ctx.fillStyle = plasma;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    }

    // White-hot central core.
    const coreRadius = maxDim * (0.025 + fireExpand * 0.105);
    const core = ctx.createRadialGradient(anchorX, anchorY, 0, anchorX, anchorY, coreRadius);
    core.addColorStop(0, `rgba(255,255,255,${fade})`);
    core.addColorStop(0.22, `rgba(255,249,196,${0.96 * fade})`);
    core.addColorStop(0.55, `rgba(255,148,34,${0.72 * fade})`);
    core.addColorStop(1, 'rgba(255,80,12,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(anchorX, anchorY, coreRadius, 0, Math.PI * 2); ctx.fill();

    // Long high-speed streaks with bright heads and fading tails.
    const streakCount = 150;
    for (let i = 0; i < streakCount; i += 1) {
      const seed = Math.sin((i + 1) * 91.733) * 43758.5453;
      const seed2 = Math.sin((i + 1) * 47.119) * 24634.6345;
      const a = (seed - Math.floor(seed)) * Math.PI * 2;
      const speedClass = 0.55 + (seed2 - Math.floor(seed2)) * 0.9;
      const local = clamp(elapsed * speedClass * 1.3 - (i % 13) * 0.008, 0, 1);
      if (local <= 0) continue;
      const headDist = maxDim * (0.04 + local * (0.32 + speedClass * 0.32));
      const tailLen = maxDim * (0.035 + speedClass * 0.085) * Math.max(0.2, 1 - local * 0.35);
      const ux = Math.cos(a), uy = Math.sin(a) * 0.72;
      const x2 = anchorX + ux * headDist;
      const y2 = anchorY + uy * headDist;
      const x1 = x2 - ux * tailLen;
      const y1 = y2 - uy * tailLen;
      const alpha = Math.sin(Math.PI * Math.min(1, local)) * fade * (0.36 + speedClass * 0.38);
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, 'rgba(255,70,0,0)');
      grad.addColorStop(0.55, `rgba(255,108,18,${alpha * 0.65})`);
      grad.addColorStop(0.88, `rgba(255,220,120,${alpha})`);
      grad.addColorStop(1, `rgba(255,255,255,${alpha})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = i % 9 === 0 ? 5.5 : (i % 3 === 0 ? 3.2 : 1.8);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      if (i % 4 === 0) {
        ctx.fillStyle = `rgba(255,248,210,${alpha})`;
        ctx.beginPath(); ctx.arc(x2, y2, ctx.lineWidth * 1.25, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Multiple expanding shockwaves, including one distorted horizontal ring.
    for (let i = 0; i < 4; i += 1) {
      const local = clamp(elapsed * 1.7 - i * 0.14, 0, 1);
      if (local <= 0 || local >= 1) continue;
      const radius = maxDim * (0.055 + local * (0.50 + i * 0.035));
      ctx.strokeStyle = i === 0
        ? `rgba(255,245,190,${(1-local) * 0.92})`
        : `rgba(${teamRgb},${(1-local) * 0.72})`;
      ctx.lineWidth = Math.max(2, (16 - i * 2) * (1 - local));
      ctx.beginPath();
      ctx.ellipse(anchorX, anchorY, radius, radius * (i === 3 ? 0.58 : 0.83), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // World-space embers and debris continue after the main fireball disappears.
    for (let i = 0; i < celebration.particles.length; i += 1) {
      const particle = celebration.particles[i];
      if (particle.age >= particle.life) continue;
      const alpha = Math.pow(Math.max(0, 1 - particle.age / particle.life), 0.72);
      const q = project(particle.p);
      if (!q) continue;
      const r = clamp(particle.size * q.scale * 5.8, 1.2, 17);
      const ember = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      ember.addColorStop(0, `rgba(255,255,225,${alpha})`);
      ember.addColorStop(0.35, `rgba(255,175,48,${alpha * 0.95})`);
      ember.addColorStop(1, 'rgba(255,45,0,0)');
      ctx.fillStyle = ember;
      ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

  function drawDottedPath(points, color, size) {
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 0; i < points.length; i += 3) {
      const q = project(points[i]);
      if (!q) continue;
      const radius = clamp(size * q.scale * 5.5, 2.2, size);
      ctx.beginPath();
      ctx.arc(q.x, q.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function rotateSpherePoint(point, yaw, pitch, roll) {
    let { x, y, z } = point;
    let c = Math.cos(yaw), s = Math.sin(yaw);
    [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(pitch); s = Math.sin(pitch);
    [y, z] = [y * c - z * s, y * s + z * c];
    c = Math.cos(roll); s = Math.sin(roll);
    [x, y] = [x * c - y * s, x * s + y * c];
    return { x, y, z };
  }

  function drawSphereCurve(points, q, radius, stroke, width) {
    let started = false;
    ctx.beginPath();
    for (const point of points) {
      if (point.z <= 0.015) { started = false; continue; }
      const x = q.x + point.x * radius;
      const y = q.y - point.y * radius;
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function drawBallGroundIndicator(p) {
    const points = [];
    const z = 6;
    const segments = 64;
    for (let i = 0; i <= segments; i += 1) {
      const a = i / segments * Math.PI * 2;
      points.push(v3(p.x + Math.cos(a) * C.BALL_R, p.y + Math.sin(a) * C.BALL_R, z));
    }
    drawPolyline(points, 'rgba(255,255,255,.94)', 3.2);
    const inner = [];
    for (let i = 0; i <= segments; i += 1) {
      const a = i / segments * Math.PI * 2;
      inner.push(v3(p.x + Math.cos(a) * (C.BALL_R - 5), p.y + Math.sin(a) * (C.BALL_R - 5), z + 1));
    }
    drawPolyline(inner, 'rgba(165,220,244,.34)', 1.3);
  }

  function drawBall(p) {
    const q = project(p);
    if (!q) return;
    // Keep the rendered silhouette aligned with the ball's fixed physics radius.
    // The old 104 px ceiling made the visual ball stop growing at close range,
    // even though its collision sphere kept the full 91.25 uu radius. Use the
    // exact perspective projection of a sphere instead of the small-angle
    // approximation, with only a canvas-sized safety ceiling for extreme cases.
    const centerDepth = Math.max(q.depth, C.BALL_R + 0.01);
    const tangentDepth = Math.sqrt(Math.max(1, centerDepth * centerDepth - C.BALL_R * C.BALL_R));
    const perspectiveRadius = (cameraBasis().scaleBase || (scene.width / 2.2)) * C.BALL_R / tangentDepth;
    const radius = clamp(perspectiveRadius, 1.5, Math.max(scene.width, scene.height) * 0.48);

    // Ground shadow and a faint height stem provide an immediate depth reference.
    const floorPoint = project(v3(p.x, p.y, 2));
    if (floorPoint && p.z > C.BALL_R + 4) {
      const heightRatio = clamp((p.z - C.BALL_R) / 1500, 0, 1);
      ctx.save();
      ctx.strokeStyle = `rgba(218,239,248,${0.18 * (1 - heightRatio * 0.55)})`;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5, 7]);
      ctx.beginPath(); ctx.moveTo(q.x, q.y + radius * 0.65); ctx.lineTo(floorPoint.x, floorPoint.y); ctx.stroke();
      ctx.setLineDash([]);
      const shadowW = clamp(radius * (1.15 - heightRatio * 0.42), 5, 62);
      const shadowH = shadowW * 0.28;
      const shadow = ctx.createRadialGradient(floorPoint.x, floorPoint.y, 1, floorPoint.x, floorPoint.y, shadowW);
      shadow.addColorStop(0, `rgba(0,0,0,${0.38 * (1 - heightRatio * 0.45)})`);
      shadow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shadow;
      ctx.beginPath(); ctx.ellipse(floorPoint.x, floorPoint.y, shadowW, shadowH, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    const lightX = q.x - radius * 0.34;
    const lightY = q.y - radius * 0.38;
    const gradient = ctx.createRadialGradient(lightX, lightY, radius * 0.03, q.x, q.y, radius * 1.02);
    gradient.addColorStop(0, '#fffde7');
    gradient.addColorStop(0.18, '#dedbc2');
    gradient.addColorStop(0.54, '#8d9184');
    gradient.addColorStop(0.82, '#424943');
    gradient.addColorStop(1, '#111718');
    ctx.save();
    ctx.beginPath(); ctx.arc(q.x, q.y, radius, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = gradient;
    ctx.fillRect(q.x - radius, q.y - radius, radius * 2, radius * 2);

    // Rotate a true sphere mesh. Curves disappear naturally on the rear hemisphere.
    const t = performance.now() * 0.001;
    const speedHint = state.drive.active && state.drive.ball ? len(state.drive.ball.v) : (state.shot?.speed || 1200);
    const spin = t * (0.65 + speedHint / 1150);
    const yaw = spin + p.x * 0.00035;
    const pitch = spin * 0.63 + p.y * 0.00028;
    const roll = -spin * 0.41;
    const meshStroke = radius > 24 ? 'rgba(22,29,29,.72)' : 'rgba(22,29,29,.62)';
    const meshWidth = Math.max(0.8, radius * 0.025);

    for (let lat = -60; lat <= 60; lat += 30) {
      const phi = lat * Math.PI / 180;
      const curve = [];
      for (let i = 0; i <= 72; i += 1) {
        const theta = i / 72 * Math.PI * 2;
        curve.push(rotateSpherePoint({ x: Math.cos(phi) * Math.cos(theta), y: Math.sin(phi), z: Math.cos(phi) * Math.sin(theta) }, yaw, pitch, roll));
      }
      drawSphereCurve(curve, q, radius, meshStroke, meshWidth);
    }
    for (let lon = 0; lon < 180; lon += 30) {
      const theta = lon * Math.PI / 180;
      const curve = [];
      for (let i = 0; i <= 72; i += 1) {
        const phi = -Math.PI / 2 + i / 72 * Math.PI;
        curve.push(rotateSpherePoint({ x: Math.cos(phi) * Math.cos(theta), y: Math.sin(phi), z: Math.cos(phi) * Math.sin(theta) }, yaw, pitch, roll));
      }
      drawSphereCurve(curve, q, radius, meshStroke, meshWidth);
    }

    // Raised panel hubs make the surface feel faceted instead of like a flat disc.
    const hubs = [
      {x:0,y:0,z:1}, {x:.76,y:.28,z:.58}, {x:-.7,y:.38,z:.6},
      {x:.2,y:-.78,z:.59}, {x:-.48,y:-.68,z:.55}
    ];
    for (const hub of hubs) {
      const h = rotateSpherePoint(hub, yaw, pitch, roll);
      if (h.z <= 0.05) continue;
      const hx = q.x + h.x * radius;
      const hy = q.y - h.y * radius;
      const rr = radius * (0.07 + 0.055 * h.z);
      ctx.fillStyle = `rgba(33,39,38,${0.46 + h.z * 0.25})`;
      ctx.beginPath(); ctx.arc(hx, hy, rr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(220,224,202,.44)'; ctx.lineWidth = Math.max(.7, radius * .012); ctx.stroke();
    }
    ctx.restore();

    // Rim and specular highlight reinforce the spherical silhouette at close range.
    ctx.save();
    ctx.strokeStyle = 'rgba(239,247,235,.82)';
    ctx.lineWidth = Math.max(1.3, radius * 0.032);
    ctx.beginPath(); ctx.arc(q.x, q.y, radius, 0, Math.PI * 2); ctx.stroke();
    const spec = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, radius * .45);
    spec.addColorStop(0, 'rgba(255,255,255,.56)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.beginPath(); ctx.arc(q.x, q.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function emitBoostTrail(car, dt) {
    if (!state.drive.boost || !car) return;
    const frame = driveCarFrame(car);
    const rearCenter = add(car.p, mul(frame.forward, -C.CAR_HALF_L * 1.02));
    state.drive.boostEmitCarry += dt * 58;
    while (state.drive.boostEmitCarry >= 1) {
      state.drive.boostEmitCarry -= 1;
      const side = Math.random() < 0.5 ? -1 : 1;
      const position = add(add(rearCenter, mul(frame.right, side * C.CAR_HALF_W * 0.48)), mul(frame.up, -C.CAR_HALF_H * 0.05));
      const backward = mul(frame.forward, -rand(360, 620));
      const spread = add(mul(frame.right, rand(-80, 80)), mul(frame.up, rand(-55, 55)));
      state.drive.boostTrail.push({ p: position, v: add(add(car.v, backward), spread), age: 0, life: rand(0.24, 0.48), size: rand(10, 18) });
    }
  }

  function stepBoostTrail(dt) {
    const particles = state.drive.boostTrail || [];
    for (const particle of particles) {
      particle.age += dt;
      particle.p = add(particle.p, mul(particle.v, dt));
      particle.v = mul(particle.v, Math.max(0, 1 - 4.2 * dt));
    }
    state.drive.boostTrail = particles.filter((particle) => particle.age < particle.life);
  }

  function drawBoostTrail() {
    const particles = state.drive.boostTrail || [];
    if (!particles.length) return;
    const basis = cameraBasis();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of particles) {
      const q = projectWithBasis(particle.p, basis);
      if (!q) continue;
      const t = clamp(particle.age / particle.life, 0, 1);
      const radius = clamp(particle.size * q.scale * (1 - t * 0.55), 1.5, 13);
      const gradient = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, radius);
      gradient.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - t)})`);
      gradient.addColorStop(0.28, `rgba(102,216,255,${0.82 * (1 - t)})`);
      gradient.addColorStop(0.72, `rgba(27,143,255,${0.46 * (1 - t)})`);
      gradient.addColorStop(1, 'rgba(27,143,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(q.x, q.y, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawVelocityStreaks(time = performance.now()) {
    const car = state.drive.active ? state.drive.car : null;
    if (!car) return;
    const speed = len(car.v || v3());
    const intensity = clamp((speed - 1500) / 650, 0, 1);
    if (intensity <= 0.001) return;
    const w = scene.width, h = scene.height;
    const cx = w * 0.5, cy = h * 0.49;
    const minDim = Math.min(w, h);
    const phase = (time * 0.00055 * (0.7 + intensity * 0.8)) % 1;
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const seedA = Math.sin((i + 1) * 91.733) * 43758.5453;
      const seedB = Math.sin((i + 1) * 47.119) * 24634.6345;
      const angle = (seedA - Math.floor(seedA)) * Math.PI * 2;
      const lane = seedB - Math.floor(seedB);
      const travel = (lane + phase + i / 22 * 0.37) % 1;
      const radius = minDim * (0.18 + travel * 0.56);
      const length = minDim * (0.015 + intensity * 0.055) * (0.55 + travel * 0.75);
      const ux = Math.cos(angle), uy = Math.sin(angle) * 0.72;
      const x2 = cx + ux * radius, y2 = cy + uy * radius;
      const x1 = x2 - ux * length, y1 = y2 - uy * length;
      const alpha = intensity * Math.sin(Math.PI * travel) * 0.20;
      if (alpha < 0.01) continue;
      const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, 'rgba(190,232,255,0)');
      gradient.addColorStop(0.58, `rgba(190,232,255,${alpha * 0.45})`);
      gradient.addColorStop(1, `rgba(244,252,255,${alpha})`);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = Math.max(1, minDim * 0.0018 * (0.7 + intensity));
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawCar(center, heading, elevation, color, label, orientation = null) {
    let axes;
    if (orientation?.forward && orientation?.up) {
      const forward = norm(orientation.forward);
      const up = norm(orientation.up);
      const right = norm(cross(forward, up));
      axes = { forward, right, up };
    } else {
      axes = carAxes(heading, clamp(elevation || 0, -0.5, 1.0));
    }
    const F = axes.forward, R = axes.right, U = axes.up;
    const L = C.CAR_HALF_L, W = C.CAR_HALF_W, H = C.CAR_HALF_H;
    const base = center.z <= C.CAR_Z + 0.5 ? C.CAR_Z : center.z;
    const c = v3(center.x, center.y, base + H * 0.12);
    const P = (f, r, u) => add(add(add(c, mul(F, f)), mul(R, r)), mul(U, u));
    const basis = cameraBasis();

    const bodyMain = color;
    const bodyBright = color;
    const dark = 'rgba(13,22,30,.98)';
    const glass = 'rgba(22,53,72,.96)';
    const trim = 'rgba(174,205,222,.88)';

    const poly = (points, fill, stroke='rgba(225,242,252,.48)', width=1.05) => {
      const pts = points.map(pt => projectWithBasis(pt, basis));
      if (pts.some(pt => !pt)) return null;
      return { pts, fill, stroke, width, depth: pts.reduce((n,p)=>n+p.depth,0)/pts.length };
    };

    // Wide, low sports-car shell with separate hood, shoulders, cabin and rear deck.
    const faces = [
      poly([P(L*1.04,W*.74,-H*.34), P(L*1.04,-W*.74,-H*.34), P(L*.78,-W*.98,-H*.18), P(L*.78,W*.98,-H*.18)], bodyMain),
      poly([P(L*.78,W*.98,-H*.18), P(L*.78,-W*.98,-H*.18), P(L*.28,-W*.94,H*.06), P(L*.28,W*.94,H*.06)], bodyBright),
      poly([P(L*.28,W*.94,H*.06), P(L*.28,-W*.94,H*.06), P(-L*.48,-W*.96,H*.02), P(-L*.48,W*.96,H*.02)], bodyMain),
      poly([P(-L*.48,W*.96,H*.02), P(-L*.48,-W*.96,H*.02), P(-L*1.02,-W*.82,-H*.20), P(-L*1.02,W*.82,-H*.20)], bodyMain),
      poly([P(L*.78,W*.98,-H*.18), P(L*.28,W*.94,H*.06), P(-L*.48,W*.96,H*.02), P(-L*1.02,W*.82,-H*.20), P(-L*.92,W*1.02,-H*.42), P(L*.82,W*1.02,-H*.42)], bodyMain),
      poly([P(L*.78,-W*.98,-H*.18), P(L*.28,-W*.94,H*.06), P(-L*.48,-W*.96,H*.02), P(-L*1.02,-W*.82,-H*.20), P(-L*.92,-W*1.02,-H*.42), P(L*.82,-W*1.02,-H*.42)], bodyMain),
      // Cabin and glass.
      poly([P(L*.22,W*.60,H*.10), P(L*.22,-W*.60,H*.10), P(-L*.10,-W*.56,H*.76), P(-L*.10,W*.56,H*.76)], glass, trim),
      poly([P(-L*.10,W*.56,H*.76), P(-L*.10,-W*.56,H*.76), P(-L*.50,-W*.63,H*.55), P(-L*.50,W*.63,H*.55)], glass, trim),
      poly([P(L*.22,W*.60,H*.10), P(-L*.10,W*.56,H*.76), P(-L*.50,W*.63,H*.55), P(-L*.58,W*.72,H*.08)], 'rgba(27,67,88,.96)', trim),
      poly([P(L*.22,-W*.60,H*.10), P(-L*.10,-W*.56,H*.76), P(-L*.50,-W*.63,H*.55), P(-L*.58,-W*.72,H*.08)], 'rgba(18,46,63,.96)', trim),
      poly([P(-L*.10,W*.56,H*.76), P(-L*.10,-W*.56,H*.76), P(-L*.50,-W*.63,H*.55), P(-L*.50,W*.63,H*.55)], 'rgba(35,70,89,.98)', trim),
      // Front splitter and rear diffuser.
      poly([P(L*1.07,W*.78,-H*.35),P(L*1.07,-W*.78,-H*.35),P(L*.91,-W*.94,-H*.48),P(L*.91,W*.94,-H*.48)], dark, trim),
      poly([P(-L*.93,W*.84,-H*.28),P(-L*.93,-W*.84,-H*.28),P(-L*1.06,-W*.68,-H*.48),P(-L*1.06,W*.68,-H*.48)], dark, trim),
      // Rear shoulders / haunches.
      poly([P(-L*.38,W*.92,H*.05),P(-L*.38,W*.64,H*.28),P(-L*.84,W*.66,H*.20),P(-L*.99,W*.82,-H*.16)], bodyBright),
      poly([P(-L*.38,-W*.92,H*.05),P(-L*.38,-W*.64,H*.28),P(-L*.84,-W*.66,H*.20),P(-L*.99,-W*.82,-H*.16)], bodyBright),
      // Spoiler blade and mounts.
      poly([P(-L*.73,W*.70,H*.62),P(-L*.73,-W*.70,H*.62),P(-L*.95,-W*.76,H*.62),P(-L*.95,W*.76,H*.62)], dark, trim),
      poly([P(-L*.79,W*.53,H*.18),P(-L*.79,W*.43,H*.18),P(-L*.84,W*.43,H*.62),P(-L*.84,W*.53,H*.62)], dark, trim),
      poly([P(-L*.79,-W*.53,H*.18),P(-L*.79,-W*.43,H*.18),P(-L*.84,-W*.43,H*.62),P(-L*.84,-W*.53,H*.62)], dark, trim),
    ].filter(Boolean);

    faces.sort((a,b)=>b.depth-a.depth);
    ctx.save();

    // Perspective-correct low-profile wheels. Each wheel is drawn in its real
    // forward/up plane instead of as a screen-facing circle, which keeps the
    // tires tucked into the fenders and prevents the old cartoon "roller" look.
    const wheelCenters = [
      P(L*.49,W*.94,-H*.34), P(L*.49,-W*.94,-H*.34),
      P(-L*.52,W*.94,-H*.34), P(-L*.52,-W*.94,-H*.34)
    ];
    const drawWheelDisc = (wc, radius, fill, stroke, width = 1) => {
      const pts = [];
      for (let k = 0; k < 20; k += 1) {
        const a = k * Math.PI * 2 / 20;
        const wp = add(wc, add(mul(F, Math.cos(a) * radius), mul(U, Math.sin(a) * radius)));
        const q = projectWithBasis(wp, basis);
        if (!q) return null;
        pts.push(q);
      }
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let k = 1; k < pts.length; k += 1) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
      return pts;
    };
    for (const wc of wheelCenters) {
      const center2 = projectWithBasis(wc, basis);
      if (!center2) continue;
      const tireRadius = H * .78;
      drawWheelDisc(wc, tireRadius, 'rgba(3,6,9,.99)', 'rgba(45,55,64,.96)', 1.2);
      drawWheelDisc(wc, tireRadius * .62, 'rgba(25,31,37,.99)', 'rgba(175,190,201,.95)', 1.15);
      drawWheelDisc(wc, tireRadius * .19, 'rgba(192,207,216,.98)', 'rgba(25,31,36,.98)', .8);

      // Five paired spokes, projected in the same wheel plane.
      ctx.strokeStyle = 'rgba(205,218,226,.92)';
      ctx.lineWidth = clamp(1.3 * center2.scale, .75, 1.7);
      for (let k = 0; k < 5; k += 1) {
        const a = k * Math.PI * 2 / 5;
        for (const offset of [-.09, .09]) {
          const ang = a + offset;
          const outer = add(wc, add(mul(F, Math.cos(ang) * tireRadius * .55), mul(U, Math.sin(ang) * tireRadius * .55)));
          const p2 = projectWithBasis(outer, basis);
          if (!p2) continue;
          ctx.beginPath(); ctx.moveTo(center2.x, center2.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        }
      }
    }

    for (const face of faces) {
      ctx.beginPath();ctx.moveTo(face.pts[0].x,face.pts[0].y);
      for(let i=1;i<face.pts.length;i++)ctx.lineTo(face.pts[i].x,face.pts[i].y);
      ctx.closePath();ctx.fillStyle=face.fill;ctx.fill();ctx.strokeStyle=face.stroke;ctx.lineWidth=face.width;ctx.stroke();
    }

    // Hood center crease and side character lines.
    const line=(a,b,stroke,width=1.5)=>{const p1=projectWithBasis(a,basis),p2=projectWithBasis(b,basis);if(!p1||!p2)return;ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();};
    line(P(L*.92,0,-H*.12),P(L*.24,0,H*.09),'rgba(255,255,255,.42)',1.2);
    line(P(L*.63,W*.93,-H*.06),P(-L*.64,W*.91,-H*.02),'rgba(255,255,255,.30)',1.1);
    line(P(L*.63,-W*.93,-H*.06),P(-L*.64,-W*.91,-H*.02),'rgba(255,255,255,.24)',1.1);

    // Rear lighting only: twin circular taillights and center brake strip.
    const lamp=(pt,r,inner,outer)=>{const q=projectWithBasis(pt,basis);if(!q)return;const rad=clamp(r*q.scale,2.2,9);const g=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,rad*2.2);g.addColorStop(0,inner);g.addColorStop(.35,outer);g.addColorStop(1,'rgba(0,0,0,0)');ctx.globalCompositeOperation='lighter';ctx.fillStyle=g;ctx.beginPath();ctx.arc(q.x,q.y,rad*2.2,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';ctx.fillStyle=inner;ctx.beginPath();ctx.arc(q.x,q.y,rad*.62,0,Math.PI*2);ctx.fill();};
    for(const side of [-1,1]){
      lamp(P(-L*1.015,side*W*.50,H*.03),10,'rgba(255,60,38,.98)','rgba(255,25,15,.76)');
      lamp(P(-L*1.018,side*W*.28,H*.03),8,'rgba(255,74,45,.98)','rgba(255,25,15,.68)');
    }
    line(P(-L*1.02,W*.15,H*.16),P(-L*1.02,-W*.15,H*.16),'rgba(255,72,44,.95)',2.1);

    // Exhaust tips and rear diffuser fins.
    for(const side of [-1,1]){
      const q=projectWithBasis(P(-L*1.055,side*W*.34,-H*.34),basis);if(q){ctx.fillStyle='rgba(5,8,10,.98)';ctx.beginPath();ctx.arc(q.x,q.y,clamp(5*q.scale,1.5,5),0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(190,204,214,.78)';ctx.lineWidth=1;ctx.stroke();}
    }

    const middle=projectWithBasis(P(0,0,H*.88),basis);
    if(middle){ctx.fillStyle='#fff';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText(label,middle.x,middle.y-5);}
    ctx.restore();
  }

  function drawImpactMarker(p, n) {
    const a = project(p);
    const b = project(add(p, mul(n, 230)));
    if (!a || !b) return;
    ctx.save();
    ctx.strokeStyle = state.revealed ? '#ffad4d' : '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawContactMarker(p, color, label = 'HIT') {
    const q = project(p);
    if (!q) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(q.x, q.y, 21, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(label, q.x, q.y - 27);
    ctx.restore();
  }

  function ballisticPath(start, velocity, seconds) {
    const s = { p: v3(start.x, start.y, start.z), v: v3(velocity.x, velocity.y, velocity.z) };
    const points = [];
    for (let i = 0; i < seconds / C.TICK; i += 1) {
      if (i % 4 === 0) points.push(v3(s.p.x, s.p.y, s.p.z));
      s.v.z -= C.GRAVITY * C.TICK;
      s.p = add(s.p, mul(s.v, C.TICK));
    }
    return points;
  }

  function drawPadBase(context, canvas) {
    const w = canvas.width;
    const h = canvas.height;
    context.clearRect(0, 0, w, h);
    const gradient = context.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#0c3854');
    gradient.addColorStop(1, '#06151f');
    context.fillStyle = gradient;
    context.fillRect(0, 0, w, h);
    context.strokeStyle = 'rgba(112,205,246,.22)';
    context.lineWidth = Math.max(1, Math.min(w, h) * 0.008);
    for (let i = 1; i < 6; i += 1) {
      context.beginPath();
      context.moveTo(i * w / 6, 0);
      context.lineTo(i * w / 6, h);
      context.stroke();
    }
    for (let i = 1; i < 4; i += 1) {
      context.beginPath();
      context.moveTo(0, i * h / 4);
      context.lineTo(w, i * h / 4);
      context.stroke();
    }
  }

  function drawTopPad() {
    drawPadBase(topCtx, topPad);
    const cx = topPad.width / 2;
    const cy = topPad.height / 2;
    const radius = Math.min(topPad.width, topPad.height) * 0.34;
    const incoming = state.shot?.incoming || v3(1, 0, 0);
    const incomingAngle = Math.atan2(incoming.y, incoming.x);
    drawPadArrow(topCtx, cx, cy, incomingAngle + Math.PI, radius * 0.78, 'rgba(255,255,255,.4)', radius * 0.045);
    drawPadArrow(topCtx, cx, cy, state.guessHeading, radius * 0.93, '#ffffff', radius * 0.065);
    if (state.revealed && state.shot) drawPadArrow(topCtx, cx, cy, state.shot.actualHeading, radius * 1.06, '#ffae4c', radius * 0.065);
    topCtx.fillStyle = '#fff';
    topCtx.beginPath();
    topCtx.arc(cx, cy, Math.max(6, radius * 0.09), 0, Math.PI * 2);
    topCtx.fill();
    topCtx.strokeStyle = 'rgba(255,255,255,.3)';
    topCtx.lineWidth = Math.max(1.5, radius * 0.018);
    topCtx.beginPath();
    topCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    topCtx.stroke();
  }

  function drawElevationPad(context, canvas, guessElevation, actualElevation, color) {
    drawPadBase(context, canvas);
    const cx = canvas.width * 0.22;
    const cy = canvas.height * 0.77;
    const length = Math.min(canvas.width * 0.68, canvas.height * 0.68);
    context.strokeStyle = 'rgba(255,255,255,.38)';
    context.lineWidth = Math.max(2, canvas.height * 0.018);
    context.beginPath();
    context.moveTo(canvas.width * 0.05, cy);
    context.lineTo(canvas.width * 0.95, cy);
    context.stroke();
    drawPadArrow(context, cx, cy, -guessElevation, length, '#ffffff', Math.max(4, canvas.height * 0.03), true);
    if (state.revealed && Number.isFinite(actualElevation)) {
      drawPadArrow(context, cx, cy, -actualElevation, length * 1.08, color, Math.max(4, canvas.height * 0.03), true);
    }
    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(cx, cy, Math.max(6, canvas.height * 0.045), 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,.55)';
    context.font = `${Math.max(10, canvas.height * 0.085)}px system-ui`;
    context.textAlign = 'right';
    context.fillText('floor', canvas.width * 0.94, cy - canvas.height * 0.04);
  }

  function drawSidePad() {
    drawElevationPad(
      sideCtx,
      sidePad,
      state.guessElevation,
      state.shot?.actualElevation,
      '#ffae4c',
    );
  }

  function drawCarGlyph2D(context, x, y, angle, length, width, fill, sideView = false) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = fill;
    context.strokeStyle = '#ffffff';
    context.lineWidth = Math.max(2, width * 0.08);
    if (!sideView) {
      context.beginPath();
      context.moveTo(length * 0.52, 0);
      context.lineTo(length * 0.34, width * 0.44);
      context.lineTo(-length * 0.05, width * 0.46);
      context.lineTo(-length * 0.34, width * 0.30);
      context.lineTo(-length * 0.48, width * 0.05);
      context.lineTo(-length * 0.48, -width * 0.05);
      context.lineTo(-length * 0.34, -width * 0.30);
      context.lineTo(-length * 0.05, -width * 0.46);
      context.lineTo(length * 0.34, -width * 0.44);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = 'rgba(222,242,255,.88)';
      context.fillRect(-length * 0.08, -width * 0.23, length * 0.24, width * 0.46);
    } else {
      context.beginPath();
      context.moveTo(-length * 0.45, width * 0.20);
      context.lineTo(-length * 0.18, width * 0.22);
      context.lineTo(-length * 0.02, -width * 0.10);
      context.lineTo(length * 0.20, -width * 0.10);
      context.lineTo(length * 0.46, -width * 0.02);
      context.lineTo(length * 0.48, width * 0.18);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = 'rgba(222,242,255,.88)';
      context.fillRect(-length * 0.02, -width * 0.06, length * 0.20, width * 0.18);
      context.fillRect(length * 0.16, -width * 0.05, length * 0.10, width * 0.12);
    }
    context.restore();
  }

  function drawCarPad() {
    drawPadBase(carCtx, carPad);
    const cx = carPad.width / 2;
    const cy = carPad.height / 2;
    const radius = Math.min(carPad.width, carPad.height) * 0.34;
    carCtx.strokeStyle = 'rgba(255,255,255,.26)';
    carCtx.lineWidth = Math.max(1.5, radius * 0.018);
    carCtx.beginPath();
    carCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    carCtx.stroke();
    carCtx.beginPath();
    carCtx.moveTo(cx - radius * 1.15, cy);
    carCtx.lineTo(cx + radius * 1.15, cy);
    carCtx.moveTo(cx, cy - radius * 1.15);
    carCtx.lineTo(cx, cy + radius * 1.15);
    carCtx.stroke();

    drawPadArrow(carCtx, cx, cy, -state.carGuessHeading, radius * 0.92, '#ffffff', radius * 0.07);
    if (state.revealed && state.shot) {
      drawPadArrow(carCtx, cx, cy, -state.shot.carPlan.optimumHeading, radius * 1.07, '#43e6a5', radius * 0.07);
    }

    drawCarGlyph2D(
      carCtx,
      cx,
      cy,
      -state.carGuessHeading,
      radius * 0.56,
      radius * 0.34,
      state.shot?.carPlan?.teamName === 'ORANGE' ? '#ff9638' : '#3db8ff',
      false,
    );
  }

  function drawCarSidePad() {
    drawElevationPad(
      carSideCtx,
      carSidePad,
      state.carGuessElevation,
      state.shot?.carPlan?.optimumElevation,
      '#43e6a5',
    );
    const cx = carSidePad.width * 0.22;
    const cy = carSidePad.height * 0.77;
    drawCarGlyph2D(
      carSideCtx,
      cx,
      cy,
      -state.carGuessElevation,
      carSidePad.height * 0.28,
      carSidePad.height * 0.16,
      state.shot?.carPlan?.teamName === 'ORANGE' ? '#ff9638' : '#3db8ff',
      true,
    );
  }

  function drawPadArrow(context, cx, cy, angle, length, color, width, side = false) {
    const ex = cx + Math.cos(angle) * length;
    const ey = cy + Math.sin(angle) * length;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = Math.max(2, width);
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(cx, cy);
    context.lineTo(ex, ey);
    context.stroke();
    context.beginPath();
    context.arc(ex, ey, Math.max(7, width * 1.55), 0, Math.PI * 2);
    context.fill();
    if (side) {
      context.strokeStyle = 'rgba(255,255,255,.18)';
      context.lineWidth = Math.max(1.5, width * 0.35);
      context.setLineDash([Math.max(5, width), Math.max(5, width)]);
      context.beginPath();
      context.moveTo(ex, ey);
      context.lineTo(ex, cy);
      context.stroke();
      context.setLineDash([]);
    }
  }

  function drawAll(time = performance.now()) {
    drawScene(time);
    drawTopPad();
    drawSidePad();
    drawCarPad();
    drawCarSidePad();
  }

  function localPoint(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height,
    };
  }

  function setTopFromEvent(event) {
    const p = localPoint(event, topPad);
    const dx = p.x - topPad.width / 2;
    const dy = p.y - topPad.height / 2;
    if (Math.hypot(dx, dy) > 12) state.guessHeading = Math.atan2(dy, dx);
    updateAngleOutputs();
    updatePathHint();
    if (state.revealed) refreshRevealedUI(false);
    else drawAll();
  }

  function setSideFromEvent(event) {
    const p = localPoint(event, sidePad);
    const cx = sidePad.width * 0.28;
    const cy = sidePad.height * 0.72;
    const dx = Math.max(12, p.x - cx);
    const dy = p.y - cy;
    state.guessElevation = clamp(-Math.atan2(dy, dx), -0.35, 1.25);
    updateAngleOutputs();
    updatePathHint();
    if (state.revealed) refreshRevealedUI(false);
    else drawAll();
  }

  function setCarFromEvent(event) {
    const p = localPoint(event, carPad);
    const cx = carPad.width / 2;
    const cy = carPad.height / 2 + 10;
    const dx = p.x - cx;
    const dy = p.y - cy;
    if (Math.hypot(dx, dy) > 12) state.carGuessHeading = -Math.atan2(dy, dx);
    updateAngleOutputs();
    updatePathHint();
    if (state.revealed) refreshRevealedUI(false);
    else drawAll();
  }

  function setCarSideFromEvent(event) {
    const p = localPoint(event, carSidePad);
    const cx = carSidePad.width * 0.22;
    const cy = carSidePad.height * 0.72;
    const dx = Math.max(12, p.x - cx);
    const dy = p.y - cy;
    state.carGuessElevation = clamp(-Math.atan2(dy, dx), 0, 1.30);
    updateAngleOutputs();
    updatePathHint();
    if (state.revealed) refreshRevealedUI(false);
    else drawAll();
  }

  function bindPad(canvas, down, move, up) {
    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      down(event);
    });
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  bindPad(topPad, (event) => {
    state.dragTop = true;
    setTopFromEvent(event);
  }, (event) => {
    if (state.dragTop) setTopFromEvent(event);
  }, () => { state.dragTop = false; if (state.revealed) startPlayback('compare'); });

  bindPad(sidePad, (event) => {
    state.dragSide = true;
    setSideFromEvent(event);
  }, (event) => {
    if (state.dragSide) setSideFromEvent(event);
  }, () => { state.dragSide = false; if (state.revealed) startPlayback('compare'); });

  bindPad(carPad, (event) => {
    state.dragCar = true;
    setCarFromEvent(event);
  }, (event) => {
    if (state.dragCar) setCarFromEvent(event);
  }, () => { state.dragCar = false; if (state.revealed) startPlayback('compare'); });

  bindPad(carSidePad, (event) => {
    state.dragCarSide = true;
    setCarSideFromEvent(event);
  }, (event) => {
    if (state.dragCarSide) setCarSideFromEvent(event);
  }, () => { state.dragCarSide = false; if (state.revealed) startPlayback('compare'); });

  function applyAngleStep(kind, deltaDegrees) {
    const step = deltaDegrees * Math.PI / 180;
    if (kind === 'ballHeading') state.guessHeading = angleWrap(state.guessHeading + step);
    if (kind === 'ballElevation') state.guessElevation = clamp(state.guessElevation + step, -0.35, 1.25);
    if (kind === 'carHeading') state.carGuessHeading = angleWrap(state.carGuessHeading + step);
    if (kind === 'carElevation') state.carGuessElevation = clamp(state.carGuessElevation + step, 0, 1.30);
    updateAngleOutputs();
    updatePathHint();
    if (state.revealed) refreshRevealedUI(false);
    else drawAll();
  }

  function applySliderStep(kind, direction) {
    if (kind === 'carSpeed') {
      state.carGuessSpeed = clamp(state.carGuessSpeed + direction * 10, 0, C.CAR_MAX_SPEED);
      $('carSpeedRange').value = String(Math.round(state.carGuessSpeed / 10) * 10);
      state.carGuessSpeed = Number($('carSpeedRange').value);
      updateCarSpeedOutput();
      updatePathHint();
      if (state.revealed) refreshRevealedUI(false);
      else drawAll();
      return;
    }
    if (kind === 'carDelay' && state.revealed) {
      state.carLaunchDelay = clamp(Number((state.carLaunchDelay + direction * 0.02).toFixed(2)), 0, 3);
      $('carDelayRange').value = state.carLaunchDelay.toFixed(2);
      updateCarDelayOutput();
      updatePathHint();
      updateCarResultUI(false);
    }
  }

  const angleStepBindings = [
    ['ballHeadingMinus', 'ballHeading', -1],
    ['ballHeadingPlus', 'ballHeading', 1],
    ['ballElevationMinus', 'ballElevation', -1],
    ['ballElevationPlus', 'ballElevation', 1],
    ['carHeadingMinus', 'carHeading', -1],
    ['carHeadingPlus', 'carHeading', 1],
    ['carElevationMinus', 'carElevation', -1],
    ['carElevationPlus', 'carElevation', 1],
  ];
  for (const [id, kind, amount] of angleStepBindings) {
    $(id).addEventListener('click', () => applyAngleStep(kind, amount));
  }

  const sliderStepBindings = [
    ['carSpeedMinus', 'carSpeed', -1],
    ['carSpeedPlus', 'carSpeed', 1],
    ['carDelayMinus', 'carDelay', -1],
    ['carDelayPlus', 'carDelay', 1],
  ];
  for (const [id, kind, amount] of sliderStepBindings) {
    $(id).addEventListener('click', () => applySliderStep(kind, amount));
  }

  scene.addEventListener('pointerdown', (event) => {
    if (state.drive.active) return;
    if (event.pointerType === 'touch' && !state.cameraTouchMode) return;
    if (event.pointerType === 'touch') event.preventDefault();
    scene.setPointerCapture(event.pointerId);
    state.pointer.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.viewMode === 'car') state.carCam.dragging = true;
  });

  scene.addEventListener('pointermove', (event) => {
    if (state.drive.active) return;
    if (!state.pointer.has(event.pointerId)) return;
    if (event.pointerType === 'touch') event.preventDefault();
    const previous = state.pointer.get(event.pointerId);
    state.pointer.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (state.viewMode === 'car') {
      state.carCam.yawOffset = clamp(state.carCam.yawOffset - (event.clientX - previous.x) * 0.008, -1.25, 1.25);
      state.carCam.pitchOffset = clamp(state.carCam.pitchOffset + (event.clientY - previous.y) * 0.005, -0.45, 0.45);
    } else if (state.pointer.size === 1) {
      state.camera.yaw -= (event.clientX - previous.x) * 0.006;
      state.camera.pitch = clamp(state.camera.pitch + (event.clientY - previous.y) * 0.004, 0.05, 1.15);
    } else if (state.pointer.size === 2) {
      const points = [...state.pointer.values()];
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (state.pinchDistance) state.camera.distance = clamp(state.camera.distance * state.pinchDistance / distance, 1600, 7200);
      state.pinchDistance = distance;
    }
    drawAll();
  });

  function releasePointer(event) {
    state.pointer.delete(event.pointerId);
    state.pinchDistance = null;
    if (state.viewMode === 'car' && state.pointer.size === 0) state.carCam.dragging = false;
  }

  scene.addEventListener('pointerup', releasePointer);
  scene.addEventListener('pointercancel', releasePointer);
  scene.addEventListener('wheel', (event) => {
    if (state.drive.active) return;
    if (state.viewMode === 'car') return;
    event.preventDefault();
    state.camera.distance = clamp(state.camera.distance * Math.exp(event.deltaY * 0.001), 1600, 7200);
    drawAll();
  }, { passive: false });

  function setCameraTouchMode(enabled) {
    state.cameraTouchMode = enabled;
    $('stageWrap').classList.toggle('camera-active', enabled);
    if (!enabled) {
      state.pointer.clear();
      state.pinchDistance = null;
    }
  }

  const driveInputSources = {
    accel: new Set(),
    reverse: new Set(),
    boost: new Set(),
    powerslide: new Set(),
    airRollLeft: new Set(),
    airRollRight: new Set(),
    jumpHeld: new Set(),
  };

  function syncDriveInput(field) {
    state.drive[field] = Boolean(driveInputSources[field]?.size);
  }

  function setDriveInputSource(field, source, active) {
    const sources = driveInputSources[field];
    if (!sources) return;
    if (active) sources.add(source);
    else sources.delete(source);
    syncDriveInput(field);
  }

  function clearDriveInputSources() {
    for (const [field, sources] of Object.entries(driveInputSources)) {
      sources.clear();
      state.drive[field] = false;
    }
    state.drive.accelBranch = 'accel';
    for (const button of document.querySelectorAll('.drive-action.active')) button.classList.remove('active');
    $('accelBranches')?.classList.remove('visible');
    for (const branch of document.querySelectorAll('.accel-branch.selected')) branch.classList.remove('selected');
  }

  function setDriveButtonState(id, active) { const el = $(id); if (el) el.classList.toggle('active', active); }

  function applyStickDeadzone(value, deadzone = 0.08) {
    const magnitude = Math.abs(value);
    if (magnitude <= deadzone) return 0;
    return Math.sign(value) * clamp((magnitude - deadzone) / (1 - deadzone), 0, 1);
  }

  function positionJoyKnob() { const knob = $('joyKnob'); if (!knob) return; knob.style.left = `${50 - state.drive.steerX * 26}%`; knob.style.top = `${50 + state.drive.steerY * 26}%`; }

  const gamepadState = { connected: false, index: null, previousButtons: [], uiHidden: false };
  function setControllerUiHidden(hidden) {
    gamepadState.uiHidden = Boolean(hidden);
    document.body.classList.toggle('controller-ui-hidden', gamepadState.uiHidden && state.drive.active);
  }
  document.addEventListener('pointerdown', (event) => { if (event.pointerType === 'touch' && gamepadState.uiHidden) setControllerUiHidden(false); }, {passive:true});
  function gamepadButtonValue(gamepad, index) { const button = gamepad?.buttons?.[index]; return button ? clamp(Number(button.value ?? (button.pressed ? 1 : 0)), 0, 1) : 0; }
  function gamepadButtonPressed(gamepad, index, threshold = 0.5) { return gamepadButtonValue(gamepad, index) >= threshold; }
  function setGamepadConnected(gamepad) { gamepadState.connected = Boolean(gamepad); gamepadState.index = gamepad?.index ?? null; if (!gamepad) gamepadState.previousButtons = []; }
  function findActiveGamepad() { const pads = navigator.getGamepads?.() || []; if (gamepadState.index !== null && pads[gamepadState.index]?.connected) return pads[gamepadState.index]; return [...pads].find((pad) => pad?.connected) || null; }
  function pollGamepad() {
    const gamepad = findActiveGamepad(); setGamepadConnected(gamepad);
    if (!gamepad || !state.drive.active) {
      for (const [field, source] of [['boost','gamepad'],['powerslide','gamepad'],['airRollLeft','gamepad-x'],['airRollLeft','gamepad-lb'],['airRollRight','gamepad-rb'],['jumpHeld','gamepad']]) setDriveInputSource(field, source, false);
      state.drive.controllerAccel = 0; state.drive.controllerReverse = 0; return;
    }
    const axes = gamepad.axes || [];
    state.drive.steerX = applyStickDeadzone(clamp(-(axes[0] || 0), -1, 1), 0.10);
    state.drive.steerY = applyStickDeadzone(clamp(axes[1] || 0, -1, 1), 0.10);
    state.drive.controllerAccel = gamepadButtonValue(gamepad, 7);
    state.drive.controllerReverse = gamepadButtonValue(gamepad, 6);
    const jump = gamepadButtonPressed(gamepad, 0), boost = gamepadButtonPressed(gamepad, 1), powerslideAirRoll = gamepadButtonPressed(gamepad, 2), camera = gamepadButtonPressed(gamepad, 3), airRollLeft = gamepadButtonPressed(gamepad, 4), airRollRight = gamepadButtonPressed(gamepad, 5);
    if (jump && !gamepadState.previousButtons[0]) state.drive.justJump = true;
    if (camera && !gamepadState.previousButtons[3]) { state.drive.cameraMode = state.drive.cameraMode === 'ball' ? 'free' : 'ball'; state.drive.ballCamOrbit = null; state.drive.ballCamLastUpdate = 0; state.drive.ballCamTargetLift = 0; state.drive.ballCamPullback = 0; state.drive.ballCamHeightLift = 0; updateDriveUI(); }
    setDriveInputSource('jumpHeld','gamepad',jump); setDriveInputSource('boost','gamepad',boost);
    setDriveInputSource('powerslide','gamepad',powerslideAirRoll && state.drive.car?.onGround !== false);
    setDriveInputSource('airRollLeft','gamepad-x',powerslideAirRoll && state.drive.car?.onGround === false);
    setDriveInputSource('airRollLeft','gamepad-lb',airRollLeft); setDriveInputSource('airRollRight','gamepad-rb',airRollRight);
    const usedController = Math.abs(state.drive.steerX) > 0.01 || Math.abs(state.drive.steerY) > 0.01 || state.drive.controllerAccel > 0.05 || state.drive.controllerReverse > 0.05 || jump || boost || powerslideAirRoll || airRollLeft || airRollRight;
    if (usedController) { setControllerUiHidden(true); startDriveIfNeeded(); }
    gamepadState.previousButtons = gamepad.buttons.map((button) => button.pressed || button.value >= 0.5);
  }
  window.addEventListener('gamepadconnected', (event) => { setGamepadConnected(event.gamepad); updateDriveUI(); });
  window.addEventListener('gamepaddisconnected', () => { setGamepadConnected(findActiveGamepad()); updateDriveUI(); });


  function updateOptimumUI() {
    const button = $('optimumButton');
    if (!button) return;
    button.classList.toggle('active', state.optimumMode);
    button.setAttribute('aria-pressed', state.optimumMode ? 'true' : 'false');
    button.textContent = state.optimumMode ? 'Optimum On' : 'Optimum';
  }

  function setOptimumMode(enabled) {
    if (!state.shot) return;
    state.optimumMode = Boolean(enabled);
    if (state.optimumMode) {
      if (state.drive.active) exitDriveMode(false);
      state.optimumPreviousRevealed = state.revealed;
      state.revealed = true;
      state.viewMode = 'car';
      state.playMode = 'compare';
      state.playhead = 0;
      state.carResult = evaluateCarGuess(state.shot.carPlan);
      updateViewModeUI();
      startPlayback('compare', true);
      $('phaseBadge').textContent = 'OPTIMUM ROUTE — LIVE SOLUTION LOOP';
      $('phaseText').textContent = 'Following the exact recommended hit';
    } else {
      state.playing = false;
      state.playhead = 0;
      state.revealed = state.optimumPreviousRevealed;
      startPlayback(state.revealed ? 'compare' : 'preview', true);
    }
    updateOptimumUI();
    drawAll();
  }


  const BOT_LEVELS = [
    { name: 'OFF', reaction: 0.35, aimError: 0, speed: 0, boost: false, jump: false, prediction: 0, powerslide: false, aggression: 0, shotAssist: 0 },
    { name: 'ROOKIE', reaction: 0.30, aimError: 360, speed: 0.64, boost: false, jump: false, prediction: 0.28, powerslide: false, aggression: 0.35, shotAssist: 0.08 },
    { name: 'PRO', reaction: 0.15, aimError: 175, speed: 0.82, boost: true, jump: false, prediction: 0.62, powerslide: true, aggression: 0.58, shotAssist: 0.20 },
    { name: 'ALL-STAR', reaction: 0.065, aimError: 62, speed: 0.96, boost: true, jump: true, prediction: 1.05, powerslide: true, aggression: 0.82, shotAssist: 0.38 },
    { name: 'UNFAIR', reaction: 0.018, aimError: 6, speed: 1.0, boost: true, jump: true, prediction: 1.55, powerslide: true, aggression: 1.0, shotAssist: 0.72 },
  ];

  function currentBotLevel() { return BOT_LEVELS[state.bot.difficultyIndex] || BOT_LEVELS[0]; }

  function updateBotDifficultyUI() {
    const button = $('botDifficultyButton');
    if (!button) return;
    const level = currentBotLevel();
    button.textContent = `BOT: ${level.name}`;
    button.classList.toggle('active', state.bot.difficultyIndex > 0);
    button.setAttribute('aria-label', `Bot difficulty ${level.name}. Tap to change.`);
  }

  function resetBotCar() {
    if (state.bot.difficultyIndex <= 0) { state.bot.car = null; return; }
    state.bot.car = {
      p: v3(0, C.BACK_Y * 0.44, C.CAR_Z), v: v3(0,0,0), heading: -Math.PI / 2,
      pitch: 0, roll: 0, yawVelocity: 0, pitchVelocity: 0, rollVelocity: 0,
      onGround: true, wheelContacts: 4, simTime: 0, supersonic: false,
    };
    state.bot.thinkTimer = 0;
    state.bot.steer = 0;
    state.bot.throttle = 0;
    state.bot.boost = false;
    state.bot.powerslide = false;
    state.bot.jumpCooldown = 0;
    state.bot.stuckTimer = 0;
    state.bot.lastTargetDistance = Infinity;
    state.bot.recoveryTimer = 0;
    state.bot.target = null;
  }

  function cycleBotDifficulty() {
    state.bot.difficultyIndex = (state.bot.difficultyIndex + 1) % BOT_LEVELS.length;
    resetBotCar();
    updateBotDifficultyUI();
    if (state.drive.active) startDriveIfNeeded();
    drawAll();
  }

  function predictBotBall(ball, seconds) {
    const prediction = copyState(ball);
    const ticks = Math.max(0, Math.min(300, Math.round(seconds / C.TICK)));
    for (let i = 0; i < ticks; i += 1) stepBall(prediction);
    return prediction;
  }

  function chooseBotPlay(bot, ball, level) {
    const botSpeed = Math.max(500, len2D(bot.v));
    const rawDistance = dist2D(bot.p, ball.p);
    const travelTime = clamp(rawDistance / Math.max(900, botSpeed + 500), 0.08, level.prediction);
    const predicted = predictBotBall(ball, travelTime);

    // Orange attacks the blue goal. Aim through the future ball position rather
    // than steering at the ball's current location, which caused endless orbiting.
    const blueGoal = v3(clamp(-predicted.p.x * 0.08, -260, 260), -C.BACK_Y - 170, 225);
    const shotDirection = norm2D(sub(blueGoal, predicted.p));
    const contactOffset = C.BALL_R + C.CAR_HALF_L + 34;
    let target = add(predicted.p, mul(shotDirection, -contactOffset));
    target.z = C.CAR_Z;

    // When the ball is already threatening orange, arrive sooner and clear through
    // it. Otherwise retain the behind-the-ball shooting lane.
    const emergency = predicted.p.y > C.BACK_Y * 0.47 || (ball.v.y > 500 && ball.p.y > 0);
    if (emergency) {
      const emergencyPrediction = predictBotBall(ball, clamp(travelTime * 0.62, 0.05, 0.65));
      const clearDirection = norm2D(sub(v3(0, -C.BACK_Y, 180), emergencyPrediction.p));
      target = add(emergencyPrediction.p, mul(clearDirection, -contactOffset * 0.82));
      target.z = C.CAR_Z;
    }

    const error = level.aimError;
    target.x += rand(-error, error);
    target.y += rand(-error * 0.22, error * 0.22);
    target.x = clamp(target.x, -C.SIDE_X + 180, C.SIDE_X - 180);
    target.y = clamp(target.y, -C.BACK_Y + 140, C.BACK_Y - 140);
    return { target, predicted, shotDirection, emergency, travelTime };
  }

  function applyBotShotAssist(ball, bot, level, contactNormal, carForward) {
    if (level.shotAssist <= 0) return;

    // Do not manufacture kickoff goals. At center field, the collision result must
    // come entirely from the actual contact normal and relative momentum.
    const nearKickoff = Math.abs(ball.p.x) < 260 && Math.abs(ball.p.y) < 340;
    if (nearKickoff) return;

    const currentSpeed = len(ball.v);
    if (currentSpeed < 1) return;

    const naturalDirection = norm(ball.v);
    const goal = v3(clamp(-ball.p.x * 0.04, -180, 180), -C.BACK_Y - 260,
      clamp(ball.p.z * 0.32 + 150, 170, 330));
    const desiredDirection = norm(sub(goal, ball.p));

    // Assistance may gently bend a physically valid outgoing hit, but it can never
    // flip the ball through the car or oppose the collision normal/car momentum.
    const normalAlignment = dot(desiredDirection, contactNormal);
    const forwardAlignment = dot(desiredDirection, carForward);
    if (normalAlignment <= 0.08 || forwardAlignment <= -0.05) return;

    const maxBlend = state.bot.difficultyIndex >= 4 ? 0.16 : 0.10;
    const blend = Math.min(level.shotAssist * 0.22, maxBlend)
      * clamp(normalAlignment, 0, 1);
    const steered = norm(add(mul(naturalDirection, 1 - blend), mul(desiredDirection, blend)));

    // Preserve the speed created by the collision. Unfair improves placement, not
    // raw impulse, so it cannot create backward or super-powered goals.
    ball.v = mul(steered, currentSpeed);
    capBall(ball);
  }

  function stepBot(step) {
    if (state.pvp.active) return;
    const bot = state.bot.car;
    const ball = state.drive.ball;
    const level = currentBotLevel();
    if (!bot || !ball || state.bot.difficultyIndex <= 0 || state.goalCelebration.active) return;
    bot.simTime += step;
    state.bot.jumpCooldown = Math.max(0, state.bot.jumpCooldown - step);
    state.bot.recoveryTimer = Math.max(0, state.bot.recoveryTimer - step);
    state.bot.thinkTimer -= step;

    if (state.bot.thinkTimer <= 0) {
      state.bot.thinkTimer = level.reaction;
      const play = chooseBotPlay(bot, ball, level);
      state.bot.target = play.target;
      const dx = play.target.x - bot.p.x;
      const dy = play.target.y - bot.p.y;
      const desired = Math.atan2(dy, dx);
      const delta = angleWrap(desired - bot.heading);
      const distance = Math.hypot(dx, dy);
      const forwardSpeedNow = dot(bot.v, v3(Math.cos(bot.heading), Math.sin(bot.heading), 0));

      const progress = state.bot.lastTargetDistance - distance;
      if (distance > 260 && progress < 7 && Math.abs(forwardSpeedNow) > 260) state.bot.stuckTimer += level.reaction;
      else state.bot.stuckTimer = Math.max(0, state.bot.stuckTimer - level.reaction * 1.8);
      state.bot.lastTargetDistance = distance;

      const severeTurn = Math.abs(delta) > 1.18;
      const orbiting = state.bot.stuckTimer > 0.34;
      state.bot.powerslide = level.powerslide && bot.onGround && Math.abs(forwardSpeedNow) > 380
        && (severeTurn || orbiting);

      const steerGain = state.bot.powerslide ? 2.85 : 2.05;
      state.bot.steer = clamp(delta * steerGain, -1, 1);

      // Reverse briefly if the target is almost directly behind and the car is too
      // slow for a useful powerslide. This guarantees re-engagement at kickoff and
      // breaks the large-circle failure mode.
      if (Math.abs(delta) > 2.35 && Math.abs(forwardSpeedNow) < 520) {
        state.bot.throttle = -0.72;
        state.bot.recoveryTimer = Math.max(state.bot.recoveryTimer, 0.18);
      } else {
        state.bot.throttle = 1;
      }
      if (state.bot.recoveryTimer > 0 && Math.abs(delta) > 1.75) state.bot.throttle = -0.62;

      state.bot.boost = level.boost && state.bot.throttle > 0 && distance > (play.emergency ? 420 : 720)
        && Math.abs(delta) < (state.bot.difficultyIndex >= 4 ? 0.48 : 0.30);

      const closeToBall = dist2D(bot.p, play.predicted.p) < (state.bot.difficultyIndex >= 4 ? 510 : 420);
      const usefulHeight = ball.p.z > 145 && ball.p.z < (state.bot.difficultyIndex >= 4 ? 690 : 500);
      if (level.jump && state.bot.jumpCooldown <= 0 && closeToBall && usefulHeight && Math.abs(delta) < 0.58) {
        bot.v.z = 430 + (state.bot.difficultyIndex >= 4 ? 165 : 70);
        bot.onGround = false;
        state.bot.jumpCooldown = state.bot.difficultyIndex >= 4 ? 0.78 : 1.25;
      }
    }

    const fwd = v3(Math.cos(bot.heading), Math.sin(bot.heading), 0);
    const right = v3(-Math.sin(bot.heading), Math.cos(bot.heading), 0);
    let forwardSpeed = dot(bot.v, fwd);
    let lateralSpeed = dot(bot.v, right);
    const slideAmount = state.bot.powerslide ? 1 : 0;
    const lateralGrip = DRIVE_PHYS.lateralGrip * (1 - slideAmount) + DRIVE_PHYS.powerslideGrip * slideAmount;
    lateralSpeed *= Math.max(0, 1 - lateralGrip * step);
    const maxSpeed = DRIVE_PHYS.maxSpeed * level.speed;
    const directionSign = Math.abs(forwardSpeed) > 5 ? Math.sign(forwardSpeed) : (state.bot.throttle < 0 ? -1 : 1);
    const turnMultiplier = state.bot.powerslide ? DRIVE_PHYS.powerslideSteerMultiplier : 1;
    bot.heading += groundCurvature(Math.abs(forwardSpeed)) * Math.abs(forwardSpeed) * state.bot.steer * directionSign * turnMultiplier * step;

    if (state.bot.throttle >= 0) forwardSpeed += throttleAcceleration(Math.abs(forwardSpeed)) * state.bot.throttle * step;
    else {
      if (forwardSpeed > 30) forwardSpeed -= DRIVE_PHYS.brakeDecel * Math.abs(state.bot.throttle) * step;
      else forwardSpeed -= throttleAcceleration(Math.abs(forwardSpeed)) * Math.abs(state.bot.throttle) * 0.7 * step;
    }
    if (state.bot.boost) forwardSpeed += DRIVE_PHYS.boostAccelGround * step;
    if (state.bot.powerslide) forwardSpeed *= Math.pow(DRIVE_PHYS.powerslideSpeedRetention, step * 60);
    forwardSpeed = clamp(forwardSpeed, -DRIVE_PHYS.reverseMaxSpeed * 0.72, maxSpeed);

    const nf = v3(Math.cos(bot.heading), Math.sin(bot.heading), 0);
    const nr = v3(-Math.sin(bot.heading), Math.cos(bot.heading), 0);
    bot.v.x = nf.x * forwardSpeed + nr.x * lateralSpeed;
    bot.v.y = nf.y * forwardSpeed + nr.y * lateralSpeed;
    if (!bot.onGround) bot.v.z -= C.GRAVITY * step;
    bot.p = add(bot.p, mul(bot.v, step));
    if (bot.p.z <= C.CAR_Z) { bot.p.z = C.CAR_Z; bot.v.z = 0; bot.onGround = true; }
    bot.p.x = clamp(bot.p.x, -C.SIDE_X + 110, C.SIDE_X - 110);
    bot.p.y = clamp(bot.p.y, -C.BACK_Y + 110, C.BACK_Y - 110);

    const hit = sphereCarClearance(ball.p, bot.p, bot.heading, bot.pitch || 0);
    if (hit.clearance <= 0) {
      const rel = sub(ball.v, bot.v);
      const normalSpeed = dot(rel, hit.normal);
      if (normalSpeed < 0) {
        const impulseMagnitude = -(1 + 0.72) * normalSpeed / ((1 / C.MASS) + (1 / C.CAR_MASS));
        const impulse = mul(hit.normal, impulseMagnitude);
        ball.v = add(ball.v, mul(impulse, 1 / C.MASS));
        bot.v = add(bot.v, mul(impulse, -1 / C.CAR_MASS));
        const relativeSpeed = len(sub(ball.v, bot.v));
        const extra = relativeSpeed * psyonixBallHitScale(relativeSpeed);
        ball.v = add(ball.v, mul(psyonixBallHitNormal(ball.p, bot.p, nf), extra));
        if (state.bot.boost) ball.v = add(ball.v, mul(nf, 38));
        applyBotShotAssist(ball, bot, level, hit.normal, nf);
      }
      ball.p = add(ball.p, mul(hit.normal, 5));
    }
  }

  function resolveDriveCarCollision() {
    const player = state.drive.car;
    const bot = state.bot.car;
    if (!player || !bot || state.goalCelebration.active) return;
    if (Math.abs(player.p.z - bot.p.z) > 105) return;

    let delta = sub(bot.p, player.p);
    delta.z = 0;
    let distance = len2D(delta);
    const minimumDistance = 132;
    if (distance >= minimumDistance) return;
    if (distance < 0.001) { delta = v3(Math.cos(player.heading), Math.sin(player.heading), 0); distance = 1; }
    const normal = mul(delta, 1 / distance);
    const penetration = minimumDistance - distance;
    player.p = add(player.p, mul(normal, -penetration * 0.5));
    bot.p = add(bot.p, mul(normal, penetration * 0.5));

    const relativeVelocity = sub(bot.v, player.v);
    const closingSpeed = dot(relativeVelocity, normal);
    if (closingSpeed >= 0) return;
    const restitution = 0.48;
    const impulseMagnitude = -(1 + restitution) * closingSpeed / ((1 / C.CAR_MASS) + (1 / C.CAR_MASS));
    const impulse = mul(normal, impulseMagnitude);
    player.v = add(player.v, mul(impulse, -1 / C.CAR_MASS));
    bot.v = add(bot.v, mul(impulse, 1 / C.CAR_MASS));

    // Rocket League bumps feel stronger than a plain equal-mass rigid collision.
    const impactSpeed = -closingSpeed;
    const bump = clamp((impactSpeed - 250) * 0.32, 0, 620);
    if (bump > 0) {
      const lift = clamp((impactSpeed - 900) * 0.10, 0, 155);
      player.v = add(player.v, v3(-normal.x * bump, -normal.y * bump, lift));
      bot.v = add(bot.v, v3(normal.x * bump, normal.y * bump, lift));
      if (lift > 20) { player.onGround = false; bot.onGround = false; }
      player.yawVelocity = (player.yawVelocity || 0) - Math.sign(normal.x || 1) * bump * 0.0012;
      bot.yawVelocity = (bot.yawVelocity || 0) + Math.sign(normal.x || 1) * bump * 0.0012;
    }
  }

  function updateScoreboard() {
    const blue = $('blueScore');
    const orange = $('orangeScore');
    if (blue) blue.textContent = String(state.score.blue);
    if (orange) orange.textContent = String(state.score.orange);
  }

  function resetBallToMidfield() {
    if (!state.drive.ball) return;
    state.drive.ball.p = v3(0, 0, C.BALL_R + 2);
    state.drive.ball.v = v3(0, 0, 0);
    state.drive.ball.w = v3(0, 0, 0);
    state.drive.hitCooldown = 0.35;
  }

  function makeGoalExplosion(origin, enteredGoal) {
    const goalSign = enteredGoal === 'orange' ? 1 : -1;
    const particles = [];
    for (let i = 0; i < 260; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const lift = rand(-0.15, 0.95);
      const flat = Math.sqrt(Math.max(0.05, 1 - lift * lift));
      const speed = rand(850, 2850);
      particles.push({
        p: { ...origin },
        v: v3(Math.cos(angle) * flat * speed, Math.sin(angle) * flat * speed - goalSign * rand(80, 420), lift * speed),
        size: rand(8, 28),
        life: rand(0.9, 2.45),
        age: 0,
      });
    }
    state.goalCelebration.origin = origin;
    state.goalCelebration.particles = particles;
    state.goalCelebration.shockwave = 0;
  }

  function applyGoalExplosionKnockback(origin) {
    const car = state.drive.car;
    if (!car) return;
    let delta = sub(car.p, origin);
    let distance = len(delta);
    const radius = 3200;
    if (distance >= radius) return;
    if (distance < 40) { delta = v3(0, -Math.sign(origin.y || 1), 0.3); distance = 40; }
    const direction = norm(add(delta, v3(0, 0, 190)));
    const strength = 3900 * Math.pow(1 - distance / radius, 0.62) + 650;
    if (car.surfaceAxis && typeof detachCarFromSurface === 'function') detachCarFromSurface(car, 180);
    car.onGround = false;
    car.bodyResting = false;
    car.bodyRestFace = null;
    car.v = add(car.v || v3(), mul(direction, strength));
    car.pitchVelocity = (car.pitchVelocity || 0) + rand(-2.2, 2.2);
    car.rollVelocity = (car.rollVelocity || 0) + rand(-3.2, 3.2);
    car.yawVelocity = (car.yawVelocity || 0) + rand(-1.4, 1.4);
    const bot = state.bot.car;
    if (bot) {
      const bd = sub(bot.p, origin);
      const bdist = Math.max(40, len(bd));
      if (bdist < radius) {
        const bdir = norm(add(bd, v3(0,0,190)));
        const bstrength = 3900 * Math.pow(1 - bdist / radius, 0.62) + 650;
        bot.v = add(bot.v || v3(), mul(bdir, bstrength));
        bot.onGround = false;
        bot.pitchVelocity = (bot.pitchVelocity || 0) + rand(-2.2,2.2);
        bot.rollVelocity = (bot.rollVelocity || 0) + rand(-3.2,3.2);
      }
    }
  }

  function showGoalCelebration(scoredBy, enteredGoal, now = performance.now()) {
    if (state.goalCelebration.active) return;
    const goalSign = enteredGoal === 'orange' ? 1 : -1;
    const origin = v3(0, goalSign * (C.BACK_Y + 210), 255);
    state.goalCelebration.active = true;
    state.goalCelebration.scoredBy = scoredBy;
    state.goalCelebration.enteredGoal = enteredGoal;
    state.goalCelebration.startedAt = now;
    state.goalCelebration.endsAt = now + 3400;
    state.goalCelebration.lastParticleUpdate = now;
    state.score[scoredBy] += 1;
    updateScoreboard();
    if (state.pvp.active && state.pvp.role === 'host') {
      pvpSend('goal', { scoredBy, enteredGoal, score: { ...state.score }, kickoffAt: Date.now() + 6900 });
      window.setTimeout(() => { if (state.pvp.active && state.pvp.role === 'host') startPvpKickoff(Date.now() + 4000); }, 3400);
    }
    makeGoalExplosion(origin, enteredGoal);
    try {
      applyGoalExplosionKnockback(origin);
    } catch (error) {
      console.error('Goal knockback failed; celebration will continue.', error);
    }

    if (state.drive.ball) {
      state.drive.ball.p = { ...origin };
      state.drive.ball.v = v3(0, 0, 0);
      state.drive.ball.w = v3(0, 0, 0);
    }
    clearDriveInputSources();
    state.drive.controllerAccel = 0;
    state.drive.controllerReverse = 0;
    state.drive.steerX = 0;
    state.drive.steerY = 0;

    const overlay = $('goalCelebration');
    const label = $('goalCelebrationText');
    if (label) label.textContent = `${scoredBy.toUpperCase()} SCORES!`;
    if (overlay) {
      overlay.hidden = false;
      overlay.classList.remove('blue-goal', 'orange-goal', 'celebrating');
      overlay.classList.add(`${scoredBy}-goal`);
      void overlay.offsetWidth;
      overlay.classList.add('celebrating');
    }
    $('phaseBadge').textContent = `${scoredBy.toUpperCase()} GOAL!`;
    $('phaseText').textContent = `Explosion in the ${enteredGoal.toUpperCase()} net`;
  }

  function updateGoalCelebration(now) {
    if (!state.goalCelebration.active) return;
    const dt = Math.min(0.05, Math.max(0, (now - (state.goalCelebration.lastParticleUpdate || now)) / 1000));
    state.goalCelebration.lastParticleUpdate = now;
    state.goalCelebration.shockwave += dt * 1850;
    for (const particle of state.goalCelebration.particles) {
      particle.age += dt;
      particle.v.z -= C.GRAVITY * 0.42 * dt;
      particle.v = mul(particle.v, Math.exp(-0.9 * dt));
      particle.p = add(particle.p, mul(particle.v, dt));
    }
    if (now < state.goalCelebration.endsAt) return;
    state.goalCelebration.active = false;
    state.goalCelebration.particles = [];
    resetBallToMidfield();
    const overlay = $('goalCelebration');
    if (overlay) {
      overlay.hidden = true;
      overlay.classList.remove('blue-goal', 'orange-goal', 'celebrating');
    }
    state.drive.lastTime = now;
    updateDriveUI();
  }

  function detectDriveGoal(now = performance.now()) {
    if (state.pvp.active && state.pvp.role !== 'host') return false;
    if (!state.drive.active || !state.drive.started || !state.drive.ball || state.goalCelebration.active) return false;
    const ball = state.drive.ball;
    const insideMouth = Math.abs(ball.p.x) <= C.GOAL_HALF_W - C.BALL_R * 0.18
      && ball.p.z <= C.GOAL_H - C.BALL_R * 0.12;
    if (!insideMouth) return false;

    const crossedOrangeLine = ball.p.y >= C.BACK_Y + C.BALL_R * 0.15;
    const crossedBlueLine = ball.p.y <= -C.BACK_Y - C.BALL_R * 0.15;
    if (crossedOrangeLine) {
      showGoalCelebration('blue', 'orange', now);
      return true;
    }
    if (crossedBlueLine) {
      showGoalCelebration('orange', 'blue', now);
      return true;
    }
    return false;
  }

  function updateDriveUI() {
    const active = state.drive.active;
    $('driveOverlay').hidden = !active;
    $('driveButton').textContent = active ? 'Exit Drive' : 'Drive';
    const pvpButton = $('pvpButton');
    if (pvpButton) {
      pvpButton.classList.toggle('active', state.pvp.active);
      pvpButton.textContent = state.pvp.connecting ? 'PVP…' : (state.pvp.active ? 'Exit PVP' : 'PVP');
    }
    $('viewModeButton').hidden = active;
    $('stageWrap').classList.toggle('drive-active', active);
    document.body.classList.toggle('drive-fullscreen', active);
    $('optimumButton').hidden = active;
    const camButton = $('driveCameraButton');
    if (camButton) {
      const ballCam = state.drive.cameraMode === 'ball';
      camButton.textContent = ballCam ? 'BCAM' : 'FCAM';
      camButton.setAttribute('aria-pressed', ballCam ? 'true' : 'false');
      camButton.setAttribute('aria-label', ballCam ? 'Ball Cam active; tap for Free Cam' : 'Free Cam active; tap for Ball Cam');
    }
    $('driveReady').textContent = active ? (state.drive.started ? (state.drive.paused ? 'Drive paused' : `${state.drive.cameraMode === 'ball' ? 'Ball Cam' : 'Free Cam'} active${gamepadState.connected ? ' · Controller connected' : ''}`) : (gamepadState.connected ? 'Controller connected · press any control to start' : 'Touch any control to start the ball')) : (gamepadState.connected ? 'Controller connected' : 'Touch any control to start the ball');
    $('stageHelp').textContent = active ? (state.drive.cameraMode === 'ball' ? 'Ball Cam: camera follows the car and tracks the ball' : 'Free Cam: camera stays behind the car and rolls with the surface') : (state.viewMode === 'car' ? 'Car view: drag to pan · release snaps behind the car' : 'Arena view: one finger orbits · two fingers zoom');
    if (active) {
      $('phaseBadge').textContent = state.drive.started ? `DRIVE MODE — ${state.drive.cameraMode === 'ball' ? 'BALL CAM' : 'FREE CAM'}` : 'DRIVE MODE — TOUCH A CONTROL TO START';
      $('phaseText').textContent = state.drive.started ? 'Manual takeoff and approach' : 'Drive mode ready';
    } else if (state.playMode === 'compare' && state.revealed) {
      $('phaseBadge').textContent = 'BOUNCE → AERIAL INTERCEPT → TARGET GOAL';
      $('phaseText').textContent = 'Study the full solution loop';
    } else {
      $('phaseBadge').textContent = 'INCOMING PATH — WATCH THE LOOP';
      $('phaseText').textContent = 'Watch the approach';
    }
    updatePlaybackButtons();
    positionJoyKnob();
  }

  function resetDriveSession() {
    if (!state.shot) return;
    const plan = state.shot.carPlan;
    state.drive.started = false; state.drive.paused = false; state.drive.cameraMode = 'ball'; state.drive.steerX = 0; state.drive.steerY = 0; state.drive.controllerAccel = 0; state.drive.controllerReverse = 0; clearDriveInputSources(); state.drive.powerslideAmount = 0; state.drive.justJump = false; state.drive.accelBranch = 'accel'; state.drive.joyPointer = null; releaseFloatingJoystick(); state.drive.hitCooldown = 0; state.drive.lastTime = 0; state.drive.ballCamOrbit = null; state.drive.ballCamLastUpdate = 0; state.drive.ballCamTargetLift = 0; state.drive.ballCamPullback = 0; state.drive.ballCamHeightLift = 0; state.drive.boostTrail = []; state.drive.boostEmitCarry = 0;
    state.goalCelebration.active = false;
    const goalOverlay = $('goalCelebration');
    if (goalOverlay) { goalOverlay.hidden = true; goalOverlay.classList.remove('blue-goal', 'orange-goal', 'celebrating'); }
    $('stageWrap')?.classList.remove('supersonic');
    $('accelBranches')?.classList.remove('visible');
    state.drive.ball = { p: v3(state.shot.initial.p.x, state.shot.initial.p.y, state.shot.initial.p.z), v: v3(state.shot.initial.v.x, state.shot.initial.v.y, state.shot.initial.v.z), w: v3(state.shot.initial.w.x, state.shot.initial.w.y, state.shot.initial.w.z) };
    state.drive.car = {
      p: v3(plan.start.x, plan.start.y, C.CAR_Z), v: v3(0, 0, 0),
      heading: state.carGuessHeading, pitch: 0, roll: 0,
      yawVelocity: 0, pitchVelocity: 0, rollVelocity: 0,
      onGround: true, wheelContacts: 4, bodyResting: false, bodyContactTime: 0,
      jumpHoldTime: 0, firstJumpActive: false, firstJumpEndAt: -Infinity,
      hasJumped: false, usedSecondJump: false, usedDodge: false,
      jumpSurfaceUp: v3(0,0,1), stickyTicks: 0,
      dodgeActive: false, dodgeTime: 0, dodgeForward: 0, dodgeSide: 0, pitchLockUntil: 0,
      dodgeCancelled: false, dodgeFollowThroughUntil: 0,
      selfRightTime: 0, simTime: 0, groundedTicks: 0,
      bodyRestFace: null, bodyRestTargetPitch: 0, bodyRestTargetRoll: 0, bodyStableTicks: 0,
      supersonic: false, supersonicGrace: 0,
      surfaceAxis: null, surfaceSign: 0, surfaceS: 0, surfaceLateral: 0,
      surfaceAngle: 0, surfaceSpeed: 0, surfaceForward: null, surfaceUp: v3(0,0,1),
      surfaceIdleTime: 0,
    };
    resetBotCar();
    positionJoyKnob();
  }


  const SUPABASE_URL = 'https://uvrnxrmwoyhswzldhcul.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_giCNdyuF32ZkCyaob2L4kQ_xIYBJ_L3';
  const PVP_CHANNEL = 'rocket-read-pvp-main-v2';

  function setPvpStatus(text, tone = '') {
    const box = $('pvpStatus');
    if (!box) return;
    box.hidden = !text;
    box.textContent = text || '';
    box.dataset.tone = tone;
  }

  function serializeCar(car) {
    if (!car) return null;
    const fields = ['heading','pitch','roll','yawVelocity','pitchVelocity','rollVelocity','onGround','wheelContacts','bodyResting','simTime','surfaceAxis','surfaceSign','surfaceS','surfaceLateral','surfaceAngle','surfaceSpeed','surfaceCornerPhi','surfaceCornerSX','surfaceCornerSY'];
    const out = { p:{...car.p}, v:{...car.v} };
    for (const field of fields) out[field] = car[field] ?? null;
    return out;
  }

  function hydrateRemoteCar(data) {
    if (!data?.p || !data?.v) return;
    const receivedAt = performance.now();
    state.pvp.remoteTarget = {
      receivedAt,
      p:v3(data.p.x, data.p.y, data.p.z),
      v:v3(data.v.x, data.v.y, data.v.z),
      data:{...data}
    };
    if (!state.bot.car) {
      state.bot.car = { p:v3(data.p.x, data.p.y, data.p.z), v:v3(data.v.x, data.v.y, data.v.z), heading:0, pitch:0, roll:0, onGround:true, wheelContacts:4 };
      for (const [key, value] of Object.entries(data)) if (key !== 'p' && key !== 'v' && value !== null) state.bot.car[key] = value;
    }
    state.pvp.lastRemoteAt = receivedAt;
  }

  function updateRemoteCarSmoothing(now) {
    const target = state.pvp.remoteTarget;
    const car = state.bot.car;
    if (!target || !car) return;
    const age = Math.min(0.12, Math.max(0, (now - target.receivedAt) / 1000));
    const predicted = add(target.p, mul(target.v, age));
    const distance = len(sub(predicted, car.p));
    if (distance > 900) car.p = {...predicted};
    else car.p = add(car.p, mul(sub(predicted, car.p), 0.24));
    car.v = add(car.v || v3(), mul(sub(target.v, car.v || v3()), 0.28));
    const angleLerp = (from, to, amount) => from + angleWrap(to - from) * amount;
    if (Number.isFinite(target.data.heading)) car.heading = angleLerp(car.heading || 0, target.data.heading, 0.28);
    if (Number.isFinite(target.data.pitch)) car.pitch = angleLerp(car.pitch || 0, target.data.pitch, 0.28);
    if (Number.isFinite(target.data.roll)) car.roll = angleLerp(car.roll || 0, target.data.roll, 0.28);
    for (const [key, value] of Object.entries(target.data)) {
      if (!['p','v','heading','pitch','roll'].includes(key) && value !== null) car[key] = value;
    }
  }

  function pvpSend(event, payload = {}) {
    if (!state.pvp.channel || !state.pvp.connected) return;
    state.pvp.channel.send({ type:'broadcast', event, payload:{ ...payload, sender:state.pvp.clientId } }).catch(() => {});
  }

  function resetPvpKickoffPositions() {
    if (!state.drive.ball || !state.drive.car) resetDriveSession();
    resetBallToMidfield();
    const orange = state.pvp.team === 'orange';
    const localY = orange ? 2350 : -2350;
    const remoteY = -localY;
    const localHeading = orange ? -Math.PI / 2 : Math.PI / 2;
    const remoteHeading = orange ? Math.PI / 2 : -Math.PI / 2;
    Object.assign(state.drive.car, { p:v3(0,localY,C.CAR_Z), v:v3(), heading:localHeading, pitch:0, roll:0, yawVelocity:0, pitchVelocity:0, rollVelocity:0, onGround:true, surfaceAxis:null, bodyResting:false, usedSecondJump:false, usedDodge:false, hasJumped:false });
    state.bot.car = { p:v3(0,remoteY,C.CAR_Z), v:v3(), heading:remoteHeading, pitch:0, roll:0, yawVelocity:0, pitchVelocity:0, rollVelocity:0, onGround:true, wheelContacts:4, bodyResting:false };
    clearDriveInputSources();
    state.drive.controllerAccel = 0;
    state.drive.controllerReverse = 0;
    state.drive.started = true;
    state.drive.paused = true;
    state.drive.lastTime = 0;
  }

  function startPvpKickoff(startAt = Date.now() + 4000, serial = Date.now()) {
    if (!state.pvp.active) return;
    state.pvp.kickoffSerial = serial;
    state.pvp.countdownStart = startAt - 4000;
    state.pvp.countdownEnd = startAt;
    resetPvpKickoffPositions();
    if (state.pvp.role === 'host') pvpSend('kickoff', { startAt, serial, score:{...state.score} });
    setPvpStatus('KICKOFF');
    updatePvpCountdown();
  }

  function updatePvpCountdown() {
    if (!state.pvp.active || !state.pvp.countdownEnd) return;
    const remaining = state.pvp.countdownEnd - Date.now();
    if (remaining <= 0) {
      state.pvp.countdownEnd = 0;
      state.drive.paused = false;
      state.drive.lastTime = 0;
      setPvpStatus('GO!', 'go');
      window.setTimeout(() => { if (state.pvp.active && !state.pvp.countdownEnd) setPvpStatus(state.pvp.connected ? `${state.pvp.team.toUpperCase()} TEAM` : 'WAITING'); }, 850);
      return;
    }
    state.drive.paused = true;
    clearDriveInputSources();
    state.drive.controllerAccel = 0;
    state.drive.controllerReverse = 0;
    const count = Math.max(1, Math.ceil(remaining / 1000));
    setPvpStatus(String(count), 'countdown');
  }

  function handlePvpBroadcast(event, payload) {
    if (!state.pvp.active || payload?.sender === state.pvp.clientId) return;
    if (event === 'car-state') hydrateRemoteCar(payload.car);
    else if (event === 'ball-state' && state.pvp.role !== 'host' && payload.ball) {
      state.drive.ball.p = v3(payload.ball.p.x,payload.ball.p.y,payload.ball.p.z);
      state.drive.ball.v = v3(payload.ball.v.x,payload.ball.v.y,payload.ball.v.z);
      state.drive.ball.w = v3(payload.ball.w.x,payload.ball.w.y,payload.ball.w.z);
    } else if (event === 'kickoff') {
      if (payload.score) { state.score = {...payload.score}; updateScoreboard(); }
      startPvpKickoff(payload.startAt, payload.serial);
    } else if (event === 'goal') {
      state.score = {...payload.score};
      state.score[payload.scoredBy] = Math.max(0, state.score[payload.scoredBy] - 1);
      showGoalCelebration(payload.scoredBy, payload.enteredGoal, performance.now());
    }
  }

  function assignPvpRoles() {
    if (!state.pvp.channel) return;
    const presence = state.pvp.channel.presenceState();
    const players = Object.values(presence).flat().filter(p => p?.clientId).sort((a,b) => (a.joinedAt-b.joinedAt) || a.clientId.localeCompare(b.clientId));
    const mine = players.findIndex(p => p.clientId === state.pvp.clientId);
    if (mine < 0) return;
    if (mine > 1) { setPvpStatus('LOBBY FULL', 'error'); disconnectPvp(false); return; }
    const previousRole = state.pvp.role;
    state.pvp.role = mine === 0 ? 'host' : 'joiner';
    state.pvp.team = mine === 0 ? 'blue' : 'orange';
    state.pvp.opponentId = players.find(p => p.clientId !== state.pvp.clientId)?.clientId || null;
    state.pvp.connected = true;
    updateDriveUI();
    if (players.length < 2) {
      state.drive.paused = true;
      setPvpStatus(`${state.pvp.team.toUpperCase()} · WAITING FOR RIVAL`);
    } else {
      setPvpStatus(`${state.pvp.team.toUpperCase()} · CONNECTED`, 'go');
      if (state.pvp.role === 'host' && (previousRole !== 'host' || !state.pvp.countdownEnd)) startPvpKickoff(Date.now() + 4000);
    }
  }

  let supabaseLoadPromise = null;

  function ensureSupabaseLoaded() {
    if (window.supabase?.createClient) return Promise.resolve(true);
    if (supabaseLoadPromise) return supabaseLoadPromise;
    const sources = [
      'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
      'https://unpkg.com/@supabase/supabase-js@2'
    ];
    supabaseLoadPromise = new Promise(resolve => {
      let index = 0;
      const tryNext = () => {
        if (window.supabase?.createClient) { resolve(true); return; }
        if (index >= sources.length) { resolve(false); return; }
        const script = document.createElement('script');
        script.src = sources[index++];
        script.async = true;
        script.onload = () => resolve(!!window.supabase?.createClient);
        script.onerror = tryNext;
        document.head.appendChild(script);
      };
      tryNext();
    });
    return supabaseLoadPromise;
  }

  async function connectPvp() {
    if (state.pvp.active || state.pvp.connecting) return;
    setPvpStatus('LOADING NETWORK…');
    const supabaseReady = await ensureSupabaseLoaded();
    if (!supabaseReady) { setPvpStatus('SUPABASE FAILED TO LOAD', 'error'); return; }
    state.pvp.connecting = true;
    state.pvp.active = true;
    state.pvp.clientId = (crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`);
    state.pvp.joinedAt = Date.now();
    state.score = {blue:0, orange:0}; updateScoreboard();
    state.bot.difficultyIndex = 0; updateBotDifficultyUI();
    enterDriveMode();
    resetPvpKickoffPositions();
    setPvpStatus('CONNECTING…');
    updateDriveUI();
    try {
      state.pvp.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}, realtime:{params:{eventsPerSecond:30}} });
      const channel = state.pvp.client.channel(PVP_CHANNEL, { config:{ broadcast:{self:false}, presence:{key:state.pvp.clientId} } });
      state.pvp.channel = channel;
      for (const event of ['car-state','ball-state','kickoff','goal']) channel.on('broadcast', {event}, ({payload}) => handlePvpBroadcast(event,payload));
      channel.on('presence', {event:'sync'}, assignPvpRoles);
      channel.on('presence', {event:'join'}, assignPvpRoles);
      channel.on('presence', {event:'leave'}, assignPvpRoles);
      channel.subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          state.pvp.connecting = false;
          await channel.track({ clientId:state.pvp.clientId, joinedAt:state.pvp.joinedAt });
          assignPvpRoles(); updateDriveUI();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          state.pvp.connecting = false; setPvpStatus('CONNECTION FAILED', 'error'); updateDriveUI();
        }
      });
    } catch (error) {
      console.error('PVP connection failed', error);
      state.pvp.connecting = false; setPvpStatus('CONNECTION FAILED', 'error'); updateDriveUI();
    }
  }

  async function disconnectPvp(exitDrive = true) {
    const channel = state.pvp.channel;
    state.pvp.active = false; state.pvp.connecting = false; state.pvp.connected = false; state.pvp.channel = null; state.pvp.role = null; state.pvp.team = null; state.pvp.opponentId = null; state.pvp.countdownEnd = 0; state.pvp.remoteTarget = null; state.pvp.remoteHitCooldown = 0;
    try { if (channel) { await channel.untrack(); await channel.unsubscribe(); } } catch (_) {}
    state.bot.car = null;
    setPvpStatus('');
    if (exitDrive && state.drive.active) exitDriveMode(); else updateDriveUI();
  }

  function updatePvpNetwork(now) {
    updatePvpCountdown();
    updateRemoteCarSmoothing(now);
    if (!state.pvp.connected || !state.drive.car) return;
    if (now - state.pvp.lastStateSend >= 33) {
      state.pvp.lastStateSend = now;
      pvpSend('car-state', { car:serializeCar(state.drive.car) });
    }
    if (state.pvp.role === 'host' && state.drive.ball && now - state.pvp.lastBallSend >= 33) {
      state.pvp.lastBallSend = now;
      pvpSend('ball-state', { ball:{p:{...state.drive.ball.p},v:{...state.drive.ball.v},w:{...state.drive.ball.w}} });
    }
  }

  function enterDriveMode() { if (!state.shot) return; state.optimumMode = false; updateOptimumUI(); state.drive.active = true; state.playing = false; state.viewMode = 'car'; setActiveTab('car'); resetDriveSession(); updateDriveUI(); resizeCanvases(); setTimeout(resizeCanvases, 80); drawAll(); }
  function exitDriveMode(resumePlayback = true) { $('stageWrap')?.classList.remove('supersonic'); setControllerUiHidden(false); state.drive.active = false; state.drive.started = false; clearDriveInputSources(); state.drive.powerslideAmount = 0; state.drive.justJump = false; state.drive.steerX = 0; state.drive.steerY = 0; state.drive.joyPointer = null; state.drive.lastTime = 0; releaseFloatingJoystick(); updateDriveUI(); resizeCanvases(); setTimeout(resizeCanvases, 80); if (resumePlayback) startPlayback(state.revealed ? 'compare' : 'preview', false); drawAll(); }
  function startDriveIfNeeded() { if (state.drive.active && !state.drive.started) { state.drive.started = true; state.drive.paused = false; state.drive.lastTime = 0; updateDriveUI(); } }

  function rotateAroundAxis(vec, axis, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return add(add(mul(vec, c), mul(cross(axis, vec), s)), mul(axis, dot(axis, vec) * (1 - c)));
  }

  function surfaceFrame(car) {
    const offset = 74;
    const radius = Math.max(120, C.RAMP_R - offset);
    const arcLength = radius * Math.PI / 2;
    const s = Math.max(0, car.surfaceS || 0);
    const theta = Math.min(Math.PI / 2, s / radius);
    let outward;
    let lateral;

    if (car.surfaceAxis === 'corner') {
      const phi = clamp(car.surfaceCornerPhi || 0, 0, Math.PI / 2);
      const sx = car.surfaceCornerSX || 1;
      const sy = car.surfaceCornerSY || 1;
      outward = norm(v3(sx * Math.cos(phi), sy * Math.sin(phi), 0));
      lateral = norm(v3(-sx * Math.sin(phi), sy * Math.cos(phi), 0));
    } else if (car.surfaceAxis === 'x') {
      const sign = car.surfaceSign || 1;
      outward = v3(sign, 0, 0);
      lateral = v3(0, 1, 0);
    } else {
      const sign = car.surfaceSign || 1;
      outward = v3(0, sign, 0);
      lateral = v3(1, 0, 0);
    }

    const climb = theta < Math.PI / 2
      ? norm(add(mul(outward, Math.cos(theta)), v3(0, 0, Math.sin(theta))))
      : v3(0, 0, 1);
    const normal = theta < Math.PI / 2
      ? norm(add(mul(outward, -Math.sin(theta)), v3(0, 0, Math.cos(theta))))
      : mul(outward, -1);
    return { radius, arcLength, theta, climb, lateral, normal, outward };
  }

  function placeCarOnSurface(car) {
    if (!car.surfaceAxis) return;
    const offset = 74;
    const floorStartX = C.SIDE_X - C.RAMP_R;
    const floorStartY = C.BACK_Y - C.RAMP_R;
    const wallX = C.SIDE_X - offset;
    const wallY = C.BACK_Y - offset;
    const frame = surfaceFrame(car);
    const s = Math.max(0, car.surfaceS);

    if (car.surfaceAxis === 'corner') {
      const phi = clamp(car.surfaceCornerPhi || 0, 0, Math.PI / 2);
      const sx = car.surfaceCornerSX || 1;
      const sy = car.surfaceCornerSY || 1;
      const cx = C.SIDE_X - C.CORNER_R;
      const cy = C.BACK_Y - C.CORNER_R;
      const radial = Math.max(120, C.CORNER_R - C.RAMP_R + Math.sin(frame.theta) * frame.radius);
      car.p.x = sx * (cx + Math.cos(phi) * radial);
      car.p.y = sy * (cy + Math.sin(phi) * radial);
      car.p.z = s <= frame.arcLength
        ? C.CAR_Z + (1 - Math.cos(frame.theta)) * frame.radius
        : C.CAR_Z + frame.radius + (s - frame.arcLength);
    } else if (car.surfaceAxis === 'x') {
      if (s <= frame.arcLength) {
        car.p.x = car.surfaceSign * (floorStartX + Math.sin(frame.theta) * frame.radius);
        car.p.z = C.CAR_Z + (1 - Math.cos(frame.theta)) * frame.radius;
      } else {
        car.p.x = car.surfaceSign * wallX;
        car.p.z = C.CAR_Z + frame.radius + (s - frame.arcLength);
      }
      car.p.y = car.surfaceLateral;
    } else {
      if (s <= frame.arcLength) {
        car.p.y = car.surfaceSign * (floorStartY + Math.sin(frame.theta) * frame.radius);
        car.p.z = C.CAR_Z + (1 - Math.cos(frame.theta)) * frame.radius;
      } else {
        car.p.y = car.surfaceSign * wallY;
        car.p.z = C.CAR_Z + frame.radius + (s - frame.arcLength);
      }
      car.p.x = car.surfaceLateral;
    }

    const forward = norm(add(mul(frame.climb, Math.cos(car.surfaceAngle)), mul(frame.lateral, Math.sin(car.surfaceAngle))));
    car.surfaceForward = forward;
    car.surfaceUp = frame.normal;
    car.v = mul(forward, car.surfaceSpeed);
    car.pitch = Math.asin(clamp(forward.z, -1, 1));
    car.heading = Math.atan2(forward.y, forward.x);
    car.onGround = true;
  }

  function enterSurfaceIfNeeded(car) {
    if (car.surfaceAxis || !car.onGround) return;
    const offset = 74;
    const radius = Math.max(120, C.RAMP_R - offset);
    const floorStartX = C.SIDE_X - C.RAMP_R;
    const floorStartY = C.BACK_Y - C.RAMP_R;
    const ax = Math.abs(car.p.x);
    const ay = Math.abs(car.p.y);
    const sx = Math.sign(car.p.x) || 1;
    const sy = Math.sign(car.p.y) || 1;
    const fwd = norm(v3(Math.cos(car.heading), Math.sin(car.heading), 0));
    const cornerCX = C.SIDE_X - C.CORNER_R;
    const cornerCY = C.BACK_Y - C.CORNER_R;

    // Rounded corner floor-to-wall ramp. This must be checked before straight walls.
    if (ax > cornerCX && ay > cornerCY) {
      const lx = ax - cornerCX;
      const ly = ay - cornerCY;
      const radial = Math.hypot(lx, ly);
      const floorCornerR = C.CORNER_R - C.RAMP_R;
      if (radial >= floorCornerR) {
        const u = clamp((radial - floorCornerR) / radius, 0, 1);
        const phi = clamp(Math.atan2(ly, lx), 0, Math.PI / 2);
        car.surfaceAxis = 'corner';
        car.surfaceCornerSX = sx;
        car.surfaceCornerSY = sy;
        car.surfaceCornerPhi = phi;
        car.surfaceS = Math.asin(u) * radius;
        const frame = surfaceFrame(car);
        car.surfaceAngle = Math.atan2(dot(fwd, frame.lateral), dot(fwd, frame.climb));
        car.surfaceSpeed = dot(car.v, fwd);
        placeCarOnSurface(car);
        return;
      }
    }

    if (ay <= cornerCY && ax >= floorStartX) {
      const u = clamp((ax - floorStartX) / radius, 0, 1);
      car.surfaceAxis = 'x';
      car.surfaceSign = sx;
      car.surfaceS = Math.asin(u) * radius;
      car.surfaceLateral = car.p.y;
      const climb = v3(sx, 0, 0);
      const lateral = v3(0, 1, 0);
      car.surfaceAngle = Math.atan2(dot(fwd, lateral), dot(fwd, climb));
      car.surfaceSpeed = dot(car.v, fwd);
      placeCarOnSurface(car);
      return;
    }
    const carInGoalMouth = insideGoalMouth(car.p, 74);
    if (ax <= cornerCX && ay >= floorStartY && !carInGoalMouth) {
      const u = clamp((ay - floorStartY) / radius, 0, 1);
      car.surfaceAxis = 'y';
      car.surfaceSign = sy;
      car.surfaceS = Math.asin(u) * radius;
      car.surfaceLateral = car.p.x;
      const climb = v3(0, sy, 0);
      const lateral = v3(1, 0, 0);
      car.surfaceAngle = Math.atan2(dot(fwd, lateral), dot(fwd, climb));
      car.surfaceSpeed = dot(car.v, fwd);
      placeCarOnSurface(car);
    }
  }

  function leaveSurfaceToFloor(car) {
    const frame = surfaceFrame(car);
    const forward = norm(add(mul(frame.climb, Math.cos(car.surfaceAngle)), mul(frame.lateral, Math.sin(car.surfaceAngle))));
    const speed = car.surfaceSpeed;
    car.surfaceAxis = null;
    car.surfaceSign = 0;
    car.surfaceS = 0;
    car.surfaceCornerPhi = 0;
    car.surfaceForward = null;
    car.surfaceUp = v3(0, 0, 1);
    car.pitch = 0;
    car.heading = Math.atan2(forward.y, forward.x);
    car.v = v3(forward.x * speed, forward.y * speed, 0);
    car.p.z = C.CAR_Z;
    car.onGround = true;
  }

  function transitionSurfaceCorners(car) {
    const cornerStartY = C.BACK_Y - C.CORNER_R;
    const cornerStartX = C.SIDE_X - C.CORNER_R;
    const lateralMotion = car.surfaceSpeed * Math.sin(car.surfaceAngle);

    if (car.surfaceAxis === 'x') {
      const sy = Math.sign(car.surfaceLateral) || Math.sign(lateralMotion) || 1;
      if (Math.abs(car.surfaceLateral) >= cornerStartY && Math.sign(lateralMotion) === sy) {
        const sx = car.surfaceSign || 1;
        const climbPart = Math.cos(car.surfaceAngle);
        const sidePart = Math.abs(Math.sin(car.surfaceAngle));
        car.surfaceAxis = 'corner';
        car.surfaceCornerSX = sx;
        car.surfaceCornerSY = sy;
        car.surfaceCornerPhi = 0;
        car.surfaceAngle = Math.atan2(sidePart, climbPart);
      }
    } else if (car.surfaceAxis === 'y') {
      const sx = Math.sign(car.surfaceLateral) || Math.sign(lateralMotion) || 1;
      if (Math.abs(car.surfaceLateral) >= cornerStartX && Math.sign(lateralMotion) === sx) {
        const sy = car.surfaceSign || 1;
        const climbPart = Math.cos(car.surfaceAngle);
        const sidePart = Math.abs(Math.sin(car.surfaceAngle));
        car.surfaceAxis = 'corner';
        car.surfaceCornerSX = sx;
        car.surfaceCornerSY = sy;
        car.surfaceCornerPhi = Math.PI / 2;
        car.surfaceAngle = Math.atan2(-sidePart, climbPart);
      }
    } else if (car.surfaceAxis === 'corner') {
      if (car.surfaceCornerPhi <= 0 && lateralMotion < 0) {
        const sx = car.surfaceCornerSX || 1;
        const sy = car.surfaceCornerSY || 1;
        const climbPart = Math.cos(car.surfaceAngle);
        const sidePart = Math.abs(Math.sin(car.surfaceAngle));
        car.surfaceAxis = 'x';
        car.surfaceSign = sx;
        car.surfaceLateral = sy * cornerStartY;
        car.surfaceAngle = Math.atan2(-sy * sidePart, climbPart);
      } else if (car.surfaceCornerPhi >= Math.PI / 2 && lateralMotion > 0) {
        const sx = car.surfaceCornerSX || 1;
        const sy = car.surfaceCornerSY || 1;
        const climbPart = Math.cos(car.surfaceAngle);
        const sidePart = Math.abs(Math.sin(car.surfaceAngle));
        car.surfaceAxis = 'y';
        car.surfaceSign = sy;
        car.surfaceLateral = sx * cornerStartX;
        car.surfaceAngle = Math.atan2(-sx * sidePart, climbPart);
      }
    }
  }

  function advanceSurfaceLateral(car, distance) {
    if (car.surfaceAxis === 'corner') {
      const offset = 74;
      const cornerRadius = Math.max(120, C.CORNER_R - offset);
      car.surfaceCornerPhi += distance / cornerRadius;
    } else {
      car.surfaceLateral += distance;
    }
    transitionSurfaceCorners(car);
  }

  function bounceDriveCarOffNormal(car, normal, restitution = DRIVE_PHYS.carWorldRestitution) {
    const vn = dot(car.v, normal);
    if (vn >= 0) return;
    const impact = -vn;
    car.v = sub(car.v, mul(normal, (1 + restitution) * vn));
    const frame = driveCarFrame(car);
    car.pitchVelocity += dot(frame.forward, normal) * impact * 0.012;
    car.rollVelocity += -dot(frame.right, normal) * impact * 0.012;
    car.onGround = false;
    car.wheelContacts = 0;
    clearBodyRestState(car);
  }

  function constrainDriveCarToArena(car, step) {
    if (car.surfaceAxis) {
      transitionSurfaceCorners(car);
      placeCarOnSurface(car);
      return;
    }
    enterSurfaceIfNeeded(car);
    if (car.surfaceAxis) return;

    const offset = 74;
    const ayGoal = Math.abs(car.p.y);
    if (ayGoal >= C.BACK_Y - 24 && Math.abs(car.p.x) <= C.GOAL_HALF_W + offset && car.p.z <= C.GOAL_H + offset) {
      const syGoal = Math.sign(car.p.y) || 1;
      const sideLimit = C.GOAL_HALF_W - offset;
      const backLimit = C.BACK_Y + C.GOAL_DEPTH - offset;
      if (Math.abs(car.p.x) > sideLimit) {
        const sx = Math.sign(car.p.x || 1);
        car.p.x = sx * sideLimit;
        bounceDriveCarOffNormal(car, v3(-sx, 0, 0));
      }
      if (ayGoal > backLimit) {
        car.p.y = syGoal * backLimit;
        bounceDriveCarOffNormal(car, v3(0, -syGoal, 0));
      }
      if (car.p.z > C.GOAL_H - offset) {
        car.p.z = C.GOAL_H - offset;
        bounceDriveCarOffNormal(car, v3(0, 0, -1));
      }
      return;
    }

    if (car.p.z > C.CEILING_Z - offset) {
      car.p.z = C.CEILING_Z - offset;
      bounceDriveCarOffNormal(car, v3(0, 0, -1));
    }

    const ax = Math.abs(car.p.x);
    const ay = Math.abs(car.p.y);
    const sx = Math.sign(car.p.x) || 1;
    const sy = Math.sign(car.p.y) || 1;
    const cornerCenterX = C.SIDE_X - C.CORNER_R;
    const cornerCenterY = C.BACK_Y - C.CORNER_R;
    const cornerR = Math.max(120, C.CORNER_R - offset);
    const inCorner = ax > cornerCenterX && ay > cornerCenterY;

    if (inCorner) {
      const dx = ax - cornerCenterX;
      const dy = ay - cornerCenterY;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance > cornerR) {
        car.p.x = sx * (cornerCenterX + dx / distance * cornerR);
        car.p.y = sy * (cornerCenterY + dy / distance * cornerR);
        bounceDriveCarOffNormal(car, v3(-sx * dx / distance, -sy * dy / distance, 0));
      }
      return;
    }

    const sideLimit = C.SIDE_X - offset;
    if (ax > sideLimit) {
      car.p.x = sx * sideLimit;
      bounceDriveCarOffNormal(car, v3(-sx, 0, 0));
    }
    const backLimit = C.BACK_Y - offset;
    const goalOpening = Math.abs(car.p.x) <= C.GOAL_HALF_W + C.CAR_HALF_W && car.p.z <= C.GOAL_H + C.CAR_HALF_H;
    if (ay > backLimit && !goalOpening) {
      car.p.y = sy * backLimit;
      bounceDriveCarOffNormal(car, v3(0, -sy, 0));
    }
  }

  function throttleAcceleration(speedAbs) {
    const s = clamp(speedAbs, 0, DRIVE_PHYS.throttleSpeed);
    if (s >= DRIVE_PHYS.throttleSpeed) return 0;
    if (s < 500) return 1600 - 0.9 * s;
    if (s < 1000) return 1150 - 1.0 * (s - 500);
    return Math.max(0, 650 - 1.58 * (s - 1000));
  }

  function groundCurvature(speedAbs) {
    const s = clamp(speedAbs, 0, 2500);
    if (s < 500) return 0.006900 - 0.00000584 * s;
    if (s < 1000) return 0.005610 - 0.00000326 * s;
    if (s < 1500) return 0.004300 - 0.00000195 * s;
    if (s < 1750) return 0.003025 - 0.00000110 * s;
    return Math.max(0, 0.001800 - 0.00000040 * s);
  }

  function clampAngularVelocity(car) {
    const magnitude = Math.hypot(car.pitchVelocity, car.yawVelocity, car.rollVelocity || 0);
    if (magnitude > DRIVE_PHYS.maxAngularSpeed) {
      const ratio = DRIVE_PHYS.maxAngularSpeed / magnitude;
      car.pitchVelocity *= ratio;
      car.yawVelocity *= ratio;
      car.rollVelocity = (car.rollVelocity || 0) * ratio;
    }
  }

  function signedAngleAroundAxis(from, to, axis) {
    const a = norm(sub(from, mul(axis, dot(from, axis))));
    const b = norm(sub(to, mul(axis, dot(to, axis))));
    return Math.atan2(dot(cross(a, b), axis), clamp(dot(a, b), -1, 1));
  }

  function detachCarFromSurface(car, normalImpulse = 0) {
    if (!car.surfaceAxis) return;
    placeCarOnSurface(car);
    const frame = driveCarFrame(car);
    const speed = Number.isFinite(car.surfaceSpeed) ? car.surfaceSpeed : dot(car.v, frame.forward);
    const preservedUp = frame.up;
    const preservedForward = frame.forward;
    car.v = add(mul(preservedForward, speed), mul(preservedUp, normalImpulse));
    car.heading = Math.atan2(preservedForward.y, preservedForward.x);
    car.pitch = Math.asin(clamp(preservedForward.z, -1, 1));
    const flatRight = norm(v3(-Math.sin(car.heading), Math.cos(car.heading), 0));
    let baseUp = norm(cross(preservedForward, flatRight));
    if (len(baseUp) < 0.1) baseUp = v3(0, 0, 1);
    car.roll = signedAngleAroundAxis(baseUp, preservedUp, preservedForward);
    car.surfaceAxis = null;
    car.surfaceSign = 0;
    car.surfaceForward = null;
    car.surfaceUp = null;
    car.onGround = false;
    car.wheelContacts = 0;
    clearBodyRestState(car);
    car.surfaceIdleTime = 0;
  }

  function surfaceSupportMissing(car) {
    if (car.surfaceAxis !== 'y') return false;
    const insideMouthWidth = Math.abs(car.p.x) <= C.GOAL_HALF_W + C.CAR_HALF_W * 0.35;
    const insideMouthHeight = car.p.z <= C.GOAL_H + C.CAR_HALF_H * 0.45;
    const atBackboard = Math.abs(car.p.y) >= C.BACK_Y - 120;
    return insideMouthWidth && insideMouthHeight && atBackboard;
  }

  function resetAirActionsOnLanding(car) {
    car.hasJumped = false;
    car.firstJumpActive = false;
    car.firstJumpEndAt = -Infinity;
    car.usedSecondJump = false;
    car.usedDodge = false;
    car.dodgeActive = false;
    car.dodgeTime = 0;
    car.dodgeCancelled = false;
    car.dodgeFollowThroughUntil = 0;
    car.pitchLockUntil = 0;
    car.jumpHoldTime = 0;
    car.stickyTicks = 0;
  }

  function beginFirstJump(car, surfaceUp = null) {
    const frame = driveCarFrame(car);
    const up = norm(surfaceUp || frame.up || v3(0, 0, 1));
    if (car.surfaceAxis) detachCarFromSurface(car, DRIVE_PHYS.jumpSpeed);
    else {
      car.v = add(car.v, mul(up, DRIVE_PHYS.jumpSpeed));
      car.onGround = false;
      car.wheelContacts = 0;
    }
    car.hasJumped = true;
    car.firstJumpActive = true;
    car.firstJumpEndAt = -Infinity;
    car.usedSecondJump = false;
    car.usedDodge = false;
    car.jumpHoldTime = 0;
    car.jumpSurfaceUp = up;
    car.stickyTicks = DRIVE_PHYS.jumpStickyTicks;
    clearBodyRestState(car);
    car.groundedTicks = 0;
  }

  function beginSelfRight(car) {
    car.selfRightTime = DRIVE_PHYS.selfRightDuration;
    car.v = add(car.v, v3(0, 0, DRIVE_PHYS.selfRightImpulse));
    clearBodyRestState(car);
    car.onGround = false;
    car.groundedTicks = 0;
  }

  function beginSecondJumpOrDodge(car) {
    if (!car.hasJumped || car.usedSecondJump || car.usedDodge) return false;
    const endAt = Number.isFinite(car.firstJumpEndAt) ? car.firstJumpEndAt : car.simTime;
    if (car.simTime - endAt > DRIVE_PHYS.secondJumpWindow) return false;
    const frame = driveCarFrame(car);
    let forwardInput = -clamp(state.drive.steerY, -1, 1);
    let sideInput = clamp(state.drive.steerX, -1, 1)
      + (state.drive.airRollLeft ? 1 : 0)
      - (state.drive.airRollRight ? 1 : 0);
    sideInput = clamp(sideInput, -1, 1);
    const inputMagnitude = Math.hypot(forwardInput, sideInput);
    if (inputMagnitude < DRIVE_PHYS.dodgeDeadzone) {
      car.v = add(car.v, mul(frame.up, DRIVE_PHYS.jumpSpeed));
      car.usedSecondJump = true;
      car.firstJumpActive = false;
      return true;
    }

    forwardInput /= inputMagnitude;
    sideInput /= inputMagnitude;
    let forwardFlat = norm2D(frame.forward);
    if (len2D(forwardFlat) < 0.1) forwardFlat = v3(Math.cos(car.heading), Math.sin(car.heading), 0);
    const leftFlat = norm(cross(v3(0, 0, 1), forwardFlat));
    const currentForwardSpeed = dot(car.v, forwardFlat);
    const speedRatio = clamp(Math.abs(currentForwardSpeed) / DRIVE_PHYS.maxSpeed, 0, 1);
    const sideScale = 1 + 0.9 * speedRatio;
    const backScale = forwardInput < 0 ? 1 + ((2.5 * 16 / 15) - 1) * speedRatio : 1;
    const rawImpulse = add(
      mul(forwardFlat, forwardInput * backScale),
      mul(leftFlat, sideInput * sideScale),
    );
    const impulseMagnitudeScale = clamp(len(rawImpulse), 0.65, 1.9);
    car.v = add(car.v, mul(norm(rawImpulse), DRIVE_PHYS.dodgeImpulse * impulseMagnitudeScale));
    car.usedDodge = true;
    car.firstJumpActive = false;
    car.dodgeActive = true;
    car.dodgeTime = 0;
    car.dodgeForward = forwardInput;
    car.dodgeSide = sideInput;
    car.dodgeCancelled = false;
    car.dodgeFollowThroughUntil = 0;
    car.pitchLockUntil = car.simTime + DRIVE_PHYS.dodgeDuration + DRIVE_PHYS.dodgePitchLockAfter;
    return true;
  }

  function updateJumpHold(car, step) {
    if (!car.firstJumpActive) return;
    const mustHoldMinimum = car.jumpHoldTime < DRIVE_PHYS.jumpHoldMin;
    const shouldApply = car.jumpHoldTime < DRIVE_PHYS.jumpHoldMax && (state.drive.jumpHeld || mustHoldMinimum);
    if (shouldApply) {
      const holdStep = Math.min(step, DRIVE_PHYS.jumpHoldMax - car.jumpHoldTime);
      const up = driveCarFrame(car).up;
      car.v = add(car.v, mul(up, DRIVE_PHYS.jumpHoldAccel * holdStep));
      car.jumpHoldTime += holdStep;
    }
    if (car.jumpHoldTime >= DRIVE_PHYS.jumpHoldMax || (!state.drive.jumpHeld && !mustHoldMinimum)) {
      car.firstJumpActive = false;
      car.firstJumpEndAt = car.simTime;
    }
  }

  function updateDodge(car, step) {
    if (!car.dodgeActive) return;
    car.dodgeTime += step;
    if (car.dodgeTime <= DRIVE_PHYS.dodgeDuration) {
      const cancelAmount = clamp(state.drive.steerY * Math.sign(car.dodgeForward || 1), 0, 1);
      if (cancelAmount > 0.20) car.dodgeCancelled = true;
      const pitchAccel = -car.dodgeForward * DRIVE_PHYS.dodgePitchTorque * DRIVE_PHYS.dodgeTorqueToAccel * (1 - cancelAmount);
      const rollAccel = -car.dodgeSide * DRIVE_PHYS.dodgeSideTorque * DRIVE_PHYS.dodgeTorqueToAccel;
      car.pitchVelocity += pitchAccel * step;
      car.rollVelocity += rollAccel * step;
      if (car.dodgeTime >= DRIVE_PHYS.dodgeVerticalDampStart && car.dodgeTime <= DRIVE_PHYS.dodgeVerticalDampEnd && car.v.z > 0) {
        car.v.z *= DRIVE_PHYS.dodgeVerticalDampPerTick;
      } else if (car.dodgeTime > DRIVE_PHYS.dodgeVerticalDampEnd && car.v.z < 0) {
        car.v.z *= 0.92;
      }
    } else {
      car.dodgeActive = false;
      car.dodgeFollowThroughUntil = car.simTime + DRIVE_PHYS.dodgeFollowThroughDuration;
    }
  }

  function updateSelfRight(car, step) {
    if (car.selfRightTime <= 0) return;
    car.selfRightTime = Math.max(0, car.selfRightTime - step);
    const rollError = angleWrap(-car.roll);
    const pitchError = angleWrap(-car.pitch);
    const torqueAccel = DRIVE_PHYS.selfRightTorque;
    car.rollVelocity += clamp(rollError * 1.8, -1, 1) * torqueAccel * step;
    car.pitchVelocity += clamp(pitchError * 1.8, -1, 1) * torqueAccel * step;
  }

  function clearBodyRestState(car) {
    car.bodyResting = false;
    car.bodyContactTime = 0;
    car.bodyRestFace = null;
    car.bodyStableTicks = 0;
  }

  function driveCarFloorSupportHeight(car, frame = driveCarFrame(car)) {
    // Lowest point of the oriented chassis plus the wheel plane. This keeps
    // side, roof, and nose contacts from being forced to the wheels-down height.
    const bodyExtent = Math.abs(frame.forward.z) * C.CAR_HALF_L
      + Math.abs(frame.right.z) * C.CAR_HALF_W
      + Math.abs(frame.up.z) * C.CAR_HALF_H;
    const wheelExtent = Math.abs(frame.forward.z) * C.CAR_HALF_L * 0.42
      + Math.abs(frame.right.z) * C.CAR_HALF_W * 0.82
      + frame.up.z * C.CAR_Z;
    return Math.max(8, bodyExtent, wheelExtent);
  }

  function chooseBodyRestTarget(car, frame) {
    // A rectangular chassis balanced on a lower edge is not equally likely to
    // fall onto either adjacent face. Because the car is much wider than it is
    // tall, gravity keeps tipping a 45-degree pose toward its wheels/roof; the
    // side only becomes the stable target when it is already close to flat.
    const roll = angleWrap(car.roll || 0);
    const rightSideDistance = Math.abs(angleWrap(-Math.PI / 2 - roll));
    const leftSideDistance = Math.abs(angleWrap(Math.PI / 2 - roll));
    const nearestSideDistance = Math.min(rightSideDistance, leftSideDistance);
    const alreadyOnSide = car.bodyRestFace === 'right-side' || car.bodyRestFace === 'left-side';
    const sideCapture = DRIVE_PHYS.bodySideRestCapture
      + (alreadyOnSide ? DRIVE_PHYS.bodySideRestHysteresis : 0);
    const genuinelySideways = nearestSideDistance <= sideCapture
      && Math.abs(frame.right.z) >= 0.72;

    if (genuinelySideways) {
      const rightSide = rightSideDistance <= leftSideDistance;
      return {
        face: rightSide ? 'right-side' : 'left-side',
        pitch: 0,
        roll: rightSide ? -Math.PI / 2 : Math.PI / 2,
      };
    }

    if (frame.up.z >= 0) return { face: 'wheels', pitch: 0, roll: 0 };
    const roofRoll = Math.abs(angleWrap(Math.PI - roll)) <= Math.abs(angleWrap(-Math.PI - roll)) ? Math.PI : -Math.PI;
    return { face: 'roof', pitch: 0, roll: roofRoll };
  }

  function settleBodyContact(car, frame, step) {
    const target = chooseBodyRestTarget(car, frame);
    if (!car.bodyRestFace || target.face !== car.bodyRestFace) {
      // Re-evaluate while the chassis is still balancing. v38 locked the first
      // face it saw, so a momentary edge contact could capture the car forever.
      car.bodyRestFace = target.face;
      car.bodyRestTargetPitch = target.pitch;
      car.bodyRestTargetRoll = target.roll;
      car.bodyStableTicks = 0;
    }

    const pitchError = angleWrap(car.bodyRestTargetPitch - car.pitch);
    const rollError = angleWrap(car.bodyRestTargetRoll - car.roll);
    car.pitchVelocity += pitchError * DRIVE_PHYS.bodySettleSpring * step;
    car.rollVelocity += rollError * DRIVE_PHYS.bodySettleSpring * step;
    const damping = Math.exp(-DRIVE_PHYS.bodySettleDamping * step);
    car.pitchVelocity *= damping;
    car.rollVelocity *= damping;
    car.yawVelocity *= Math.exp(-4.5 * step);
    clampAngularVelocity(car);

    car.v.x *= Math.exp(-DRIVE_PHYS.bodyRestLinearDamping * step);
    car.v.y *= Math.exp(-DRIVE_PHYS.bodyRestLinearDamping * step);

    const angularSpeed = Math.hypot(car.pitchVelocity, car.rollVelocity);
    const settled = Math.abs(pitchError) <= DRIVE_PHYS.bodySleepAngle
      && Math.abs(rollError) <= DRIVE_PHYS.bodySleepAngle
      && angularSpeed <= DRIVE_PHYS.bodySleepAngularSpeed;
    car.bodyStableTicks = settled ? (car.bodyStableTicks || 0) + 1 : 0;

    if (car.bodyStableTicks >= 4) {
      car.pitch = car.bodyRestTargetPitch;
      car.roll = angleWrap(car.bodyRestTargetRoll);
      car.pitchVelocity = 0;
      car.rollVelocity = 0;
      if (Math.abs(car.yawVelocity) < 0.08) car.yawVelocity = 0;
      if (Math.abs(car.v.x) < 2) car.v.x = 0;
      if (Math.abs(car.v.y) < 2) car.v.y = 0;
      if (car.bodyRestFace === 'wheels') {
        car.onGround = true;
        car.wheelContacts = 4;
        car.groundedTicks = (car.groundedTicks || 0) + 1;
        if (car.groundedTicks >= 3) resetAirActionsOnLanding(car);
      } else {
        car.onGround = false;
        car.wheelContacts = 0;
      }
    }
  }

  function updateSupersonic(car, step) {
    const speed = len(car.v);
    if (!car.supersonic) {
      if (speed >= DRIVE_PHYS.supersonicEnter) {
        car.supersonic = true;
        car.supersonicGrace = DRIVE_PHYS.supersonicGrace;
      }
    } else if (speed >= DRIVE_PHYS.supersonicEnter) {
      car.supersonicGrace = DRIVE_PHYS.supersonicGrace;
    } else if (speed >= DRIVE_PHYS.supersonicExit && car.supersonicGrace > 0) {
      car.supersonicGrace = Math.max(0, car.supersonicGrace - step);
    } else {
      car.supersonic = false;
      car.supersonicGrace = 0;
    }
    $('stageWrap')?.classList.toggle('supersonic', Boolean(car.supersonic));
  }

  function resolveDriveFloorContact(car, step) {
    if (car.surfaceAxis) {
      clearBodyRestState(car);
      return;
    }

    let frame = driveCarFrame(car);
    let supportHeight = driveCarFloorSupportHeight(car, frame);
    if (car.p.z > supportHeight + 0.35) {
      const supportGap = car.p.z - supportHeight;
      if ((car.bodyResting || car.onGround) && car.v.z <= 0.5) {
        // As a tilted chassis rotates toward a resting face its required center
        // height can shrink. Follow that support downward instead of treating
        // the geometric gap as a fresh airborne state or leaving the car floating.
        car.p.z = supportHeight;
      } else {
        if (car.v.z > 0.5 || (!car.bodyResting && supportGap > 2)) clearBodyRestState(car);
        if (car.v.z > 0.5) car.onGround = false;
        return;
      }
    }

    car.p.z = supportHeight;
    frame = driveCarFrame(car);
    const upDot = dot(frame.up, v3(0, 0, 1));
    const impactSpeed = Math.max(0, -car.v.z);
    const angularSpeed = Math.hypot(car.pitchVelocity, car.yawVelocity, car.rollVelocity || 0);

    if (upDot > 0.38) {
      car.wheelContacts = upDot > 0.76 ? 4 : 3;
      car.onGround = true;
      clearBodyRestState(car);
      car.groundedTicks = (car.groundedTicks || 0) + 1;
      const suspensionCompression = clamp(impactSpeed / 42, 0, DRIVE_PHYS.suspensionTravel);
      const suspensionReturn = suspensionCompression * DRIVE_PHYS.suspensionStiffness / C.CAR_MASS;
      car.v.z = impactSpeed > 190 ? Math.min(impactSpeed * 0.12, suspensionReturn) : 0;
      const settle = Math.min(1, DRIVE_PHYS.landingLevelRate * step);
      car.pitch += angleWrap(-car.pitch) * settle;
      car.roll += angleWrap(-car.roll) * settle;
      car.pitchVelocity *= Math.max(0, 1 - DRIVE_PHYS.suspensionCompressionDamping * 0.02 * step * 60);
      car.rollVelocity *= Math.max(0, 1 - DRIVE_PHYS.suspensionCompressionDamping * 0.02 * step * 60);
      car.yawVelocity *= 0.85;
      if (car.groundedTicks >= 3) resetAirActionsOnLanding(car);
      return;
    }

    car.wheelContacts = upDot > -0.15 ? 2 : 0;
    car.onGround = false;
    car.groundedTicks = 0;
    car.bodyContactTime = (car.bodyContactTime || 0) + step;

    const shouldBounce = impactSpeed > DRIVE_PHYS.bodyBounceThreshold
      && !(car.bodyResting && impactSpeed < DRIVE_PHYS.bodyBounceThreshold * 1.35);
    if (shouldBounce) {
      car.v.z = impactSpeed * DRIVE_PHYS.carWorldRestitution;
      car.v.x *= 1 - DRIVE_PHYS.carWorldFriction * 0.08;
      car.v.y *= 1 - DRIVE_PHYS.carWorldFriction * 0.08;
      car.pitchVelocity += -frame.forward.z * impactSpeed * 0.018;
      car.rollVelocity += frame.right.z * impactSpeed * 0.018;
      car.bodyResting = false;
      car.bodyRestFace = null;
      car.bodyStableTicks = 0;
      return;
    }

    car.v.z = 0;
    car.bodyResting = true;
    // A dodge should not continue injecting flip torque after the chassis has
    // become a sustained floor contact. The jump/dodge resource is preserved.
    if (car.bodyContactTime >= DRIVE_PHYS.bodySettleDelay) {
      car.dodgeActive = false;
      car.dodgeFollowThroughUntil = car.simTime;
      car.firstJumpActive = false;
      if (!Number.isFinite(car.firstJumpEndAt)) car.firstJumpEndAt = car.simTime;
    }

    if (car.bodyContactTime >= DRIVE_PHYS.bodySettleDelay
        && angularSpeed <= DRIVE_PHYS.bodySettleAngularLimit) {
      settleBodyContact(car, frame, step);
    } else {
      car.v.x *= Math.exp(-DRIVE_PHYS.carWorldFriction * 2.0 * step);
      car.v.y *= Math.exp(-DRIVE_PHYS.carWorldFriction * 2.0 * step);
      car.pitchVelocity *= Math.exp(-3.2 * step);
      car.rollVelocity *= Math.exp(-3.2 * step);
      car.yawVelocity *= Math.exp(-2.2 * step);
    }

    // Orientation changes alter which chassis point touches the floor. Keep the
    // center at the correct support height instead of pinning every pose to CAR_Z.
    supportHeight = driveCarFloorSupportHeight(car);
    car.p.z = Math.max(car.p.z, supportHeight);
  }

  function stepDrive(dt) {
    if (!state.drive.active || !state.drive.started || state.drive.paused || !state.drive.ball || !state.drive.car) return;
    let remaining = clamp(dt, 0, 0.08);
    while (remaining > 0) {
      const step = Math.min(C.TICK, remaining);
      remaining -= step;
      const car = state.drive.car;
      stepBoostTrail(step);
      car.simTime = (car.simTime || 0) + step;
      const jumpPressed = Boolean(state.drive.justJump);

      const targetSlide = state.drive.powerslide && car.onGround ? 1 : 0;
      const slideRate = targetSlide > car.powerslideAmount ? DRIVE_PHYS.powerslideEngageRate : DRIVE_PHYS.powerslideReleaseRate;
      const oldSlide = Number.isFinite(car.powerslideAmount) ? car.powerslideAmount : state.drive.powerslideAmount || 0;
      car.powerslideAmount = clamp(oldSlide + Math.sign(targetSlide - oldSlide) * slideRate * step, 0, 1);
      if (Math.abs(targetSlide - car.powerslideAmount) < slideRate * step) car.powerslideAmount = targetSlide;
      state.drive.powerslideAmount = car.powerslideAmount;

      const digitalThrottle = state.drive.accel === state.drive.reverse ? 0 : (state.drive.accel ? 1 : (state.drive.reverse ? -1 : 0));
      const analogThrottle = clamp((state.drive.controllerAccel || 0) - (state.drive.controllerReverse || 0), -1, 1);
      const dedicatedThrottle = Math.abs(analogThrottle) > Math.abs(digitalThrottle) ? analogThrottle : digitalThrottle;
      const throttleInput = state.drive.boost ? 1 : dedicatedThrottle;
      let integratedOnSurface = false;

      const currentFrame = driveCarFrame(car);
      const needsBodyRecovery = car.bodyResting && !car.onGround && currentFrame.up.z < 0.92;
      if (jumpPressed && needsBodyRecovery) {
        beginSelfRight(car);
      } else if (jumpPressed && car.surfaceAxis) {
        beginFirstJump(car, currentFrame.up);
      } else if (jumpPressed && car.onGround) {
        beginFirstJump(car, currentFrame.up);
      } else if (jumpPressed && !car.onGround && !car.surfaceAxis) {
        if (car.firstJumpActive) {
          car.firstJumpActive = false;
          car.firstJumpEndAt = car.simTime;
        }
        beginSecondJumpOrDodge(car);
      }

      if (car.onGround && car.surfaceAxis) {
        const frame = surfaceFrame(car);
        let speed = Number.isFinite(car.surfaceSpeed) ? car.surfaceSpeed : len(car.v);
        const steer = clamp(state.drive.steerX, -1, 1);
        const speedAbs = Math.abs(speed);
        const directionSign = Math.abs(speed) > 5 ? Math.sign(speed) : (throttleInput < 0 ? -1 : 1);
        const slideSteer = 1 + car.powerslideAmount * (DRIVE_PHYS.powerslideSteerMultiplier - 1);
        const turnRate = groundCurvature(speedAbs) * speedAbs * steer * directionSign * slideSteer;
        const surfaceForwardBeforeTurn = norm(add(mul(frame.climb, Math.cos(car.surfaceAngle)), mul(frame.lateral, Math.sin(car.surfaceAngle))));
        const positiveAngleTangent = norm(add(mul(frame.climb, -Math.sin(car.surfaceAngle)), mul(frame.lateral, Math.cos(car.surfaceAngle))));
        const localLeft = norm(cross(frame.normal, surfaceForwardBeforeTurn));
        const steeringHandedness = dot(positiveAngleTangent, localLeft) >= 0 ? 1 : -1;
        car.surfaceAngle += turnRate * steeringHandedness * step;

        if (Math.abs(throttleInput) < 0.04 && !state.drive.boost) {
          const loss = Math.min(Math.abs(speed), DRIVE_PHYS.coastDecel * step);
          speed -= Math.sign(speed) * loss;
        } else {
          const desiredSign = Math.sign(throttleInput) || 1;
          if (Math.abs(speed) > 5 && Math.sign(speed) !== desiredSign) {
            const brake = Math.min(Math.abs(speed), DRIVE_PHYS.brakeDecel * Math.abs(throttleInput) * step);
            speed -= Math.sign(speed) * brake;
          } else {
            speed += desiredSign * throttleAcceleration(Math.abs(speed)) * Math.abs(throttleInput) * step;
          }
        }
        if (state.drive.boost) speed += DRIVE_PHYS.boostAccelGround * step;
        if (car.powerslideAmount > 0.01) speed *= Math.pow(DRIVE_PHYS.powerslideSpeedRetention, car.powerslideAmount * step * 60);

        const forward = norm(add(mul(frame.climb, Math.cos(car.surfaceAngle)), mul(frame.lateral, Math.sin(car.surfaceAngle))));
        speed += dot(v3(0, 0, -C.GRAVITY), forward) * step;
        speed = clamp(speed, -DRIVE_PHYS.reverseMaxSpeed, DRIVE_PHYS.maxSpeed);
        car.surfaceSpeed = speed;
        car.surfaceS += speed * Math.cos(car.surfaceAngle) * step;
        advanceSurfaceLateral(car, speed * Math.sin(car.surfaceAngle) * step);

        if (car.surfaceS <= 0) {
          car.surfaceS = 0;
          placeCarOnSurface(car);
          leaveSurfaceToFloor(car);
        } else {
          placeCarOnSurface(car);
          car.wheelContacts = 4;
          const verticalWall = Math.abs(surfaceFrame(car).normal.z) < 0.18;
          const fullStick = Math.abs(throttleInput) > 0.04 || state.drive.boost || Math.abs(speed) > DRIVE_PHYS.surfaceFullStickSpeed;
          car.surfaceAdhesion = fullStick ? DRIVE_PHYS.surfaceAdhesionFull : DRIVE_PHYS.surfaceAdhesionBase;
          car.surfaceIdleTime = verticalWall && !fullStick ? (car.surfaceIdleTime || 0) + step : 0;
          if (surfaceSupportMissing(car)) {
            const oldSurfaceSpeed = car.surfaceSpeed;
            const oldSurfaceAngle = car.surfaceAngle;
            detachCarFromSurface(car, -32);
            car.pitchVelocity += -Math.sign(oldSurfaceSpeed || 1) * Math.cos(oldSurfaceAngle) * 0.85;
            car.rollVelocity += -Math.sign(oldSurfaceSpeed * Math.sin(oldSurfaceAngle) || 1) * 0.65;
            integratedOnSurface = true;
          } else if (verticalWall && car.surfaceIdleTime >= DRIVE_PHYS.wallDetachDelay) {
            detachCarFromSurface(car, 0);
            integratedOnSurface = true;
          } else {
            integratedOnSurface = true;
          }
        }
      } else if (car.onGround) {
        const fwd = v3(Math.cos(car.heading), Math.sin(car.heading), 0);
        const right = v3(-Math.sin(car.heading), Math.cos(car.heading), 0);
        let forwardSpeed = dot(car.v, fwd);
        let lateralSpeed = dot(car.v, right);
        const effectiveGrip = DRIVE_PHYS.lateralGrip * (1 - car.powerslideAmount) + DRIVE_PHYS.powerslideGrip * car.powerslideAmount;
        lateralSpeed *= Math.max(0, 1 - effectiveGrip * step);
        const steer = clamp(state.drive.steerX, -1, 1);
        const speedAbs = Math.abs(forwardSpeed);
        const directionSign = Math.abs(forwardSpeed) > 5 ? Math.sign(forwardSpeed) : (throttleInput < 0 ? -1 : 1);
        const slideSteer = 1 + car.powerslideAmount * (DRIVE_PHYS.powerslideSteerMultiplier - 1);
        car.heading += groundCurvature(speedAbs) * speedAbs * steer * directionSign * slideSteer * step;

        if (Math.abs(throttleInput) < 0.04 && !state.drive.boost) {
          const loss = Math.min(Math.abs(forwardSpeed), DRIVE_PHYS.coastDecel * step);
          forwardSpeed -= Math.sign(forwardSpeed) * loss;
        } else {
          const desiredSign = Math.sign(throttleInput) || 1;
          if (Math.abs(forwardSpeed) > 5 && Math.sign(forwardSpeed) !== desiredSign) {
            const brake = Math.min(Math.abs(forwardSpeed), DRIVE_PHYS.brakeDecel * Math.abs(throttleInput) * step);
            forwardSpeed -= Math.sign(forwardSpeed) * brake;
          } else {
            forwardSpeed += desiredSign * throttleAcceleration(Math.abs(forwardSpeed)) * Math.abs(throttleInput) * step;
          }
        }
        if (state.drive.boost) forwardSpeed += DRIVE_PHYS.boostAccelGround * step;
        forwardSpeed = clamp(forwardSpeed, -DRIVE_PHYS.reverseMaxSpeed, DRIVE_PHYS.maxSpeed);
        const newFwd = v3(Math.cos(car.heading), Math.sin(car.heading), 0);
        const newRight = v3(-Math.sin(car.heading), Math.cos(car.heading), 0);
        car.v.x = newFwd.x * forwardSpeed + newRight.x * lateralSpeed;
        car.v.y = newFwd.y * forwardSpeed + newRight.y * lateralSpeed;
      } else {
        updateJumpHold(car, step);
        updateDodge(car, step);
        updateSelfRight(car, step);

        const restingOnBody = Boolean(car.bodyResting && car.bodyContactTime >= DRIVE_PHYS.bodySettleDelay);
        const airControlScale = restingOnBody ? 0 : 1;
        const pitchAllowed = !car.dodgeActive && car.simTime >= (car.pitchLockUntil || 0);
        if (pitchAllowed) car.pitchVelocity += clamp(state.drive.steerY, -1, 1) * DRIVE_PHYS.pitchAccel * airControlScale * step;
        car.yawVelocity += clamp(state.drive.steerX, -1, 1) * DRIVE_PHYS.yawAccel * airControlScale * step;
        const rollInput = ((state.drive.airRollRight ? 1 : 0) - (state.drive.airRollLeft ? 1 : 0)) * airControlScale;
        car.rollVelocity += rollInput * DRIVE_PHYS.rollAccel * step;

        if (!car.dodgeActive) {
          const inDodgeFollowThrough = car.simTime < (car.dodgeFollowThroughUntil || 0);
          const preservePitch = inDodgeFollowThrough && Math.abs(car.dodgeForward || 0) > 0.08 && !car.dodgeCancelled;
          const preserveRoll = inDodgeFollowThrough && Math.abs(car.dodgeSide || 0) > 0.08;
          const pitchDamping = preservePitch
            ? Math.exp(-DRIVE_PHYS.dodgeFollowThroughDamping * step)
            : Math.max(0, 1 - DRIVE_PHYS.pitchDampingRaw * DRIVE_PHYS.angularDampingScale * step);
          const rollDamping = preserveRoll
            ? Math.exp(-DRIVE_PHYS.dodgeFollowThroughDamping * step)
            : Math.max(0, 1 - DRIVE_PHYS.rollDampingRaw * DRIVE_PHYS.angularDampingScale * step);
          car.pitchVelocity *= pitchDamping;
          car.yawVelocity *= Math.max(0, 1 - DRIVE_PHYS.yawDampingRaw * DRIVE_PHYS.angularDampingScale * step);
          if (Math.abs(rollInput) < 0.01) car.rollVelocity *= rollDamping;
        }
        clampAngularVelocity(car);
        car.pitch += car.pitchVelocity * step;
        car.heading += car.yawVelocity * step;
        car.roll = angleWrap((car.roll || 0) + car.rollVelocity * step);

        const frame = driveCarFrame(car);
        if (!restingOnBody && Math.abs(throttleInput) > 0.04) {
          const airAccel = throttleInput > 0 ? DRIVE_PHYS.airThrottleForward : DRIVE_PHYS.airThrottleReverse;
          car.v = add(car.v, mul(frame.forward, airAccel * throttleInput * step));
        }
        if (!restingOnBody && state.drive.boost) car.v = add(car.v, mul(frame.forward, DRIVE_PHYS.boostAccelAir * step));
        if (car.stickyTicks > 0) {
          car.v = add(car.v, mul(car.jumpSurfaceUp || v3(0,0,1), -DRIVE_PHYS.jumpStickyAccel * step));
          car.stickyTicks -= 1;
        }
        car.v.z -= C.GRAVITY * step;
      }

      state.drive.justJump = false;
      if (!integratedOnSurface) {
        const velocityMagnitude = len(car.v);
        if (velocityMagnitude > DRIVE_PHYS.maxSpeed) car.v = mul(car.v, DRIVE_PHYS.maxSpeed / velocityMagnitude);
        car.p.x += car.v.x * step;
        car.p.y += car.v.y * step;
        car.p.z += car.v.z * step;
        constrainDriveCarToArena(car, step);
      }

      resolveDriveFloorContact(car, step);
      updateSupersonic(car, step);
      stepBot(step);
      resolveDriveCarCollision();

      if (!state.goalCelebration.active) {
        stepBall(state.drive.ball);
        if (detectDriveGoal(performance.now())) break;
      }
      state.drive.hitCooldown = Math.max(0, state.drive.hitCooldown - step);
      const hit = state.goalCelebration.active
        ? { clearance: 1, normal: v3(0,0,1) }
        : sphereCarClearance(state.drive.ball.p, car.p, car.heading, car.pitch);
      if (hit.clearance <= 0 && state.drive.hitCooldown <= 0) {
        const carVelocityAtHit = car.surfaceAxis && car.surfaceForward
          ? mul(car.surfaceForward, car.surfaceSpeed || 0)
          : car.v;
        const rel = sub(state.drive.ball.v, carVelocityAtHit);
        const normalSpeed = dot(rel, hit.normal);
        if (normalSpeed < 0) {
          const invBallMass = 1 / C.MASS;
          const invCarMass = 1 / C.CAR_MASS;
          const impulseMagnitude = -(1 + 0.72) * normalSpeed / (invBallMass + invCarMass);
          const impulse = mul(hit.normal, impulseMagnitude);
          state.drive.ball.v = add(state.drive.ball.v, mul(impulse, invBallMass));
          const carDelta = mul(impulse, -invCarMass);
          if (car.surfaceAxis && car.surfaceForward) car.surfaceSpeed += dot(carDelta, car.surfaceForward);
          else car.v = add(car.v, carDelta);

          // Add Rocket League's characteristic gameplay impulse to the ball only.
          // This preserves the real gravity/hang-time curve; it corrects the launch
          // velocity produced by car touches, especially small upward pops.
          const carFrameAtHit = driveCarFrame(car);
          const relativeSpeed = len(sub(state.drive.ball.v, carVelocityAtHit));
          const psyonixNormal = psyonixBallHitNormal(state.drive.ball.p, car.p, carFrameAtHit.forward);
          const psyonixDeltaV = relativeSpeed * psyonixBallHitScale(relativeSpeed);
          state.drive.ball.v = add(state.drive.ball.v, mul(psyonixNormal, psyonixDeltaV));

          if (state.drive.boost) state.drive.ball.v = add(state.drive.ball.v, mul(carFrameAtHit.forward, 38));
        }
        const outSpeed = len(state.drive.ball.v);
        if (outSpeed > C.BALL_MAX_SPEED) state.drive.ball.v = mul(state.drive.ball.v, C.BALL_MAX_SPEED / outSpeed);
        state.drive.ball.p = add(state.drive.ball.p, mul(hit.normal, 4));
        state.drive.hitCooldown = 0.11;
      }

      // The host owns the ball simulation, so it must also resolve touches made
      // by the joiner's remotely synchronized car. Previously only the host's
      // local car was tested, which made the orange player pass through the ball.
      state.pvp.remoteHitCooldown = Math.max(0, (state.pvp.remoteHitCooldown || 0) - step);
      if (state.pvp.active && state.pvp.role === 'host' && state.bot.car && !state.goalCelebration.active) {
        const remote = state.bot.car;
        const remoteHit = sphereCarClearance(state.drive.ball.p, remote.p, remote.heading || 0, remote.pitch || 0);
        if (remoteHit.clearance <= 0 && state.pvp.remoteHitCooldown <= 0) {
          const remoteVelocity = remote.surfaceAxis && remote.surfaceForward
            ? mul(remote.surfaceForward, remote.surfaceSpeed || 0)
            : (remote.v || v3());
          const rel = sub(state.drive.ball.v, remoteVelocity);
          const normalSpeed = dot(rel, remoteHit.normal);
          if (normalSpeed < 0) {
            const invBallMass = 1 / C.MASS;
            const invCarMass = 1 / C.CAR_MASS;
            const impulseMagnitude = -(1 + 0.72) * normalSpeed / (invBallMass + invCarMass);
            const impulse = mul(remoteHit.normal, impulseMagnitude);
            state.drive.ball.v = add(state.drive.ball.v, mul(impulse, invBallMass));
            const remoteFrame = driveCarFrame(remote);
            const relativeSpeed = len(sub(state.drive.ball.v, remoteVelocity));
            const hitNormal = psyonixBallHitNormal(state.drive.ball.p, remote.p, remoteFrame.forward);
            state.drive.ball.v = add(state.drive.ball.v, mul(hitNormal, relativeSpeed * psyonixBallHitScale(relativeSpeed)));
          }
          const outSpeed = len(state.drive.ball.v);
          if (outSpeed > C.BALL_MAX_SPEED) state.drive.ball.v = mul(state.drive.ball.v, C.BALL_MAX_SPEED / outSpeed);
          state.drive.ball.p = add(state.drive.ball.p, mul(remoteHit.normal, 4));
          state.pvp.remoteHitCooldown = 0.11;
        }
      }
      emitBoostTrail(car, step);
    }
    const carSpeed = len(state.drive.car.v);
    $('speedText').textContent = Math.round(carSpeed);
    const pct = clamp(carSpeed / DRIVE_PHYS.maxSpeed, 0, 1);
    $('gaugeNeedle').style.transform = `rotate(${(-80 + pct * 160).toFixed(1)}deg)`;
    if (state.pvp.active) updatePvpNetwork(performance.now());
  }

  function updateViewModeUI() {
    const button = $('viewModeButton');
    if (!button) return;
    const car = state.viewMode === 'car';
    button.textContent = car ? 'Arena' : 'Car';
    button.classList.toggle('active', car);
    if (!state.drive.active) $('stageHelp').textContent = car
      ? 'Car view: drag to pan · release snaps behind the car'
      : 'Arena view: one finger orbits · two fingers zoom';
    if (!car) {
      state.carCam.yawOffset = 0;
      state.carCam.pitchOffset = 0;
      state.carCam.dragging = false;
    }
    drawAll();
  }

  $('playButton').addEventListener('click', togglePlayback);
  $('driveButton').addEventListener('click', () => { if (state.pvp.active) disconnectPvp(); else if (state.drive.active) exitDriveMode(); else enterDriveMode(); });
  $('pvpButton').addEventListener('click', () => { if (state.pvp.active || state.pvp.connecting) disconnectPvp(); else connectPvp(); });
  $('botDifficultyButton')?.addEventListener('click', cycleBotDifficulty);
  $('driveCameraButton').addEventListener('click', () => { state.drive.cameraMode = state.drive.cameraMode === 'ball' ? 'free' : 'ball'; state.drive.ballCamOrbit = null; state.drive.ballCamLastUpdate = 0; state.drive.ballCamTargetLift = 0; state.drive.ballCamPullback = 0; state.drive.ballCamHeightLift = 0; state.renderBasis = null; updateDriveUI(); drawAll(); });
  $('optimumButton').addEventListener('click', () => setOptimumMode(!state.optimumMode));
  $('viewModeButton').addEventListener('click', () => { state.viewMode = state.viewMode === 'car' ? 'arena' : 'car'; updateViewModeUI(); });
  $('newButton').addEventListener('click', newShot);
  $('lockButton').addEventListener('click', lockGuess);
  $('replayButton').addEventListener('click', () => { if (state.drive.active) { resetDriveSession(); updateDriveUI(); drawAll(); } else if (state.optimumMode) startPlayback('compare', true); else startPlayback(state.revealed ? 'compare' : 'preview'); });
  $('ballTabButton').addEventListener('click', () => setActiveTab('ball'));
  $('carTabButton').addEventListener('click', () => setActiveTab('car'));

  const settingsDialog = $('settingsDialog');
  $('settingsButton').addEventListener('click', () => {
    if (typeof settingsDialog.showModal === 'function') settingsDialog.showModal();
    else settingsDialog.setAttribute('open', '');
  });
  $('closeSettingsButton').addEventListener('click', () => settingsDialog.close());
  settingsDialog.addEventListener('click', (event) => {
    if (event.target === settingsDialog) settingsDialog.close();
  });

  for (const id of ['modeSelect', 'spinSelect', 'speedSelect']) $(id).addEventListener('change', newShot);
  $('playbackSelect').addEventListener('change', (event) => {
    state.playbackRate = Number(event.target.value);
    startPlayback(state.revealed ? 'compare' : 'preview');
  });
  $('carSpeedRange').addEventListener('input', (event) => {
    state.carGuessSpeed = Number(event.target.value);
    updateCarSpeedOutput();
    updatePathHint();
    if (state.revealed) refreshRevealedUI(false);
    else drawAll();
  });
  $('carDelayRange').addEventListener('input', (event) => {
    if (!state.revealed) return;
    state.carLaunchDelay = Number(event.target.value);
    updateCarDelayOutput();
    updatePathHint();
    updateCarResultUI(false);
  });
  $('carDelayRange').addEventListener('change', () => {
    if (!state.revealed) return;
    updateCarResultUI(true);
  });
  $('restitution').addEventListener('input', (event) => {
    state.restitution = Number(event.target.value);
    $('restOut').textContent = state.restitution.toFixed(2);
    newShot();
  });
  $('grip').addEventListener('input', (event) => {
    state.grip = Number(event.target.value);
    $('gripOut').textContent = state.grip.toFixed(2);
    newShot();
  });

  function bindDriveActionButton(id, fields, { jump = false } = {}) {
    const el = $(id);
    if (!el) return;
    const activePointers = new Map();
    const down = (event) => {
      event.preventDefault();
      event.stopPropagation();
      startDriveIfNeeded();
      const source = `${id}:${event.pointerId}`;
      activePointers.set(event.pointerId, source);
      try { el.setPointerCapture(event.pointerId); } catch (_) {}
      for (const field of fields) setDriveInputSource(field, source, true);
      if (jump) state.drive.justJump = true;
      setDriveButtonState(id, true);
    };
    const up = (event) => {
      if (event) { event.preventDefault(); event.stopPropagation(); }
      const source = activePointers.get(event?.pointerId);
      if (!source) return;
      activePointers.delete(event.pointerId);
      for (const field of fields) setDriveInputSource(field, source, false);
      setDriveButtonState(id, activePointers.size > 0);
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  function setAccelGestureMode(source, mode, triggerJump = false) {
    const branches = $('accelBranches');
    for (const field of ['boost', 'powerslide', 'jumpHeld']) setDriveInputSource(field, source, false);
    setDriveInputSource('accel', source, true);
    if (mode === 'left') setDriveInputSource('powerslide', source, true);
    if (mode === 'center') {
      setDriveInputSource('boost', source, true);
      setDriveInputSource('powerslide', source, true);
    }
    if (mode === 'right') setDriveInputSource('boost', source, true);
    if (mode === 'jump') {
      setDriveInputSource('jumpHeld', source, true);
      if (triggerJump) state.drive.justJump = true;
    }
    state.drive.accelBranch = mode;
    if (branches) branches.classList.add('visible');
    for (const branch of document.querySelectorAll('.accel-branch')) branch.classList.remove('selected');
    if (mode === 'left') document.querySelector('.branch-left')?.classList.add('selected');
    if (mode === 'center') document.querySelector('.branch-center')?.classList.add('selected');
    if (mode === 'right') document.querySelector('.branch-right')?.classList.add('selected');
  }

  function bindAccelerateGesture() {
    const el = $('accelerateButton');
    if (!el) return;
    const pointers = new Map();
    const pointInside = (rect, x, y, pad = 0) => !!rect
      && x >= rect.left - pad && x <= rect.right + pad
      && y >= rect.top - pad && y <= rect.bottom + pad;

    const update = (event, record) => {
      const dx = event.clientX - record.x;
      const dy = event.clientY - record.y;
      const jumpRect = $('jumpButton')?.getBoundingClientRect();
      const leftRect = document.querySelector('.accel-branch.branch-left')?.getBoundingClientRect();
      const centerRect = document.querySelector('.accel-branch.branch-center')?.getBoundingClientRect();
      const rightRect = document.querySelector('.accel-branch.branch-right')?.getBoundingClientRect();

      let mode = 'accel';
      // Live hit-testing follows the thumb across the visible fork buttons even
      // while Accelerate owns pointer capture.
      if (pointInside(leftRect, event.clientX, event.clientY, 5)) mode = 'left';
      else if (pointInside(rightRect, event.clientX, event.clientY, 5)) mode = 'right';
      else if (pointInside(centerRect, event.clientX, event.clientY, 5)) mode = 'center';
      else if (pointInside(jumpRect, event.clientX, event.clientY, 8) || dy > 34) mode = 'jump';
      else {
        // Forgiving fallback zones keep quick swipes reliable between frames.
        if (dx < -30 && Math.abs(dy) < 48) mode = 'left';
        else if (dx > 30 && Math.abs(dy) < 48) mode = 'right';
        else if (dy < -28 && Math.abs(dx) < 38) mode = 'center';
      }

      const enteringJump = mode === 'jump' && record.mode !== 'jump';
      if (mode === record.mode && mode !== 'jump') return;
      record.mode = mode;
      setAccelGestureMode(record.source, mode, enteringJump);
    };
    const down = (event) => {
      event.preventDefault();
      event.stopPropagation();
      startDriveIfNeeded();
      const source = `accelerateGesture:${event.pointerId}`;
      const record = { source, x: event.clientX, y: event.clientY, mode: 'accel' };
      pointers.set(event.pointerId, record);
      try { el.setPointerCapture(event.pointerId); } catch (_) {}
      setDriveButtonState('accelerateButton', true);
      setAccelGestureMode(source, 'accel');
    };
    const move = (event) => {
      const record = pointers.get(event.pointerId);
      if (!record) return;
      event.preventDefault();
      event.stopPropagation();
      update(event, record);
    };
    const up = (event) => {
      const record = pointers.get(event.pointerId);
      if (!record) return;
      event.preventDefault();
      event.stopPropagation();
      pointers.delete(event.pointerId);
      for (const field of ['accel', 'boost', 'powerslide', 'jumpHeld']) setDriveInputSource(field, record.source, false);
      setDriveButtonState('accelerateButton', pointers.size > 0);
      if (!pointers.size) {
        state.drive.accelBranch = 'accel';
        $('accelBranches')?.classList.remove('visible');
        for (const branch of document.querySelectorAll('.accel-branch.selected')) branch.classList.remove('selected');
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  bindAccelerateGesture();
  bindDriveActionButton('reverseButton', ['reverse']);
  bindDriveActionButton('boostButton', ['boost']);
  bindDriveActionButton('powerslideButton', ['powerslide']);
  bindDriveActionButton('airRollLeftButton', ['airRollLeft']);
  bindDriveActionButton('airRollRightButton', ['airRollRight']);
  bindDriveActionButton('jumpButton', ['jumpHeld'], { jump: true });

  const joyZone = $('joyZone');
  const stageWrap = $('stageWrap');
  let driveJoyOrigin = null;

  function releaseFloatingJoystick() {
    driveJoyOrigin = null;
    if (!joyZone) return;
    joyZone.classList.remove('floating');
    joyZone.style.removeProperty('--joy-x');
    joyZone.style.removeProperty('--joy-y');
  }

  function updateDriveStick(clientX, clientY) {
    if (!driveJoyOrigin) return;
    const dx = (clientX - driveJoyOrigin.x) / driveJoyOrigin.radius;
    const dy = (clientY - driveJoyOrigin.y) / driveJoyOrigin.radius;
    // Preserve the v35 steering sign: physical left is local-left in every arena frame.
    state.drive.steerX = applyStickDeadzone(clamp(-dx, -1, 1));
    state.drive.steerY = applyStickDeadzone(clamp(dy, -1, 1));
    positionJoyKnob();
  }

  function beginDriveStick(event, floating) {
    if (!state.drive.active || state.drive.joyPointer !== null) return false;
    event.preventDefault();
    event.stopPropagation();
    startDriveIfNeeded();
    const stageRect = stageWrap.getBoundingClientRect();
    if (floating) {
      const radius = Math.min(58, Math.max(44, Math.min(stageRect.width, stageRect.height) * 0.12));
      const safeX = clamp(event.clientX - stageRect.left, radius + 4, stageRect.width - radius - 4);
      const safeY = clamp(event.clientY - stageRect.top, radius + 4, stageRect.height - radius - 4);
      joyZone.classList.add('floating');
      joyZone.style.setProperty('--joy-x', `${safeX}px`);
      joyZone.style.setProperty('--joy-y', `${safeY}px`);
      driveJoyOrigin = { x: stageRect.left + safeX, y: stageRect.top + safeY, radius };
      try { stageWrap.setPointerCapture(event.pointerId); } catch (_) {}
    } else {
      releaseFloatingJoystick();
      const rect = joyZone.getBoundingClientRect();
      driveJoyOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: Math.min(rect.width, rect.height) * 0.42 };
      try { joyZone.setPointerCapture(event.pointerId); } catch (_) {}
    }
    state.drive.joyPointer = event.pointerId;
    updateDriveStick(event.clientX, event.clientY);
    return true;
  }

  function releaseDriveStick(event) {
    if (state.drive.joyPointer !== event.pointerId) return;
    event.preventDefault();
    state.drive.joyPointer = null;
    state.drive.steerX = 0;
    state.drive.steerY = 0;
    positionJoyKnob();
    releaseFloatingJoystick();
  }

  joyZone.addEventListener('pointerdown', (event) => beginDriveStick(event, false));

  stageWrap.addEventListener('pointerdown', (event) => {
    if (!state.drive.active || state.drive.joyPointer !== null) return;
    if (event.target.closest('button, input, select, dialog, .joy-zone, .drive-control-cluster, .stage-buttons')) return;
    const clusterRect = document.querySelector('.drive-control-cluster')?.getBoundingClientRect();
    if (clusterRect && event.clientX >= clusterRect.left - 4 && event.clientX <= clusterRect.right + 4 && event.clientY >= clusterRect.top - 4 && event.clientY <= clusterRect.bottom + 4) return;
    beginDriveStick(event, true);
  });
  stageWrap.addEventListener('pointermove', (event) => {
    if (state.drive.joyPointer !== event.pointerId) return;
    event.preventDefault();
    updateDriveStick(event.clientX, event.clientY);
  });
  stageWrap.addEventListener('pointerup', releaseDriveStick);
  stageWrap.addEventListener('pointercancel', releaseDriveStick);
  joyZone.addEventListener('pointerup', releaseDriveStick);
  joyZone.addEventListener('pointercancel', releaseDriveStick);


  document.addEventListener('contextmenu', (event) => {
    if (event.target.closest('button, canvas, .joy-zone, input[type="range"], .stage-wrap')) event.preventDefault();
  });
  document.addEventListener('selectstart', (event) => {
    if (event.target.closest('button, canvas, .joy-zone, input[type="range"], .stage-wrap')) event.preventDefault();
  });

  const resizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => resizeCanvases())
    : null;
  if (resizeObserver) {
    resizeObserver.observe($('stageWrap'));
    resizeObserver.observe(document.querySelector('.trainer-panel') || document.body);
  }
  window.addEventListener('resize', resizeCanvases);
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvases, 120));

  function loop(time) {
    let needsDraw = false;
    if (state.drive.active) {
      try {
        updateGoalCelebration(time);
        pollGamepad();
        if (state.pvp.active) updatePvpNetwork(time);
        if (!state.drive.lastTime) state.drive.lastTime = time;
        const dt = Math.min(0.1, Math.max(0, (time - state.drive.lastTime) / 1000));
        state.drive.lastTime = time;
        stepDrive(dt);
        drawAll(time);
      } catch (error) {
        console.error('Drive frame failed; recovering without stopping animation.', error);
        if (state.goalCelebration.active) {
          state.goalCelebration.active = false;
          state.goalCelebration.particles = [];
          state.goalCelebration.shockwave = 0;
          resetBallToMidfield();
          const overlay = $('goalCelebration');
          if (overlay) {
            overlay.hidden = true;
            overlay.classList.remove('blue-goal', 'orange-goal', 'celebrating');
          }
        }
        state.drive.lastTime = time;
      }
      requestAnimationFrame(loop);
      return;
    }
    if (state.viewMode === 'car' && !state.carCam.dragging) {
      const oldYaw = state.carCam.yawOffset;
      const oldPitch = state.carCam.pitchOffset;
      state.carCam.yawOffset *= 0.82;
      state.carCam.pitchOffset *= 0.82;
      if (Math.abs(state.carCam.yawOffset) < 0.002) state.carCam.yawOffset = 0;
      if (Math.abs(state.carCam.pitchOffset) < 0.002) state.carCam.pitchOffset = 0;
      needsDraw = needsDraw || Math.abs(oldYaw - state.carCam.yawOffset) > 0.0005 || Math.abs(oldPitch - state.carCam.pitchOffset) > 0.0005;
    }
    if (state.playing) { drawAll(time); needsDraw = false; }
    else if (needsDraw) drawAll(time);
    requestAnimationFrame(loop);
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  setCameraTouchMode(true);
  updateViewModeUI();
  updateDriveUI();
  updateOptimumUI();
  updateScoreboard();
  updateBotDifficultyUI();
  newShot();
  requestAnimationFrame(loop);
})();
