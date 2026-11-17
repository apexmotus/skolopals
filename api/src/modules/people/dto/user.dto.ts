import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
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

export class UpdateUserDto {
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

  @ApiProperty({ enum: INVITABLE_ROLES, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(INVITABLE_ROLES, { each: true })
  roles!: InvitableRole[];
}

export class SetUserActiveDto {
  @ApiProperty()
  @IsBoolean()
  active!: boolean;
}

export class UserSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional() phone?: string;
  @ApiProperty({ type: [String] }) roles!: string[];
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: string;
}

export class ListUsersQueryDto extends PaginationQueryDto {}
