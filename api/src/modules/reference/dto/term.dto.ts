import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Max, Min } from 'class-validator';

export class TermDto {
  @ApiProperty() id!: string;
  @ApiProperty() year!: number;
  @ApiProperty() termNumber!: number;
  @ApiProperty() startsOn!: string;
  @ApiProperty() endsOn!: string;
}

export class CreateTermDto {
  @ApiProperty({ minimum: 2020, maximum: 2100 })
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @ApiProperty({ minimum: 1, maximum: 4 })
  @IsInt()
  @Min(1)
  @Max(4)
  termNumber!: number;

  @ApiProperty({ example: '2026-01-14' })
  @IsDateString()
  startsOn!: string;

  @ApiProperty({ example: '2026-03-20' })
  @IsDateString()
  endsOn!: string;
}
