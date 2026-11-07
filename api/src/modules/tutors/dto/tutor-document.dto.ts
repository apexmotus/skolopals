import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

const DOC_TYPES = [
  'id',
  'qualification',
  'police_clearance',
  'cv',
  'other',
] as const;

export class TutorDocumentDto {
  @ApiProperty() id!: string;
  @ApiProperty() tutorId!: string;
  @ApiProperty({ enum: DOC_TYPES }) docType!: string;
  @ApiProperty() uploadedAt!: string;
  @ApiPropertyOptional() verifiedAt?: string;
  @ApiPropertyOptional({
    description: 'Signed, time-limited download URL — never a public one.',
  })
  downloadUrl?: string;
}

export class AddDocumentDto {
  @ApiProperty({ enum: DOC_TYPES }) @IsIn(DOC_TYPES) docType!: string;

  @ApiProperty({
    example: 'id-document.pdf',
    description: 'Original filename, used to pick the storage extension.',
  })
  @IsString()
  @MaxLength(200)
  @Matches(/\.(pdf|jpe?g|png)$/i, {
    message:
      'fileName must end in .pdf, .jpg, .jpeg or .png (image/jpeg, image/png, application/pdf only)',
  })
  fileName!: string;
}

export class UploadDocumentResponseDto {
  @ApiProperty({ type: TutorDocumentDto }) document!: TutorDocumentDto;
  @ApiProperty({
    description:
      'PUT the file bytes directly to this Supabase Storage signed URL — never through this API.',
  })
  uploadUrl!: string;
  @ApiProperty() uploadToken!: string;
}
