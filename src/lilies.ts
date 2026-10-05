import * as THREE from 'three';
import { POND } from './config';

interface Pad {
  obj: THREE.Group;
  ax: number;
  az: number;
  r: number;
  seed: number;
}

function makeLotus(size: number): THREE.Group {
  const g = new THREE.Group();
  const petalGeo = new THREE.SphereGeometry(1, 16, 10);
  const outerMat = new THREE.MeshStandardMaterial({ color: '#f7c9d9', roughness: 0.5, emissive: '#f39ab8', emissiveIntensity: 0.08 });
  const innerMat = new THREE.MeshStandardMaterial({ color: '#fbe3ec', roughness: 0.5 });
  const layers: [number, number, number, THREE.Material][] = [
    [8, 1.0, -0.35, outerMat],
    [6, 0.7, -0.9, innerMat],
  ];
  layers.forEach(([count, len, tilt, mat], layer) => {
    for (let i = 0; i < count; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / count) * Math.PI * 2 + layer * 0.3;
      const petal = new THREE.Mesh(petalGeo, mat);
      petal.scale.set(0.28 * size, 0.1 * size, 0.7 * size * len);
      petal.position.set(0, 0.12 * size, 0.45 * size * len);
      petal.rotation.x = tilt;
      pivot.add(petal);
      g.add(pivot);
    }
  });
  const centre = new THREE.Mesh(
    new THREE.SphereGeometry(0.15 * size, 16, 10),
    new THREE.MeshStandardMaterial({ color: '#f2c94c', roughness: 0.6 }),
  );
  centre.scale.y = 0.6;
  centre.position.y = 0.2 * size;
  g.add(centre);
  return g;
}

export class Lilies {
  readonly group = new THREE.Group();
  private pads: Pad[] = [];

  constructor() {
    const mats = [
      new THREE.MeshStandardMaterial({ color: '#4f8a3c', roughness: 0.65, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: '#6b9b45', roughness: 0.65, side: THREE.DoubleSide }),
    ];
    // x, z, radius, has a flower
    const spots: [number, number, number, boolean][] = [
      [-6.2, -2.8, 0.9, true],
      [-4.9, -3.9, 0.6, false],
      [5.8, 3.1, 1.0, true],
      [7.0, 1.6, 0.55, false],
      [3.2, -4.6, 0.7, false],
      [-2.0, 4.6, 0.65, false],
    ];
    spots.forEach(([x, z, r, flower], i) => {
      const obj = new THREE.Group();
      const geo = new THREE.CircleGeometry(r, 48, 0.3, Math.PI * 2 - 0.45); // the classic notch
      geo.rotateX(-Math.PI / 2);
      obj.add(new THREE.Mesh(geo, mats[i % 2]));
      if (flower) obj.add(makeLotus(r * 0.45));
      obj.position.set(x, POND.waterY + 0.02, z);
      obj.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(obj);
      this.pads.push({ obj, ax: x, az: z, r, seed: Math.random() * 10 });
    });
  }

  update(time: number) {
    for (const p of this.pads) {
      p.obj.position.x = p.ax + Math.sin(time * 0.07 + p.seed) * 0.35;
      p.obj.position.z = p.az + Math.cos(time * 0.05 + p.seed) * 0.25;
      p.obj.position.y = POND.waterY + 0.02 + Math.sin(time * 0.9 + p.seed) * 0.006;
      p.obj.rotation.y += Math.sin(p.seed) * 0.0004;
    }
  }

  writeShadows(out: THREE.Vector4[], start: number): number {
    let i = start;
    for (const p of this.pads) {
      if (i >= out.length) break;
      out[i++].set(p.obj.position.x, p.obj.position.z, p.r * 1.1, 0.5);
    }
    return i;
  }
}
