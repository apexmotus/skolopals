"use client";

import { useState } from "react";
import { Button, CardTitle, Field, FormMessage, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resubmitApplication } from "../actions";

export function ResubmitForm({ applicationId }: { applicationId: string }) {
  const [folder] = useState(() => crypto.randomUUID());
  const [paths, setPaths] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setStatus("uploading");
    const supabase = createClient();
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setStatus("error");
        return;
      }
      const path = `applications/${folder}/certificate-${crypto.randomUUID().slice(0, 8)}-${file.name.replace(/[^\w.-]+/g, "_").slice(-80)}`;
      const { error } = await supabase.storage.from("tutor-documents").upload(path, file);
      if (error) {
        setStatus("error");
        return;
      }
      setPaths((p) => [...p, path]);
    }
    setStatus("idle");
  }

  return (
    <form action={resubmitApplication} className="flex flex-col gap-[14px]">
      <CardTitle>Send the requested details</CardTitle>
      <input type="hidden" name="application_id" value={applicationId} />
      {paths.map((p) => (
        <input key={p} type="hidden" name="documents" value={p} />
      ))}
      <Field label="Upload documents (JPG, PNG or PDF · up to 10 MB each)" htmlFor="more-docs">
        <input
          id="more-docs"
          type="file"
          multiple
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => onFiles(e.target.files)}
          className="text-[13px] text-muted file:mr-3 file:rounded-[6px] file:border file:border-line file:bg-white file:px-3 file:py-2 file:text-[13px] file:text-ink"
        />
      </Field>
      {paths.length ? <p className="text-[12px] text-brand">{paths.length} file(s) uploaded.</p> : null}
      {status === "error" ? <FormMessage>Upload failed. Check the file is under 10 MB and try again.</FormMessage> : null}
      <Field label="Note for the reviewer (optional)" htmlFor="note">
        <Textarea id="note" name="note" rows={3} maxLength={2000} placeholder="Anything you’d like us to know…" />
      </Field>
      <Button type="submit" className="w-fit" disabled={status === "uploading"}>
        {status === "uploading" ? "Uploading…" : "Resubmit for review"}
      </Button>
    </form>
  );
}
