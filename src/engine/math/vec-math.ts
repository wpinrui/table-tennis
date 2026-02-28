/**
 * Lightweight vector math — pure functions on Vec2/Vec3.
 * No class overhead for performance.
 */

import type { Vec2, Vec3 } from "../types/index.js";

// ---------------------------------------------------------------------------
// Vec3 operations
// ---------------------------------------------------------------------------

export function v3add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function v3sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function v3scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function v3dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function v3cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function v3mag(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function v3normalize(v: Vec3): Vec3 {
  const m = v3mag(v);
  if (m === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

export function v3zero(): Vec3 {
  return { x: 0, y: 0, z: 0 };
}

// ---------------------------------------------------------------------------
// Vec2 operations
// ---------------------------------------------------------------------------

export function v2add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function v2sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function v2scale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function v2mag(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function v2normalize(v: Vec2): Vec2 {
  const m = v2mag(v);
  if (m === 0) return { x: 0, y: 0 };
  return { x: v.x / m, y: v.y / m };
}

export function v2dist(a: Vec2, b: Vec2): number {
  return v2mag(v2sub(a, b));
}

export function v2zero(): Vec2 {
  return { x: 0, y: 0 };
}

/** Linearly interpolate from a toward b by fraction t (clamped to [0,1]). */
export function v2lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  const tc = Math.max(0, Math.min(1, t));
  return { x: a.x + (b.x - a.x) * tc, y: a.y + (b.y - a.y) * tc };
}

/** Clamp a number to [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
