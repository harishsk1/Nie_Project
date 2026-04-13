import fs from "fs";
import path from "path";
import type { Request } from "express";

export function getStaticFilePath(req: Request, filename: string) {
  const base = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  return `${base}/uploads/${filename}`;
}

export function getLocalPath(filename: string) {
  return path.join(process.cwd(), "public", "uploads", filename);
}

export function removeLocalFile(localPath?: string | null) {
  if (!localPath) return;
  fs.promises.unlink(localPath).catch(() => void 0);
}
