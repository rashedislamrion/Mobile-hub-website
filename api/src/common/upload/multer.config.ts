import { diskStorage } from 'multer';
import { extname, join, resolve } from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { storageService } from './storage.service';

// D4: SVG uploads are blocked everywhere
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];
const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.pdf',
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const PRIVATE_SUBFOLDERS = [
  'staff-documents',
  'purchase-documents',
  'expenses',
];

export function getUploadRoot(): string {
  return process.env.UPLOAD_ROOT || join(process.cwd(), 'uploads');
}

export function getPrivateUploadRoot(): string {
  return (
    process.env.PRIVATE_UPLOAD_ROOT || join(process.cwd(), 'private-uploads')
  );
}

export function isPrivateSubfolder(subfolder: string): boolean {
  const safe = subfolder.replace(/[^a-zA-Z0-9_-]/g, '');
  return PRIVATE_SUBFOLDERS.includes(safe);
}

/**
 * Validates the file buffer/content against magic byte signatures.
 * Eliminates extension spoofing, 0-byte corrupt files, and embedded SVG vectors.
 */
export function validateFileMagicBytes(filePath: string, originalName: string): void {
  if (!fs.existsSync(filePath)) {
    throw new BadRequestException('Uploaded file does not exist on disk.');
  }

  const stat = fs.statSync(filePath);
  if (stat.size === 0) {
    try { fs.unlinkSync(filePath); } catch {}
    throw new BadRequestException('Empty file (0 bytes) cannot be uploaded.');
  }

  if (stat.size > MAX_FILE_SIZE) {
    try { fs.unlinkSync(filePath); } catch {}
    throw new BadRequestException('File size exceeds the 5MB maximum limit.');
  }

  // Read first 64 bytes for signature detection
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(64);
  const bytesRead = fs.readSync(fd, buffer, 0, 64, 0);
  fs.closeSync(fd);

  if (bytesRead < 4) {
    try { fs.unlinkSync(filePath); } catch {}
    throw new BadRequestException('File content is truncated or unreadable.');
  }

  // Reject any embedded SVG/XML indicators regardless of claimed extension
  const headerText = buffer.toString('utf8', 0, bytesRead).toLowerCase();
  if (
    headerText.includes('<svg') ||
    headerText.includes('<?xml') ||
    headerText.includes('<!doctype svg')
  ) {
    try { fs.unlinkSync(filePath); } catch {}
    throw new BadRequestException(
      'SVG files and XML vectors are strictly disallowed for security reasons.',
    );
  }

  const ext = extname(originalName).toLowerCase();
  let detectedType: 'jpeg' | 'png' | 'webp' | 'gif' | 'pdf' | null = null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedType = 'jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  else if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedType = 'png';
  }
  // GIF: 47 49 46 38 ('GIF8')
  else if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38
  ) {
    detectedType = 'gif';
  }
  // PDF: 25 50 44 46 ('%PDF')
  else if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    detectedType = 'pdf';
  }
  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  else if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    detectedType = 'webp';
  }

  if (!detectedType) {
    try { fs.unlinkSync(filePath); } catch {}
    throw new BadRequestException(
      'Invalid file content. File does not match supported formats (JPEG, PNG, WebP, GIF, PDF).',
    );
  }

  // Verify match with extension
  const validExtensionsForType: Record<string, string[]> = {
    jpeg: ['.jpg', '.jpeg'],
    png: ['.png'],
    webp: ['.webp'],
    gif: ['.gif'],
    pdf: ['.pdf'],
  };

  if (!validExtensionsForType[detectedType]?.includes(ext)) {
    try { fs.unlinkSync(filePath); } catch {}
    throw new BadRequestException(
      `File content signature (${detectedType.toUpperCase()}) does not match claimed file extension "${ext}".`,
    );
  }
}

export function createMulterConfig(subfolder: string): MulterOptions {
  // Prevent directory traversal: sanitize subfolder to alphanumeric, dash, and underscore
  const safeSubfolder = subfolder.replace(/[^a-zA-Z0-9_-]/g, '');
  const isPrivate = isPrivateSubfolder(safeSubfolder);

  return {
    storage: diskStorage({
      destination: (req, file, callback) => {
        const root = isPrivate ? getPrivateUploadRoot() : getUploadRoot();
        const uploadDir = join(root, safeSubfolder);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        callback(null, uploadDir);
      },
      filename: (req, file, callback) => {
        const fileExt = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
          return callback(
            new BadRequestException(
              `Disallowed file extension "${fileExt}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
            ),
            '',
          );
        }
        const baseName = file.originalname
          .replace(fileExt, '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .slice(0, 50); // Prevent excessively long filenames
        const uniqueId = crypto.randomUUID();
        const safeFilename = `${uniqueId}-${baseName}${fileExt}`;
        callback(null, safeFilename);
      },
    }),
    fileFilter: (req, file, callback) => {
      const fileExt = extname(file.originalname).toLowerCase();
      if (
        !ALLOWED_MIME_TYPES.includes(file.mimetype) ||
        !ALLOWED_EXTENSIONS.includes(fileExt)
      ) {
        return callback(
          new BadRequestException(
            `Invalid file type (${file.mimetype}) or extension (${fileExt}). Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}. SVGs are strictly disallowed.`,
          ),
          false,
        );
      }
      callback(null, true);
    },
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  };
}

/**
 * Resolves an uploaded file to its storage URL (Cloudflare R2 public URL or local disk URL)
 * after verifying its magic byte signatures.
 */
export async function resolveUploadedFile(
  file: Express.Multer.File | undefined | null,
  subfolder: string,
): Promise<string | null> {
  if (!file) return null;
  if (file.path) {
    validateFileMagicBytes(file.path, file.originalname);
  }
  return storageService.uploadFile(file, subfolder);
}

/**
 * Resolves multiple uploaded files to storage URLs after verifying magic byte signatures.
 */
export async function resolveUploadedFiles(
  files: Express.Multer.File[] | undefined | null,
  subfolder: string,
): Promise<string[]> {
  if (!files || files.length === 0) return [];
  for (const file of files) {
    if (file.path) {
      validateFileMagicBytes(file.path, file.originalname);
    }
  }
  return storageService.uploadFiles(files, subfolder);
}
