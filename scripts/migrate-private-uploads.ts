#!/usr/bin/env ts-node

import * as fs from "fs";
import * as path from "path";

const PRIVATE_FOLDERS = ["staff-documents", "purchase-documents", "expenses"];

function resolveRoot(envVar: string | undefined, fallbackRelative: string): string {
  if (envVar && envVar.trim()) {
    return path.resolve(envVar.trim());
  }
  return path.resolve(process.cwd(), fallbackRelative);
}

const isApply = process.argv.includes("--apply");
const isDryRun = !isApply;

const uploadRoot = resolveRoot(process.env.UPLOAD_ROOT, "uploads");
const privateUploadRoot = resolveRoot(
  process.env.PRIVATE_UPLOAD_ROOT,
  "private-uploads",
);

console.log("=".repeat(70));
console.log("PASS 50 — PRIVATE UPLOADS MIGRATION SCRIPT");
console.log("=".repeat(70));
console.log(`Mode:                ${isDryRun ? "DRY-RUN (no files moved)" : "APPLY (live migration)"}`);
console.log(`Source (UPLOAD_ROOT):         ${uploadRoot}`);
console.log(`Target (PRIVATE_UPLOAD_ROOT): ${privateUploadRoot}`);
console.log(`Folders:             ${PRIVATE_FOLDERS.join(", ")}`);
console.log("=".repeat(70));

if (!fs.existsSync(uploadRoot)) {
  console.log(`[INFO] Source directory does not exist: ${uploadRoot}`);
  console.log("Nothing to migrate.");
  process.exit(0);
}

if (!isDryRun && !fs.existsSync(privateUploadRoot)) {
  fs.mkdirSync(privateUploadRoot, { recursive: true, mode: 0o750 });
  console.log(`[INFO] Created target directory: ${privateUploadRoot}`);
}

let totalScanned = 0;
let totalCopied = 0;
let totalSkipped = 0;
let totalFailed = 0;

for (const folder of PRIVATE_FOLDERS) {
  const srcDir = path.join(uploadRoot, folder);
  const dstDir = path.join(privateUploadRoot, folder);

  console.log(`\n--- Inspecting folder: ${folder} ---`);
  if (!fs.existsSync(srcDir)) {
    console.log(`  Source directory not found: ${srcDir} (skipped)`);
    continue;
  }

  if (!isDryRun && !fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true, mode: 0o750 });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    totalScanned++;

    const srcFile = path.join(srcDir, entry.name);
    const dstFile = path.join(dstDir, entry.name);

    try {
      const srcStat = fs.statSync(srcFile);

      if (fs.existsSync(dstFile)) {
        const dstStat = fs.statSync(dstFile);
        if (dstStat.size === srcStat.size) {
          console.log(`  [ALREADY MIGRATED] ${folder}/${entry.name} (${srcStat.size} bytes)`);
          if (!isDryRun) {
            fs.unlinkSync(srcFile);
            console.log(`    Cleaned up duplicate source in public root.`);
          }
          totalSkipped++;
          continue;
        } else {
          console.warn(`  [WARNING] Target already exists with different size: ${folder}/${entry.name} (src: ${srcStat.size}b, dst: ${dstStat.size}b). Preserving both.`);
          totalSkipped++;
          continue;
        }
      }

      if (isDryRun) {
        console.log(`  [PLAN MOVE] ${folder}/${entry.name} (${srcStat.size} bytes) -> ${dstFile}`);
        totalCopied++;
      } else {
        fs.copyFileSync(srcFile, dstFile);
        const copiedStat = fs.statSync(dstFile);
        if (copiedStat.size !== srcStat.size) {
          throw new Error(`Size mismatch after copy: expected ${srcStat.size}, got ${copiedStat.size}`);
        }
        fs.unlinkSync(srcFile);
        console.log(`  [MOVED] ${folder}/${entry.name} (${srcStat.size} bytes)`);
        totalCopied++;
      }
    } catch (err: any) {
      console.error(`  [ERROR] Failed to process ${folder}/${entry.name}:`, err.message);
      totalFailed++;
    }
  }
}

console.log("\n" + "=".repeat(70));
console.log("MIGRATION SUMMARY");
console.log("=".repeat(70));
console.log(`Total scanned:        ${totalScanned}`);
console.log(`Moved / Planned:      ${totalCopied}`);
console.log(`Already present/skip: ${totalSkipped}`);
console.log(`Failed:               ${totalFailed}`);
console.log("=".repeat(70));

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
