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
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import {
  AddDocumentDto,
  TutorDocumentDto,
  UploadDocumentResponseDto,
} from './dto/tutor-document.dto';
import {
  AddQualificationDto,
  TutorQualificationDto,
} from './dto/tutor-qualification.dto';
import {
  AddReferenceDto,
  RecordOutcomeDto,
  TutorReferenceDto,
} from './dto/tutor-reference.dto';
import { SetPayRateDto, TutorPayRateDto } from './dto/tutor-pay-rate.dto';
import {
  SetSpokenLanguagesDto,
  TutorSpokenLanguageDto,
} from './dto/tutor-spoken-language.dto';
import {
  SetCompetencyDto,
  TutorCompetencyDto,
} from './dto/tutor-competency.dto';
import {
  CreateTutorDto,
  ListPublicTutorsQueryDto,
  TutorDto,
  UpdateMyTutorProfileDto,
} from './dto/tutor.dto';
import { TutorsManager } from './tutors.manager';

@ApiTags('tutors')
@ApiBearerAuth()
@Controller('tutors')
export class TutorsController {
  constructor(private readonly manager: TutorsManager) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Public tutor directory (active tutors only)' })
  @ApiOkResponse({ type: TutorDto, isArray: true })
  listPublic(@Query() query: ListPublicTutorsQueryDto) {
    return this.manager.listPublic(query);
  }

  @Get('me')
  @Roles('tutor')
  @ApiOperation({ summary: "Get the signed-in tutor's own profile" })
  @ApiOkResponse({ type: TutorDto })
  getMyProfile(@CurrentUser() actor: AuthUser): Promise<TutorDto> {
    return this.manager.getMyProfile(actor);
  }

  @Patch('me')
  @Roles('tutor')
  @ApiOperation({ summary: "Update the signed-in tutor's own profile" })
  @ApiOkResponse({ type: TutorDto })
  updateMyProfile(
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpdateMyTutorProfileDto,
  ): Promise<TutorDto> {
    return this.manager.updateMyProfile(actor, dto);
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a tutor record for an existing account (BR-23 — no self-application)',
  })
  @ApiCreatedResponse({ type: TutorDto })
  create(@Body() dto: CreateTutorDto): Promise<TutorDto> {
    return this.manager.createTutor(dto);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Public tutor profile by slug, with rating summary',
  })
  @ApiOkResponse({ type: TutorDto })
  getBySlug(@Param('slug') slug: string): Promise<TutorDto> {
    return this.manager.getBySlug(slug);
  }

  @Get(':id/competencies')
  @Public()
  @ApiOperation({
    summary:
      'List what a tutor teaches, and in which languages (staff directory)',
  })
  @ApiOkResponse({ type: TutorCompetencyDto, isArray: true })
  listCompetencies(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TutorCompetencyDto[]> {
    return this.manager.listCompetencies(id);
  }

  @Put(':id/competencies')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Set (upsert) one teaching competency and its media of instruction',
  })
  @ApiOkResponse({ type: TutorCompetencyDto })
  setCompetency(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCompetencyDto,
  ): Promise<TutorCompetencyDto> {
    return this.manager.setCompetency(id, dto);
  }

  @Put(':id/spoken-languages')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Set the full list of languages a tutor speaks (for parent communication)',
  })
  @ApiOkResponse({ type: TutorSpokenLanguageDto, isArray: true })
  setSpokenLanguages(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetSpokenLanguagesDto,
  ): Promise<TutorSpokenLanguageDto[]> {
    return this.manager.setSpokenLanguages(id, dto);
  }

  @Get(':id/qualifications')
  @Public()
  @ApiOperation({ summary: "List a tutor's qualifications" })
  @ApiOkResponse({ type: TutorQualificationDto, isArray: true })
  listQualifications(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TutorQualificationDto[]> {
    return this.manager.listQualifications(id);
  }

  @Post(':id/qualifications')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a qualification' })
  @ApiCreatedResponse({ type: TutorQualificationDto })
  addQualification(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddQualificationDto,
  ): Promise<TutorQualificationDto> {
    return this.manager.addQualification(id, dto);
  }

  @Get(':id/documents')
  @Roles('admin')
  @ApiOperation({
    summary: 'List vetting documents (admin only) with signed download URLs',
  })
  @ApiOkResponse({ type: TutorDocumentDto, isArray: true })
  listDocuments(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TutorDocumentDto[]> {
    return this.manager.listDocuments(id);
  }

  @Post(':id/documents')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Start a vetting-document upload: returns a signed Storage URL, never proxies the file bytes',
  })
  @ApiCreatedResponse({ type: UploadDocumentResponseDto })
  uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddDocumentDto,
  ): Promise<UploadDocumentResponseDto> {
    return this.manager.uploadDocument(id, dto);
  }

  @Get(':id/references')
  @Roles('admin')
  @ApiOperation({ summary: 'List reference checks (admin only)' })
  @ApiOkResponse({ type: TutorReferenceDto, isArray: true })
  listReferences(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TutorReferenceDto[]> {
    return this.manager.listReferences(id);
  }

  @Post(':id/references')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a reference to check' })
  @ApiCreatedResponse({ type: TutorReferenceDto })
  addReference(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddReferenceDto,
  ): Promise<TutorReferenceDto> {
    return this.manager.addReference(id, dto);
  }

  @Patch(':id/references/:refId')
  @Roles('admin')
  @ApiOperation({ summary: 'Record the outcome of a reference check' })
  @ApiOkResponse({ type: TutorReferenceDto })
  recordOutcome(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('refId', ParseUUIDPipe) refId: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: RecordOutcomeDto,
  ): Promise<TutorReferenceDto> {
    return this.manager.recordOutcome(id, refId, actor, dto);
  }

  @Get(':id/pay-rates')
  @ApiOperation({
    summary: "List a tutor's pay rate history (the tutor themselves, or admin)",
  })
  @ApiOkResponse({ type: TutorPayRateDto, isArray: true })
  listPayRates(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TutorPayRateDto[]> {
    return this.manager.listPayRates(id);
  }

  @Put(':id/pay-rates')
  @Roles('admin')
  @ApiOperation({
    summary: 'Set a new pay rate, closing the previous open one',
  })
  @ApiOkResponse({ type: TutorPayRateDto })
  setPayRate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPayRateDto,
  ): Promise<TutorPayRateDto> {
    return this.manager.setPayRate(id, dto);
  }
}
