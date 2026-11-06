import { ApiProperty } from '@nestjs/swagger';

export class OperatingHourDto {
  @ApiProperty({
    minimum: 1,
    maximum: 7,
    description: 'ISO-8601 day of week: 1=Monday .. 7=Sunday.',
  })
  dayOfWeek!: number;
  @ApiProperty({ example: '13:00:00' }) opensAt!: string;
  @ApiProperty({ example: '18:00:00' }) closesAt!: string;
  @ApiProperty({ enum: ['tutoring', 'administration'] }) purpose!: string;
}
