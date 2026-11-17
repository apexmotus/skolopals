import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { PagedResult } from '../../common/types/paged-result.js';
import { MyProfileDto, UpdateMyProfileDto } from './dto/profile.dto.js';
import {
  CreateUserDto,
  ListUsersQueryDto,
  SetUserActiveDto,
  UpdateUserDto,
  UserSummaryDto,
} from './dto/user.dto.js';
import { PeopleManager } from './people.manager.js';

@ApiTags('people')
@ApiBearerAuth()
@Controller('people')
export class PeopleController {
  constructor(private readonly manager: PeopleManager) {}

  @Get('me')
  @ApiOperation({ summary: "Get the signed-in user's own profile" })
  @ApiOkResponse({ type: MyProfileDto })
  getMyProfile(@CurrentUser() actor: AuthUser): Promise<MyProfileDto> {
    return this.manager.getMyProfile(actor);
  }

  @Patch('me')
  @ApiOperation({ summary: "Update the signed-in user's own profile" })
  @ApiOkResponse({ type: MyProfileDto })
  updateMyProfile(
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpdateMyProfileDto,
  ): Promise<MyProfileDto> {
    return this.manager.updateMyProfile(actor, dto);
  }

  @Get('users')
  @Roles('admin', 'superadmin')
  @ApiOperation({
    summary: 'List all users and their roles (admin / superadmin only)',
  })
  @ApiOkResponse({ type: UserSummaryDto, isArray: true })
  listUsers(
    @Query() query: ListUsersQueryDto,
  ): Promise<PagedResult<UserSummaryDto>> {
    return this.manager.listUsers(query);
  }

  @Post('users')
  @Roles('admin', 'superadmin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Invite a new user by first name, last name, email, and role (admin role requires superadmin)',
  })
  @ApiCreatedResponse({ type: UserSummaryDto })
  inviteUser(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateUserDto,
  ): Promise<UserSummaryDto> {
    return this.manager.inviteUser(actor, dto);
  }

  @Patch('users/:id')
  @Roles('admin', 'superadmin')
  @ApiOperation({
    summary:
      "Edit a user's name and roles (admin accounts require superadmin)",
  })
  @ApiOkResponse({ type: UserSummaryDto })
  updateUser(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserSummaryDto> {
    return this.manager.updateUser(actor, id, dto);
  }

  @Patch('users/:id/active')
  @Roles('admin', 'superadmin')
  @ApiOperation({
    summary:
      'Deactivate or reactivate a user (blocks sign-in; data is kept)',
  })
  @ApiOkResponse({ type: UserSummaryDto })
  setUserActive(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserActiveDto,
  ): Promise<UserSummaryDto> {
    return this.manager.setUserActive(actor, id, dto.active);
  }
}
