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
  // Tutor applications (SPEC-2026-11-tutor-applications.md §3.4). An applicant
  // is an ordinary self-signup account, so a parent (or learner) role; the
  // police clearance can also come from a tutor after approval (§4.4).
  tutor_cv: {
    bucket: STORAGE_BUCKETS.tutorDocuments,
    roles: ['parent', 'learner'],
    maxBytes: TEN_MB,
  },
  tutor_qualification: {
    bucket: STORAGE_BUCKETS.tutorDocuments,
    roles: ['parent', 'learner'],
    maxBytes: TEN_MB,
  },
  tutor_id_document: {
    bucket: STORAGE_BUCKETS.tutorDocuments,
    roles: ['parent', 'learner'],
    maxBytes: TEN_MB,
  },
  tutor_selfie: {
    bucket: STORAGE_BUCKETS.tutorDocuments,
    roles: ['parent', 'learner'],
    maxBytes: TEN_MB,
    imagesOnly: true,
  },
  tutor_police_clearance: {
    bucket: STORAGE_BUCKETS.tutorDocuments,
    roles: ['parent', 'learner', 'tutor'],
    maxBytes: TEN_MB,
  },
} as const satisfies Record<
  string,
  {
    bucket: StorageBucket;
    roles: readonly string[];
    maxBytes: number;
    /** Refuse a PDF: the file must be a photo (a selfie). */
    imagesOnly?: boolean;
  }
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
