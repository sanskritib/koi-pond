# koi pond

A little Three.js koi pond: water with real-looking ripples, koi that swim around and dart away when you tap, cherry blossom petals that fall, land, ripple and drift, plus lily pads and a lotus or two. Inspired by @buildwithsid's water-opus.

## Run it

```
npm install
npm run dev
```

Then open the localhost link it prints. Tap the water, drag to look around.

## Where things live

- `src/main.ts` - sets up the scene, camera, lights and the tap handler
- `src/water.ts` - the water surface shader and the ripple system
- `src/koi.ts` - koi bodies, colour patterns and swimming
- `src/petals.ts` - falling and floating blossoms
- `src/floor.ts` - pond bed, moving caustics, soft shadows
- `src/lilies.ts` - lily pads and lotus flowers
- `src/garden.ts` - moss and rocks around the edge
- `src/config.ts` - pond size and sun direction

## Good first tweaks

1. More fish: change `new KoiSchool(9)` in `main.ts`.
2. Your own koi: add a colour combo to `PALETTES` in `koi.ts`.
3. Faster or slower rings: change `age * 1.7` in `water.ts`.
4. A heavier blossom storm: raise `COUNT` in `petals.ts`.
5. Golden hour: lower the middle number of `SUN_DIR` in `config.ts`, then warm up `uHorizon` and `uZenith` in `water.ts`.
