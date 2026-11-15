import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import type { InvitableRole } from '../../../common/supabase-admin/supabase-admin-auth.service.js';

export const INVITABLE_ROLES: readonly InvitableRole[] = [
  'parent',
  'learner',
  'tutor',
  'admin',
] as const;

export class CreateUserDto {
  @ApiProperty({ example: 'Thabo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ example: 'Mokoena' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ example: 'thabo@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ enum: INVITABLE_ROLES })
  @IsIn(INVITABLE_ROLES)
  role!: InvitableRole;
}

export class UserSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional() phone?: string;
  @ApiProperty({ type: [String] }) roles!: string[];
  @ApiProperty() createdAt!: string;
}

export class ListUsersQueryDto extends PaginationQueryDto {}
