import { API_BASE } from "../api.ts";

export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const MAX_ATTACHMENT_SIDE = 1600;

export interface PendingAttachment {
  id: string;
  content_type: string;
  size: number;
  data_base64?: string;
}

export function attachmentId(): string {
  return crypto.randomUUID();
}

export function base64Bytes(dataBase64: string): number {
  const padding = dataBase64.endsWith("==") ? 2 : dataBase64.endsWith("=") ? 1 : 0;
  return Math.floor((dataBase64.length * 3) / 4) - padding;
}

export function scaleToFit(width: number, height: number, maxSide = MAX_ATTACHMENT_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide || longest <= 0) return { width, height };
  const factor = maxSide / longest;
  return { width: Math.max(1, Math.round(width * factor)), height: Math.max(1, Math.round(height * factor)) };
}

export function stripApp1Segments(jpeg: Uint8Array): Uint8Array {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const out: number[] = [0xff, 0xd8];
  let pos = 2;
  while (pos + 1 < jpeg.length) {
    const marker = (jpeg[pos] << 8) | jpeg[pos + 1];
    if (marker === 0xffd9 || marker === 0xffda || marker < 0xff01) {
      out.push(...jpeg.subarray(pos));
      break;
    }
    if (marker >= 0xffd0 && marker <= 0xffd7) {
      out.push(jpeg[pos], jpeg[pos + 1]);
      pos += 2;
      continue;
    }
    if (pos + 3 >= jpeg.length) {
      out.push(...jpeg.subarray(pos));
      break;
    }
    const length = (jpeg[pos + 2] << 8) | jpeg[pos + 3];
    if (marker !== 0xffe1) out.push(...jpeg.subarray(pos, pos + 2 + length));
    pos += 2 + length;
  }
  return Uint8Array.from(out);
}

export async function compressImage(blob: Blob, maxBytes = MAX_ATTACHMENT_BYTES): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const start = scaleToFit(bitmap.width, bitmap.height);
    let width = start.width;
    let height = start.height;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot compress images");
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const quality = 0.85 - attempt * 0.12;
      const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (out && out.size <= maxBytes) {
        const stripped = stripApp1Segments(new Uint8Array(await out.arrayBuffer()));
        return new Blob([stripped.buffer as ArrayBuffer], { type: "image/jpeg" });
      }
      width *= 0.7;
      height *= 0.7;
    }
    throw new Error("The photo is too large even after compression");
  } finally {
    bitmap.close();
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function uploadAttachment(
  token: string,
  input: { id: string; reportClientId: string; contentType: string; dataBase64: string }
): Promise<{ id: string; size: number }> {
  const res = await fetch(`${API_BASE}/api/attachments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      id: input.id,
      report_client_id: input.reportClientId,
      content_type: input.contentType,
      data_base64: input.dataBase64,
    }),
  });
  if (!res.ok) throw new Error(`attachment upload failed with ${res.status}`);
  return (await res.json()) as { id: string; size: number };
}
