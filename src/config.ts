// Pond shape + light. Tweak these first.
export const POND = { rx: 10, rz: 7, waterY: 0, floorY: -1.6 } as const;

// Direction pointing TOWARD the sun (x, y, z). Lower y = longer, golden-hour shadows.
export const SUN_DIR: [number, number, number] = [0.45, 0.8, 0.35];

// 0 at the centre, 1 on the pond edge (it's an ellipse).
export function pondValue(x: number, z: number): number {
  return (x / POND.rx) ** 2 + (z / POND.rz) ** 2;
}

export function insidePond(x: number, z: number, margin = 1): boolean {
  return pondValue(x, z) < margin * margin;
}

export function randomPointInPond(margin = 0.8): [number, number] {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * margin;
  return [Math.cos(a) * r * POND.rx, Math.sin(a) * r * POND.rz];
}
