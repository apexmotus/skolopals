import { describe, expect, it } from 'vitest';
import { detectFileType } from './file-type.js';

const bytes = (...parts: (number[] | string)[]) =>
  Uint8Array.from(
    parts.flatMap((p) =>
      typeof p === 'string' ? [...Buffer.from(p, 'latin1')] : p,
    ),
  );

describe('detectFileType', () => {
  it('recognises a PDF', () => {
    expect(detectFileType(bytes('%PDF-1.7\n'))?.mimeType).toBe(
      'application/pdf',
    );
  });

  it('recognises a JPEG', () => {
    expect(detectFileType(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]))?.kind).toBe(
      'jpeg',
    );
  });

  it('recognises a PNG', () => {
    expect(
      detectFileType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))
        ?.kind,
    ).toBe('png');
  });

  it.each(['heic', 'heix', 'mif1', 'heif'])(
    'recognises an iPhone/HEIF photo with brand %s',
    (brand) => {
      expect(
        detectFileType(bytes([0, 0, 0, 0x18], 'ftyp', brand, [0, 0, 0, 0]))
          ?.kind,
      ).toBe('heic');
    },
  );

  it('rejects an MP4, which is also ISO-BMFF', () => {
    expect(
      detectFileType(bytes([0, 0, 0, 0x18], 'ftyp', 'isom', [0, 0, 0, 0])),
    ).toBeNull();
  });

  it('rejects anything else, including a renamed text file', () => {
    expect(detectFileType(bytes('hello, this is not a report'))).toBeNull();
    expect(detectFileType(new Uint8Array())).toBeNull();
  });
});
