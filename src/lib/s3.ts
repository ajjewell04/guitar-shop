import { S3Client } from "@aws-sdk/client-s3";
import { ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { fromIni } from "@aws-sdk/credential-providers";

const isVercel = process.env.VERCEL === "1";

const credentials = isVercel
  ? awsCredentialsProvider({
      roleArn: process.env.AWS_ROLE_ARN!,
      roleSessionName: `guitarshop-${process.env.VERCEL_ENV}-session`,
    })
  : fromIni({ profile: process.env.AWS_PROFILE });

export const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials,
});

export async function userS3Folder(userID: string) {
  const userPrefix = `users/${userID}/`;

  const listResults = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET!,
      Prefix: userPrefix,
      MaxKeys: 1,
    }),
  );

  if ((listResults.KeyCount ?? 0) > 0) {
    return;
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: `${userPrefix}/models/.keep`,
      Body: "",
      ContentType: "text/plain",
    }),
  );
}

export const S3_BUCKET = process.env.S3_BUCKET!;
