import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception.js';
import { detectFileType } from '../../common/file-storage/file-type.js';
import { FileStorageService } from '../../common/file-storage/file-storage.service.js';
import { ImageConverter } from '../../common/file-storage/image-converter.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type {
  ConfirmedUploadDto,
  ConfirmUploadDto,
  SignUploadDto,
  SignUploadResponseDto,
} from './dto/upload.dto.js';
import {
  stagingPrefix,
  UPLOAD_PURPOSES,
  type UploadPurpose,
} from './upload-purposes.js';

const STAGED_FILE = /^[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|heic|heif)$/;

/**
 * Two-step upload: `sign` hands out a signed URL into the uploader's own
 * staging folder; once the browser has PUT the file, `confirm` checks what it
 * actually is (from its bytes, not its name), enforces the size limit and
 * converts iPhone HEIC photos to JPEG. A file that fails a check is deleted.
 */
@Injectable()
export class UploadsManager {
  constructor(
    private readonly storage: FileStorageService,
    private readonly converter: ImageConverter,
  ) {}

  async sign(
    user: AuthUser,
    dto: SignUploadDto,
  ): Promise<SignUploadResponseDto> {
    const purpose = this.allowed(user, dto.purpose);
    if (dto.sizeBytes > purpose.maxBytes) throw this.tooLarge(purpose.maxBytes);

    const extension = dto.fileName
      .slice(dto.fileName.lastIndexOf('.') + 1)
      .toLowerCase();
    const path = `${stagingPrefix(user.id)}${randomUUID()}.${extension}`;
    const { signedUrl, token } = await this.storage.createUploadUrl(
      purpose.bucket,
      path,
    );
    return { uploadUrl: signedUrl, uploadToken: token, path };
  }

  async confirm(
    user: AuthUser,
    dto: ConfirmUploadDto,
  ): Promise<ConfirmedUploadDto> {
    const purpose = this.allowed(user, dto.purpose);
    const prefix = stagingPrefix(user.id);
    // Only the uploader's own staged files, and nothing that escapes the folder.
    if (
      !dto.path.startsWith(prefix) ||
      !STAGED_FILE.test(dto.path.slice(prefix.length))
    )
      throw new ForbiddenException('That upload does not belong to you.');

    const bytes = await this.storage.download(purpose.bucket, dto.path);
    if (!bytes)
      throw new NotFoundException(
        'We could not find the uploaded file. Please upload it again.',
      );

    if (bytes.length > purpose.maxBytes) {
      await this.storage.remove(purpose.bucket, [dto.path]);
      throw this.tooLarge(purpose.maxBytes);
    }

    const type = detectFileType(bytes);
    if (!type) {
      await this.storage.remove(purpose.bucket, [dto.path]);
      throw new BusinessRuleException(
        'UPLOAD_UNSUPPORTED_TYPE',
        'That file is not a PDF, JPG, PNG or iPhone photo. Please choose a different file.',
      );
    }

    if (type.kind === 'pdf' && 'imagesOnly' in purpose) {
      await this.storage.remove(purpose.bucket, [dto.path]);
      throw new BusinessRuleException(
        'UPLOAD_PHOTO_REQUIRED',
        'This needs a photo, not a PDF. Please take or choose a photo.',
      );
    }

    const base = dto.path.slice(0, dto.path.lastIndexOf('.'));

    if (type.kind === 'heic') {
      let jpeg: Buffer;
      try {
        jpeg = await this.converter.heicToJpeg(bytes);
      } catch {
        await this.storage.remove(purpose.bucket, [dto.path]);
        throw new BusinessRuleException(
          'UPLOAD_UNREADABLE_IMAGE',
          'We could not read that photo. Please take it again, or upload a screenshot or PDF instead.',
        );
      }
      const jpegPath = `${base}.jpg`;
      await this.storage.upload(purpose.bucket, jpegPath, jpeg, 'image/jpeg');
      await this.storage.remove(purpose.bucket, [dto.path]);
      return {
        path: jpegPath,
        mimeType: 'image/jpeg',
        sizeBytes: jpeg.length,
        converted: true,
      };
    }

    // The bytes decide the extension, so a PNG named .pdf is stored as .png.
    let path = dto.path;
    const declared = dto.path.slice(dto.path.lastIndexOf('.') + 1);
    const sameKind =
      declared === type.extension ||
      (type.kind === 'jpeg' && declared === 'jpeg');
    if (!sameKind) {
      path = `${base}.${type.extension}`;
      await this.storage.move(purpose.bucket, dto.path, path);
    }
    return {
      path,
      mimeType: type.mimeType,
      sizeBytes: bytes.length,
      converted: false,
    };
  }

  private allowed(user: AuthUser, name: UploadPurpose) {
    const purpose = UPLOAD_PURPOSES[name];
    if (!purpose.roles.some((role) => user.roles.includes(role)))
      throw new ForbiddenException('You cannot upload this kind of file.');
    return purpose;
  }

  private tooLarge(maxBytes: number) {
    return new BusinessRuleException(
      'UPLOAD_TOO_LARGE',
      `The file is larger than ${Math.round(maxBytes / (1024 * 1024))} MB. Please choose a smaller file.`,
    );
  }
}
