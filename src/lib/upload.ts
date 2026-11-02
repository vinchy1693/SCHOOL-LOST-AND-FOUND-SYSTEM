import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 5 * 1024 * 1024;

function sniff(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (buffer.length >= 6 && buffer.subarray(0, 4).toString("ascii") === "GIF8") {
    return "gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

/**
 * Validate and store an uploaded image. Returns the public URL path
 * (served by app/uploads/[name]/route.ts) or null when no file was sent.
 */
export async function saveImage(file: unknown): Promise<string | null> {
  if (!file || typeof file !== "object") return null;
  const candidate = file as { arrayBuffer?: () => Promise<ArrayBuffer>; size?: number };
  if (typeof candidate.arrayBuffer !== "function" || !candidate.size) return null;
  if ((candidate.size ?? 0) > MAX_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const buffer = Buffer.from(await candidate.arrayBuffer());
  const ext = sniff(buffer);
  if (!ext) {
    throw new Error("That file is not a JPG, PNG, WEBP or GIF image.");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `/uploads/${name}`;
}
