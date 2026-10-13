import assert from "node:assert/strict";
import { crc32, inflateSync } from "node:zlib";

// Playwright screenshots are non-interlaced 8-bit RGB/RGBA PNGs. Validate that
// finite format without accepting a signature-only or partially written file.
export function checkAcceptanceScreenshot(bytes, viewportWidth) {
  assert.ok(bytes.length > 8 && bytes.length <= 64 * 1024 * 1024, "Invalid PNG size");
  assert.ok(bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")), "Invalid PNG signature");
  let offset = 8, width, height, channels, ended = false, dataEnded = false;
  const data = [];
  while (offset < bytes.length) {
    assert.ok(offset + 12 <= bytes.length, "Truncated PNG chunk");
    const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
    assert.ok(end <= bytes.length, "Truncated PNG data");
    const type = bytes.toString("ascii", offset + 4, offset + 8), payload = bytes.subarray(offset + 8, end - 4);
    assert.match(type, /^[A-Za-z]{4}$/);
    assert.equal(crc32(bytes.subarray(offset + 4, end - 4)), bytes.readUInt32BE(end - 4), "Corrupt PNG checksum");
    if (offset === 8) assert.equal(type, "IHDR");
    if (type === "IHDR") {
      assert.equal(offset, 8); assert.equal(length, 13);
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4);
      assert.ok(width >= viewportWidth - 32 && width <= viewportWidth, "Unexpected screenshot width");
      assert.ok(height >= (viewportWidth === 1024 ? 720 : 960) && height <= 20000, "Unexpected screenshot height");
      assert.equal(payload[8], 8); assert.ok([2, 6].includes(payload[9]));
      channels = payload[9] === 2 ? 3 : 4;
      assert.deepEqual([...payload.subarray(10)], [0, 0, 0], "Unsupported PNG encoding");
    } else if (type === "IDAT") {
      assert.equal(dataEnded, false, "Noncontiguous PNG image data"); data.push(payload);
    } else {
      if (data.length) dataEnded = true;
      if (type === "IEND") {
        assert.equal(length, 0); assert.equal(end, bytes.length); ended = true;
      } else if (type === "PLTE") {
        assert.equal(data.length, 0); assert.ok(length > 0 && length <= 768 && length % 3 === 0);
      } else assert.equal(type[0], type[0].toLowerCase(), "Unsupported critical PNG chunk");
    }
    offset = end;
  }
  assert.ok(ended && data.length > 0, "Incomplete PNG image");
  const stride = 1 + width * channels, size = stride * height;
  assert.ok(size <= 128 * 1024 * 1024, "Screenshot pixel budget exceeded");
  const pixels = inflateSync(Buffer.concat(data), { maxOutputLength: size });
  assert.equal(pixels.length, size, "Invalid PNG pixel data");
  for (let row = 0; row < height; row++) assert.ok(pixels[row * stride] <= 4, "Invalid PNG row filter");
}
