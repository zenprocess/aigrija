/** Normalize a Uint8Array (possibly with SharedArrayBuffer) to Uint8Array<ArrayBuffer>
 * for CF Workers WebCrypto compatibility (crypto.subtle requires ArrayBuffer, not SharedArrayBuffer).
 */
export function toUint8Array(data: Uint8Array | ArrayBuffer | ArrayBufferView): Uint8Array<ArrayBuffer> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  // Uint8Array or other TypedArray/DataView — copy the bytes to ensure plain ArrayBuffer
  const offset = (data as ArrayBufferView).byteOffset;
  const length = (data as ArrayBufferView).byteLength;
  const srcBuffer = (data as ArrayBufferView).buffer;
  // slice() always returns ArrayBuffer even when source is SharedArrayBuffer
  const ab = srcBuffer.slice(offset, offset + length) as ArrayBuffer;
  return new Uint8Array(ab);
}
