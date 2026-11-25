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

  /**
   * Learners still signed in 30 minutes after their class ended: one alert each to admins and
   * guardians (docs/SPEC-2026-11-door-and-online-attendance.md §2.4). Runs as `anon` like the
   * offers job; `private.alert_late_pickups` is idempotent, so overlapping runs are safe.
   */
  async alertLatePickups(): Promise<number> {
    const row = await this.sp.queryOne<{ alert_late_pickups: number }>('private.alert_late_pickups', []);
    return row?.alert_late_pickups ?? 0;
  }
}
