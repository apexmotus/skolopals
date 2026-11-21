export interface DetectedFileType {
  kind: 'pdf' | 'jpeg' | 'png' | 'heic';
  mimeType: string;
  extension: string;
}

// ISO-BMFF brands an iPhone (and most Android HEIF cameras) write.
const HEIF_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'mif1',
  'msf1',
  'heif',
]);

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

/**
 * What a file really is, from its first bytes. The browser's declared type and
 * the file name are both user input; this is what the upload is judged by.
 * `null` for anything outside the accepted set.
 */
export function detectFileType(bytes: Uint8Array): DetectedFileType | null {
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === '%PDF-')
    return { kind: 'pdf', mimeType: 'application/pdf', extension: 'pdf' };
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  )
    return { kind: 'jpeg', mimeType: 'image/jpeg', extension: 'jpg' };
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (b, i) => bytes[i] === b,
    )
  )
    return { kind: 'png', mimeType: 'image/png', extension: 'png' };
  if (
    bytes.length >= 12 &&
    ascii(bytes, 4, 8) === 'ftyp' &&
    HEIF_BRANDS.has(ascii(bytes, 8, 12))
  )
    return { kind: 'heic', mimeType: 'image/heic', extension: 'heic' };
  return null;
}
