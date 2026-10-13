import { describe, expect, it } from 'vitest';
import { readCaptureDate } from './image-metadata';

function exifJpeg(dateText: string): Uint8Array {
  const text = `${dateText}\0`;
  const stringBytes = new TextEncoder().encode(text);
  const tiff = new Uint8Array(26 + stringBytes.length);
  const view = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49], 0);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, 1, true);
  view.setUint16(10, 0x9003, true);
  view.setUint16(12, 2, true);
  view.setUint32(14, stringBytes.length, true);
  view.setUint32(18, 26, true);
  tiff.set(stringBytes, 26);
  const exif = new Uint8Array(6 + tiff.length);
  exif.set([0x45, 0x78, 0x69, 0x66, 0, 0], 0);
  exif.set(tiff, 6);
  const jpeg = new Uint8Array(2 + 2 + 2 + exif.length + 2);
  jpeg.set([0xff, 0xd8, 0xff, 0xe1], 0);
  const jpegView = new DataView(jpeg.buffer);
  jpegView.setUint16(4, exif.length + 2, false);
  jpeg.set(exif, 6);
  jpeg.set([0xff, 0xd9], 6 + exif.length);
  return jpeg;
}

function standardExifJpeg(dateText: string, littleEndian: boolean): Uint8Array {
  const text = new TextEncoder().encode(`${dateText}\0`);
  const ifd0Offset = 8;
  const exifIfdOffset = 26;
  const valueOffset = 44;
  const tiff = new Uint8Array(valueOffset + text.length);
  const view = new DataView(tiff.buffer);
  tiff.set(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d], 0);
  view.setUint16(2, 42, littleEndian);
  view.setUint32(4, ifd0Offset, littleEndian);
  view.setUint16(ifd0Offset, 1, littleEndian);
  view.setUint16(ifd0Offset + 2, 0x8769, littleEndian);
  view.setUint16(ifd0Offset + 4, 4, littleEndian);
  view.setUint32(ifd0Offset + 6, 1, littleEndian);
  view.setUint32(ifd0Offset + 10, exifIfdOffset, littleEndian);
  view.setUint16(exifIfdOffset, 1, littleEndian);
  view.setUint16(exifIfdOffset + 2, 0x9003, littleEndian);
  view.setUint16(exifIfdOffset + 4, 2, littleEndian);
  view.setUint32(exifIfdOffset + 6, text.length, littleEndian);
  view.setUint32(exifIfdOffset + 10, valueOffset, littleEndian);
  tiff.set(text, valueOffset);
  const exif = new Uint8Array(6 + tiff.length);
  exif.set([0x45, 0x78, 0x69, 0x66, 0, 0], 0);
  exif.set(tiff, 6);
  const jpeg = new Uint8Array(8 + exif.length);
  jpeg.set([0xff, 0xd8, 0xff, 0xe1], 0);
  new DataView(jpeg.buffer).setUint16(4, exif.length + 2, false);
  jpeg.set(exif, 6);
  jpeg.set([0xff, 0xd9], 6 + exif.length);
  return jpeg;
}

describe('image capture metadata', () => {
  it('falls back to the provided current time when EXIF is unavailable', async () => {
    const now = new Date('2026-10-12T12:00:00.000Z');
    const file = new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' });
    await expect(readCaptureDate(file, now)).resolves.toBe(now.toISOString());
  });

  it('reads DateTimeOriginal from a JPEG EXIF segment', async () => {
    const file = new File([exifJpeg('2026:10:08 19:30:00').buffer as ArrayBuffer], 'photo.jpg', { type: 'image/jpeg' });
    const expected = new Date(2026, 9, 8, 19, 30, 0).toISOString();
    await expect(readCaptureDate(file, new Date('2026-10-12T12:00:00.000Z'))).resolves.toBe(expected);
  });

  it.each([true, false])('reads standard DateTimeOriginal through the EXIF IFD pointer (littleEndian=%s)', async (littleEndian) => {
    const file = new File([standardExifJpeg('2026:10:09 08:15:30', littleEndian).buffer as ArrayBuffer], 'phone.jpg', { type: 'image/jpeg' });
    const expected = new Date(2026, 9, 9, 8, 15, 30).toISOString();
    await expect(readCaptureDate(file, new Date('2026-10-12T12:00:00.000Z'))).resolves.toBe(expected);
  });

  it('falls back safely when EXIF offsets are malformed', async () => {
    const bytes = standardExifJpeg('2026:10:09 08:15:30', true);
    new DataView(bytes.buffer).setUint32(22, 0x7fffffff, true);
    const now = new Date('2026-10-13T00:00:00.000Z');
    await expect(readCaptureDate(new File([bytes.buffer as ArrayBuffer], 'broken.jpg', { type: 'image/jpeg' }), now)).resolves.toBe(now.toISOString());
  });
});
