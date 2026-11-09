import { deviceDb } from "./db";

export async function readSurgeonCache<T>(key: string): Promise<{ data: T; updatedAt: string } | null> {
  try {
    const db = await deviceDb();
    const row = await db.get("surgeon_cache", key);
    if (!row) return null;
    return { data: row.value as T, updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

export async function writeSurgeonCache(key: string, value: unknown): Promise<void> {
  try {
    const db = await deviceDb();
    await db.put("surgeon_cache", { key, value, updated_at: new Date().toISOString() });
  } catch {
    // Cache is best-effort; the live fetch already succeeded.
  }
}
