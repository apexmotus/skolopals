import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  UPLOAD_PURPOSE_NAMES,
  type UploadPurpose,
} from '../upload-purposes.js';

export class SignUploadDto {
  @ApiProperty({ enum: UPLOAD_PURPOSE_NAMES })
  @IsIn(UPLOAD_PURPOSE_NAMES)
  purpose!: UploadPurpose;

  @ApiProperty({ example: 'report-term-3.pdf' })
  @IsString()
  @MaxLength(200)
  @Matches(/\.(pdf|jpe?g|png|heic|heif)$/i, {
    message: 'Upload a PDF, JPG, PNG or iPhone (HEIC) photo.',
  })
  fileName!: string;

  @ApiProperty({
    description: 'Declared size in bytes. Checked again on confirm.',
  })
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024, { message: 'The file is larger than 10 MB.' })
  sizeBytes!: number;
}

export class SignUploadResponseDto {
  @ApiProperty({
    description:
      'PUT the file bytes directly to this Supabase Storage signed URL — never through this API.',
  })
  uploadUrl!: string;
  @ApiProperty() uploadToken!: string;
  @ApiProperty({
    description:
      'Pass to POST /uploads/confirm, then to the endpoint that uses the file.',
  })
  path!: string;
}

export class ConfirmUploadDto {
  @ApiProperty({ enum: UPLOAD_PURPOSE_NAMES })
  @IsIn(UPLOAD_PURPOSE_NAMES)
  purpose!: UploadPurpose;

  @ApiProperty() @IsString() @MaxLength(300) path!: string;
}

export class ConfirmedUploadDto {
  @ApiProperty({
    description:
      'May differ from the signed path: HEIC becomes .jpg, a wrong extension is corrected.',
  })
  path!: string;
  @ApiProperty({ enum: ['application/pdf', 'image/jpeg', 'image/png'] })
  mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty({
    description: 'True when an iPhone HEIC photo was converted to JPEG.',
  })
  converted!: boolean;
}
