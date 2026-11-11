"use client";

import * as React from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const WIDTH = 1280;
const HEIGHT = 730;
const FLIGHT_MS = 16_000;
const TILT = -38;
const PEAK_OPACITY = 0.15;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function SpaceShipScene({ onDone }: { onDone: () => void }) {
  const host = React.useRef<HTMLDivElement>(null);
  const done = React.useRef(onDone);

  React.useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  React.useEffect(() => {
    const element = host.current;
    if (!element) return;

    let cancelled = false;
    let frame = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, WIDTH / HEIGHT, 0.01, 200);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(WIDTH, HEIGHT);
    renderer.setClearAlpha(0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "auto";
    element.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x101828, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(1.6, 2.2, 2.0);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9db4ff, 2.2);
    rim.position.set(-2.0, 1.0, -1.6);
    scene.add(rim);

    const draco = new DRACOLoader().setDecoderPath("/draco/");
    draco.setDecoderConfig({ type: "wasm" });
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    const load = (url: string) =>
      new Promise<THREE.Group>((resolve, reject) =>
        loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject)
      );

    Promise.all([
      load("/models/space-shuttle-d.glb"),
      load("/models/space-shuttle-d-engine.glb"),
      load("/models/space-shuttle-d-door-prt.glb"),
      load("/models/space-shuttle-d-door-stb.glb"),
    ])
      .then(([shuttle, engine, doorPort, doorStarboard]) => {
        if (cancelled) return;
        const root = shuttle;

        // The orbiter ships with an open payload bay and no main engines.
        root.add(doorPort, doorStarboard);
        for (const [x, y, z] of [
          [-538, 0, 50],
          [-538, 53, -51],
          [-538, -53, -51],
        ]) {
          const bell = engine.clone(true);
          bell.position.set(x, y, z);
          root.add(bell);
        }

        root.rotation.set(-Math.PI / 2, 0, 0);
        root.updateMatrixWorld(true);

        let box = new THREE.Box3().setFromObject(root);
        const raw = new THREE.Vector3();
        box.getSize(raw);
        root.scale.setScalar(3.0 / Math.max(raw.x, raw.y, raw.z));
        root.updateMatrixWorld(true);

        box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        const centre = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(centre);

        // Centre the mesh on its own spin axis, so a roll turns it in place
        // instead of swinging it around the scene origin.
        root.position.sub(centre);
        const pivot = new THREE.Group();
        pivot.add(root);
        scene.add(pivot);

        const plume = (radius: number, colour: number, opacity: number) => {
          const geometry = new THREE.ConeGeometry(radius, 1, 28, 1, true);
          geometry.rotateZ(Math.PI / 2);
          geometry.translate(-0.5, 0, 0);
          return new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({
              color: colour,
              transparent: true,
              opacity,
              side: THREE.DoubleSide,
              depthWrite: false,
            })
          );
        };

        const nozzleX = box.min.x - centre.x + 0.0517 * size.x;
        const layout = [
          { y: -0.159 * size.y, z: 0 },
          { y: -0.341 * size.y, z: -0.057 * size.z },
          { y: -0.341 * size.y, z: 0.057 * size.z },
        ];

        const engines = layout.map((offset, index) => {
          const core = plume(0.085, 0x4d8dff, 0.75);
          const halo = plume(0.15, 0xa8ccff, 0.3);
          core.position.set(nozzleX, offset.y, offset.z);
          halo.position.set(nozzleX, offset.y, offset.z);
          core.scale.x = 1.05;
          halo.scale.x = 1.5;
          pivot.add(core, halo);
          return { core, halo, phase: index * 2.1 };
        });

        const longest = Math.max(size.x, size.y, size.z);
        const distance = (longest * 1.06) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
        camera.position.addScaledVector(new THREE.Vector3(0.02, 0.26, 1).normalize(), distance);
        camera.lookAt(0, 0, 0);

        const started = performance.now();

        const tick = (now: number) => {
          const t = Math.min(1, (now - started) / FLIGHT_MS);
          const eased = easeInOut(t);

          pivot.rotation.x = eased * Math.PI * 2;

          for (const engine of engines) {
            const wave = 0.86 + 0.14 * Math.sin(now * 0.018 + engine.phase);
            const flicker = wave * (0.92 + Math.random() * 0.18);
            engine.core.scale.x = 1.05 * flicker;
            engine.halo.scale.x = 1.5 * flicker;
            engine.core.material.opacity = 0.55 + Math.random() * 0.3;
            engine.halo.material.opacity = 0.18 + Math.random() * 0.14;
          }

          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const width = element.offsetWidth;
          const height = element.offsetHeight;
          const x = (-0.15 + eased * 1.3) * vw - width / 2;
          const y = (1.15 - eased * 1.3) * vh - height / 2;

          const fade = t < 0.1 ? t / 0.1 : t > 0.88 ? Math.max(0, (1 - t) / 0.12) : 1;
          element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${TILT}deg)`;
          element.style.opacity = (PEAK_OPACITY * Math.min(1, fade)).toFixed(3);

          renderer.render(scene, camera);

          if (t < 1) {
            frame = window.requestAnimationFrame(tick);
          } else {
            done.current();
          }
        };

        frame = window.requestAnimationFrame(tick);
        draco.dispose();
      })
      .catch(() => {
        // Decoration only: if the models cannot be fetched nothing is shown.
        done.current();
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      draco.dispose();
      renderer.dispose();
      element.replaceChildren();
    };
  }, []);

  return (
    <div
      ref={host}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-0 w-[120vw] select-none opacity-0 will-change-transform"
      style={{ filter: "drop-shadow(0 18px 40px rgb(10 16 30 / 0.35))" }}
    />
  );
}
