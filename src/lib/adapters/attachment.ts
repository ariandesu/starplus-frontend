import { API_BASE } from "../api.ts";

export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

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

export async function compressImage(blob: Blob, maxBytes = MAX_ATTACHMENT_BYTES): Promise<Blob> {
  if (blob.size <= maxBytes) return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    let width = bitmap.width;
    let height = bitmap.height;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot compress images");
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const quality = 0.85 - attempt * 0.12;
      const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (out && out.size <= maxBytes) return out;
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
