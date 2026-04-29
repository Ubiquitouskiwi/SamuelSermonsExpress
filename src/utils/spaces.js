/**
 * DigitalOcean Spaces utility module.
 * Spaces is S3-compatible, so we use the AWS SDK.
 */
const { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand, CopyObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com',
  region: 'nyc3',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY || '',
    secretAccessKey: process.env.DO_SPACES_SECRET || '',
  },
  forcePathStyle: false,
});

const BUCKET = process.env.DO_SPACES_BUCKET || 'starlingtek-samuel-sermons';
const CDN_BASE = process.env.DO_SPACES_CDN || 'https://starlingtek-samuel-sermons.nyc3.cdn.digitaloceanspaces.com';

// Pipeline stage → directory mapping
const STAGE_DIRS = {
  raw: 'sermons-raw',
  processed: 'sermons-processed',
  transcribed: 'sermons-transcribed',
  final: 'sermons-final',
};

/**
 * List files in a stage directory.
 */
async function listFiles(stage) {
  const prefix = STAGE_DIRS[stage];
  if (!prefix) throw new Error(`Unknown stage: ${stage}`);

  const command = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix + '/',
  });
  const response = await client.send(command);
  const contents = response.Contents || [];
  return contents
    .filter((obj) => obj.Key !== prefix + '/')
    .map((obj) => ({
      key: obj.Key,
      name: obj.Key.replace(prefix + '/', ''),
      size: obj.Size,
      lastModified: obj.LastModified,
      url: `${CDN_BASE}/${obj.Key}`,
    }));
}

/**
 * Upload a file to a stage directory.
 */
async function uploadFile(stage, filename, buffer, contentType) {
  const prefix = STAGE_DIRS[stage];
  if (!prefix) throw new Error(`Unknown stage: ${stage}`);

  const key = `${prefix}/${filename}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType || 'application/pdf',
    ACL: 'public-read',
  });
  await client.send(command);
  return {
    key,
    url: `${CDN_BASE}/${key}`,
  };
}

/**
 * Move a file between stage directories.
 */
async function moveFile(sourceKey, destStage) {
  const destPrefix = STAGE_DIRS[destStage];
  if (!destPrefix) throw new Error(`Unknown stage: ${destStage}`);

  const filename = sourceKey.split('/').pop();
  const destKey = `${destPrefix}/${filename}`;

  // Copy to new location
  await client.send(new CopyObjectCommand({
    Bucket: BUCKET,
    CopySource: `${BUCKET}/${sourceKey}`,
    Key: destKey,
    ACL: 'public-read',
  }));

  // Delete from old location
  await client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: sourceKey,
  }));

  return {
    key: destKey,
    url: `${CDN_BASE}/${destKey}`,
  };
}

/**
 * Delete a file.
 */
async function deleteFile(key) {
  await client.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

/**
 * Get CDN URL for a key.
 */
function getCdnUrl(key) {
  return `${CDN_BASE}/${key}`;
}

module.exports = { listFiles, uploadFile, moveFile, deleteFile, getCdnUrl, STAGE_DIRS };
