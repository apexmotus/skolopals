import { ApiProperty } from '@nestjs/swagger';

export class TutorSessionLoadDto {
  @ApiProperty() month!: string;
  @ApiProperty() sessions!: number;
  @ApiProperty({ description: 'Hours actually taught.' }) hours!: number;
}
