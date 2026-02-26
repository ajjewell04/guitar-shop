"use client";

import { useMemo } from "react";
import { type NeckParams } from "@/lib/neck-params";
import { buildProceduralNeckMesh } from "@/lib/procedural-neck";

const WORLD_SCALE = 0.001;

export default function ProceduralNeckMesh({ params }: { params: NeckParams }) {
  const mesh = useMemo(
    () => buildProceduralNeckMesh(params),
    [JSON.stringify(params)],
  );

  return (
    <primitive object={mesh} scale={[WORLD_SCALE, WORLD_SCALE, WORLD_SCALE]} />
  );
}
