import {
  S3FileRef,
  signGetFileUrl,
  unwrapRelation,
} from "@/app/api/_shared/s3";
import type { Json } from "@/types/database.types";

interface ProjectNode {
  id: string;
  project_id: string;
  type: string;
  parent_id: string | null;
  sort_index: number;
  name: string;
  asset_id: string | null;
  transforms?: Json;
  last_updated: string;
  asset?: {
    meta: object;
    id: string;
    name: string;
    part_type: string;
    model_file?: S3FileRef | S3FileRef[] | null;
    preview_file?: S3FileRef | S3FileRef[] | null;
  } | null;
}

interface LibraryAsset {
  id: string;
  name: string;
  part_type: string | null;
  upload_date: string | null;
  model_file?: S3FileRef | S3FileRef[] | null;
  preview_file?: S3FileRef | S3FileRef[] | null;
}

export async function mapNodeRow(node: ProjectNode) {
  const modelFile = unwrapRelation(node.asset?.model_file);
  const previewFile = unwrapRelation(node.asset?.preview_file);

  return {
    id: node.id,
    project_id: node.project_id,
    type: node.type,
    parent_id: node.parent_id,
    sort_index: node.sort_index,
    name: node.name,
    asset_id: node.asset_id,
    transforms: node.transforms ?? {},
    last_updated: node.last_updated,
    asset: node.asset
      ? {
          id: node.asset.id,
          name: node.asset.name,
          part_type: node.asset.part_type,
          meta: node.asset.meta ?? {},
          modelUrl: await signGetFileUrl(modelFile, { expiresIn: 60 }),
          previewUrl: await signGetFileUrl(previewFile, { expiresIn: 60 }),
        }
      : null,
  };
}

export async function mapLibraryAssetRow(asset: LibraryAsset) {
  const modelFile = unwrapRelation(asset.model_file);
  const previewFile = unwrapRelation(asset.preview_file);

  return {
    id: asset.id,
    name: asset.name,
    part_type: asset.part_type,
    upload_date: asset.upload_date,
    modelUrl: await signGetFileUrl(modelFile, { expiresIn: 60 }),
    previewUrl: await signGetFileUrl(previewFile, { expiresIn: 60 }),
  };
}
