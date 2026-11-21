import {
  STORAGE_BUCKETS,
  type StorageBucket,
} from '../../common/file-storage/file-storage.constants.js';

const TEN_MB = 10 * 1024 * 1024;

/**
 * What a browser may upload, where it lands and who may send it. Every upload
 * goes to `staging/<uploader's user id>/` in its bucket; the endpoint that
 * consumes it (enrolment submit, proof of payment) moves it to its final
 * place once that record exists. So a file is never attached to a learner or
 * an invoice the uploader has not been checked against.
 */
export const UPLOAD_PURPOSES = {
  report_card: {
    bucket: STORAGE_BUCKETS.learnerDocuments,
    roles: ['parent', 'admin'],
    maxBytes: TEN_MB,
  },
  payment_proof: {
    bucket: STORAGE_BUCKETS.paymentProofs,
    roles: ['parent'],
    maxBytes: TEN_MB,
  },
} as const satisfies Record<
  string,
  { bucket: StorageBucket; roles: readonly string[]; maxBytes: number }
>;

export type UploadPurpose = keyof typeof UPLOAD_PURPOSES;
export const UPLOAD_PURPOSE_NAMES = Object.keys(
  UPLOAD_PURPOSES,
) as UploadPurpose[];

/** Extensions a file name may carry. The real type is checked from the bytes on confirm. */
export const ACCEPTED_EXTENSIONS = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'heic',
  'heif',
] as const;

export const stagingPrefix = (userId: string) => `staging/${userId}/`;
