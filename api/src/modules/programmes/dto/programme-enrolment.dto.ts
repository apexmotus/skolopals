import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** A booking — a learner's place on a programme. Not the `enrolments` resource. */
export class ProgrammeEnrolmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() programmeId!: string;
  @ApiProperty() learnerId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() bookedAt!: Date;
}

export class BookProgrammeDto {
  @ApiProperty() @IsUUID() learnerId!: string;
}
