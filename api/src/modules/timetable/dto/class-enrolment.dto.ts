import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** A placement — a learner's membership in a class group. Not the `enrolments` resource. */
export class ClassEnrolmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() classGroupId!: string;
  @ApiProperty() learnerId!: string;
  @ApiProperty() enrolmentId!: string;
  @ApiProperty() joinedOn!: string;
  @ApiPropertyOptional() leftOn?: string;
}

export class PlaceLearnerDto {
  @ApiProperty() @IsUUID() learnerId!: string;
  @ApiProperty() @IsUUID() enrolmentId!: string;
}
