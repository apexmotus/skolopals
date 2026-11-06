import { ApiProperty } from '@nestjs/swagger';

export class AchievementLevelDto {
  @ApiProperty() code!: number;
  @ApiProperty() label!: string;
  @ApiProperty() description!: string;
  @ApiProperty() minPercent!: number;
  @ApiProperty() maxPercent!: number;
}
