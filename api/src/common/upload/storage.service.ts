import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import { join, resolve } from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string = '';
  private publicUrl: string = '';

  constructor() {
    this.initR2();
  }

  private initR2() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;

    if (accountId && accessKeyId && secretAccessKey && bucketName) {
      try {
        this.s3Client = new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        this.bucketName = bucketName;
        this.publicUrl = (process.env.R2_PUBLIC_URL || '')
          .replace(/^https?:\/\//, '')
          .replace(/\/$/, '');
        this.logger.log(
          `Cloudflare R2 storage initialized for bucket: ${bucketName}`,
        );
      } catch (err: any) {
        this.logger.error(`Failed to initialize Cloudflare R2: ${err.message}`);
        this.s3Client = null;
      }
    } else {
      this.logger.log(
        'Cloudflare R2 credentials not configured. Using local disk storage (/uploads).',
      );
    }
  }

  public isR2Configured(): boolean {
    return this.s3Client !== null && !!this.bucketName;
  }

  /**
   * Uploads a file to Cloudflare R2 (or retains local disk path if R2 is not configured
   * or if the file belongs to a private subfolder).
   * Returns the URL/path to store in the database.
   */
  async uploadFile(
    file: Express.Multer.File,
    subfolder: string,
  ): Promise<string> {
    if (!file) {
      throw new Error('No file provided for upload');
    }

    const localUrl = `/uploads/${subfolder}/${file.filename}`;

    // Private subfolders MUST remain on local disk under PRIVATE_UPLOAD_ROOT
    const privateSubfolders = ['staff-documents', 'purchase-documents', 'expenses'];
    if (privateSubfolders.includes(subfolder.replace(/[^a-zA-Z0-9_-]/g, ''))) {
      return localUrl;
    }

    if (!this.isR2Configured()) {
      return localUrl;
    }

    try {
      const key = `${subfolder}/${file.filename}`;
      let body: Buffer;

      if (file.buffer) {
        body = file.buffer;
      } else if (file.path && fs.existsSync(file.path)) {
        body = fs.readFileSync(file.path);
      } else {
        return localUrl;
      }

      await this.s3Client!.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: body,
          ContentType: file.mimetype,
        }),
      );

      // Clean up local temp file once safely uploaded to R2
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // Non-blocking cleanup
        }
      }

      const finalUrl = this.publicUrl
        ? `https://${this.publicUrl}/${key}`
        : `https://${this.bucketName}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

      this.logger.log(`Uploaded to Cloudflare R2: ${finalUrl}`);
      return finalUrl;
    } catch (err: any) {
      this.logger.error(
        `Cloudflare R2 upload failed for ${file.filename}: ${err.message}. Falling back to local.`,
      );
      return localUrl;
    }
  }

  /**
   * Batch uploads multiple files to R2 or returns local URLs.
   */
  async uploadFiles(
    files: Express.Multer.File[],
    subfolder: string,
  ): Promise<string[]> {
    if (!files || files.length === 0) return [];
    return Promise.all(files.map((file) => this.uploadFile(file, subfolder)));
  }

  /**
   * Deletes a file from R2 if configured.
   */
  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;

    if (
      this.isR2Configured() &&
      (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))
    ) {
      try {
        const urlObj = new URL(fileUrl);
        const key = urlObj.pathname.replace(/^\//, '');
        await this.s3Client!.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          }),
        );
        this.logger.log(`Deleted from Cloudflare R2: ${key}`);
      } catch (err: any) {
        this.logger.warn(
          `Failed to delete object from R2 (${fileUrl}): ${err.message}`,
        );
      }
    }
  }

  /**
   * Safely unlinks a file from local disk or R2 bucket.
   * Enforces path containment to prevent directory traversal.
   * Never throws exceptions.
   */
  async safeUnlink(fileUrlOrPath: string | null | undefined): Promise<boolean> {
    if (!fileUrlOrPath) return false;

    // Handle R2 URLs
    if (fileUrlOrPath.startsWith('http://') || fileUrlOrPath.startsWith('https://')) {
      await this.deleteFile(fileUrlOrPath);
      return true;
    }

    try {
      let relativePath = fileUrlOrPath.replace(/^\/?uploads\//, '').replace(/^\//, '');
      const parts = relativePath.split('/');
      if (parts.length < 2) return false;

      const subfolder = parts[0];
      const filename = parts.slice(1).join('/');

      const uploadRoot = process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
      const privateRoot = process.env.PRIVATE_UPLOAD_ROOT || join(process.cwd(), 'private-uploads');

      const candidatePaths = [
        join(uploadRoot, subfolder, filename),
        join(privateRoot, subfolder, filename),
      ];

      for (const targetPath of candidatePaths) {
        const resolved = resolve(targetPath);
        const isWithinUpload = resolved.startsWith(resolve(uploadRoot));
        const isWithinPrivate = resolved.startsWith(resolve(privateRoot));

        if ((isWithinUpload || isWithinPrivate) && fs.existsSync(resolved)) {
          fs.unlinkSync(resolved);
          this.logger.log(`Safely unlinked local file: ${resolved}`);
          return true;
        }
      }
      return false;
    } catch (err: any) {
      this.logger.warn(`Failed to safely unlink file (${fileUrlOrPath}): ${err.message}`);
      return false;
    }
  }
}

// Global singleton instance for helper usage outside DI contexts
export const storageService = new StorageService();
