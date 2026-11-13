"use client";

import * as React from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BODY_ANCHORS } from "./body-anchors";
import type { BodyModel } from "@/lib/body-model-settings";

export interface SceneSystem {
  id: string;
  label: string;
  status: string | null;
}

interface BodySceneProps {
  model: BodyModel;
  systems: SceneSystem[];
  active: string | null;
  onSelect: (systemId: string) => void;
  onReady: () => void;
  onFail: () => void;
}

type StatusName = "nominal" | "watch" | "critical" | "insufficient";

const ICONS = {
  nominal: CheckCircle2,
  watch: AlertCircle,
  critical: AlertTriangle,
  insufficient: HelpCircle,
} as const;

const DOT_CLASSES: Record<StatusName, string> = {
  nominal: "bg-status-nominal-dot",
  watch: "bg-status-watch-dot",
  critical: "bg-status-critical-dot",
  insufficient: "bg-status-insufficient-dot",
};

const BODY_HEIGHT = 1.75;
const FOV = 30;
const CENTRE = new THREE.Vector3(0, 0.9, 0);

function toStatus(status: string | null): StatusName {
  return status === "nominal" || status === "watch" || status === "critical" || status === "insufficient"
    ? status
    : "insufficient";
}

function statusDotColour(status: string | null): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--status-${toStatus(status)}-dot`)
    .trim();
}

function disposeMaterial(material: THREE.Material): void {
  const textured = material as THREE.Material & { map?: THREE.Texture | null };
  textured.map?.dispose();
  material.dispose();
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
  });
}

export default function BodyScene({ model, systems, active, onSelect, onReady, onFail }: BodySceneProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const markerRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const apiRef = React.useRef<{ select: (id: string | null) => void } | null>(null);
  const systemsRef = React.useRef(systems);
  const activeRef = React.useRef(active);
  const onReadyRef = React.useRef(onReady);
  const onFailRef = React.useRef(onFail);

  React.useEffect(() => {
    systemsRef.current = systems;
  }, [systems]);

  React.useEffect(() => {
    activeRef.current = active;
  }, [active]);

  React.useEffect(() => {
    onReadyRef.current = onReady;
    onFailRef.current = onFail;
  }, [onReady, onFail]);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let glow: THREE.Sprite | null = null;
    let modelRoot: THREE.Object3D | null = null;
    let desiredTarget = CENTRE.clone();
    let desiredDistance = 0;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "3D body model. Use the list to choose a body system.");
    renderer.domElement.className = "h-full w-full";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-2, 3, 4);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = THREE.MathUtils.degToRad(60);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(100);
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.7;

    const stopAutoRotate = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener("start", stopAutoRotate);
    renderer.domElement.addEventListener("keydown", stopAutoRotate);

    const fitDistance = () => {
      const half = (BODY_HEIGHT / 2) * 1.2;
      return half / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    };

    const placeCamera = () => {
      const distance = fitDistance();
      desiredDistance = distance;
      desiredTarget = CENTRE.clone();
      camera.position.set(0, CENTRE.y, distance);
      controls.target.copy(CENTRE);
      controls.minDistance = distance * 0.6;
      controls.maxDistance = distance * 1.5;
      controls.update();
    };
    placeCamera();

    const makeGlow = (colour: string): THREE.Sprite | null => {
      if (!colour) return null;
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) return null;
      const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, colour);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
      );
      sprite.scale.setScalar(0.42);
      return sprite;
    };

    const clearGlow = () => {
      if (!glow) return;
      glow.removeFromParent();
      const material = glow.material as THREE.SpriteMaterial;
      material.map?.dispose();
      material.dispose();
      glow = null;
    };

    const api = {
      select(id: string | null) {
        stopAutoRotate();
        const anchor = id ? BODY_ANCHORS[id] : null;
        if (anchor) {
          desiredTarget = new THREE.Vector3(anchor.x, anchor.y, anchor.z);
          desiredDistance = Math.max(fitDistance() * 0.62, 1.5);
          clearGlow();
          const system = systemsRef.current.find((entry) => entry.id === id) ?? null;
          const sprite = makeGlow(statusDotColour(system?.status ?? null));
          if (sprite) {
            sprite.position.set(anchor.x, anchor.y, anchor.z);
            scene.add(sprite);
            glow = sprite;
          }
        } else {
          desiredTarget = CENTRE.clone();
          desiredDistance = fitDistance();
          clearGlow();
        }
      },
    };
    apiRef.current = api;
    api.select(activeRef.current);

    const draco = new DRACOLoader().setDecoderPath("/draco/");
    draco.setDecoderConfig({ type: "wasm" });
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.load(
      `/models/body-${model}.glb`,
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        const body = gltf.scene.getObjectByName("Body");
        if (!body) {
          onFailRef.current();
          return;
        }
        modelRoot = gltf.scene;
        modelRoot.updateMatrixWorld(true);
        const bodyBox = new THREE.Box3().setFromObject(body);
        const size = bodyBox.getSize(new THREE.Vector3());
        const scale = BODY_HEIGHT / Math.max(size.y, 0.0001);
        modelRoot.scale.setScalar(scale);
        modelRoot.updateMatrixWorld(true);
        const scaledBody = new THREE.Box3().setFromObject(body);
        modelRoot.position.x -= (scaledBody.min.x + scaledBody.max.x) / 2;
        modelRoot.position.z -= (scaledBody.min.z + scaledBody.max.z) / 2;
        modelRoot.position.y -= scaledBody.min.y;
        scene.add(modelRoot);
        onReadyRef.current();
      },
      undefined,
      () => {
        if (!disposed) onFailRef.current();
      }
    );

    const projected = new THREE.Vector3();
    const updateMarkers = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const frontFacing = camera.position.z > 0;
      for (const system of systemsRef.current) {
        const element = markerRefs.current[system.id];
        const anchor = BODY_ANCHORS[system.id];
        if (!element || !anchor || width === 0 || height === 0) continue;
        projected.set(anchor.x, anchor.y, anchor.z).project(camera);
        const x = (projected.x * 0.5 + 0.5) * width;
        const y = (-projected.y * 0.5 + 0.5) * height;
        element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        element.style.display = "";
        element.style.opacity = frontFacing ? "1" : "0.25";
        element.tabIndex = frontFacing ? 0 : -1;
      }
    };

    const render = () => {
      if (!reduceMotion) {
        controls.target.lerp(desiredTarget, 0.12);
        const offset = camera.position.clone().sub(controls.target);
        const distance = offset.length();
        if (distance > 0.0001 && desiredDistance > 0) {
          const next = THREE.MathUtils.lerp(distance, desiredDistance, 0.12);
          camera.position.copy(controls.target).add(offset.multiplyScalar(next / distance));
        }
      } else {
        controls.target.copy(desiredTarget);
        const offset = camera.position.clone().sub(controls.target);
        const distance = offset.length();
        if (distance > 0.0001 && desiredDistance > 0) {
          camera.position.copy(controls.target).add(offset.multiplyScalar(desiredDistance / distance));
        }
      }
      controls.update();
      updateMarkers();
      renderer.render(scene, camera);
    };

    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let onScreen = true;
    const intersection = new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      setRunning(!document.hidden && onScreen);
    });
    intersection.observe(host);

    let running = false;
    const setRunning = (next: boolean) => {
      if (next === running) return;
      running = next;
      renderer.setAnimationLoop(next ? render : null);
    };
    const onVisibility = () => setRunning(!document.hidden && onScreen);
    document.addEventListener("visibilitychange", onVisibility);
    setRunning(true);

    return () => {
      disposed = true;
      apiRef.current = null;
      renderer.setAnimationLoop(null);
      document.removeEventListener("visibilitychange", onVisibility);
      intersection.disconnect();
      resizeObserver.disconnect();
      controls.removeEventListener("start", stopAutoRotate);
      renderer.domElement.removeEventListener("keydown", stopAutoRotate);
      clearGlow();
      if (modelRoot) disposeObject(modelRoot);
      controls.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      draco.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [model]);

  React.useEffect(() => {
    apiRef.current?.select(active);
  }, [active]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0">
        {systems.map((system) => {
          const name = toStatus(system.status);
          const Icon = ICONS[name];
          const selected = active === system.id;
          return (
            <button
              key={system.id}
              type="button"
              ref={(element) => {
                markerRefs.current[system.id] = element;
              }}
              onClick={() => onSelect(system.id)}
              aria-pressed={selected}
              aria-label={`${system.label}: ${system.status ?? "no data yet"}`}
              className="pointer-events-auto absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full focus-ring"
              style={{ display: "none" }}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white",
                  DOT_CLASSES[name],
                  selected && "scale-110"
                )}
              >
                <Icon className="h-3.5 w-3.5 text-white" aria-hidden />
              </span>
              {selected && (
                <span className="pointer-events-none absolute left-full top-1/2 ml-1 whitespace-nowrap rounded-full bg-card px-2 py-0.5 text-xs font-medium text-foreground shadow-card">
                  {system.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
