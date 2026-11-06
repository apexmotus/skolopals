import {
  Body,
  Controller,
  Delete,
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
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import {
  AddCollectorDto,
  AuthorisedCollectorDto,
} from './dto/authorised-collector.dto';
import {
  AddEmergencyContactDto,
  EmergencyContactDto,
} from './dto/emergency-contact.dto';
import {
  AddGuardianDto,
  LearnerGuardianDto,
  SetContactFlagsDto,
} from './dto/learner-guardian.dto';
import {
  CreateLearnerDto,
  LearnerDto,
  ListLearnersQueryDto,
  UpdateLearnerDto,
} from './dto/learner.dto';
import {
  MedicalNotesDto,
  UpsertMedicalNotesDto,
} from './dto/medical-notes.dto';
import { PeopleManager } from './people.manager';

@ApiTags('learners')
@ApiBearerAuth()
@Controller('learners')
export class LearnersController {
  constructor(private readonly manager: PeopleManager) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Get a learner by id (404 if not entitled to view them)',
  })
  @ApiOkResponse({ type: LearnerDto })
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<LearnerDto> {
    return this.manager.getLearnerById(id);
  }

  @Get()
  @Roles('admin', 'tutor')
  @ApiOperation({
    summary: 'List learners (a tutor sees only learners they teach)',
  })
  @ApiOkResponse({ type: LearnerDto, isArray: true })
  list(@Query() query: ListLearnersQueryDto) {
    return this.manager.listLearners(query);
  }

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a learner directly (walk-in path; the normal path is enrolment.submit)',
  })
  @ApiCreatedResponse({ type: LearnerDto })
  create(@Body() dto: CreateLearnerDto): Promise<LearnerDto> {
    return this.manager.createLearner(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a learner (guardian of this learner, or admin)',
  })
  @ApiOkResponse({ type: LearnerDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLearnerDto,
  ): Promise<LearnerDto> {
    return this.manager.updateLearner(id, dto);
  }

  @Get(':id/guardians')
  @ApiOperation({
    summary:
      "List a learner's guardians (guardian of, admin, or a teaching tutor)",
  })
  @ApiOkResponse({ type: LearnerGuardianDto, isArray: true })
  listGuardians(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LearnerGuardianDto[]> {
    return this.manager.listGuardians(id);
  }

  @Post(':id/guardians')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Link an existing guardian to a learner' })
  @ApiCreatedResponse({ type: LearnerGuardianDto })
  addGuardian(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddGuardianDto,
  ): Promise<LearnerGuardianDto> {
    return this.manager.addGuardian(id, dto);
  }

  @Patch(':id/guardians/:guardianId')
  @ApiOperation({
    summary: "Set a guardian link's primary/billing-contact flags",
  })
  @ApiOkResponse({ type: LearnerGuardianDto })
  setContactFlags(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
    @Body() dto: SetContactFlagsDto,
  ): Promise<LearnerGuardianDto> {
    return this.manager.setContactFlags(id, guardianId, dto);
  }

  @Get(':id/emergency-contacts')
  @ApiOperation({
    summary:
      'List emergency contacts (guardian of this learner, or admin — never exposed to a tutor)',
  })
  @ApiOkResponse({ type: EmergencyContactDto, isArray: true })
  listEmergencyContacts(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmergencyContactDto[]> {
    return this.manager.listEmergencyContacts(id);
  }

  @Post(':id/emergency-contacts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an emergency contact' })
  @ApiCreatedResponse({ type: EmergencyContactDto })
  addEmergencyContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddEmergencyContactDto,
  ): Promise<EmergencyContactDto> {
    return this.manager.addEmergencyContact(id, dto);
  }

  @Delete(':id/emergency-contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an emergency contact' })
  async removeEmergencyContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ): Promise<void> {
    await this.manager.removeEmergencyContact(id, contactId);
  }

  @Get(':id/collectors')
  @ApiOperation({
    summary:
      'List authorised collectors (guardian of this learner, or admin — never exposed to a tutor)',
  })
  @ApiOkResponse({ type: AuthorisedCollectorDto, isArray: true })
  listCollectors(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AuthorisedCollectorDto[]> {
    return this.manager.listCollectors(id);
  }

  @Post(':id/collectors')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an authorised collector' })
  @ApiCreatedResponse({ type: AuthorisedCollectorDto })
  addCollector(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCollectorDto,
  ): Promise<AuthorisedCollectorDto> {
    return this.manager.addCollector(id, dto);
  }

  @Delete(':id/collectors/:collectorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an authorised collector' })
  async removeCollector(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('collectorId', ParseUUIDPipe) collectorId: string,
  ): Promise<void> {
    await this.manager.removeCollector(id, collectorId);
  }

  @Get(':id/medical-notes')
  @ApiOperation({
    summary:
      'Get medical notes — SPECIAL PERSONAL INFORMATION (POPIA s26); guardian of this learner or admin only, NEVER a tutor',
  })
  @ApiOkResponse({ type: MedicalNotesDto })
  getMedicalNotes(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MedicalNotesDto> {
    return this.manager.getMedicalNotes(id);
  }

  @Put(':id/medical-notes')
  @ApiOperation({
    summary:
      'Upsert medical notes — guardian of this learner or admin only, NEVER a tutor',
  })
  @ApiOkResponse({ type: MedicalNotesDto })
  upsertMedicalNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: UpsertMedicalNotesDto,
  ): Promise<MedicalNotesDto> {
    return this.manager.upsertMedicalNotes(id, actor, dto);
  }
}
