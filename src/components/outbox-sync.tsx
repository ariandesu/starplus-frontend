"use client";

import { useEffect } from "react";
import { startOutboxSync } from "@/lib/outbox-sync";

export function OutboxSync() {
  useEffect(() => startOutboxSync(), []);
  return null;
}
