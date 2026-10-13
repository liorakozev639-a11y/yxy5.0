function readDateTimeOriginal(bytes: Uint8Array): string | undefined {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xda || marker === 0xd9) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    const dataStart = offset + 2;
    const dataEnd = offset + length;
    if (marker === 0xe1 && dataEnd <= bytes.length) {
      const header = new TextDecoder().decode(bytes.slice(dataStart, dataStart + 6));
      if (header === 'Exif\0\0') {
        const date = parseTiff(bytes, dataStart + 6);
        if (date) return date;
      }
    }
    offset = dataEnd;
  }
  return undefined;
}

function parseTiff(bytes: Uint8Array, start: number): string | undefined {
  if (start < 0 || start + 8 > bytes.length) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const littleEndian = bytes[start] === 0x49 && bytes[start + 1] === 0x49;
  if (!littleEndian && !(bytes[start] === 0x4d && bytes[start + 1] === 0x4d)) return undefined;
  const get16 = (position: number) => position >= 0 && position + 2 <= bytes.length ? view.getUint16(position, littleEndian) : undefined;
  const get32 = (position: number) => position >= 0 && position + 4 <= bytes.length ? view.getUint32(position, littleEndian) : undefined;
  if (get16(start + 2) !== 42) return undefined;
  const firstIfdOffset = get32(start + 4);
  if (firstIfdOffset === undefined) return undefined;

  const parseDateEntry = (entry: number): string | undefined => {
    const type = get16(entry + 2);
    const count = get32(entry + 4);
    if (type !== 2 || count === undefined || count === 0) return undefined;
    const valueOffset = get32(entry + 8);
    if (valueOffset === undefined) return undefined;
    const valueStart = count <= 4 ? entry + 8 : start + valueOffset;
    if (valueStart < start || valueStart + count > bytes.length) return undefined;
    const value = new TextDecoder().decode(bytes.slice(valueStart, valueStart + count)).replace(/\0/g, '');
    const match = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return undefined;
    const [, year, month, day, hour, minute, second] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).toISOString();
  };

  const scanIfd = (ifdOffset: number, allowExifPointer: boolean): string | undefined => {
    const ifdStart = start + ifdOffset;
    const entryCount = get16(ifdStart);
    if (entryCount === undefined) return undefined;
    for (let index = 0; index < entryCount; index += 1) {
      const entry = ifdStart + 2 + index * 12;
      if (entry < start || entry + 12 > bytes.length) return undefined;
      const tag = get16(entry);
      if (tag === 0x9003) {
        const date = parseDateEntry(entry);
        if (date) return date;
      }
      if (allowExifPointer && tag === 0x8769) {
        const exifIfdOffset = get32(entry + 8);
        if (exifIfdOffset !== undefined) {
          const date = scanIfd(exifIfdOffset, false);
          if (date) return date;
        }
      }
    }
    return undefined;
  };

  return scanIfd(firstIfdOffset, true);
}

export async function readCaptureDate(file: Blob, now = new Date()): Promise<string> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return readDateTimeOriginal(bytes) ?? now.toISOString();
  } catch {
    return now.toISOString();
  }
}

export function toObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
