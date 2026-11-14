/**
 * Cloudflare R2 Storage Module
 * Handles upload/download operations for video files using S3-compatible API
 */

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');

// Initialize R2 Client (S3 compatible)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'easy-edits-videos';
const PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL;

/**
 * Upload a video file to R2
 * @param {Buffer|string} fileOrPath - File buffer or path to file
 * @param {string} filename - Filename to use in R2
 * @param {string} folder - Optional folder prefix (e.g., 'inputs' or 'outputs')
 * @returns {Promise<{key: string, url: string}>}
 */
async function uploadVideo(fileOrPath, filename, folder = 'inputs') {
  let fileBuffer;

  if (typeof fileOrPath === 'string') {
    // It's a file path
    fileBuffer = fs.readFileSync(fileOrPath);
  } else {
    // It's already a buffer
    fileBuffer = fileOrPath;
  }

  const key = `${folder}/${filename}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: 'video/mp4',
  });

  await r2Client.send(command);

  // Return both the key and a public URL if available
  const url = PUBLIC_URL ? `${PUBLIC_URL}/${key}` : null;

  return { key, url };
}

/**
 * Get a signed URL for downloading a video (valid for 1 hour)
 * @param {string} key - The R2 object key
 * @returns {Promise<string>}
 */
async function getSignedDownloadUrl(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
  return signedUrl;
}

/**
 * Get a signed URL for uploading a video (valid for 1 hour)
 * @param {string} key - The R2 object key
 * @returns {Promise<string>}
 */
async function getSignedUploadUrl(key) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: 'video/mp4',
  });

  const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
  return signedUrl;
}

/**
 * Delete a video from R2
 * @param {string} key - The R2 object key
 */
async function deleteVideo(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
}

/**
 * Get the public URL for a video (if public access is enabled)
 * @param {string} key - The R2 object key
 * @returns {string|null}
 */
function getPublicUrl(key) {
  if (!PUBLIC_URL) return null;
  return `${PUBLIC_URL}/${key}`;
}

/**
 * Test R2 connection by listing bucket contents
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 1,
    });
    await r2Client.send(command);
    return true;
  } catch (error) {
    console.error('R2 connection test failed:', error.message);
    return false;
  }
}

module.exports = {
  uploadVideo,
  getSignedDownloadUrl,
  getSignedUploadUrl,
  deleteVideo,
  getPublicUrl,
  testConnection,
  BUCKET_NAME,
};
