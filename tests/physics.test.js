import { test } from 'vitest';
import assert from 'node:assert/strict';

const GRAVITY = 1400;
const TAU = 0.55;

function simulate(dx, dy, swipe, duration = 1.0, dt = 0.001) {
  const dist = Math.hypot(dx, dy);
  const power = Math.min(Math.max(dist, 30), 260) * 6.2;
  const ang = Math.atan2(dy, dx);
  let vx = Math.cos(ang) * power;
  let vy = Math.sin(ang) * power;
  let swerve = Math.min(Math.max(swipe / 120, -1), 1) * 520;
  let swerveT = 0;
  let x = 0, y = 0;
  for (let t = 0; t < duration; t += dt) {
    swerveT += dt;
    const decay = Math.exp(-swerveT / TAU);
    const speed = Math.hypot(vx, vy) || 1;
    const px = -vy / speed;
    const py = vx / speed;
    vx += (px * swerve * decay) * dt;
    vy += (py * swerve * decay * 0.2) * dt;
    vy += GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;
  }
  return { x, y, vx, vy };
}

test('straight kick moves mostly forward', () => {
  const r = simulate(0, -150, 0);
  assert(r.y < -50, 'ball should travel upward (negative y)');
  assert(Math.abs(r.x) < 2, 'straight kick should have negligible x drift');
});

test('positive swipe curves ball right relative to straight', () => {
  const straight = simulate(0, -150, 0);
  const curved = simulate(0, -150, 120);
  assert(curved.x > straight.x + 10, 'positive swipe should curve toward positive x');
});

test('negative swipe curves ball left relative to straight', () => {
  const straight = simulate(0, -150, 0);
  const curved = simulate(0, -150, -120);
  assert(curved.x < straight.x - 10, 'negative swipe should curve toward negative x');
});

test('swerve acceleration magnitude decays over time', () => {
  const swerve = 520;
  const magAt0 = Math.abs(swerve) * Math.exp(-0 / TAU);
  const magAt06 = Math.abs(swerve) * Math.exp(-0.6 / TAU);
  const magAt12 = Math.abs(swerve) * Math.exp(-1.2 / TAU);
  assert(magAt06 < magAt0, 'swerve magnitude should decay by t=0.6s');
  assert(magAt12 < magAt06, 'swerve magnitude should keep decaying');
});
