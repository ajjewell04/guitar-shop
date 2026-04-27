import {
  signGetFileUrl,
  unwrapRelation,
  type S3FileRef,
} from "@/app/api/_shared/s3";

type AssetListRow = {
  id: string;
  name: string;
  owner_id: string;
  part_type: string | null;
  upload_date: string | null;
  upload_status: string | null;
  preview_file?: S3FileRef | S3FileRef[] | null;
  model_file?: S3FileRef | S3FileRef[] | null;
};

export async function mapLibraryAssetRow(asset: AssetListRow) {
  const previewFile = unwrapRelation(asset.preview_file);
  const modelFile = unwrapRelation(asset.model_file);

  return {
    id: asset.id,
    name: asset.name,
    owner_id: asset.owner_id,
    part_type: asset.part_type,
    upload_date: asset.upload_date,
    upload_status: asset.upload_status,
    previewUrl: await signGetFileUrl(previewFile, { expiresIn: 60 }),
    modelUrl: await signGetFileUrl(modelFile, { expiresIn: 60 }),
  };
}
