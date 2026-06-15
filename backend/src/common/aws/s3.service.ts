/**
 * S3Service - Amazon S3 Interaction Layer
 *
 * Provides methods for:
 *   - Generating presigned upload URLs (so users can upload directly to S3)
 *   - Retrieving object URLs
 *   - Copying OCR results to the processed bucket
 *
 * In local development, all calls are directed at Floci (http://localhost:4566)
 * instead of real AWS S3. The SDK configuration applies forcePathStyle since
 * Floci does not support virtual-hosted-style S3 URLs.
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class S3Service {
  // Floci endpoint (or real AWS endpoint in production)
  private readonly endpoint: string;

  // AWS region (used in SDK client initialization)
  private readonly region: string;

  // S3 bucket for raw uploaded documents
  private readonly rawBucket = 'dvp-documents-raw';

  // S3 bucket for OCR-processed results (JSON files)
  private readonly processedBucket = 'dvp-documents-processed';

  constructor() {
    this.endpoint = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
    this.region = process.env.AWS_DEFAULT_REGION || 'us-east-1';
  }

  /**
   * Generate a presigned PUT URL that allows the frontend to upload a file
   * directly to S3 without exposing AWS credentials.
   *
   * The URL expires in 1 hour (3600 seconds).
   *
   * @param s3Key - The S3 object key (path) for the document
   * @returns A presigned URL string for direct PUT upload
   */
  /**
   * Upload a file buffer directly to S3 (server-side).
   * Used when the frontend sends the file to the backend instead of
   * uploading directly to S3 (avoids CORS issues in local dev).
   *
   * @param s3Key  - The S3 object key
   * @param buffer - The file content as a Buffer
   * @param contentType - MIME type of the file
   */
  async uploadBuffer(s3Key: string, buffer: Buffer, contentType: string): Promise<void> {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      endpoint: this.endpoint,
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
      },
      forcePathStyle: true,
    });

    await client.send(
      new PutObjectCommand({
        Bucket: this.rawBucket,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  async getSignedUploadUrl(s3Key: string): Promise<string> {
    // Dynamic imports to avoid bundling AWS SDK when not needed
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const client = new S3Client({
      endpoint: this.endpoint,
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
      },
      // Floci requires path-style addressing: http://host:4566/bucket/key
      forcePathStyle: true,
    });

    const command = new PutObjectCommand({
      Bucket: this.rawBucket,
      Key: s3Key,
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });

    // Replace Docker internal hostname with localhost for browser-side uploads.
    // In Docker Compose, the backend uses AWS_ENDPOINT_URL=http://floci:4566,
    // but the browser running on the host cannot resolve the "floci" hostname.
    return url.replace('floci', 'localhost');
  }

  /**
   * Build a direct S3 object URL (no authentication required if bucket is public,
   * but our buckets are private — use presigned URLs for access).
   *
   * @param s3Key - The S3 object key
   * @returns The HTTP URL to the object
   */
  async getObjectUrl(s3Key: string): Promise<string> {
    return `${this.endpoint}/${this.rawBucket}/${s3Key}`;
  }

  /**
   * Copy OCR-extracted data to the processed bucket as a JSON file.
   * The processed file key mirrors the original but replaces "original" with "processed".
   * Example:
   *   Original:  /userId/docId/original.pdf
   *   Processed: /userId/docId/processed.json
   *
   * @param s3Key  - The original document's S3 key
   * @param ocrData - The OCR-extracted data (serialized to JSON)
   */
  async copyToProcessed(s3Key: string, ocrData: Record<string, any>): Promise<void> {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      endpoint: this.endpoint,
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
      },
      forcePathStyle: true,
    });

    // Derive the processed key: replace "original" with "processed" in the filename
    const processedKey = s3Key.replace('/original.', '/processed.');

    await client.send(
      new PutObjectCommand({
        Bucket: this.processedBucket,
        Key: processedKey,
        Body: JSON.stringify(ocrData),
        ContentType: 'application/json',
      }),
    );
  }
}
