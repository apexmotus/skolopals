import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const SOURCES = [
  'website',
  'whatsapp',
  'facebook',
  'walk_in',
  'phone',
  'referral',
  'flyer',
  'other',
] as const;
const STATUSES = ['new', 'contacted', 'enrolled', 'closed'] as const;
/** `enrolled` is excluded on purpose — it only ever results from {@link ConvertEnquiryDto}, which also supplies the learner link a bare status change cannot. */
const UPDATABLE_STATUSES = ['new', 'contacted', 'closed'] as const;

export class EnquiryDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() topic!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ enum: SOURCES }) source!: string;
  @ApiProperty({ enum: STATUSES }) status!: string;
  @ApiPropertyOptional() handledBy?: string;
  @ApiPropertyOptional() handledAt?: Date;
  @ApiPropertyOptional() convertedLearnerId?: string;
  @ApiProperty() createdAt!: Date;
}

export class SubmitEnquiryDto {
  @ApiProperty() @IsString() @MaxLength(200) fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;

  @ApiProperty() @IsString() @MaxLength(4000) message!: string;

  @ApiPropertyOptional({ enum: SOURCES })
  @IsOptional()
  @IsIn(SOURCES)
  source?: string;
}

export class ListEnquiriesQueryDto {
  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: string;
}

export class UpdateEnquiryStatusDto {
  @ApiProperty({ enum: UPDATABLE_STATUSES }) @IsIn(UPDATABLE_STATUSES) status!: string;
}

export class ConvertEnquiryDto {
  @ApiProperty() @IsUUID() learnerId!: string;
}
