"""Slim the Body page GLBs: JPEG re-encode (same pixels, same sizes), then
simplify + Draco via gltf-transform. See tools/slim-body-models.sh."""

import io
import json
import struct
import sys

from PIL import Image


def load_glb(path):
    raw = open(path, "rb").read()
    json_len = struct.unpack("<I", raw[12:16])[0]
    doc = json.loads(raw[20 : 20 + json_len])
    off = 20 + json_len
    bin_len = struct.unpack("<I", raw[off : off + 4])[0]
    blob = raw[off + 8 : off + 8 + bin_len]
    return doc, blob


def view_bytes(doc, blob, index):
    bv = doc["bufferViews"][index]
    start = bv.get("byteOffset", 0)
    return blob[start : start + bv["byteLength"]]


def rebuild_glb(doc, chunks):
    """chunks: list of bytes, one per bufferView, in order. Recomputes offsets."""
    blob = b""
    for i, data in enumerate(chunks):
        doc["bufferViews"][i]["byteOffset"] = len(blob)
        doc["bufferViews"][i]["byteLength"] = len(data)
        blob += bytes(data)
    doc["buffers"] = [{"byteLength": len(blob)}]
    js = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(blob))
    out += struct.pack("<II", len(js), 0x4E4F534A) + js
    out += struct.pack("<II", len(blob), 0x004E4942) + blob
    return out


def has_alpha(data):
    try:
        return Image.open(io.BytesIO(bytes(data))).convert("RGBA").getextrema()[3] != (255, 255)
    except Exception:
        return True


def png_size(data):
    try:
        return Image.open(io.BytesIO(bytes(data))).size
    except Exception:
        return (0, 0)


def slim_textures(src, dst, jpeg_quality):
    doc, blob = load_glb(src)
    chunks = [view_bytes(doc, blob, i) for i in range(len(doc["bufferViews"]))]
    image_views = {im["bufferView"] for im in doc.get("images", [])}
    saved = 0
    for n, im in enumerate(doc.get("images", [])):
        data = chunks[im["bufferView"]]
        mime = (im.get("mimeType") or "").lower()
        if mime.endswith("jpeg") or mime.endswith("jpg"):
            before = len(data)
            pic = Image.open(io.BytesIO(bytes(data))).convert("RGB")
            buf = io.BytesIO()
            pic.save(buf, "JPEG", quality=jpeg_quality, optimize=True)
            chunks[im["bufferView"]] = buf.getvalue()
            saved += before - len(buf.getvalue())
        elif mime.endswith("png") and not has_alpha(data):
            before = len(data)
            pic = Image.open(io.BytesIO(bytes(data))).convert("RGB")
            buf = io.BytesIO()
            pic.save(buf, "JPEG", quality=jpeg_quality, optimize=True)
            chunks[im["bufferView"]] = buf.getvalue()
            im["mimeType"] = "image/jpeg"
            saved += before - len(buf.getvalue())
        elif mime.endswith("png"):
            w, h = png_size(data)
            if max(w, h) >= 256:
                before = len(data)
                pic = Image.open(io.BytesIO(bytes(data))).convert("RGBA")
                pal = pic.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG)
                buf = io.BytesIO()
                pal.save(buf, "PNG", optimize=True)
                chunks[im["bufferView"]] = buf.getvalue()
                saved += before - len(buf.getvalue())
    open(dst, "wb").write(rebuild_glb(doc, chunks))
    print(f"textures: {src} -> {dst} saved {saved} bytes at q{jpeg_quality}")


if __name__ == "__main__":
    slim_textures(sys.argv[1], sys.argv[2], int(sys.argv[3]))
