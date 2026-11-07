import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Matches, Max, Min } from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ClassScheduleDto {
  @ApiProperty() id!: string;
  @ApiProperty() classGroupId!: string;
  @ApiProperty({ description: 'ISO day of week, 1=Monday..7=Sunday' })
  dayOfWeek!: number;
  @ApiProperty() startsAtTime!: string;
  @ApiProperty() endsAtTime!: string;
}

export class AddClassScheduleDto {
  @ApiProperty({
    minimum: 1,
    maximum: 7,
    description: 'ISO day of week, 1=Monday..7=Sunday',
  })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiProperty({
    example: '14:00',
    description:
      'Rejected outside centre operating hours for an in-centre class (online classes are exempt).',
  })
  @Matches(HHMM, { message: 'startsAtTime must be HH:mm' })
  startsAtTime!: string;

  @ApiProperty({ example: '15:00' })
  @Matches(HHMM, { message: 'endsAtTime must be HH:mm' })
  endsAtTime!: string;
}
