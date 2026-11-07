import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AchievementLevelDto } from './dto/achievement-level.dto';
import { AssessmentDomainDto } from './dto/assessment-domain.dto';
import { AssessmentTypeDto } from './dto/assessment-type.dto';
import { ConsentTypeDto } from './dto/consent-type.dto';
import { GradeDto } from './dto/grade.dto';
import { LanguageDto } from './dto/language.dto';
import { OperatingHourDto } from './dto/operating-hour.dto';
import { CreateRoomDto, RoomDto } from './dto/room.dto';
import { SchoolPhaseDto } from './dto/school-phase.dto';
import {
  ListSubjectOfferingsQueryDto,
  SubjectOfferingDto,
} from './dto/subject-offering.dto';
import { SubjectDto } from './dto/subject.dto';
import { CreateTermDto, TermDto } from './dto/term.dto';
import { ReferenceManager } from './reference.manager';

@ApiTags('reference')
@ApiBearerAuth()
@Controller('reference')
export class ReferenceController {
  constructor(private readonly manager: ReferenceManager) {}

  @Get('phases')
  @Public()
  @ApiOperation({ summary: 'List CAPS school phases' })
  @ApiOkResponse({ type: SchoolPhaseDto, isArray: true })
  listPhases(): Promise<SchoolPhaseDto[]> {
    return this.manager.listPhases();
  }

  @Get('grades')
  @Public()
  @ApiOperation({ summary: 'List grades (Grade R - Grade 12)' })
  @ApiOkResponse({ type: GradeDto, isArray: true })
  listGrades(): Promise<GradeDto[]> {
    return this.manager.listGrades();
  }

  @Get('subjects')
  @Public()
  @ApiOperation({ summary: 'List subjects the centre teaches' })
  @ApiOkResponse({ type: SubjectDto, isArray: true })
  listSubjects(): Promise<SubjectDto[]> {
    return this.manager.listSubjects();
  }

  @Get('subject-offerings')
  @Public()
  @ApiOperation({ summary: 'List which subjects are offered at which grade' })
  @ApiOkResponse({ type: SubjectOfferingDto, isArray: true })
  listOfferings(
    @Query() query: ListSubjectOfferingsQueryDto,
  ): Promise<SubjectOfferingDto[]> {
    return this.manager.listOfferings(query.gradeCode);
  }

  @Get('languages')
  @Public()
  @ApiOperation({ summary: 'List languages (medium of instruction / spoken)' })
  @ApiOkResponse({ type: LanguageDto, isArray: true })
  listLanguages(): Promise<LanguageDto[]> {
    return this.manager.listLanguages();
  }

  @Get('achievement-levels')
  @Public()
  @ApiOperation({ summary: 'List the CAPS 7-point achievement scale' })
  @ApiOkResponse({ type: AchievementLevelDto, isArray: true })
  listAchievementLevels(): Promise<AchievementLevelDto[]> {
    return this.manager.listAchievementLevels();
  }

  @Get('assessment-types')
  @Public()
  @ApiOperation({ summary: 'List assessment types (e.g. initial, termly, baseline)' })
  @ApiOkResponse({ type: AssessmentTypeDto, isArray: true })
  listAssessmentTypes(): Promise<AssessmentTypeDto[]> {
    return this.manager.listAssessmentTypes();
  }

  @Get('assessment-domains')
  @Public()
  @ApiOperation({ summary: 'List the domains an assessment can score (e.g. reading, numeracy)' })
  @ApiOkResponse({ type: AssessmentDomainDto, isArray: true })
  listAssessmentDomains(): Promise<AssessmentDomainDto[]> {
    return this.manager.listAssessmentDomains();
  }

  @Get('consent-types')
  @Public()
  @ApiOperation({ summary: 'List consent types the enrolment form renders' })
  @ApiOkResponse({ type: ConsentTypeDto, isArray: true })
  listConsentTypes(): Promise<ConsentTypeDto[]> {
    return this.manager.listConsentTypes();
  }

  @Get('terms')
  @Public()
  @ApiOperation({ summary: 'List school terms' })
  @ApiOkResponse({ type: TermDto, isArray: true })
  listTerms(): Promise<TermDto[]> {
    return this.manager.listTerms();
  }

  @Post('terms')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a school term' })
  @ApiCreatedResponse({ type: TermDto })
  createTerm(@Body() dto: CreateTermDto): Promise<TermDto> {
    return this.manager.createTerm(dto);
  }

  @Get('operating-hours')
  @Public()
  @ApiOperation({ summary: "List the centre's operating hours" })
  @ApiOkResponse({ type: OperatingHourDto, isArray: true })
  listOperatingHours(): Promise<OperatingHourDto[]> {
    return this.manager.listOperatingHours();
  }

  @Get('rooms')
  @Roles('admin')
  @ApiOperation({
    summary:
      'List rooms (admin-only in this app, though the data is public-readable)',
  })
  @ApiOkResponse({ type: RoomDto, isArray: true })
  listRooms(): Promise<RoomDto[]> {
    return this.manager.listRooms();
  }

  @Post('rooms')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a room' })
  @ApiCreatedResponse({ type: RoomDto })
  createRoom(@Body() dto: CreateRoomDto): Promise<RoomDto> {
    return this.manager.createRoom(dto);
  }
}
