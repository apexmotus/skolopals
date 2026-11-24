import { Injectable } from '@nestjs/common';
import { STORAGE_BUCKETS } from '../../common/file-storage/file-storage.constants.js';
import { FileStorageService } from '../../common/file-storage/file-storage.service.js';
import { UnitOfWork } from '../../database/unit-of-work.js';
import type {
  AttachProofDto,
  PaymentSubmissionDto,
  ProofLinkDto,
  VerifyPaymentDto,
  VerifyPaymentResultDto,
} from './dto/payment.dto.js';
import { PaymentsRepository } from './payments.repository.js';

const PROOF_LINK_TTL_SECONDS = 60;

/** SPEC §3: "pay in your banking app, then upload proof", and an administrator verifies. */
@Injectable()
export class PaymentsManager {
  constructor(
    private readonly repo: PaymentsRepository,
    private readonly uow: UnitOfWork,
    private readonly storage: FileStorageService,
  ) {}

  /** "I have made the payment". Idempotent: returns the open submission if there is one. */
  start(invoiceId: string): Promise<PaymentSubmissionDto> {
    return this.repo.start(invoiceId);
  }

  /**
   * Records the proof and moves the file from the parent's staging folder to
   * `{account}/{submission}/…` in one unit of work, so a failed move leaves
   * the submission waiting for proof rather than pointing at nothing.
   */
  async attachProof(submissionId: string, dto: AttachProofDto): Promise<void> {
    await this.uow.run(async () => {
      const filed = await this.repo.attachProof(submissionId, {
        stagingPath: dto.path,
        mime: dto.mimeType,
        claimedAmountCents: dto.claimedAmountCents,
        claimedPaidOn: dto.claimedPaidOn,
        payerReference: dto.payerReference,
      });
      await this.storage.move(STORAGE_BUCKETS.paymentProofs, filed.stagingPath, filed.storagePath);
    });
  }

  async proofLink(submissionId: string): Promise<ProofLinkDto> {
    const proof = await this.repo.proofLocation(submissionId);
    const url = await this.storage.createDownloadUrl(
      STORAGE_BUCKETS.paymentProofs,
      proof.storagePath,
      PROOF_LINK_TTL_SECONDS,
    );
    return { url, mime: proof.mime };
  }

  /** For an offer invoice: activates, places the learner and bills any month now due, in one transaction. */
  verify(submissionId: string, dto: VerifyPaymentDto): Promise<VerifyPaymentResultDto> {
    return this.repo.verify(submissionId, dto.amountCents, dto.paidOn ?? null, dto.reference ?? null);
  }

  reject(submissionId: string, reason: string): Promise<void> {
    return this.repo.reject(submissionId, reason);
  }
}
