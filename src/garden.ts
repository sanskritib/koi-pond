import * as THREE from 'three';
import { POND } from './config';
import { NOISE_GLSL } from './noise';

// Mossy ground around the pond plus a ring of rocks on the edge.
export function createGarden(): THREE.Group {
  const group = new THREE.Group();

  const groundGeo = new THREE.PlaneGeometry(120, 120, 1, 1);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.ShaderMaterial({
    uniforms: {
      uRadii: { value: new THREE.Vector2(POND.rx, POND.rz) },
      uMossA: { value: new THREE.Color('#2c3d27') },
      uMossB: { value: new THREE.Color('#4a5e33') },
      uStone: { value: new THREE.Color('#6b6656') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uRadii;
      uniform vec3 uMossA;
      uniform vec3 uMossB;
      uniform vec3 uStone;
      varying vec3 vWorld;
      ${NOISE_GLSL}
      void main() {
        vec2 p = vWorld.xz;
        vec2 q = p / uRadii;
        float e2 = dot(q, q);
        if (e2 < 1.0) discard;
        vec3 col = mix(uMossA, uMossB, fbm(p * 0.6));
        col = mix(col, uStone, smoothstep(0.62, 0.8, fbm(p * 3.5 + 3.0)) * 0.5);
        col *= 1.0 - smoothstep(1.7, 1.0, e2) * 0.25;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = POND.waterY + 0.04;
  group.add(ground);

  // Lumpy rock: jitter each vertex by a hash of its position so shared corners stay joined.
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  const rp = rockGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
    const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    const s = 0.85 + (h - Math.floor(h)) * 0.3;
    rp.setXYZ(i, x * s, y * s, z * s);
  }
  rockGeo.computeVertexNormals();

  const INNER = 110;
  const OUTER = 60;
  const rocks = new THREE.InstancedMesh(
    rockGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
    INNER + OUTER,
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < INNER + OUTER; i++) {
    const inner = i < INNER;
    const idx = inner ? i : i - INNER;
    const n = inner ? INNER : OUTER;
    const a = (idx / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.04;
    const f = inner ? 1.0 + Math.random() * 0.04 : 1.1 + Math.random() * 0.08;
    const s = inner ? 0.45 + Math.random() * 0.4 : 0.35 + Math.random() * 0.5;
    dummy.position.set(Math.cos(a) * POND.rx * f, 0.02, Math.sin(a) * POND.rz * f);
    dummy.scale.set(s * (1 + Math.random() * 0.6), s * (0.35 + Math.random() * 0.25), s);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.18 + Math.random() * 0.08, 0.08 + Math.random() * 0.1, 0.32 + Math.random() * 0.18);
    rocks.setColorAt(i, color);
  }
  group.add(rocks);

  return group;
}
