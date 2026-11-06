import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RoomDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() capacity!: number;
  @ApiProperty() isActive!: boolean;
}

export class CreateRoomDto {
  @ApiProperty() @IsString() name!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
