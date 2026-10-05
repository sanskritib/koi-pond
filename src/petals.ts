import * as THREE from 'three';
import { POND, insidePond, randomPointInPond } from './config';
import type { RippleField } from './water';

const COUNT = 170;

// 0 = falling, 1 = resting (on water or ground), 2 = sinking away
type State = 0 | 1 | 2;

interface Petal {
  p: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  fall: number;
  vx: number;
  vz: number;
  state: State;
  ground: boolean;
  t: number;
  life: number;
  seed: number;
  scale: number;
}

function petalGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.055, 0.025, 0.075, 0.1, 0.035, 0.145);
  s.lineTo(0, 0.125); // the little notch at the tip
  s.lineTo(-0.035, 0.145);
  s.bezierCurveTo(-0.075, 0.1, -0.055, 0.025, 0, 0);
  const g = new THREE.ShapeGeometry(s, 8);
  g.translate(0, -0.075, 0);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, x * x * 4 + y * y * 1.2); // cup it slightly
  }
  g.computeVertexNormals();
  return g;
}

export class Petals {
  readonly mesh: THREE.InstancedMesh;
  private petals: Petal[] = [];
  private dummy = new THREE.Object3D();
  private wind = new THREE.Vector2(0.35, 0.08);

  constructor() {
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      side: THREE.DoubleSide,
      roughness: 0.6,
      emissive: new THREE.Color('#ff8fae'),
      emissiveIntensity: 0.08,
    });
    this.mesh = new THREE.InstancedMesh(petalGeometry(), mat, COUNT);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.renderOrder = 3;

    const c = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      c.setHSL(0.95 + Math.random() * 0.03, 0.75, 0.82 + Math.random() * 0.1);
      this.mesh.setColorAt(i, c);
      const pt: Petal = {
        p: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(),
        fall: 0, vx: 0, vz: 0, state: 0, ground: false, t: 0, life: 0,
        seed: Math.random() * 100, scale: 1.2 + Math.random() * 0.8,
      };
      if (Math.random() < 0.35) {
        const [x, z] = randomPointInPond(0.9);
        this.settle(pt, x, z, false);
      } else {
        this.spawn(pt);
        pt.p.y = Math.random() * 9;
      }
      this.petals.push(pt);
    }
  }

  private spawn(pt: Petal) {
    pt.state = 0;
    pt.t = 0;
    pt.ground = false;
    pt.vx = 0;
    pt.vz = 0;
    pt.p.set((Math.random() - 0.5) * POND.rx * 2.4 - 3, 7 + Math.random() * 4, (Math.random() - 0.5) * POND.rz * 2.4);
    pt.fall = 0.45 + Math.random() * 0.35;
    pt.rot.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    pt.spin.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
  }

  private settle(pt: Petal, x: number, z: number, ground: boolean) {
    pt.state = 1;
    pt.t = 0;
    pt.ground = ground;
    pt.life = ground ? 8 + Math.random() * 8 : 15 + Math.random() * 20;
    pt.p.set(x, ground ? POND.waterY + 0.07 : POND.waterY + 0.015, z);
    pt.rot.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
  }

  // A tap pushes floating petals outward.
  push(x: number, z: number) {
    for (const pt of this.petals) {
      if (pt.state !== 1 || pt.ground) continue;
      const dx = pt.p.x - x, dz = pt.p.z - z;
      const d = Math.hypot(dx, dz);
      if (d < 3 && d > 1e-3) {
        const k = (1 - d / 3) * 1.2;
        pt.vx += (dx / d) * k;
        pt.vz += (dz / d) * k;
      }
    }
  }

  update(dt: number, time: number, ripples: RippleField) {
    for (let i = 0; i < COUNT; i++) {
      const pt = this.petals[i];
      pt.t += dt;
      let s = pt.scale;

      if (pt.state === 0) {
        pt.p.x += (this.wind.x + Math.sin(pt.t * 1.7 + pt.seed) * 0.35) * dt;
        pt.p.z += (this.wind.y + Math.cos(pt.t * 1.3 + pt.seed) * 0.25) * dt;
        pt.p.y -= pt.fall * (0.75 + 0.35 * Math.sin(pt.t * 2.4 + pt.seed)) * dt;
        pt.rot.x += pt.spin.x * dt;
        pt.rot.y += pt.spin.y * dt;
        pt.rot.z += pt.spin.z * dt;
        if (pt.p.y <= POND.waterY + 0.07) {
          if (insidePond(pt.p.x, pt.p.z, 0.97)) {
            ripples.add(pt.p.x, pt.p.z, 0.3, time);
            this.settle(pt, pt.p.x, pt.p.z, false);
          } else {
            this.settle(pt, pt.p.x, pt.p.z, true);
          }
        }
      } else if (pt.state === 1) {
        if (!pt.ground) {
          pt.p.x += (0.05 + Math.sin(time * 0.21 + pt.seed) * 0.05 + pt.vx) * dt;
          pt.p.z += (Math.cos(time * 0.17 + pt.seed) * 0.05 + pt.vz) * dt;
          const damp = Math.exp(-dt * 1.4);
          pt.vx *= damp;
          pt.vz *= damp;
          if (!insidePond(pt.p.x, pt.p.z, 0.96)) {
            pt.p.x *= 0.995;
            pt.p.z *= 0.995;
          }
          pt.p.y = POND.waterY + 0.015 + Math.sin(time * 1.6 + pt.seed * 3) * 0.008;
          pt.rot.z += Math.sin(pt.seed) * 0.08 * dt;
        }
        if (pt.t > pt.life) {
          pt.state = 2;
          pt.t = 0;
        }
      } else {
        const k = Math.min(pt.t / 2.5, 1);
        s *= 1 - k;
        if (!pt.ground) pt.p.y = POND.waterY + 0.015 - k * 0.05;
        if (k >= 1) this.spawn(pt);
      }

      this.dummy.position.copy(pt.p);
      this.dummy.rotation.copy(pt.rot);
      this.dummy.scale.setScalar(s);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
