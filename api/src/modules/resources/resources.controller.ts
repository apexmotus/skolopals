import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { CreateResourceDto, ResourceDto, UpdateResourceDto } from './dto/resource.dto';
import { ResourcesManager } from './resources.manager';

@ApiTags('resources')
@ApiBearerAuth()
@Controller('resources')
export class ResourcesController {
  constructor(private readonly manager: ResourcesManager) {}

  @Get()
  @ApiOperation({ summary: 'List resources visible to the caller (four-way audience check)' })
  @ApiOkResponse({ type: ResourceDto, isArray: true })
  listForActor(): Promise<ResourceDto[]> {
    return this.manager.listForActor();
  }

  @Post()
  @Roles('tutor', 'admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a resource and its one audience' })
  @ApiCreatedResponse({ type: ResourceDto })
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateResourceDto): Promise<ResourceDto> {
    return this.manager.create(actor, dto);
  }

  @Patch(':id')
  @Roles('tutor', 'admin')
  @ApiOperation({ summary: 'Update a resource (its owning tutor, or admin)' })
  @ApiOkResponse({ type: ResourceDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResourceDto,
  ): Promise<ResourceDto> {
    return this.manager.update(id, dto);
  }

  @Delete(':id/audiences/:audienceId')
  @Roles('tutor', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a resource audience (its owning tutor, or admin)' })
  @ApiNoContentResponse()
  removeAudience(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('audienceId', ParseUUIDPipe) audienceId: string,
  ): Promise<void> {
    return this.manager.removeAudience(id, audienceId);
  }
}
