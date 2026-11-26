import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const STAGED_PATH = /^staging\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png)$/;
const MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const APPLICATION_DOC_TYPES = [
  'cv',
  'qualification',
  'id',
  'id_back',
  'selfie',
  'police_clearance',
] as const;
export const APPLICATION_STATUSES = [
  'submitted',
  'shortlisted',
  'approved',
  'rejected',
  'withdrawn',
] as const;

// Recruitment ------------------------------------------------------------------

export class RecruitmentNeedDto {
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
}

export class RecruitmentStatusDto {
  @ApiProperty() isOpen!: boolean;
  @ApiPropertyOptional() roundId?: string;
  @ApiPropertyOptional({ nullable: true }) closesAt?: string | null;
  @ApiPropertyOptional() message?: string;
  @ApiPropertyOptional() policeClearanceRequired?: boolean;
  @ApiPropertyOptional({ type: RecruitmentNeedDto, isArray: true }) needs?: RecruitmentNeedDto[];
}

export class RecruitmentRoundDto {
  @ApiProperty() id!: string;
  @ApiProperty() openedAt!: string;
  @ApiPropertyOptional({ nullable: true }) closesAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) closedAt!: string | null;
  @ApiProperty() message!: string;
  @ApiProperty() policeClearanceRequired!: boolean;
  @ApiProperty({ description: 'Open right now: not closed and not past its closing date.' }) isOpen!: boolean;
  @ApiProperty({ type: String, isArray: true }) needs!: string[];
  @ApiProperty() applicationCount!: number;
}

/** Open a round, or change the open one. */
export class RecruitmentSettingsDto {
  @ApiPropertyOptional({ nullable: true, description: 'Closes automatically at this time. Omit for no closing date.' })
  @IsOptional()
  @IsDateString()
  closesAt?: string | null;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({ type: String, isArray: true, description: 'Subject codes the centre is short of.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(40)
  needs?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  policeClearanceRequired?: boolean;
}

// Submission -------------------------------------------------------------------

export class ApplicationAddressDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) line1!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) city!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) province!: string;
  @ApiPropertyOptional({ default: 'South Africa' }) @IsOptional() @IsString() @MaxLength(100) country?: string;
}

export class ApplicationCompetencyDto {
  @ApiProperty() @IsString() subjectCode!: string;

  @ApiProperty({ type: String, isArray: true, description: 'Each grade is one competency, as in tutor_competencies.' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  gradeCodes!: string[];

  @ApiProperty({ type: String, isArray: true, description: 'Languages of instruction.' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  languageCodes!: string[];
}

/** A file already confirmed through POST /uploads/confirm; still in the uploader's staging folder. */
export class ApplicationDocumentDto {
  @ApiProperty({ enum: APPLICATION_DOC_TYPES }) @IsIn(APPLICATION_DOC_TYPES) docType!: (typeof APPLICATION_DOC_TYPES)[number];

  @ApiProperty({ description: 'The path returned by POST /uploads/confirm.' })
  @IsString()
  @MaxLength(300)
  @Matches(STAGED_PATH)
  path!: string;

  @ApiProperty({ enum: MIME_TYPES }) @IsIn(MIME_TYPES) mimeType!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10 * 1024 * 1024) sizeBytes!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) originalName?: string;

  @ApiPropertyOptional({ description: 'Qualification title; required for a qualification.' })
  @ValidateIf((d: ApplicationDocumentDto) => d.docType === 'qualification')
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) institution?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1950) @Max(2100) yearAwarded?: number;
}

export class ApplicationReferenceDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) fullName!: string;
  @ApiProperty({ example: 'Former principal' }) @IsString() @MinLength(1) @MaxLength(100) relationship!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(50) phone!: string;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((r: ApplicationReferenceDto) => !!r.email) @IsEmail() email?: string;
}

export class ApplicationConsentsDto {
  @ApiProperty() @IsBoolean() popia!: boolean;
  @ApiProperty() @IsBoolean() referencesAgreed!: boolean;
  @ApiProperty() @IsBoolean() declaration!: boolean;
}

export class SubmitTutorApplicationDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) firstName!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) lastName!: string;
  @ApiProperty({ example: '0721234567' }) @IsString() @MaxLength(20) phone!: string;

  @ApiPropertyOptional({ description: 'Omit when it is the same as the phone number.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsappNumber?: string;

  @ApiProperty({ type: ApplicationAddressDto })
  @ValidateNested()
  @Type(() => ApplicationAddressDto)
  address!: ApplicationAddressDto;

  @ApiProperty({ type: ApplicationCompetencyDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ApplicationCompetencyDto)
  competencies!: ApplicationCompetencyDto[];

  @ApiProperty({ type: ApplicationDocumentDto, isArray: true })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ApplicationDocumentDto)
  documents!: ApplicationDocumentDto[];

  @ApiProperty({ type: ApplicationReferenceDto, isArray: true, minItems: 3, maxItems: 3 })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => ApplicationReferenceDto)
  references!: ApplicationReferenceDto[];

  @ApiProperty({ type: ApplicationConsentsDto })
  @ValidateNested()
  @Type(() => ApplicationConsentsDto)
  consents!: ApplicationConsentsDto;
}

export class SubmittedApplicationDto {
  @ApiProperty() applicationId!: string;
}

export class PoliceClearanceUploadDto {
  @ApiProperty({ description: 'The path returned by POST /uploads/confirm (purpose tutor_police_clearance).' })
  @IsString()
  @MaxLength(300)
  @Matches(STAGED_PATH)
  path!: string;

  @ApiProperty({ enum: MIME_TYPES }) @IsIn(MIME_TYPES) mimeType!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(10 * 1024 * 1024) sizeBytes!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) originalName?: string;
}

// Review -------------------------------------------------------------------------

export class ListApplicationsQueryDto {
  @ApiPropertyOptional({ enum: [...APPLICATION_STATUSES, 'needs_action'] })
  @IsOptional()
  @IsIn([...APPLICATION_STATUSES, 'needs_action'])
  status?: (typeof APPLICATION_STATUSES)[number] | 'needs_action';

  @ApiPropertyOptional() @IsOptional() @IsString() roundId?: string;
}

export class SetApplicationStatusDto {
  @ApiProperty({ enum: ['shortlisted', 'rejected'] }) @IsIn(['shortlisted', 'rejected']) status!: 'shortlisted' | 'rejected';
  @ApiPropertyOptional({ description: 'Internal; never shown to the applicant.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RequestPoliceClearanceDto {
  @ApiPropertyOptional({ example: 'Please upload by 15 Jan' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ApplicationCompetencyViewDto {
  @ApiProperty() subjectCode!: string;
  @ApiProperty() subjectName!: string;
  @ApiProperty() gradeCode!: string;
  @ApiProperty() gradeName!: string;
  @ApiProperty({ type: String, isArray: true }) languages!: string[];
}

export class ApplicationDocumentViewDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: APPLICATION_DOC_TYPES }) docType!: string;
  @ApiProperty() originalName!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() title!: string;
  @ApiProperty() institution!: string;
  @ApiPropertyOptional({ nullable: true }) yearAwarded!: number | null;
  @ApiProperty() uploadedAt!: string;
  @ApiPropertyOptional({ description: 'Signed URL, valid for 5 minutes. Only on the detail view.' }) url?: string;
}

export class ApplicationReferenceViewDto {
  @ApiProperty() position!: number;
  @ApiProperty() fullName!: string;
  @ApiProperty() relationship!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() email!: string;
}

export class TutorApplicationSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() roundId!: string;
  @ApiProperty() applicantId!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
  @ApiProperty() whatsappNumber!: string;
  @ApiProperty({ enum: APPLICATION_STATUSES }) status!: string;
  @ApiProperty() submittedAt!: string;
  @ApiProperty() policeClearanceRequired!: boolean;
  @ApiPropertyOptional({ nullable: true }) policeClearanceRequestedAt!: string | null;
  @ApiProperty() policeClearanceRequestNote!: string;
  @ApiProperty() hasPoliceClearance!: boolean;
  @ApiPropertyOptional({ nullable: true }) identityCheckedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) tutorId!: string | null;
  @ApiProperty({ description: 'e.g. "Mathematics 4–7 · English 1–3"' }) subjectsSummary!: string;
}

export class TutorApplicationDetailDto extends TutorApplicationSummaryDto {
  @ApiProperty() addressLine1!: string;
  @ApiProperty() addressLine2!: string;
  @ApiProperty() city!: string;
  @ApiProperty() province!: string;
  @ApiProperty() country!: string;
  @ApiProperty() decisionNote!: string;
  @ApiPropertyOptional({ nullable: true }) reviewedAt!: string | null;
  @ApiProperty({ type: ApplicationCompetencyViewDto, isArray: true }) competencies!: ApplicationCompetencyViewDto[];
  @ApiProperty({ type: ApplicationDocumentViewDto, isArray: true }) documents!: ApplicationDocumentViewDto[];
  @ApiProperty({ type: ApplicationReferenceViewDto, isArray: true }) references!: ApplicationReferenceViewDto[];
}

export class SkippedCompetencyDto {
  @ApiProperty() subjectCode!: string;
  @ApiProperty() gradeCode!: string;
}

export class ApproveApplicationResultDto {
  @ApiProperty() tutorId!: string;
  @ApiProperty({ type: SkippedCompetencyDto, isArray: true }) skippedCompetencies!: SkippedCompetencyDto[];
}

export class RetentionDueDto {
  @ApiProperty() applicationId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['rejected', 'withdrawn'] }) status!: string;
  @ApiProperty() decidedAt!: string;
  @ApiProperty({ example: '2027-12-01' }) dueOn!: string;
}

export class PurgeResultDto {
  @ApiProperty() deletedFiles!: number;
}
