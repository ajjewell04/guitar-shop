import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "@/lib/s3";

export type S3FileRef = {
  bucket?: string | null;
  object_key?: string | null;
  mime_type?: string | null;
};

export function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function signGetFileUrl(
  file?: S3FileRef | null,
  opts?: { expiresIn?: number; contentDisposition?: string },
) {
  if (!file?.object_key) return null;

  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: file.bucket ?? S3_BUCKET,
      Key: file.object_key,
      ResponseContentType: file.mime_type ?? undefined,
      ResponseContentDisposition: opts?.contentDisposition,
    }),
    { expiresIn: opts?.expiresIn ?? 60 },
  );
}

export async function signPutObjectUrl(params: {
  objectKey: string;
  contentType: string;
  expiresIn?: number;
}) {
  return getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: params.objectKey,
      ContentType: params.contentType,
    }),
    { expiresIn: params.expiresIn ?? 60 },
  );
}

export async function deleteObjectsByBucket(
  files: Array<{ bucket: string | null; object_key: string | null }>,
) {
  const byBucket = new Map<string, string[]>();

  for (const file of files) {
    if (!file.object_key) continue;
    const bucket = file.bucket ?? S3_BUCKET;
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), file.object_key]);
  }

  for (const [bucket, keys] of byBucket) {
    for (let i = 0; i < keys.length; i += 1000) {
      const objects = keys.slice(i, i + 1000).map((Key) => ({ Key }));
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects, Quiet: true },
        }),
      );
    }
  }
}
