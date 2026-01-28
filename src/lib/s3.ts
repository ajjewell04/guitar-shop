import { S3Client } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { fromIni } from "@aws-sdk/credential-providers";

const isVercel = process.env.VERCEL === "1";

const credentials = isVercel
  ? awsCredentialsProvider({
      roleArn: process.env.AWS_ROLE_ARN!,
      roleSessionName: process.env.AWS_ROLE_ARN!,
    })
  : fromIni({ profile: process.env.AWS_PROFILE });

export const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials,
});

export const S3_BUCKET = process.env.S3_BUCKET!;
