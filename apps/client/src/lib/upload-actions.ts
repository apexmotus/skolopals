"use server";

import { api, ApiError } from "@skolopals/shared/api";

export type UploadPurpose = "report_card" | "payment_proof";

export type SignedUpload = { uploadToken: string; path: string; bucket: string } | { error: string };
export type ConfirmedUpload =
  | { path: string; mimeType: string; sizeBytes: number; converted: boolean }
  | { error: string };

const BUCKET: Record<UploadPurpose, string> = {
  report_card: "learner-documents",
  payment_proof: "payment-proofs",
};

function message(err: unknown) {
  return err instanceof ApiError && err.status < 500
    ? err.message
    : "We could not upload the file. Check your connection and try again.";
}

/** Step 1 of an upload: a signed URL into the caller's own staging folder (`POST /uploads/sign`). */
export async function signUpload(purpose: UploadPurpose, fileName: string, sizeBytes: number): Promise<SignedUpload> {
  try {
    const signed = await api.post<{ uploadUrl: string; uploadToken: string; path: string }>("/uploads/sign", {
      purpose,
      fileName,
      sizeBytes,
    });
    return { uploadToken: signed.uploadToken, path: signed.path, bucket: BUCKET[purpose] };
  } catch (err) {
    return { error: message(err) };
  }
}

/** Step 3: the API checks the bytes, the size, and turns an iPhone photo into a JPEG. */
export async function confirmUpload(purpose: UploadPurpose, path: string): Promise<ConfirmedUpload> {
  try {
    return await api.post("/uploads/confirm", { purpose, path });
  } catch (err) {
    return { error: message(err) };
  }
}
