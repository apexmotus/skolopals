import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SubmitLearnerDto {
  @ApiProperty() @IsString() @MaxLength(200) fullName!: string;
  @ApiProperty({ example: '2013-04-02' }) @IsDateString() dateOfBirth!: string;
  @ApiProperty() @IsString() gradeCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() homeLanguageCode?: string;

  @ApiPropertyOptional({ default: 'guardian', example: 'mother' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  relationship?: string;
}

export class SubmitSubjectDto {
  @ApiProperty() @IsString() subjectCode!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  preferredLanguageCode?: string;
}

export class SubmitEmergencyContactDto {
  @ApiProperty() @IsString() @MaxLength(200) fullName!: string;
  @ApiProperty() @IsString() @MaxLength(100) relationship!: string;
  @ApiProperty() @IsString() @MaxLength(50) phone!: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 5, default: 1 })
  @IsOptional()
  priority?: number;
}

export class SubmitCollectorDto {
  @ApiProperty() @IsString() @MaxLength(200) fullName!: string;
  @ApiProperty() @IsString() @MaxLength(100) relationship!: string;
  @ApiProperty() @IsString() @MaxLength(50) phone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() idNumberLast4?: string;
}

export class SubmitConsentDto {
  @ApiProperty() @IsString() consentTypeCode!: string;
  @ApiProperty() @IsBoolean() granted!: boolean;
}

export class SubmitEnrolmentDto {
  @ApiProperty({ type: SubmitLearnerDto })
  @ValidateNested()
  @Type(() => SubmitLearnerDto)
  learner!: SubmitLearnerDto;

  @ApiProperty() @IsString() packageCode!: string;

  @ApiPropertyOptional({ type: [SubmitSubjectDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitSubjectDto)
  subjects?: SubmitSubjectDto[];

  @ApiProperty({
    type: [SubmitEmergencyContactDto],
    minItems: 1,
    description: 'At least one emergency contact is required.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitEmergencyContactDto)
  emergencyContacts!: SubmitEmergencyContactDto[];

  @ApiPropertyOptional({ type: [SubmitCollectorDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitCollectorDto)
  collectors?: SubmitCollectorDto[];

  @ApiProperty({ type: [SubmitConsentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmitConsentDto)
  consents!: SubmitConsentDto[];

  @ApiProperty() @IsString() policyVersion!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() preferredTutorId?: string;
}
