import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT, // needed for MinIO / localstack
});

const BUCKET = process.env.S3_BUCKET || "miruns-link";

function key(code: string): string {
  return `sessions/${code}.json`;
}

export async function putSessionData(
  code: string,
  data: unknown,
  expiresAt?: Date,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key(code),
      Body: JSON.stringify(data),
      ContentType: "application/json",
      ...(expiresAt && { Expires: expiresAt }),
    }),
  );
}

export async function getSessionData(
  code: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: key(code) }),
    );
    const body = await res.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name: string }).name === "NoSuchKey"
    ) {
      return null;
    }
    throw err;
  }
}

export async function deleteSessionData(code: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key(code) }));
}
