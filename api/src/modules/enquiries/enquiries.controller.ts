import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Throttle } from '../../common/decorators/throttle.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  ConvertEnquiryDto,
  EnquiryDto,
  ListEnquiriesQueryDto,
  SubmitEnquiryDto,
  UpdateEnquiryStatusDto,
} from './dto/enquiry.dto.js';
import { EnquiriesManager } from './enquiries.manager.js';

@ApiTags('enquiries')
@Controller('enquiries')
export class EnquiriesController {
  constructor(private readonly manager: EnquiriesManager) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  /** 5/min per client, well under the app default of 120/min — a public form is the app's one unauthenticated write, and the one surface most worth throttling harder. */
  @Throttle(5, 60_000)
  @ApiOperation({ summary: 'Submit a contact enquiry (public — no account needed)' })
  @ApiCreatedResponse({ type: EnquiryDto })
  submit(@Body() dto: SubmitEnquiryDto): Promise<EnquiryDto> {
    return this.manager.submit(dto);
  }

  @Get()
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List contact enquiries' })
  @ApiOkResponse({ type: EnquiryDto, isArray: true })
  list(@Query() query: ListEnquiriesQueryDto): Promise<EnquiryDto[]> {
    return this.manager.list(query.status);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update an enquiry's status" })
  @ApiOkResponse({ type: EnquiryDto })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnquiryStatusDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<EnquiryDto> {
    return this.manager.updateStatus(id, dto, actor);
  }

  @Post(':id/convert')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link a converted enquiry to the resulting learner' })
  @ApiOkResponse({ type: EnquiryDto })
  convert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConvertEnquiryDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<EnquiryDto> {
    return this.manager.convert(id, dto, actor);
  }
}
