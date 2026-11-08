import { describe, expect, it } from "vitest";
import { attachmentId, base64Bytes, blobToBase64, scaleToFit, stripApp1Segments } from "../src/lib/adapters/attachment";

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

  it("fits long sides to 1600 px", () => {
    expect(scaleToFit(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(scaleToFit(800, 600)).toEqual({ width: 800, height: 600 });
    expect(scaleToFit(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("strips EXIF APP1 segments and keeps JPEG magic", () => {
    const exif = Buffer.concat([Buffer.from("Exif\0\0", "binary"), Buffer.alloc(16, 0x41)]);
    const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, exif.length + 2]), exif]);
    const rest = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xda, 0x00, 0x08, 0x01, 0x02]);
    const jpeg = new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xd8]), app1, rest]));
    const stripped = stripApp1Segments(jpeg);
    expect([...stripped.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect(Buffer.from(stripped).includes(Buffer.from("Exif\0\0", "binary"))).toBe(false);
    expect([...stripped]).toEqual([0xff, 0xd8, ...rest]);
  });
});
