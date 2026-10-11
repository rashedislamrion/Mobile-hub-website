import { NotFoundException } from '@nestjs/common';
import { extname, join, resolve } from 'path';
import * as fs from 'fs';
import { Response } from 'express';
import { getUploadRoot, getPrivateUploadRoot } from './multer.config';

/**
 * Resolves a private document from disk.
 * First checks PRIVATE_UPLOAD_ROOT, then falls back to UPLOAD_ROOT for legacy files.
 * Enforces strict directory containment to prevent path traversal.
 */
export function resolvePrivateFilePath(
  subfolder: string,
  storedPathOrFilename: string | null | undefined,
): string | null {
  if (!storedPathOrFilename) return null;

  // Extract clean filename without path traversal characters
  const cleanFilename = storedPathOrFilename.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!cleanFilename) return null;

  const safeSubfolder = subfolder.replace(/[^a-zA-Z0-9_-]/g, '');
  const privateRoot = getPrivateUploadRoot();
  const publicRoot = getUploadRoot();

  const candidates = [
    join(privateRoot, safeSubfolder, cleanFilename),
    join(publicRoot, safeSubfolder, cleanFilename),
  ];

  for (const candidate of candidates) {
    const resolved = resolve(candidate);
    const inPrivate = resolved.startsWith(resolve(privateRoot));
    const inPublic = resolved.startsWith(resolve(publicRoot));
    if ((inPrivate || inPublic) && fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return null;
}

/**
 * Streams a local file to the Express Response with correct headers.
 */
export function streamLocalFile(
  filePath: string,
  res: Response,
  customFilename?: string,
): void {
  if (!fs.existsSync(filePath)) {
    throw new NotFoundException('The requested document was not found on disk.');
  }

  const ext = extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
  };

  const contentType = mimeMap[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

  const filename = customFilename || filePath.split('/').pop() || 'document';
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(filename)}"`,
  );

  const stream = fs.createReadStream(filePath);
  stream.on('error', (err) => {
    if (!res.headersSent) {
      res.status(500).json({ statusCode: 500, message: 'Error streaming file' });
    }
  });
  stream.pipe(res);
}
