import { Injectable } from '@nestjs/common';
import convert from 'heic-convert';

/**
 * iPhone photos are HEIC, which most browsers cannot display. Uploads are
 * converted to JPEG once, on confirm, so every later preview and download just
 * works. heic-convert is pure JS/WASM: sharp's prebuilt binaries cannot decode
 * HEIC, and native libheif is not available on Vercel.
 */
@Injectable()
export class ImageConverter {
  async heicToJpeg(bytes: Buffer): Promise<Buffer> {
    const jpeg = await convert({
      buffer: bytes,
      format: 'JPEG',
      quality: 0.85,
    });
    return Buffer.from(jpeg);
  }
}
