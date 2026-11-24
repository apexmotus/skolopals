import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param.js';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type { PaymentSubmissionDto, VerifyPaymentResultDto } from './dto/payment.dto.js';

export interface ProofLocation {
  storagePath: string;
  mime: string;
}

/**
 * PayShap proof-of-payment (`db/migrations/20261125000003_payshap_payments.sql`).
 * Every function here is in `private`: the proof functions take storage
 * paths, so they must never be reachable through PostgREST, and verify and
 * reject sit with them. Each checks its own caller (account holder or admin).
 */
@Injectable()
export class PaymentsRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  private async jsonb<T>(fn: string, params: Parameters<StoredProcRunner['queryOne']>[1]): Promise<T> {
    const name = fn.slice(fn.indexOf('.') + 1);
    const row = await this.sp.queryOne<Record<string, T>>(fn, params);
    if (!row) throw new Error(`${fn} unexpectedly returned no row`);
    return row[name] as T;
  }

  start(invoiceId: string): Promise<PaymentSubmissionDto> {
    return this.jsonb('private.start_payment_submission', [p.uuid('p_invoice_id', invoiceId)]);
  }

  /** Returns where the API must move the staged proof. */
  attachProof(
    submissionId: string,
    proof: Record<string, unknown>,
  ): Promise<{ stagingPath: string; storagePath: string }> {
    return this.jsonb('private.attach_payment_proof', [
      p.uuid('p_submission_id', submissionId),
      p.jsonb('p_proof', proof),
    ]);
  }

  proofLocation(submissionId: string): Promise<ProofLocation> {
    return this.jsonb('private.payment_proof_location', [p.uuid('p_submission_id', submissionId)]);
  }

  verify(
    submissionId: string,
    amountCents: number,
    paidOn: string | null,
    reference: string | null,
  ): Promise<VerifyPaymentResultDto> {
    return this.jsonb('private.verify_payment_submission', [
      p.uuid('p_submission_id', submissionId),
      p.int('p_amount_cents', amountCents),
      p.date('p_paid_on', paidOn),
      p.text('p_reference', reference),
    ]);
  }

  async reject(submissionId: string, reason: string): Promise<void> {
    await this.sp.queryOne('private.reject_payment_submission', [
      p.uuid('p_submission_id', submissionId),
      p.text('p_reason', reason),
    ]);
  }
}
