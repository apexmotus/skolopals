import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param.js';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';

export interface DocumentLocation {
  storagePath: string;
  mime: string;
  originalName: string;
}

@Injectable()
export class LearnerDocumentsRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  /**
   * `private.learner_document_download` decides who may read (admin, the
   * learner's guardians and tutors, D5) and writes the POPIA access log.
   * Refuses with "Document not found" otherwise.
   */
  async locate(documentId: string): Promise<DocumentLocation | undefined> {
    const row = await this.sp.queryOne<{ learner_document_download: DocumentLocation }>(
      'private.learner_document_download',
      [p.uuid('p_document_id', documentId)],
    );
    return row?.learner_document_download;
  }
}
