import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { STORAGE_BUCKETS } from '../../common/file-storage/file-storage.constants.js';
import { FileStorageService } from '../../common/file-storage/file-storage.service.js';
import { CronSecretGuard } from '../../common/guards/cron-secret.guard.js';
import { type OfferRunResult, JobsRepository } from './jobs.repository.js';

const STAGING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Jobs scheduled in api/vercel.json. GET because that is what Vercel Cron
 * sends. All are idempotent, so a missed or repeated run is safe.
 */
@ApiExcludeController()
@Public()
@UseGuards(CronSecretGuard)
@Controller('internal/jobs')
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(
    private readonly repo: JobsRepository,
    private readonly storage: FileStorageService,
  ) {}

  @Get('enrolment-offers')
  async enrolmentOffers(): Promise<OfferRunResult> {
    const result = await this.repo.processEnrolmentOffers();
    this.logger.log(`enrolment offers ${result.on}: ${result.reminded} reminded, ${result.lapsed} lapsed`);
    return result;
  }

  /**
   * Not on Vercel Cron: Hobby only runs daily jobs. Supabase Cron runs the same check every
   * 10 minutes inside the database (db/migrations/20261125000011_late_pickup_schedule.sql), and
   * the door screens run it too. Kept for a manual or external trigger.
   */
  @Get('late-pickups')
  async latePickups(): Promise<{ alerted: number }> {
    const alerted = await this.repo.alertLatePickups();
    if (alerted > 0) this.logger.log(`late pickups: ${alerted} alerted`);
    return { alerted };
  }

  /**
   * Uploads never submitted (an abandoned enrol form, payment or tutor application) are deleted
   * after 24 hours (SPEC §4.1). An abandoned tutor application leaves an ID photo and a selfie.
   */
  @Get('staging-cleanup')
  async stagingCleanup(): Promise<{ removed: number }> {
    let removed = 0;
    for (const bucket of [
      STORAGE_BUCKETS.learnerDocuments,
      STORAGE_BUCKETS.paymentProofs,
      STORAGE_BUCKETS.tutorDocuments,
    ]) {
      removed += await this.storage.removeStaleStaging(bucket, STAGING_MAX_AGE_MS);
    }
    this.logger.log(`staging cleanup: ${removed} removed`);
    return { removed };
  }
}
