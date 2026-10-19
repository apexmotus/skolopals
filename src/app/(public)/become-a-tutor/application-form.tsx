"use client";

import { useActionState, useId, useState } from "react";
import { Badge, Button, Card, CardTitle, Field, FormMessage, Input, PageHeading, Textarea, cx } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { submitApplication, type FormState } from "../actions";

type UploadKind = "identity" | "certificate" | "video";
type Upload = { status: "idle" | "uploading" | "done" | "error"; paths: string[]; error?: string };

const UPLOADS: { kind: UploadKind; title: string; required: boolean; hint: string; accept: string; multiple?: boolean; maxMb: number }[] = [
  { kind: "identity", title: "Identity document", required: true, hint: "JPG, PNG, or PDF · up to 10 MB", accept: "image/jpeg,image/png,application/pdf", maxMb: 10 },
  { kind: "certificate", title: "Certificates", required: true, hint: "JPG, PNG, or PDF · up to 10 MB each", accept: "image/jpeg,image/png,application/pdf", multiple: true, maxMb: 10 },
  { kind: "video", title: "Optional intro video", required: false, hint: "MP4 · up to 50 MB", accept: "video/mp4", maxMb: 50 },
];

export function ApplicationForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitApplication, {});
  const [folder] = useState(() => crypto.randomUUID());
  const [uploads, setUploads] = useState<Record<UploadKind, Upload>>({
    identity: { status: "idle", paths: [] },
    certificate: { status: "idle", paths: [] },
    video: { status: "idle", paths: [] },
  });
  const v = state.values ?? {};

  const requiredDone = UPLOADS.filter((u) => u.required && uploads[u.kind].status === "done").length;
  const requiredTotal = UPLOADS.filter((u) => u.required).length;
  // Step 2 (background) is where this form sits; uploads move the bar towards step 3.
  const progress = 0.25 + 0.25 * (requiredDone / requiredTotal) + (requiredDone === requiredTotal ? 0.25 : 0);

  async function upload(kind: UploadKind, files: FileList | null, maxMb: number) {
    if (!files?.length) return;
    const tooBig = [...files].find((f) => f.size > maxMb * 1024 * 1024);
    if (tooBig) {
      setUploads((u) => ({ ...u, [kind]: { status: "error", paths: u[kind].paths, error: `${tooBig.name} is larger than ${maxMb} MB.` } }));
      return;
    }
    setUploads((u) => ({ ...u, [kind]: { ...u[kind], status: "uploading", error: undefined } }));
    const supabase = createClient();
    const paths: string[] = [];
    for (const file of files) {
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
      const path = `applications/${folder}/${kind}-${crypto.randomUUID().slice(0, 8)}-${safe}`;
      const { error } = await supabase.storage.from("tutor-documents").upload(path, file, { upsert: false });
      if (error) {
        setUploads((u) => ({
          ...u,
          [kind]: { status: "error", paths: u[kind].paths, error: `Upload failed for ${file.name}. Check your connection and try again.` },
        }));
        return;
      }
      paths.push(path);
    }
    setUploads((u) => ({ ...u, [kind]: { status: "done", paths: [...u[kind].paths, ...paths] } }));
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <PageHeading title="Become a Skolopals tutor" description="Step 2 of 4 · Professional background" />
      <div className="h-[6px] w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${progress * 100}%` }} />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Your application</CardTitle>
          <Badge tone="brand" className="py-[6px]">
            {requiredTotal + 1} required
          </Badge>
        </div>
        <div className="flex flex-col gap-[14px] md:flex-row">
          <Field label="Full name" htmlFor="full_name" className="flex-1">
            <Input id="full_name" name="full_name" placeholder="Jordan Lee" defaultValue={v.full_name ?? defaultName} required />
          </Field>
          <Field label="Email" htmlFor="email" className="flex-1">
            <Input id="email" name="email" type="email" placeholder="jordan@example.com" defaultValue={v.email} required />
          </Field>
        </div>
        <div className="flex flex-col gap-[14px] md:flex-row">
          <Field label="Subjects" htmlFor="subjects" className="flex-1">
            <Input id="subjects" name="subjects" placeholder="Mathematics, Physics" defaultValue={v.subjects} required />
          </Field>
          <Field label="Grades taught" htmlFor="grades" className="flex-1">
            <Input id="grades" name="grades" placeholder="Grades 8-12" defaultValue={v.grades} />
          </Field>
        </div>
        <Field label="Qualifications" htmlFor="qualifications">
          <Input id="qualifications" name="qualifications" placeholder="MSc Mathematics, QTS" defaultValue={v.qualifications} />
        </Field>
        <Field label="Teaching experience" htmlFor="experience">
          <Textarea id="experience" name="experience" rows={2} placeholder="Describe your classroom and tutoring experience..." defaultValue={v.experience} />
        </Field>

        <div className="flex items-center gap-[10px] rounded-[8px] bg-canvas p-3">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-[10px] bg-brand">
            <img src="/icons/check.svg" alt="" width={12} height={12} />
          </span>
          <p className="text-[12px] text-brand">
            {requiredDone} of {requiredTotal} required uploads are complete.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          {UPLOADS.map((u) => (
            <UploadCard key={u.kind} {...u} upload={uploads[u.kind]} onFiles={(f) => upload(u.kind, f, u.maxMb)} />
          ))}
        </div>
        {Object.values(uploads).flatMap((u) => u.paths).map((p) => (
          <input key={p} type="hidden" name="documents" value={p} />
        ))}

        {state.error ? <FormMessage>{state.error}</FormMessage> : null}
        <div className="flex gap-[10px]">
          <Button type="submit" disabled={pending || requiredDone < requiredTotal || Object.values(uploads).some((u) => u.status === "uploading")}>
            {pending ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      </Card>
    </form>
  );
}

function UploadCard({
  title,
  required,
  hint,
  accept,
  multiple,
  upload,
  onFiles,
}: {
  title: string;
  required: boolean;
  hint: string;
  accept: string;
  multiple?: boolean;
  upload: Upload;
  onFiles: (files: FileList | null) => void;
}) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const label =
    upload.status === "uploading"
      ? "Uploading…"
      : upload.paths.length
        ? `${upload.paths.length} ${upload.paths.length === 1 ? "file" : "files"} uploaded`
        : title.includes("video")
          ? "Add a 60-second video"
          : "Drop PDF or image here";

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cx(
        "flex min-w-0 flex-1 cursor-pointer flex-col gap-[14px] rounded-[10px] border bg-white p-5 shadow-card",
        upload.status === "error" ? "border-danger" : dragging ? "border-brand" : "border-line",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[20px] font-bold text-ink">{title}</span>
        {upload.status === "done" ? (
          <Badge tone="success" className="py-[6px] font-semibold">Uploaded</Badge>
        ) : required ? (
          <Badge tone="danger" className="py-[6px]">Required</Badge>
        ) : (
          <Badge className="py-[6px] font-semibold">Optional</Badge>
        )}
      </div>
      <div className="flex flex-col gap-2 text-muted">
        <span className="text-[13px]">{label}</span>
        <span className="text-[11px]">{hint}</span>
        {upload.error ? (
          <span role="alert" className="text-[11px] text-danger">
            {upload.error}
          </span>
        ) : null}
      </div>
      <input id={id} type="file" accept={accept} multiple={multiple} className="sr-only" onChange={(e) => onFiles(e.target.files)} />
    </label>
  );
}
