import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const RETENTION_ACTIONS = ['deleted', 'anonymised', 'skipped'] as const;

export class RetentionDueDto {
  @ApiProperty() recordClass!: string;
  @ApiProperty() subjectId!: string;
  @ApiProperty() subjectLabel!: string;
  @ApiProperty() leftOn!: string;
  @ApiProperty() retentionMonths!: number;
  @ApiProperty() dueOn!: string;
}

export class RetentionLogDto {
  @ApiProperty() id!: string;
  @ApiProperty() recordClass!: string;
  @ApiProperty() subjectId!: string;
  @ApiProperty() subjectLabel!: string;
  @ApiProperty({ enum: RETENTION_ACTIONS }) action!: string;
  @ApiProperty() performedAt!: Date;
  @ApiPropertyOptional() confirmedBy?: string;
  @ApiProperty() note!: string;
}

/**
 * Records that an admin confirmed an action — it never performs a deletion
 * or anonymisation itself. There is no purge function anywhere in this
 * schema; the actual destructive step happens outside this API, and this
 * call is the audit trail that gates `v_retention_due` from surfacing the
 * same learner again once logged.
 */
export class RecordRetentionActionDto {
  @ApiProperty({ enum: RETENTION_ACTIONS }) @IsIn(RETENTION_ACTIONS) action!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
