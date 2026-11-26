import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception.js';
import type { FileStorageService } from '../../common/file-storage/file-storage.service.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { UploadsManager } from './uploads.manager.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = '22222222-2222-4222-8222-222222222222';
const parent: AuthUser = { id: USER_ID, roles: ['parent'], claims: {} };
const tutor: AuthUser = { id: USER_ID, roles: ['tutor'], claims: {} };
const staged = (ext: string) => `staging/${USER_ID}/${FILE_ID}.${ext}`;

const PDF = Buffer.from('%PDF-1.7\n...');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const HEIC = Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]),
  Buffer.from('ftypheic'),
  Buffer.alloc(8),
]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

function setup(download: Buffer | null = PDF) {
  const storage = {
    createUploadUrl: vi
      .fn()
      .mockResolvedValue({
        signedUrl: 'https://s/signed',
        token: 'tok',
        path: 'p',
      }),
    download: vi.fn().mockResolvedValue(download),
    upload: vi.fn().mockResolvedValue(undefined),
    move: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const converter = { heicToJpeg: vi.fn().mockResolvedValue(JPEG) };
  const manager = new UploadsManager(
    storage as unknown as FileStorageService,
    converter,
  );
  return { storage, converter, manager };
}

describe('UploadsManager.sign', () => {
  it('signs a URL into the uploader’s own staging folder in the purpose’s bucket', async () => {
    const { manager, storage } = setup();
    const result = await manager.sign(parent, {
      purpose: 'report_card',
      fileName: 'Term 3.PDF',
      sizeBytes: 1000,
    });
    expect(result.path).toMatch(
      new RegExp(`^staging/${USER_ID}/[0-9a-f-]{36}\\.pdf$`),
    );
    expect(storage.createUploadUrl).toHaveBeenCalledWith(
      'learner-documents',
      result.path,
    );
    expect(result.uploadUrl).toBe('https://s/signed');
  });

  it('uses the payment-proofs bucket for a proof of payment', async () => {
    const { manager, storage } = setup();
    await manager.sign(parent, {
      purpose: 'payment_proof',
      fileName: 'pop.jpg',
      sizeBytes: 1000,
    });
    expect(storage.createUploadUrl).toHaveBeenCalledWith(
      'payment-proofs',
      expect.any(String),
    );
  });

  it('refuses a role the purpose does not allow', async () => {
    const { manager } = setup();
    await expect(
      manager.sign(tutor, {
        purpose: 'report_card',
        fileName: 'a.pdf',
        sizeBytes: 1,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('UploadsManager.confirm', () => {
  it('accepts a PDF as it is', async () => {
    const { manager, storage } = setup(PDF);
    const result = await manager.confirm(parent, {
      purpose: 'report_card',
      path: staged('pdf'),
    });
    expect(result).toEqual({
      path: staged('pdf'),
      mimeType: 'application/pdf',
      sizeBytes: PDF.length,
      converted: false,
    });
    expect(storage.move).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('converts an iPhone HEIC photo to JPEG and removes the original', async () => {
    const { manager, storage, converter } = setup(HEIC);
    const result = await manager.confirm(parent, {
      purpose: 'payment_proof',
      path: staged('heic'),
    });
    expect(converter.heicToJpeg).toHaveBeenCalledWith(HEIC);
    expect(storage.upload).toHaveBeenCalledWith(
      'payment-proofs',
      staged('jpg'),
      JPEG,
      'image/jpeg',
    );
    expect(storage.remove).toHaveBeenCalledWith('payment-proofs', [
      staged('heic'),
    ]);
    expect(result).toMatchObject({
      path: staged('jpg'),
      mimeType: 'image/jpeg',
      converted: true,
    });
  });

  it('judges by the bytes: a PNG named .pdf is moved to .png', async () => {
    const { manager, storage } = setup(PNG);
    const result = await manager.confirm(parent, {
      purpose: 'report_card',
      path: staged('pdf'),
    });
    expect(storage.move).toHaveBeenCalledWith(
      'learner-documents',
      staged('pdf'),
      staged('png'),
    );
    expect(result.mimeType).toBe('image/png');
  });

  it('treats .jpeg and .jpg as the same kind', async () => {
    const { manager, storage } = setup(JPEG);
    const result = await manager.confirm(parent, {
      purpose: 'report_card',
      path: staged('jpeg'),
    });
    expect(storage.move).not.toHaveBeenCalled();
    expect(result.path).toBe(staged('jpeg'));
  });

  it('deletes and rejects a PDF sent as a selfie', async () => {
    const { manager, storage } = setup(PDF);
    await expect(
      manager.confirm(parent, { purpose: 'tutor_selfie', path: staged('pdf') }),
    ).rejects.toMatchObject({ code: 'UPLOAD_PHOTO_REQUIRED' });
    expect(storage.remove).toHaveBeenCalledWith('tutor-documents', [
      staged('pdf'),
    ]);
  });

  it('accepts a photo as a selfie, in the tutor documents bucket', async () => {
    const { manager, storage } = setup(JPEG);
    const result = await manager.confirm(parent, {
      purpose: 'tutor_selfie',
      path: staged('jpg'),
    });
    expect(storage.download).toHaveBeenCalledWith('tutor-documents', staged('jpg'));
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('deletes and rejects a file that is not an accepted type', async () => {
    const { manager, storage } = setup(Buffer.from('MZ executable'));
    await expect(
      manager.confirm(parent, { purpose: 'report_card', path: staged('pdf') }),
    ).rejects.toMatchObject({
      code: 'UPLOAD_UNSUPPORTED_TYPE',
    });
    expect(storage.remove).toHaveBeenCalledWith('learner-documents', [
      staged('pdf'),
    ]);
  });

  it('deletes and rejects a file over 10 MB, whatever size the browser declared', async () => {
    const { manager, storage } = setup(
      Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]),
    );
    await expect(
      manager.confirm(parent, { purpose: 'report_card', path: staged('pdf') }),
    ).rejects.toBeInstanceOf(BusinessRuleException);
    expect(storage.remove).toHaveBeenCalled();
  });

  it('deletes and rejects a HEIC photo that cannot be decoded', async () => {
    const { manager, storage, converter } = setup(HEIC);
    converter.heicToJpeg.mockRejectedValue(new Error('corrupt'));
    await expect(
      manager.confirm(parent, { purpose: 'report_card', path: staged('heic') }),
    ).rejects.toMatchObject({
      code: 'UPLOAD_UNREADABLE_IMAGE',
    });
    expect(storage.remove).toHaveBeenCalledWith('learner-documents', [
      staged('heic'),
    ]);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('404s when nothing was uploaded to the path', async () => {
    const { manager } = setup(null);
    await expect(
      manager.confirm(parent, { purpose: 'report_card', path: staged('pdf') }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    [
      `staging/33333333-3333-4333-8333-333333333333/${FILE_ID}.pdf`,
      'another user’s folder',
    ],
    [
      `staging/${USER_ID}/../../learner/x.pdf`,
      'a path that escapes the folder',
    ],
    [`staging/${USER_ID}/${FILE_ID}.exe`, 'a non-file name'],
    [`${USER_ID}/${FILE_ID}.pdf`, 'outside staging'],
  ])('refuses %s (%s) without touching storage', async (path) => {
    const { manager, storage } = setup();
    await expect(
      manager.confirm(parent, { purpose: 'report_card', path }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.download).not.toHaveBeenCalled();
  });
});
