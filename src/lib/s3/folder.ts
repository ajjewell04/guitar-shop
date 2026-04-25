import { ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET } from "@/lib/s3/client";

export async function userS3Folder(userID: string) {
  const userPrefix = `users/${userID}/`;

  const listResults = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: userPrefix,
      MaxKeys: 1,
    }),
  );

  if ((listResults.KeyCount ?? 0) > 0) {
    return;
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: `${userPrefix}/models/.keep`,
      Body: "",
      ContentType: "text/plain",
    }),
  );
}
