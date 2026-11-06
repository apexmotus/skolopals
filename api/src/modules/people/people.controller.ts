import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { MyProfileDto, UpdateMyProfileDto } from './dto/profile.dto';
import { PeopleManager } from './people.manager';

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
}
