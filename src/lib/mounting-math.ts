import * as THREE from "three";
import { MM_TO_WORLD, type MountingAnchor } from "@/lib/mounting";
import {
  nodeTransformsFromMatrix,
  type NodeTransforms,
} from "@/lib/node-hierarchy";

function anchorToMatrix(anchor: MountingAnchor): THREE.Matrix4 {
  const position = new THREE.Vector3(
    anchor.positionMm.x * MM_TO_WORLD,
    anchor.positionMm.y * MM_TO_WORLD,
    anchor.positionMm.z * MM_TO_WORLD,
  );
  const rotation = new THREE.Euler(
    THREE.MathUtils.degToRad(anchor.rotationDeg.x),
    THREE.MathUtils.degToRad(anchor.rotationDeg.y),
    THREE.MathUtils.degToRad(anchor.rotationDeg.z),
  );
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  const scale = new THREE.Vector3(
    anchor.scale.x,
    anchor.scale.y,
    anchor.scale.z,
  );
  return new THREE.Matrix4().compose(position, quaternion, scale);
}

export function computeSnappedNeckLocalTransforms(args: {
  bodyWorldMatrix: THREE.Matrix4;
  bodyAnchor: MountingAnchor;
  neckAnchor: MountingAnchor;
}): NodeTransforms {
  const bodyAnchorWorld = args.bodyWorldMatrix
    .clone()
    .multiply(anchorToMatrix(args.bodyAnchor));
  const neckAnchorInv = anchorToMatrix(args.neckAnchor).invert();
  const neckWorld = bodyAnchorWorld.multiply(neckAnchorInv);
  const bodyWorldInv = args.bodyWorldMatrix.clone().invert();
  const neckLocal = bodyWorldInv.multiply(neckWorld);
  return nodeTransformsFromMatrix(neckLocal);
}

export function computeLocalTransformsFromWorld(args: {
  parentWorldMatrix: THREE.Matrix4;
  childWorldMatrix: THREE.Matrix4;
}): NodeTransforms {
  const parentWorldInv = args.parentWorldMatrix.clone().invert();
  const local = parentWorldInv.multiply(args.childWorldMatrix.clone());
  return nodeTransformsFromMatrix(local);
}
