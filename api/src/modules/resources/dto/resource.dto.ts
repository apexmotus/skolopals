import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

const AUDIENCE_TYPES = ['learner', 'class_group', 'grade', 'all'] as const;

/**
 * Ports the DB's own CHECK constraint (`resource_audiences`,
 * `db/migrations/20261020000012_communication.sql`): exactly the column
 * matching `audienceType` may be populated. Re-validating it here, per the
 * plan's explicit instruction, means a bad request 400s before ever
 * reaching the database instead of surfacing as a raw `23514` — same
 * reasoning as every other DB CHECK this plan mirrors in a DTO.
 */
function MatchesAudienceType(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'matchesAudienceType',
      target: target.constructor,
      propertyName: propertyName as string,
      options,
      validator: {
        validate(_value: unknown, args?: { object: unknown }): boolean {
          const dto = args?.object as CreateResourceDto;
          const fields: Record<(typeof AUDIENCE_TYPES)[number], unknown> = {
            learner: dto.learnerId,
            class_group: dto.classGroupId,
            grade: dto.gradeCode,
            all: undefined,
          };
          return (AUDIENCE_TYPES as readonly string[]).every((type) => {
            const isTarget = dto.audienceType === type;
            const isSet = fields[type as (typeof AUDIENCE_TYPES)[number]] !== undefined;
            return isTarget ? isSet || type === 'all' : !isSet;
          });
        },
        defaultMessage(): string {
          return 'Exactly the field matching audienceType must be set, and no others.';
        },
      },
    });
  };
}

export class ResourceAudienceDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: AUDIENCE_TYPES }) audienceType!: string;
  @ApiPropertyOptional() learnerId?: string;
  @ApiPropertyOptional() classGroupId?: string;
  @ApiPropertyOptional() gradeCode?: string;
}

export class ResourceDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() subjectCode?: string;
  @ApiProperty() url!: string;
  @ApiProperty() storagePath!: string;
  @ApiPropertyOptional() createdBy?: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: ResourceAudienceDto, isArray: true }) audiences!: ResourceAudienceDto[];
}

export class CreateResourceDto {
  @ApiProperty() @IsString() @MaxLength(200) title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  storagePath?: string;

  @ApiProperty({ enum: AUDIENCE_TYPES })
  @IsIn(AUDIENCE_TYPES)
  @MatchesAudienceType()
  audienceType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  learnerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classGroupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gradeCode?: string;
}

export class UpdateResourceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subjectCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;
}
