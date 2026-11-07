import { ApiProperty } from '@nestjs/swagger';

export class PublicTimetableEntryDto {
  @ApiProperty() classGroupId!: string;
  @ApiProperty() className!: string;
  @ApiProperty() subject!: string;
  @ApiProperty() language!: string;
  @ApiProperty() deliveryMode!: string;
  @ApiProperty() capacity!: number;
  @ApiProperty({ description: 'ISO day of week, 1=Monday..7=Sunday' })
  dayOfWeek!: number;
  @ApiProperty() startsAtTime!: string;
  @ApiProperty() endsAtTime!: string;
  @ApiProperty() tutorSlug!: string;
  @ApiProperty() tutorName!: string;
}
