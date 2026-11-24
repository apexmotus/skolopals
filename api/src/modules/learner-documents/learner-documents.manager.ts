import { Injectable, NotFoundException } from '@nestjs/common';
import { STORAGE_BUCKETS } from '../../common/file-storage/file-storage.constants.js';
import { FileStorageService } from '../../common/file-storage/file-storage.service.js';
import type { DocumentDownloadDto } from './learner-documents.controller.js';
import { LearnerDocumentsRepository } from './learner-documents.repository.js';

/** Short on purpose: a forwarded link stops working within a minute. */
export const DOWNLOAD_TTL_SECONDS = 60;

@Injectable()
export class LearnerDocumentsManager {
  constructor(
    private readonly repo: LearnerDocumentsRepository,
    private readonly storage: FileStorageService,
  ) {}

  async download(learnerId: string, documentId: string): Promise<DocumentDownloadDto> {
    const doc = await this.repo.locate(documentId);
    // The id pair must match, so a document id can't be fetched through another learner's URL.
    if (!doc?.storagePath.startsWith(`learners/${learnerId}/`))
      throw new NotFoundException('Document not found.');
    const url = await this.storage.createDownloadUrl(
      STORAGE_BUCKETS.learnerDocuments,
      doc.storagePath,
      DOWNLOAD_TTL_SECONDS,
    );
    return { url, mime: doc.mime, originalName: doc.originalName };
  }
}
