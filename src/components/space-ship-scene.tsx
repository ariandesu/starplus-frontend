"use client";

import * as React from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const WIDTH = 1120;
const HEIGHT = 640;

export default function SpaceShipScene({ onReady }: { onReady: () => void }) {
  const host = React.useRef<HTMLDivElement>(null);
  const ready = React.useRef(onReady);

  React.useEffect(() => {
    ready.current = onReady;
  }, [onReady]);

  React.useEffect(() => {
    const element = host.current;
    if (!element) return;

    let cancelled = false;
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

    new GLTFLoader().load(
      "/models/space-shuttle.glb",
      (gltf) => {
        if (cancelled) return;
        const root = gltf.scene;
        root.rotation.y = -Math.PI / 2;
        scene.add(root);

        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        const centre = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(centre);
        const longest = Math.max(size.x, size.y, size.z);
        const distance = (longest * 1.1) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
        camera.position.copy(centre).addScaledVector(new THREE.Vector3(0.02, 0.26, 1).normalize(), distance);
        camera.lookAt(centre);

        renderer.render(scene, camera);
        ready.current();
      },
      undefined,
      () => {
        // Decoration only: if the model cannot be fetched the page is unchanged.
      }
    );

    return () => {
      cancelled = true;
      renderer.dispose();
      element.replaceChildren();
    };
  }, []);

  return <div ref={host} className="w-full" />;
}
