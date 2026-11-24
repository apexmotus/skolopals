import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { LearnerDocumentsManager } from './learner-documents.manager.js';

export class DocumentDownloadDto {
  @ApiProperty({ description: 'Signed URL, valid for 60 seconds.' }) url!: string;
  @ApiProperty() mime!: string;
  @ApiProperty() originalName!: string;
}

/** Report cards (SPEC §4.2, §4.6). */
@ApiTags('learner-documents')
@ApiBearerAuth()
@Controller('learners/:learnerId/documents')
export class LearnerDocumentsController {
  constructor(private readonly manager: LearnerDocumentsManager) {}

  @Get(':documentId/download')
  @ApiOperation({ summary: 'A 60-second signed URL for a learner document; every call is logged' })
  @ApiOkResponse({ type: DocumentDownloadDto })
  download(
    @Param('learnerId', ParseUUIDPipe) learnerId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<DocumentDownloadDto> {
    return this.manager.download(learnerId, documentId);
  }
}
