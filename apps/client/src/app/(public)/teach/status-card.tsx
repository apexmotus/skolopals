"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Card, CardTitle, FormMessage } from "@skolopals/ui/ui";
import { Dialog } from "@skolopals/ui/dialog";
import { UploadField, type UploadedFile } from "@/components/uploads/upload-field";
import { uploadPoliceClearance, withdrawTutorApplication, type TeachState } from "./actions";

const STATUS: Record<string, { label: string; tone: "warning" | "brand" | "success" | "neutral"; body: string }> = {
  submitted: { label: "Received", tone: "warning", body: "The centre has your application and will be in touch." },
  shortlisted: {
    label: "Shortlisted",
    tone: "brand",
    body: "You’ve been shortlisted. The centre will contact you to arrange an interview.",
  },
  approved: {
    label: "Approved",
    tone: "success",
    body: "Welcome to Skolopals. Your account is now a tutor account: sign out and sign in again to open the tutor portal.",
  },
  rejected: {
    label: "Not successful",
    tone: "neutral",
    body: "Thank you for applying. We won’t be taking your application further this time.",
  },
  withdrawn: { label: "Withdrawn", tone: "neutral", body: "You withdrew this application." },
};

function Result({ state }: { state: TeachState }) {
  if (state.error) return <FormMessage>{state.error}</FormMessage>;
  if (state.ok) return <FormMessage tone="success">{state.ok}</FormMessage>;
  return null;
}

/** The applicant's view of where their application is (SPEC §3.5). */
export function ApplicationStatusCard({
  applicationId,
  status,
  submittedOn,
  clearanceRequested,
  clearanceNote,
}: {
  applicationId: string;
  status: string;
  submittedOn: string;
  clearanceRequested: boolean;
  clearanceNote: string;
}) {
  const [state, setState] = useState<TeachState>({});
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const info = STATUS[status] ?? STATUS.submitted;

  return (
    <>
      {clearanceRequested ? <PoliceClearanceRequestCard note={clearanceNote} /> : null}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Your tutor application</CardTitle>
          <Badge tone={info?.tone}>{info?.label}</Badge>
        </div>
        <p className="text-[12px] text-muted">Sent {submittedOn}</p>
        <p className="text-[14px] leading-[1.6] text-ink">{info?.body}</p>
        {status === "submitted" ? (
          <Button type="button" variant="secondary" className="w-fit" onClick={() => setConfirming(true)}>
            Withdraw my application
          </Button>
        ) : null}
        {confirming ? (
          <Dialog
            open
            onClose={() => setConfirming(false)}
            title="Withdraw your application?"
            description="You can apply again the next time the centre opens applications."
            footer={
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
                  Keep it
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setState(await withdrawTutorApplication(applicationId));
                      setConfirming(false);
                    })
                  }
                >
                  {pending ? "Withdrawing…" : "Withdraw"}
                </Button>
              </div>
            }
          >
            <p className="text-[14px] text-ink">The centre will no longer see it as waiting for a decision.</p>
          </Dialog>
        ) : null}
        <Result state={state} />
      </Card>
    </>
  );
}

/** Shown when the centre has asked for a police clearance: on /teach, and on the tutor portal after approval. */
export function PoliceClearanceRequestCard({ note }: { note: string }) {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [state, setState] = useState<TeachState>({});
  const [pending, startTransition] = useTransition();

  if (state.ok) {
    return (
      <Card className="border-success">
        <FormMessage tone="success">{state.ok}</FormMessage>
      </Card>
    );
  }

  return (
    <Card className="border-accent">
      <CardTitle>We need your police clearance certificate</CardTitle>
      {note ? <p className="whitespace-pre-wrap text-[14px] leading-[1.6] text-ink">{note}</p> : null}
      <p className="text-[13px] text-muted">A PDF or a clear photo of your SAPS certificate.</p>
      <UploadField purpose="tutor_police_clearance" label="Police clearance certificate" value={file} onChange={setFile} />
      <Button
        type="button"
        className="w-fit"
        disabled={!file || pending}
        onClick={() => {
          if (!file) return;
          startTransition(async () => setState(await uploadPoliceClearance(file)));
        }}
      >
        {pending ? "Sending…" : "Send certificate"}
      </Button>
      <Result state={state} />
    </Card>
  );
}
