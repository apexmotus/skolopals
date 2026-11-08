import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { ConsentManager } from './consent.manager.js';
import { ConsentDto } from './dto/consent.dto.js';
import { RecordRetentionActionDto, RetentionDueDto, RetentionLogDto } from './dto/retention.dto.js';

@ApiTags('consent')
@ApiBearerAuth()
@Controller()
export class ConsentController {
  constructor(private readonly manager: ConsentManager) {}

  @Get('learners/:id/consents')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: "List a learner's consent records (a guardian of theirs, or admin)" })
  @ApiOkResponse({ type: ConsentDto, isArray: true })
  list(@Param('id', ParseUUIDPipe) id: string): Promise<ConsentDto[]> {
    return this.manager.list(id);
  }

  @Post('learners/:id/consents/:consentTypeCode/withdraw')
  @Roles('parent')
  @ApiOperation({ summary: 'Withdraw a consent (only the guardian who granted it)' })
  @ApiOkResponse({ type: ConsentDto })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('consentTypeCode') consentTypeCode: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<ConsentDto> {
    return this.manager.withdraw(id, consentTypeCode, actor);
  }

  @Get('admin/retention/due')
  @Roles('admin')
  @ApiOperation({ summary: 'Learners past their retention period and not yet purged' })
  @ApiOkResponse({ type: RetentionDueDto, isArray: true })
  getDue(): Promise<RetentionDueDto[]> {
    return this.manager.getDue();
  }

  @Post('admin/retention/:learnerId/action')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Confirm a retention action was taken — never performs the deletion/anonymisation itself',
  })
  @ApiCreatedResponse({ type: RetentionLogDto })
  recordAction(
    @Param('learnerId', ParseUUIDPipe) learnerId: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: RecordRetentionActionDto,
  ): Promise<RetentionLogDto> {
    return this.manager.recordAction(learnerId, actor, dto);
  }
}
