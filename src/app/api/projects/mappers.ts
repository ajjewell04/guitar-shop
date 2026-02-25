import {
  signGetFileUrl,
  unwrapRelation,
  type S3FileRef,
} from "@/app/api/_shared/s3";

type ProjectListRow = {
  id: string;
  owner_id: string;
  name: string;
  created_on: string;
  last_updated: string;
  preview_file?: S3FileRef | S3FileRef[] | null;
};

export async function mapProjectListRow(project: ProjectListRow) {
  const preview = unwrapRelation(project.preview_file);
  return {
    id: project.id,
    owner_id: project.owner_id,
    name: project.name,
    created_on: project.created_on,
    last_updated: project.last_updated,
    previewUrl: await signGetFileUrl(preview, { expiresIn: 300 }),
  };
}
