import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import {
  AcknowledgeReportDto,
  ProgressReportDto,
  SaveProgressReportDto,
} from './dto/progress-report.dto';
import { ProgressReportManager } from './progress-report.manager';

@ApiTags('progress-reports')
@ApiBearerAuth()
@Controller()
export class ProgressReportController {
  constructor(private readonly manager: ProgressReportManager) {}

  @Get('learners/:id/progress-reports')
  @ApiOperation({
    summary:
      'List a learner’s progress reports (guardian: published only; teaching tutor, admin: including drafts)',
  })
  @ApiOkResponse({ type: ProgressReportDto, isArray: true })
  list(@Param('id', ParseUUIDPipe) id: string): Promise<ProgressReportDto[]> {
    return this.manager.list(id);
  }

  @Get('progress-reports/:id')
  @ApiOperation({ summary: 'Get a single progress report (same visibility rule as the list)' })
  @ApiOkResponse({ type: ProgressReportDto })
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<ProgressReportDto> {
    return this.manager.getById(id);
  }

  @Put('learners/:id/progress-reports/:termId')
  @Roles('admin', 'tutor')
  @ApiOperation({
    summary: 'Save (upsert) a termly progress report, optionally publishing it (teaching tutor, admin)',
  })
  @ApiOkResponse({ type: ProgressReportDto })
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('termId', ParseUUIDPipe) termId: string,
    @Body() dto: SaveProgressReportDto,
  ): Promise<ProgressReportDto> {
    return this.manager.save(id, termId, dto);
  }

  @Post('progress-reports/:id/acknowledge')
  @Roles('parent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Acknowledge a published progress report (guardian-of)' })
  @ApiCreatedResponse({ type: ProgressReportDto })
  acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: AcknowledgeReportDto,
  ): Promise<ProgressReportDto> {
    return this.manager.acknowledge(id, actor, dto);
  }
}
