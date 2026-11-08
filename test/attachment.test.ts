import { describe, expect, it } from "vitest";
import { attachmentId, base64Bytes, blobToBase64, compressImage } from "../src/lib/adapters/attachment";

describe("attachments", () => {
  it("generates unique ids", () => {
    expect(attachmentId()).not.toBe(attachmentId());
  });

  it("computes base64 byte sizes", () => {
    expect(base64Bytes("aGk=")).toBe(2);
    expect(base64Bytes("AAAA")).toBe(3);
  });

  it("round-trips a blob through base64", async () => {
    const blob = new Blob(["hi"], { type: "image/png" });
    expect(await blobToBase64(blob)).toBe("aGk=");
  });

  it("passes through a photo that already fits", async () => {
    const blob = new Blob(["x".repeat(100)], { type: "image/jpeg" });
    await expect(compressImage(blob)).resolves.toBe(blob);
  });
});
