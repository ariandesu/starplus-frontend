"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { BodyMap } from "@/components/body-map";
import { Skeleton } from "@/components/ui/skeleton";
import type { BodyModel } from "@/lib/body-model-settings";
import type { SceneSystem } from "./body-scene";

const BodyScene = dynamic(() => import("./body-scene"), { ssr: false });

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

interface BodyViewerProps {
  model: BodyModel;
  systems: SceneSystem[];
  active: string | null;
  onSelect: (systemId: string) => void;
  statusFor: (systemId: string) => string | null;
}

export function BodyViewer({ model, systems, active, onSelect, statusFor }: BodyViewerProps) {
  const [supported] = React.useState(() => hasWebGL());
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!supported || failed || ready) return;
    const timer = window.setTimeout(() => setFailed(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [supported, failed, ready]);

  if (!supported || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <BodyMap active={active} statusFor={statusFor} onSelect={onSelect} />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <BodyScene
        model={model}
        systems={systems}
        active={active}
        onSelect={onSelect}
        onReady={() => setReady(true)}
        onFail={() => setFailed(true)}
      />
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card">
          <Skeleton height="12rem" width="8rem" />
          <p className="text-sm text-muted">Loading 3D model…</p>
        </div>
      )}
    </div>
  );
}
