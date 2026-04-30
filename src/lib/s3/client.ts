import { S3Client } from "@aws-sdk/client-s3";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { fromIni } from "@aws-sdk/credential-providers";
import { env } from "@/lib/env";

const isVercel = env.VERCEL === "1";

const credentials = isVercel
  ? awsCredentialsProvider({
      roleArn: env.AWS_ROLE_ARN!,
      roleSessionName: `guitarshop-${env.VERCEL_ENV}-session`,
    })
  : fromIni({ profile: env.AWS_PROFILE });

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials,
});

export const S3_BUCKET = env.S3_BUCKET;
