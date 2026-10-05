import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { POND, SUN_DIR, insidePond } from './config';
import { RippleField, createWater } from './water';
import { MAX_SHADOWS, createFloor } from './floor';
import { createGarden } from './garden';
import { KoiSchool } from './koi';
import { Petals } from './petals';
import { Lilies } from './lilies';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const hint = document.getElementById('hint')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1f2a1e');

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 15, 11);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, -0.4, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.maxPolarAngle = 1.15;
controls.minDistance = 7;
controls.maxDistance = 30;

scene.add(new THREE.HemisphereLight('#e3f2ff', '#2b3a26', 0.9));
const sun = new THREE.DirectionalLight('#fff0d6', 1.8);
sun.position.set(SUN_DIR[0] * 20, SUN_DIR[1] * 20, SUN_DIR[2] * 20);
scene.add(sun);

// Shared state the shaders read every frame.
const time = { value: 0 };
const ripples = new RippleField();
const shadows = Array.from({ length: MAX_SHADOWS }, () => new THREE.Vector4(0, 0, 1, 0));

scene.add(createGarden());
scene.add(createFloor(time, shadows));
const koi = new KoiSchool(9);
scene.add(koi.group);
scene.add(createWater(ripples, time));
const lilies = new Lilies();
scene.add(lilies.group);
const petals = new Petals();
scene.add(petals.mesh);

// Tap (not drag) the water: ripple, scatter the koi, push the petals.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -POND.waterY);
const hit = new THREE.Vector3();
let down: { x: number; y: number } | null = null;

canvas.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 6) return;
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  if (!raycaster.ray.intersectPlane(waterPlane, hit)) return;
  if (!insidePond(hit.x, hit.z)) return;
  ripples.add(hit.x, hit.z, 1, time.value);
  koi.scatter(hit.x, hit.z);
  petals.push(hit.x, hit.z);
  hint.classList.add('hide');
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  time.value += dt;

  koi.update(dt, time.value, ripples);
  lilies.update(time.value);
  petals.update(dt, time.value, ripples);

  let i = koi.writeShadows(shadows, 0);
  i = lilies.writeShadows(shadows, i);
  for (; i < shadows.length; i++) shadows[i].w = 0;

  controls.update();
  renderer.render(scene, camera);
});
