"use client";

import { useEffect, useState } from "react";
import { ApiError, getAttachment } from "@/lib/api";

export interface PhotoReport {
  client_id: string;
  payload_json: string;
}

export function attachmentIds(payloadJson: string): string[] {
  try {
    const payload = JSON.parse(payloadJson) as { attachments?: Array<{ id?: unknown }> };
    if (!Array.isArray(payload.attachments)) return [];
    return payload.attachments
      .map((attachment) => (typeof attachment.id === "string" ? attachment.id : ""))
      .filter((id) => id.length > 0);
  } catch {
    return [];
  }
}

export function ReportPhotos({ token, report }: { token: string; report: PhotoReport }) {
  const [urls, setUrls] = useState<Array<{ id: string; url: string }>>([]);
  const [expired, setExpired] = useState<string[]>([]);
  const ids = attachmentIds(report.payload_json);
  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      for (const id of attachmentIds(report.payload_json)) {
        try {
          const blob = await getAttachment(token, id);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          created.push(url);
          setUrls((prev) => [...prev, { id, url }]);
        } catch (error) {
          if (cancelled) return;
          if (error instanceof ApiError && error.status === 404) {
            setExpired((prev) => [...prev, id]);
          }
        }
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [token, report.client_id, report.payload_json]);
  if (ids.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-sm font-semibold text-foreground">Photos</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {urls.map(({ id, url }) => (
          <img key={id} src={url} alt="Report photo" data-testid="photo-thumb" className="h-24 w-24 rounded-lg border border-border object-cover" />
        ))}
        {expired.map((id) => (
          <p key={id} className="text-xs text-muted-foreground">
            Photo expired (90 days)
          </p>
        ))}
      </div>
    </div>
  );
}
