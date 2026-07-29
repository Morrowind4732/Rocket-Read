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
    CAR_HALF_L: 59,
    CAR_HALF_W: 42,
    CAR_HALF_H: 22,
    CAR_Z: 28,
    CAR_MAX_SPEED: 2300,
  };

  const PRO_CAMERA = { distance: 270, height: 100, angle: -4 * Math.PI / 180, fov: 110 };
  const DRIVE_PHYS = {
    throttleSpeed: 1410,
    reverseMaxSpeed: 1400,
    maxSpeed: 2300,
    throttleAccelLow: 1600,
    boostAccelGround: 991.666,
    boostAccelAir: 1058.333,
    coastDecel: 525,
    brakeDecel: 3500,
    jumpSpeed: 292,
    jumpHoldAccel: 1460,
    jumpHoldMax: 0.20,
    airThrottleForward: 66.667,
    airThrottleReverse: 33.334,
    pitchAccel: 12.46,
    yawAccel: 9.11,
    maxAngularSpeed: 5.5,
    lateralGrip: 13.5,
    landingLevelRate: 9.0,
    powerslideGrip: 1.35,
    powerslideSteerMultiplier: 2.15,
    powerslideSpeedRetention: 0.985,
    powerslideEngageRate: 9.0,
    powerslideReleaseRate: 6.0,
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
    cameraTouchMode: true,
    viewMode: 'arena',
    carCam: { yawOffset: 0, pitchOffset: 0, dragging: false },
    camera: { yaw: -0.82, pitch: 0.28, distance: 3150, target: v3(0, 0, 550) },
    drive: { active: false, started: false, paused: false, cameraMode: 'ball', steerX: 0, steerY: 0, accel: false, boost: false, powerslide: false, powerslideAmount: 0, jumpHeld: false, justJump: false, joyPointer: null, hitCooldown: 0, ball: null, car: null, lastTime: 0 },
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
      if (ay > yLimit) contacts.push({ n: v3(0, -sy, 0), d: ay - yLimit, surface: 'backboard' });
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
      if (ax <= straightYEnd && ay > rampYLimit) {
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

  function cameraBasis() {
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
        const orbitForward = norm(horizontalBall);
        const horizontalDistance = len(horizontalBall);
        const distance = PRO_CAMERA.distance + clamp(horizontalDistance * 0.012, 0, 54);
        const heightLift = PRO_CAMERA.height + 20 + clamp(verticalBall * 0.03, -24, 72);
        mount = add(add(carAnchor, mul(orbitForward, -distance)), mul(worldUp, heightLift));
        target = add(carAnchor, v3(0, 0, clamp(verticalBall * 0.012, -6, 18)));
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

  function roundedBoundary(z, samples = 84) {
    const points = [];
    const w = C.SIDE_X;
    const l = C.BACK_Y;
    const r = C.CORNER_R;
    const cx = w - r;
    const cy = l - r;
    const segments = Math.max(5, Math.floor(samples / 8));
    const corners = [
      { sx: 1, sy: 1, a0: 0, a1: Math.PI / 2 },
      { sx: -1, sy: 1, a0: Math.PI / 2, a1: Math.PI },
      { sx: -1, sy: -1, a0: Math.PI, a1: Math.PI * 1.5 },
      { sx: 1, sy: -1, a0: Math.PI * 1.5, a1: Math.PI * 2 },
    ];
    for (const corner of corners) {
      const centerX = corner.sx * cx;
      const centerY = corner.sy * cy;
      for (let i = 0; i <= segments; i += 1) {
        const a = corner.a0 + (corner.a1 - corner.a0) * i / segments;
        points.push(v3(centerX + Math.cos(a) * r, centerY + Math.sin(a) * r, z));
      }
    }
    points.push(points[0]);
    return points;
  }

  function transitionBoundary(z, samples = 84) {
    const zz = clamp(z, 0, C.RAMP_R);
    const radial = Math.sqrt(Math.max(0, C.RAMP_R * C.RAMP_R - (zz - C.RAMP_R) * (zz - C.RAMP_R)));
    const inset = C.RAMP_R - radial;
    const points = [];
    const w = C.SIDE_X - inset;
    const l = C.BACK_Y - inset;
    const r = Math.max(120, C.CORNER_R - inset);
    const cx = w - r;
    const cy = l - r;
    const segments = Math.max(5, Math.floor(samples / 8));
    const corners = [
      { sx: 1, sy: 1, a0: 0, a1: Math.PI / 2 },
      { sx: -1, sy: 1, a0: Math.PI / 2, a1: Math.PI },
      { sx: -1, sy: -1, a0: Math.PI, a1: Math.PI * 1.5 },
      { sx: 1, sy: -1, a0: Math.PI * 1.5, a1: Math.PI * 2 },
    ];
    for (const corner of corners) {
      const centerX = corner.sx * cx;
      const centerY = corner.sy * cy;
      for (let i = 0; i <= segments; i += 1) {
        const a = corner.a0 + (corner.a1 - corner.a0) * i / segments;
        points.push(v3(centerX + Math.cos(a) * r, centerY + Math.sin(a) * r, zz));
      }
    }
    points.push(points[0]);
    return points;
  }

  function drawFloorTransition() {
    if (state.drive.active) {
      // Only draw the upper seam in Drive mode. The lower seam was coplanar with
      // the field boundary and floor grid, which caused intermittent shimmer.
      drawPolyline(transitionBoundary(C.RAMP_R, 96), 'rgba(130,211,241,.22)', 1.5);
      return;
    }
    const basis = cameraBasis();
    const rings = [0, C.RAMP_R * 0.25, C.RAMP_R * 0.5, C.RAMP_R * 0.75, C.RAMP_R].map((z) => transitionBoundary(z, 96));
    ctx.save();
    for (let r = 0; r < rings.length - 1; r += 1) {
      const lower = rings[r];
      const upper = rings[r + 1];
      for (let i = 0; i < lower.length - 1; i += 1) {
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
    drawPolyline(transitionBoundary(0, 96), 'rgba(130,211,241,.26)', 2);
    drawPolyline(transitionBoundary(C.RAMP_R * 0.52, 96), 'rgba(130,211,241,.18)', 1.5);
    drawPolyline(transitionBoundary(C.RAMP_R, 96), 'rgba(130,211,241,.22)', 2);
    ctx.restore();
  }

  function drawWallFog() {
    if (state.drive.active) return;
    const basis = cameraBasis();
    const lower = roundedBoundary(0, 96);
    const upper = roundedBoundary(420, 96);
    ctx.save();
    for (let i = 0; i < lower.length - 1; i += 1) {
      const a0 = lower[i];
      const a1 = lower[i + 1];
      const b1 = upper[i + 1];
      const b0 = upper[i];
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

  function drawPolyline(points, stroke, width = 2, dash = []) {
    if (!points || points.length < 2) return;
    const basis = cameraBasis();
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

  function drawGoal(sign, color, highlighted) {
    const y = sign * C.BACK_Y;
    const stroke = highlighted ? color : color.replace('1)', '.72)');
    drawPolyline([v3(-C.GOAL_HALF_W, y, 0), v3(-C.GOAL_HALF_W, y, C.GOAL_H), v3(C.GOAL_HALF_W, y, C.GOAL_H), v3(C.GOAL_HALF_W, y, 0)], stroke, highlighted ? 13 : 8);
    if (highlighted) {
      drawPolyline([v3(-C.GOAL_HALF_W, y - sign * 30, 15), v3(C.GOAL_HALF_W, y - sign * 30, 15)], 'rgba(255,255,255,.85)', 4, [14, 10]);
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
    const w = scene.width;
    const h = scene.height;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2c83bd');
    sky.addColorStop(0.43, '#0d4d78');
    sky.addColorStop(0.44, '#183f3b');
    sky.addColorStop(1, '#071b1d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(5,26,43,.28)';
    for (let i = 0; i < 16; i += 1) {
      const bx = i * w / 15 - 35;
      const bh = 40 + ((i * 47) % 130);
      ctx.fillRect(bx, h * 0.43 - bh, 55, bh);
    }

    drawFloorTransition();
    drawWallFog();
    // A tiny vertical separation prevents coplanar floor/grid/boundary strokes from
    // fighting as the camera pans. The grid is also kept inside the drivable floor.
    for (let x = -3840; x <= 3840; x += 512) drawPolyline([v3(x, -4800, 1.5), v3(x, 4800, 1.5)], 'rgba(130,211,241,.12)', 1);
    for (let y = -4608; y <= 4608; y += 512) drawPolyline([v3(-3800, y, 1.5), v3(3800, y, 1.5)], 'rgba(130,211,241,.12)', 1);
    drawPolyline(roundedBoundary(3), 'rgba(131,225,255,.72)', 4);
    drawPolyline(roundedBoundary(420), 'rgba(131,225,255,.22)', 2);
    const wallRing = roundedBoundary(0, 128);
    const wallStep = Math.max(1, Math.floor((wallRing.length - 1) / 24));
    for (let i = 0; i < wallRing.length - 1; i += wallStep) {
      const p0 = wallRing[i];
      drawPolyline([v3(p0.x, p0.y, 5), v3(p0.x, p0.y, 420)], 'rgba(133,220,255,.12)', 1);
    }

    drawPolyline([v3(-4096, 0, 1), v3(4096, 0, 1)], 'rgba(255,255,255,.3)', 3);
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

    if (driveActive && state.drive.car) {
      const teamColor = plan.teamName === 'BLUE' ? 'rgba(61,184,255,.98)' : 'rgba(255,156,67,.98)';
      drawCar(state.drive.car.p, state.drive.car.heading, state.drive.car.pitch || 0, teamColor, 'YOU', state.drive.car.surfaceForward ? { forward: state.drive.car.surfaceForward, up: state.drive.car.surfaceUp } : null);
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
      const teamColor = plan.teamName === 'BLUE' ? 'rgba(61,184,255,.96)' : 'rgba(255,156,67,.96)';
      drawCar(plan.start, state.carGuessHeading, 0, teamColor, 'YOU');
    }

    drawBall(ballP);
    if (!driveActive) drawImpactMarker(bounceP, shot.bounce?.n || v3(0, 0, 1));
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

  function drawBall(p) {
    const q = project(p);
    if (!q) return;
    const radius = clamp(C.BALL_R * q.scale, 8, 104);

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
    const F = axes.forward;
    const R = axes.right;
    const U = axes.up;
    const L = C.CAR_HALF_L;
    const W = C.CAR_HALF_W;
    const H = C.CAR_HALF_H;
    const base = center.z <= C.CAR_Z + 0.5 ? C.CAR_Z : center.z;
    const c = v3(center.x, center.y, base + H * 0.28);
    const P = (f, r, u) => add(add(add(c, mul(F, f)), mul(R, r)), mul(U, u));

    const bodyBottom = [P(L*0.98, W*0.95, -H*0.45), P(L*0.98, -W*0.95, -H*0.45), P(-L*1.05, -W*0.96, -H*0.45), P(-L*1.05, W*0.96, -H*0.45)];
    const belt = [P(L*0.92, W*0.88, -H*0.02), P(L*0.92, -W*0.88, -H*0.02), P(-L*0.95, -W*0.90, -H*0.02), P(-L*0.95, W*0.90, -H*0.02)];
    const cabin = [P(L*0.20, W*0.56, H*0.72), P(L*0.20, -W*0.56, H*0.72), P(-L*0.38, -W*0.62, H*0.68), P(-L*0.38, W*0.62, H*0.68)];
    const spoiler = [P(-L*0.88, W*0.46, H*0.38), P(-L*0.88, -W*0.46, H*0.38), P(-L*1.02, -W*0.46, H*0.38), P(-L*1.02, W*0.46, H*0.38), P(-L*0.92, W*0.46, H*0.58), P(-L*0.92, -W*0.46, H*0.58), P(-L*1.00, -W*0.46, H*0.58), P(-L*1.00, W*0.46, H*0.58)];
    const wheelCenters = [P(L*0.42, W*0.82, -H*0.20), P(L*0.42, -W*0.82, -H*0.20), P(-L*0.45, W*0.82, -H*0.20), P(-L*0.45, -W*0.82, -H*0.20)];
    const basis = cameraBasis();
    ctx.save();
    const projWheels = wheelCenters.map((pt) => projectWithBasis(pt, basis));
    for (const q of projWheels) {
      if (!q) continue;
      const rr = clamp(10.5 * q.scale, 2.8, 9);
      ctx.fillStyle = 'rgba(10,16,18,1)';
      ctx.beginPath(); ctx.arc(q.x, q.y, rr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(185,200,214,.72)'; ctx.lineWidth = 1.1; ctx.stroke();
      ctx.beginPath(); ctx.arc(q.x, q.y, rr*0.38, 0, Math.PI * 2); ctx.stroke();
    }
    const mainColor = color.includes('rgba') ? color.replace(/0?\.\d+\)$/, '1)') : color;
    const faces = [
      { pts: [belt[0], belt[1], bodyBottom[1], bodyBottom[0]], fill: mainColor },
      { pts: [belt[3], belt[2], bodyBottom[2], bodyBottom[3]], fill: 'rgba(88,138,176,1)' },
      { pts: [belt[0], belt[3], bodyBottom[3], bodyBottom[0]], fill: 'rgba(123,197,242,1)' },
      { pts: [belt[1], belt[2], bodyBottom[2], bodyBottom[1]], fill: 'rgba(93,160,208,1)' },
      { pts: [belt[0], belt[1], belt[2], belt[3]], fill: 'rgba(126,203,248,1)' },
      { pts: [cabin[0], cabin[1], belt[1], belt[0]], fill: 'rgba(197,232,255,1)' },
      { pts: [cabin[3], cabin[2], belt[2], belt[3]], fill: 'rgba(122,186,226,1)' },
      { pts: [cabin[0], cabin[3], belt[3], belt[0]], fill: 'rgba(170,220,249,1)' },
      { pts: [cabin[1], cabin[2], belt[2], belt[1]], fill: 'rgba(143,201,236,1)' },
      { pts: [cabin[0], cabin[1], cabin[2], cabin[3]], fill: 'rgba(231,245,255,1)' },
      { pts: [spoiler[4], spoiler[5], spoiler[6], spoiler[7]], fill: 'rgba(233,241,248,1)' },
      { pts: [spoiler[0], spoiler[1], spoiler[5], spoiler[4]], fill: 'rgba(214,228,240,1)' },
      { pts: [spoiler[3], spoiler[2], spoiler[6], spoiler[7]], fill: 'rgba(170,190,209,1)' },
    ];
    const projectedFaces = [];
    for (const face of faces) {
      const pts = face.pts.map((pt) => projectWithBasis(pt, basis));
      if (pts.some((pt) => !pt)) continue;
      const avgDepth = pts.reduce((a, b) => a + b.depth, 0) / pts.length;
      projectedFaces.push({ pts, fill: face.fill, depth: avgDepth });
    }
    projectedFaces.sort((a, b) => b.depth - a.depth);
    for (const face of projectedFaces) {
      ctx.beginPath(); ctx.moveTo(face.pts[0].x, face.pts[0].y);
      for (let i = 1; i < face.pts.length; i += 1) ctx.lineTo(face.pts[i].x, face.pts[i].y);
      ctx.closePath(); ctx.fillStyle = face.fill; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.82)'; ctx.lineWidth = 1.25; ctx.stroke();
    }
    const noseLeft = projectWithBasis(P(L*1.04, W*0.38, H*0.10), basis);
    const noseRight = projectWithBasis(P(L*1.04, -W*0.38, H*0.10), basis);
    if (noseLeft && noseRight) { ctx.strokeStyle = '#fff4b0'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(noseLeft.x, noseLeft.y); ctx.lineTo(noseRight.x, noseRight.y); ctx.stroke(); }
    const middle = projectWithBasis(c, basis);
    if (middle) { ctx.fillStyle = '#ffffff'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, middle.x, middle.y - 15); }
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

  function setDriveButtonState(id, active) { const el = $(id); if (el) el.classList.toggle('active', active); }

  function applyStickDeadzone(value, deadzone = 0.08) {
    const magnitude = Math.abs(value);
    if (magnitude <= deadzone) return 0;
    return Math.sign(value) * clamp((magnitude - deadzone) / (1 - deadzone), 0, 1);
  }

  function positionJoyKnob() { const knob = $('joyKnob'); if (!knob) return; knob.style.left = `${50 - state.drive.steerX * 26}%`; knob.style.top = `${50 + state.drive.steerY * 26}%`; }

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

  function updateDriveUI() {
    const active = state.drive.active;
    $('driveOverlay').hidden = !active;
    $('driveButton').textContent = active ? 'Exit Drive' : 'Drive';
    $('viewModeButton').hidden = active;
    $('stageWrap').classList.toggle('drive-active', active);
    document.body.classList.toggle('drive-fullscreen', active);
    $('optimumButton').hidden = active;
    const camButton = $('driveCameraButton');
    if (camButton) {
      const ballCam = state.drive.cameraMode === 'ball';
      camButton.textContent = ballCam ? 'Ball Cam' : 'Free Cam';
      camButton.setAttribute('aria-pressed', ballCam ? 'true' : 'false');
    }
    $('driveReady').textContent = active ? (state.drive.started ? (state.drive.paused ? 'Drive paused' : `${state.drive.cameraMode === 'ball' ? 'Ball Cam' : 'Free Cam'} active`) : 'Touch any control to start the ball') : 'Touch any control to start the ball';
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
    state.drive.started = false; state.drive.paused = false; state.drive.cameraMode = 'ball'; state.drive.steerX = 0; state.drive.steerY = 0; state.drive.accel = false; state.drive.boost = false; state.drive.powerslide = false; state.drive.powerslideAmount = 0; state.drive.jumpHeld = false; state.drive.justJump = false; state.drive.joyPointer = null; state.drive.hitCooldown = 0; state.drive.lastTime = 0;
    state.drive.ball = { p: v3(state.shot.initial.p.x, state.shot.initial.p.y, state.shot.initial.p.z), v: v3(state.shot.initial.v.x, state.shot.initial.v.y, state.shot.initial.v.z), w: v3(state.shot.initial.w.x, state.shot.initial.w.y, state.shot.initial.w.z) };
    state.drive.car = { p: v3(plan.start.x, plan.start.y, C.CAR_Z), v: v3(0, 0, 0), heading: state.carGuessHeading, pitch: 0, yawVelocity: 0, pitchVelocity: 0, onGround: true, jumpHoldTime: 0, surfaceAxis: null, surfaceSign: 0, surfaceS: 0, surfaceLateral: 0, surfaceAngle: 0, surfaceSpeed: 0, surfaceForward: null, surfaceUp: v3(0,0,1) };
    positionJoyKnob();
  }

  function enterDriveMode() { if (!state.shot) return; state.optimumMode = false; updateOptimumUI(); state.drive.active = true; state.playing = false; state.viewMode = 'car'; setActiveTab('car'); resetDriveSession(); updateDriveUI(); resizeCanvases(); setTimeout(resizeCanvases, 80); drawAll(); }
  function exitDriveMode(resumePlayback = true) { state.drive.active = false; state.drive.started = false; state.drive.accel = false; state.drive.boost = false; state.drive.powerslide = false; state.drive.powerslideAmount = 0; state.drive.jumpHeld = false; state.drive.justJump = false; state.drive.steerX = 0; state.drive.steerY = 0; state.drive.lastTime = 0; updateDriveUI(); resizeCanvases(); setTimeout(resizeCanvases, 80); if (resumePlayback) startPlayback(state.revealed ? 'compare' : 'preview', false); drawAll(); }
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
    if (ax <= cornerCX && ay >= floorStartY) {
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

  function constrainDriveCarToArena(car, step) {
    if (car.surfaceAxis) {
      transitionSurfaceCorners(car);
      placeCarOnSurface(car);
      return;
    }
    enterSurfaceIfNeeded(car);
    if (car.surfaceAxis) return;

    const offset = 74;
    const ax = Math.abs(car.p.x);
    const ay = Math.abs(car.p.y);
    const sx = Math.sign(car.p.x) || 1;
    const sy = Math.sign(car.p.y) || 1;
    const cornerCenterX = C.SIDE_X - C.CORNER_R;
    const cornerCenterY = C.BACK_Y - C.CORNER_R;
    const cornerR = Math.max(120, C.CORNER_R - offset);
    if (ax > cornerCenterX && ay > cornerCenterY) {
      const dx = ax - cornerCenterX;
      const dy = ay - cornerCenterY;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance > cornerR) {
        car.p.x = sx * (cornerCenterX + dx / distance * cornerR);
        car.p.y = sy * (cornerCenterY + dy / distance * cornerR);
        const normal = v3(-sx * dx / distance, -sy * dy / distance, 0);
        const outward = -dot(car.v, normal);
        if (outward > 0) car.v = add(car.v, mul(normal, outward));
      }
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
    const magnitude = Math.hypot(car.pitchVelocity, car.yawVelocity);
    if (magnitude > DRIVE_PHYS.maxAngularSpeed) {
      const ratio = DRIVE_PHYS.maxAngularSpeed / magnitude;
      car.pitchVelocity *= ratio;
      car.yawVelocity *= ratio;
    }
  }

  function stepDrive(dt) {
    if (!state.drive.active || !state.drive.started || state.drive.paused || !state.drive.ball || !state.drive.car) return;
    let remaining = clamp(dt, 0, 0.08);
    while (remaining > 0) {
      const step = Math.min(C.TICK, remaining);
      remaining -= step;
      const car = state.drive.car;
      const targetSlide = state.drive.powerslide && car.onGround ? 1 : 0;
      const slideRate = targetSlide > car.powerslideAmount ? DRIVE_PHYS.powerslideEngageRate : DRIVE_PHYS.powerslideReleaseRate;
      car.powerslideAmount = clamp((Number.isFinite(car.powerslideAmount) ? car.powerslideAmount : state.drive.powerslideAmount || 0) + Math.sign(targetSlide - (Number.isFinite(car.powerslideAmount) ? car.powerslideAmount : 0)) * slideRate * step, 0, 1);
      if (Math.abs(targetSlide - car.powerslideAmount) < slideRate * step) car.powerslideAmount = targetSlide;
      state.drive.powerslideAmount = car.powerslideAmount;
      const stickThrottle = clamp(-state.drive.steerY, -1, 1);
      const throttleInput = state.drive.boost ? 1 : (state.drive.accel ? 1 : stickThrottle);
      let integratedOnSurface = false;

      if (car.onGround && car.surfaceAxis) {
        const frame = surfaceFrame(car);
        let speed = Number.isFinite(car.surfaceSpeed) ? car.surfaceSpeed : len(car.v);
        const steer = clamp(state.drive.steerX, -1, 1);
        const speedAbs = Math.abs(speed);
        const directionSign = Math.abs(speed) > 5 ? Math.sign(speed) : (throttleInput < 0 ? -1 : 1);
        const slideSteer = 1 + car.powerslideAmount * (DRIVE_PHYS.powerslideSteerMultiplier - 1);
        const turnRate = groundCurvature(speedAbs) * speedAbs * steer * directionSign * slideSteer;

        // A surface's stored lateral axis is a geometry coordinate, not always the
        // car's local-left direction. On opposite walls and some corner quadrants,
        // increasing surfaceAngle previously meant right instead of left. Resolve
        // the handedness from the car's current forward/up frame every tick so a
        // positive steering input always turns the nose toward local left.
        const surfaceForwardBeforeTurn = norm(add(
          mul(frame.climb, Math.cos(car.surfaceAngle)),
          mul(frame.lateral, Math.sin(car.surfaceAngle)),
        ));
        const positiveAngleTangent = norm(add(
          mul(frame.climb, -Math.sin(car.surfaceAngle)),
          mul(frame.lateral, Math.cos(car.surfaceAngle)),
        ));
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
        const limit = speed < 0 ? DRIVE_PHYS.reverseMaxSpeed : (state.drive.boost ? DRIVE_PHYS.maxSpeed : DRIVE_PHYS.throttleSpeed);
        speed = clamp(speed, -DRIVE_PHYS.reverseMaxSpeed, limit);
        car.surfaceSpeed = speed;
        car.surfaceS += speed * Math.cos(car.surfaceAngle) * step;
        advanceSurfaceLateral(car, speed * Math.sin(car.surfaceAngle) * step);

        if (state.drive.justJump) {
          placeCarOnSurface(car);
          car.v = add(mul(car.surfaceForward, speed), mul(car.surfaceUp, DRIVE_PHYS.jumpSpeed));
          car.onGround = false;
          car.surfaceAxis = null;
          car.surfaceForward = null;
          car.jumpHoldTime = 0;
        } else if (car.surfaceS <= 0) {
          car.surfaceS = 0;
          placeCarOnSurface(car);
          leaveSurfaceToFloor(car);
        } else {
          placeCarOnSurface(car);
          integratedOnSurface = true;
        }
      } else if (car.onGround) {
        car.pitch = car.pitch + (0 - car.pitch) * Math.min(1, DRIVE_PHYS.landingLevelRate * step);
        car.pitchVelocity *= Math.max(0, 1 - 14 * step);
        car.yawVelocity = 0;
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
        const speedLimit = forwardSpeed < 0 ? DRIVE_PHYS.reverseMaxSpeed : (state.drive.boost ? DRIVE_PHYS.maxSpeed : DRIVE_PHYS.throttleSpeed);
        forwardSpeed = clamp(forwardSpeed, -DRIVE_PHYS.reverseMaxSpeed, speedLimit);
        const newFwd = v3(Math.cos(car.heading), Math.sin(car.heading), 0);
        const newRight = v3(-Math.sin(car.heading), Math.cos(car.heading), 0);
        car.v.x = newFwd.x * forwardSpeed + newRight.x * lateralSpeed;
        car.v.y = newFwd.y * forwardSpeed + newRight.y * lateralSpeed;
        if (state.drive.justJump) { car.v.z = DRIVE_PHYS.jumpSpeed; car.onGround = false; car.jumpHoldTime = 0; }
      } else {
        car.pitchVelocity += clamp(state.drive.steerY, -1, 1) * DRIVE_PHYS.pitchAccel * step;
        car.yawVelocity += clamp(state.drive.steerX, -1, 1) * DRIVE_PHYS.yawAccel * step;
        clampAngularVelocity(car);
        car.pitch += car.pitchVelocity * step;
        car.heading += car.yawVelocity * step;
        const airForward = v3(Math.cos(car.heading) * Math.cos(car.pitch), Math.sin(car.heading) * Math.cos(car.pitch), Math.sin(car.pitch));
        if (Math.abs(throttleInput) > 0.04) {
          const airAccel = throttleInput > 0 ? DRIVE_PHYS.airThrottleForward : DRIVE_PHYS.airThrottleReverse;
          car.v = add(car.v, mul(airForward, airAccel * throttleInput * step));
        }
        if (state.drive.boost) car.v = add(car.v, mul(airForward, DRIVE_PHYS.boostAccelAir * step));
        if (state.drive.jumpHeld && car.jumpHoldTime < DRIVE_PHYS.jumpHoldMax) {
          const holdStep = Math.min(step, DRIVE_PHYS.jumpHoldMax - car.jumpHoldTime);
          car.v.z += DRIVE_PHYS.jumpHoldAccel * holdStep;
          car.jumpHoldTime += holdStep;
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

      if (!car.surfaceAxis && car.p.z <= C.CAR_Z) {
        car.p.z = C.CAR_Z;
        if (car.v.z < 0) car.v.z = 0;
        car.onGround = true;
        car.pitch *= Math.max(0, 1 - DRIVE_PHYS.landingLevelRate * step);
        car.pitchVelocity *= 0.35;
        car.yawVelocity *= 0.35;
      }

      stepBall(state.drive.ball);
      state.drive.hitCooldown = Math.max(0, state.drive.hitCooldown - step);
      const hit = sphereCarClearance(state.drive.ball.p, car.p, car.heading, car.pitch);
      if (hit.clearance <= 0 && state.drive.hitCooldown <= 0) {
        const rel = sub(state.drive.ball.v, car.v);
        let normalSpeed = dot(rel, hit.normal);
        if (normalSpeed > 0) normalSpeed = -Math.abs(normalSpeed) * 0.25;
        let outgoing = sub(state.drive.ball.v, mul(hit.normal, (1 + 0.72) * normalSpeed));
        outgoing = add(outgoing, mul(car.v, state.drive.boost ? 0.26 : 0.18));
        const outSpeed = len(outgoing);
        if (outSpeed > C.BALL_MAX_SPEED) outgoing = mul(outgoing, C.BALL_MAX_SPEED / outSpeed);
        state.drive.ball.p = add(state.drive.ball.p, mul(hit.normal, 4));
        state.drive.ball.v = outgoing;
        state.drive.hitCooldown = 0.11;
      }
    }
    const speed = len(state.drive.ball.v);
    $('speedText').textContent = Math.round(speed);
    const pct = clamp(speed / C.BALL_MAX_SPEED, 0, 1);
    $('gaugeNeedle').style.transform = `rotate(${(-80 + pct * 160).toFixed(1)}deg)`;
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
  $('driveButton').addEventListener('click', () => { if (state.drive.active) exitDriveMode(); else enterDriveMode(); });
  $('driveCameraButton').addEventListener('click', () => { state.drive.cameraMode = state.drive.cameraMode === 'ball' ? 'free' : 'ball'; updateDriveUI(); drawAll(); });
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

  function bindHoldDriveButton(id, field) {
    const el = $(id);
    const down = (event) => { event.preventDefault(); startDriveIfNeeded(); state.drive[field] = true; setDriveButtonState(id, true); };
    const up = (event) => { if (event) event.preventDefault(); state.drive[field] = false; setDriveButtonState(id, false); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  }
  bindHoldDriveButton('accelerateButton', 'accel');
  bindHoldDriveButton('boostButton', 'boost');
  bindHoldDriveButton('powerslideButton', 'powerslide');
  $('jumpButton').addEventListener('pointerdown', (event) => { event.preventDefault(); startDriveIfNeeded(); state.drive.justJump = true; state.drive.jumpHeld = true; setDriveButtonState('jumpButton', true); });
  const releaseJump = (event) => { if (event) event.preventDefault(); state.drive.jumpHeld = false; setDriveButtonState('jumpButton', false); };
  $('jumpButton').addEventListener('pointerup', releaseJump);
  $('jumpButton').addEventListener('pointercancel', releaseJump);
  $('jumpButton').addEventListener('pointerleave', releaseJump);
  const joyZone = $('joyZone');
  joyZone.addEventListener('pointerdown', (event) => { event.preventDefault(); startDriveIfNeeded(); state.drive.joyPointer = event.pointerId; joyZone.setPointerCapture(event.pointerId); const rect = joyZone.getBoundingClientRect(); state.drive.steerX = applyStickDeadzone(clamp(-((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1)); state.drive.steerY = applyStickDeadzone(clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1)); positionJoyKnob(); });
  joyZone.addEventListener('pointermove', (event) => { if (state.drive.joyPointer !== event.pointerId) return; event.preventDefault(); const rect = joyZone.getBoundingClientRect(); state.drive.steerX = applyStickDeadzone(clamp(-((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1)); state.drive.steerY = applyStickDeadzone(clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1)); positionJoyKnob(); });
  const releaseJoy = (event) => { if (state.drive.joyPointer !== event.pointerId) return; state.drive.joyPointer = null; state.drive.steerX = 0; state.drive.steerY = 0; positionJoyKnob(); };
  joyZone.addEventListener('pointerup', releaseJoy); joyZone.addEventListener('pointercancel', releaseJoy);


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
      if (!state.drive.lastTime) state.drive.lastTime = time;
      const dt = (time - state.drive.lastTime) / 1000;
      state.drive.lastTime = time;
      stepDrive(dt);
      drawAll(time);
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
  newShot();
  requestAnimationFrame(loop);
})();
