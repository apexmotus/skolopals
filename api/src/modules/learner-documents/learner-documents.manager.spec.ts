import { NotFoundException } from '@nestjs/common';
import type { FileStorageService } from '../../common/file-storage/file-storage.service.js';
import { LearnerDocumentsManager } from './learner-documents.manager.js';
import type { LearnerDocumentsRepository } from './learner-documents.repository.js';

describe('LearnerDocumentsManager.download', () => {
  const doc = { storagePath: 'learners/l1/d1.pdf', mime: 'application/pdf', originalName: 'report.pdf' };

  it('signs a 60-second link for a document of that learner', async () => {
    const repo = { locate: vi.fn().mockResolvedValue(doc) } as unknown as LearnerDocumentsRepository;
    const createDownloadUrl = vi.fn().mockResolvedValue('https://signed');
    const manager = new LearnerDocumentsManager(repo, { createDownloadUrl } as unknown as FileStorageService);

    await expect(manager.download('l1', 'd1')).resolves.toEqual({
      url: 'https://signed',
      mime: 'application/pdf',
      originalName: 'report.pdf',
    });
    expect(createDownloadUrl).toHaveBeenCalledWith('learner-documents', 'learners/l1/d1.pdf', 60);
  });

  it('404s when the document belongs to a different learner than the URL says', async () => {
    const repo = { locate: vi.fn().mockResolvedValue(doc) } as unknown as LearnerDocumentsRepository;
    const createDownloadUrl = vi.fn();
    const manager = new LearnerDocumentsManager(repo, { createDownloadUrl } as unknown as FileStorageService);

    await expect(manager.download('l2', 'd1')).rejects.toBeInstanceOf(NotFoundException);
    expect(createDownloadUrl).not.toHaveBeenCalled();
  });
});
