import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class AuthorisedCollectorDto {
  @ApiProperty() id!: string;
  @ApiProperty() learnerId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() relationship!: string;
  @ApiProperty() phone!: string;
  @ApiPropertyOptional() idNumberLast4?: string;
  @ApiProperty() activeFrom!: string;
  @ApiPropertyOptional() activeTo?: string;
}

export class AddCollectorDto {
  @ApiProperty() @IsString() @MaxLength(200) fullName!: string;
  @ApiProperty() @IsString() @MaxLength(100) relationship!: string;
  @ApiProperty() @IsString() @MaxLength(50) phone!: string;

  @ApiPropertyOptional({
    description: 'Last four digits only — POPIA minimality.',
  })
  @IsOptional()
  @Matches(/^\d{4}$/)
  idNumberLast4?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  activeFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  activeTo?: string;
}
