export const SUPABASE_STORAGE_CLIENT = Symbol('SUPABASE_STORAGE_CLIENT');

/**
 * Every private bucket the API signs URLs for. Each is created by a migration
 * in db/migrations; none is public and none has a storage policy for
 * guardians or tutors — they only ever reach a file through a signed URL
 * this API issues after its own access check.
 */
export const STORAGE_BUCKETS = {
  /** Tutor vetting material. Admin only, 50 MB, jpeg/png/pdf (20261020000022_storage.sql). */
  tutorDocuments: 'tutor-documents',
  /** Report cards and other learner documents, 10 MB (SPEC-2026-11 §4.2). */
  learnerDocuments: 'learner-documents',
  /** PayShap proofs of payment, 10 MB (SPEC-2026-11 §3.3). */
  paymentProofs: 'payment-proofs',
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
