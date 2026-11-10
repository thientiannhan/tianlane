import crypto from 'node:crypto';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB Free-Tier Guard

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Generates an AWS Signature V4 Presigned PUT URL for Cloudflare R2.
 * Strictly stateless: zero local disk I/O (/tmp or ./uploads is never touched).
 */
export function createR2PresignedPutUrl({
  fileName,
  contentType = 'application/octet-stream',
  fileSizeBytes = 0,
  projectId = 'general',
  env = process.env,
}) {
  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error('File exceeds 50 MB limit.');
  }

  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const bucketName = env.R2_BUCKET_NAME || 'tianlane-deliverables';
  const publicDomain = (
    env.R2_PUBLIC_DOMAIN || `https://pub-${accountId || 'demo'}.r2.dev`
  ).replace(/\/+$/, '');

  const safeName = String(fileName || 'deliverable.bin').replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );
  const objectKey = `projects/${encodeRfc3986(projectId)}/${Date.now()}-${safeName}`;

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    accountId === 'your_cloudflare_account_id'
  ) {
    return {
      configured: false,
      objectKey,
      uploadUrl: null,
      publicUrl: `${publicDomain}/${objectKey}`,
      expiresIn: 900,
      message:
        'R2 credentials not set in environment; using Smart Link metadata mode.',
    };
  }

  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalUri = `/${encodeRfc3986(bucketName)}/${objectKey
    .split('/')
    .map(encodeRfc3986)
    .join('/')}`;

  const queryParams = new Map([
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Content-Sha256', 'UNSIGNED-PAYLOAD'],
    ['X-Amz-Credential', `${accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', '900'],
    ['X-Amz-SignedHeaders', 'content-type;host'],
  ]);

  const canonicalQueryString = [...queryParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .join('&');

  const canonicalHeaders = `content-type:${contentType.trim()}\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto
    .createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const uploadUrl = `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

  return {
    configured: true,
    objectKey,
    uploadUrl,
    publicUrl: `${publicDomain}/${objectKey}`,
    expiresIn: 900,
  };
}
