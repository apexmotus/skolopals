"use client";

import { useId, useState } from "react";
import { FormMessage } from "@skolopals/ui/ui";
import { createClient } from "@skolopals/shared/supabase/client";
import { confirmUpload, signUpload, type UploadPurpose } from "@/lib/upload-actions";

export type UploadedFile = { path: string; mimeType: string; sizeBytes: number; originalName: string };

const TEN_MB = 10 * 1024 * 1024;

/**
 * Picks a file and uploads it straight to private storage: the API signs a
 * URL into the user's staging folder, the browser sends the bytes there (never
 * through our servers), and the API then checks what the file really is.
 * iPhone photos (HEIC) are accepted and come back as JPEG.
 */
export function UploadField({
  purpose,
  label,
  hint,
  value,
  onChange,
  capture,
}: {
  purpose: UploadPurpose;
  label: string;
  hint?: string;
  value: UploadedFile | null;
  onChange: (file: UploadedFile | null) => void;
  /** Offer the camera on phones (proof of payment). */
  capture?: boolean;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.size > TEN_MB) {
      setError("The file is larger than 10 MB. Please choose a smaller file.");
      return;
    }
    setBusy(true);
    try {
      const signed = await signUpload(purpose, file.name, file.size);
      if ("error" in signed) throw new Error(signed.error);

      const { error: putError } = await createClient()
        .storage.from(signed.bucket)
        .uploadToSignedUrl(signed.path, signed.uploadToken, file, { contentType: file.type || undefined });
      if (putError) throw new Error("The upload did not finish. Please try again.");

      const confirmed = await confirmUpload(purpose, signed.path);
      if ("error" in confirmed) throw new Error(confirmed.error);
      onChange({ path: confirmed.path, mimeType: confirmed.mimeType, sizeBytes: confirmed.sizeBytes, originalName: file.name });
    } catch (err) {
      onChange(null);
      setError(err instanceof Error ? err.message : "The upload did not finish. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[12px] font-semibold text-ink">
        {label}
      </label>
      <label
        htmlFor={id}
        className="flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border-2 border-dashed border-line bg-white/[0.03] p-4 text-center text-[13px] text-ink hover:border-white/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
      >
        <input
          id={id}
          type="file"
          accept="image/*,application/pdf,.heic,.heif"
          capture={capture ? "environment" : undefined}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
        {busy ? (
          <span>Uploading…</span>
        ) : value ? (
          <>
            <span className="font-semibold">✓ {value.originalName}</span>
            <span className="text-[12px] text-muted">Tap to choose a different file</span>
          </>
        ) : (
          <>
            <span className="font-semibold">Choose a file or take a photo</span>
            <span className="text-[12px] text-muted">PDF, JPG, PNG or iPhone photo, up to 10 MB</span>
          </>
        )}
      </label>
      {hint ? <p className="text-[12px] text-muted">{hint}</p> : null}
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
