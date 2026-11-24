import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  AptitudeResultDto,
  AttemptDto,
  NextQuestionDto,
  StartAttemptDto,
  SubmitAnswerDto,
} from './dto/aptitude.dto.js';
import { AptitudeManager } from './aptitude.manager.js';

/**
 * SPEC-2026-11-enrolment-payments-ux.md §4.3 and §8. Each underlying
 * function checks the caller is the learner's guardian or an administrator
 * (admins can run it on the centre tablet for walk-ins, D15).
 */
@ApiTags('aptitude')
@ApiBearerAuth()
@Controller('aptitude/attempts')
export class AptitudeController {
  constructor(private readonly manager: AptitudeManager) {}

  @Post()
  @Roles('parent', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start the aptitude test for a pending application, or resume the live attempt',
  })
  @ApiOkResponse({ type: AttemptDto })
  start(@Body() dto: StartAttemptDto): Promise<AttemptDto> {
    return this.manager.start(dto.enrolmentId);
  }

  @Get(':id/next')
  @Roles('parent', 'admin')
  @ApiOperation({
    summary: 'The question waiting for an answer (serving the next one if none is), or done',
  })
  @ApiOkResponse({ type: NextQuestionDto })
  next(@Param('id', ParseUUIDPipe) id: string): Promise<NextQuestionDto> {
    return this.manager.next(id);
  }

  @Post(':id/answers')
  @Roles('parent', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Answer the waiting question; returns the next one, or done' })
  @ApiOkResponse({ type: NextQuestionDto })
  answer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitAnswerDto,
  ): Promise<NextQuestionDto> {
    return this.manager.answer(id, dto);
  }

  @Get(':id/result')
  @Roles('admin', 'tutor', 'parent')
  @ApiOperation({
    summary:
      'The result, shaped by who asks: full with item breakdown for admin, no breakdown for the learner’s tutors, a summary for the guardian once the application is decided',
  })
  @ApiOkResponse({ type: AptitudeResultDto })
  result(@Param('id', ParseUUIDPipe) id: string): Promise<AptitudeResultDto> {
    return this.manager.result(id);
  }

  @Post(':id/retake')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set this attempt aside so the learner can take the test again' })
  @ApiNoContentResponse()
  retake(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.manager.retake(id);
  }
}
