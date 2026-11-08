import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MyProfileDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional() phone?: string;
  @ApiProperty() email!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ type: [String] }) roles!: string[];
}

export class UpdateMyProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}
