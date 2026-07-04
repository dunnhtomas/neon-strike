/**
 * Pure free-kick physics: drag-powered velocity + exponentially decaying Magnus swerve + gravity.
 *
 * v0 = k * dragVector
 * a_swerve(t) = S * perpendicular(v) * exp(-t / tau)
 * a_g = (0, g)
 */

export interface Vector2 { x: number; y: number }

export interface KickParams {
  start: Vector2;
  release: Vector2;
  powerScale?: number;
  maxDrag?: number;
  maxSwerve?: number;
  tau?: number;
  gravity?: number;
}

export interface SimulationState {
  pos: Vector2;
  vel: Vector2;
  swerveMag: number;
  swerveT: number;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export function hypot(x: number, y: number): number {
  return Math.hypot(x, y);
}

export function computeKickVector(
  ball: Vector2,
  release: Vector2,
  powerScale = 6.2,
  maxDrag = 260,
): Vector2 {
  const dx = ball.x - release.x;
  const dy = ball.y - release.y;
  const dist = clamp(hypot(dx, dy), 30, maxDrag);
  const power = dist * powerScale;
  const angle = Math.atan2(dy, dx);
  return { x: Math.cos(angle) * power, y: Math.sin(angle) * power };
}

export function computeSwerve(
  aimStartX: number,
  releaseX: number,
  maxSwerve = 520,
  sensitivity = 120,
): number {
  const swipe = aimStartX - releaseX;
  return clamp(swipe / sensitivity, -1, 1) * maxSwerve;
}

export function stepPhysics(
  state: SimulationState,
  dt: number,
  wind = 0,
  gravity = 1400,
  tau = 0.55,
): SimulationState {
  const { vel, swerveMag, swerveT } = state;
  const nextT = swerveT + dt;
  const decay = Math.exp(-nextT / tau);
  const speed = hypot(vel.x, vel.y) || 1;

  // Perpendicular unit vector to velocity.
  const px = -vel.y / speed;
  const py = vel.x / speed;

  const ax = px * swerveMag * decay + wind;
  const ay = py * swerveMag * decay * 0.2 + gravity;

  return {
    pos: {
      x: state.pos.x + vel.x * dt,
      y: state.pos.y + vel.y * dt,
    },
    vel: {
      x: vel.x + ax * dt,
      y: vel.y + ay * dt,
    },
    swerveMag,
    swerveT: nextT,
  };
}

export function simulateFlight(
  initial: SimulationState,
  duration: number,
  step = 1 / 120,
  wind = 0,
  gravity = 1400,
  tau = 0.55,
): SimulationState {
  let s = initial;
  const steps = Math.ceil(duration / step);
  for (let i = 0; i < steps; i++) {
    s = stepPhysics(s, step, wind, gravity, tau);
  }
  return s;
}
