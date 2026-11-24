import { Injectable } from '@nestjs/common';
import { StoredProcRunner } from '../../database/stored-proc.runner.js';

export interface OfferRunResult {
  on: string;
  reminded: number;
  lapsed: number;
}

@Injectable()
export class JobsRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  /**
   * Day-3 reminders and day-7 lapses (SPEC §5.4). Runs as `anon` (a cron
   * call has no user), which is why `private.process_enrolment_offers` is
   * granted to anon; it refuses future dates and is idempotent.
   */
  async processEnrolmentOffers(): Promise<OfferRunResult> {
    const row = await this.sp.queryOne<{ process_enrolment_offers: OfferRunResult }>(
      'private.process_enrolment_offers',
      [],
    );
    if (!row) throw new Error('process_enrolment_offers returned no row');
    return row.process_enrolment_offers;
  }
}
