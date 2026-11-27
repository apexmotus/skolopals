"use client";

import { useActionState, useState } from "react";
import { Button, Card, CardTitle, Field, FormMessage, Input, Switch, Textarea } from "@skolopals/ui/ui";
import { Dialog } from "@skolopals/ui/dialog";
import { shortDate } from "@skolopals/shared/format";
import {
  closeRecruitment,
  openRecruitment,
  updateRecruitment,
  type TutorApplicationState,
} from "./actions";

type Subject = { code: string; name: string };

export type RecruitmentCardProps = {
  isOpen: boolean;
  /** The open round, when there is one. */
  round?: {
    openedAt: string;
    closesAt: string | null;
    message: string;
    needs: string[];
    policeClearanceRequired: boolean;
    applicationCount: number;
  };
  /** The last closed round, for "Last round: …" when closed. */
  lastRound?: { openedAt: string; closedAt: string | null; applicationCount: number };
  subjects: Subject[];
};

function Result({ state }: { state: TutorApplicationState }) {
  if (state.error) return <FormMessage>{state.error}</FormMessage>;
  if (state.ok) return <FormMessage tone="success">{state.ok}</FormMessage>;
  return null;
}

/** The on/off switch for tutor applications (SPEC §2.1). */
export function RecruitmentCard({ isOpen, round, lastRound, subjects }: RecruitmentCardProps) {
  const [dialog, setDialog] = useState<"open" | "edit" | null>(null);
  const [closeState, closeAction, closing] = useActionState<TutorApplicationState, FormData>(closeRecruitment, {});
  const subjectName = new Map(subjects.map((s) => [s.code, s.name]));

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Recruitment</CardTitle>
          {isOpen && round ? (
            <p className="text-[13px] text-ink">
              <span className="font-bold text-success">Open</span> since {shortDate(round.openedAt)}
              {round.closesAt ? ` · closes ${shortDate(round.closesAt)}` : " · no closing date"}
              {` · ${round.applicationCount} application${round.applicationCount === 1 ? "" : "s"} so far`}
              {round.policeClearanceRequired ? " · Police clearance required" : ""}
            </p>
          ) : (
            <p className="text-[13px] text-muted">
              Applications are closed.
              {lastRound
                ? ` Last round: ${shortDate(lastRound.openedAt)} – ${lastRound.closedAt ? shortDate(lastRound.closedAt) : "…"}, ${lastRound.applicationCount} application${lastRound.applicationCount === 1 ? "" : "s"}.`
                : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isOpen ? (
            <>
              <Button type="button" variant="secondary" onClick={() => setDialog("edit")}>
                Edit
              </Button>
              <form action={closeAction}>
                <Button type="submit" variant="secondary" disabled={closing}>
                  {closing ? "Closing…" : "Close now"}
                </Button>
              </form>
            </>
          ) : (
            <Button type="button" onClick={() => setDialog("open")}>
              Open applications
            </Button>
          )}
        </div>
      </div>

      {isOpen && round && (round.message || round.needs.length > 0) ? (
        <div className="flex flex-col gap-2 text-[13px] text-muted">
          {round.message ? <p className="whitespace-pre-wrap">“{round.message}”</p> : null}
          {round.needs.length > 0 ? (
            <p>Subjects needed: {round.needs.map((c) => subjectName.get(c) ?? c).join(", ")}</p>
          ) : null}
        </div>
      ) : null}
      {/* "Applications are closed" is stale once they have been opened again. */}
      <Result state={isOpen ? { error: closeState.error } : closeState} />

      {dialog ? (
        <RecruitmentDialog
          mode={dialog}
          round={dialog === "edit" ? round : undefined}
          subjects={subjects}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </Card>
  );
}

function RecruitmentDialog({
  mode,
  round,
  subjects,
  onClose,
}: {
  mode: "open" | "edit";
  round?: RecruitmentCardProps["round"];
  subjects: Subject[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<TutorApplicationState, FormData>(
    mode === "open" ? openRecruitment : updateRecruitment,
    {},
  );
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const closesOn = round?.closesAt
    ? new Date(round.closesAt).toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" })
    : "";
  const formId = `recruitment-${mode}`;

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === "open" ? "Open tutor applications" : "Change this round"}
      description={
        mode === "open"
          ? "An Apply to teach button appears on the website. You can close applications again at any time."
          : "Changes apply to applications submitted from now on."
      }
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            {state.ok ? "Done" : "Cancel"}
          </Button>
          {state.ok ? null : (
            <Button type="submit" form={formId} disabled={pending}>
              {pending ? "Saving…" : mode === "open" ? "Open applications" : "Save"}
            </Button>
          )}
        </div>
      }
    >
      <form id={formId} action={action} className="flex flex-col gap-4">
        <Field label="Closing date (optional)" htmlFor="closes_on" hint="Applications close at the end of this day. Leave empty to close them yourself.">
          <Input id="closes_on" name="closes_on" type="date" min={today} defaultValue={closesOn} />
        </Field>
        <Field label="Message for applicants (optional)" htmlFor="message">
          <Textarea
            id="message"
            name="message"
            rows={3}
            maxLength={1000}
            defaultValue={round?.message}
            placeholder="We're looking for patient tutors who love helping learners catch up."
          />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[12px] font-semibold text-ink">Subjects you need (optional)</legend>
          <p className="text-[12px] text-muted">These are shown on the website and listed first on the form.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {subjects.map((s) => (
              <label key={s.code} className="flex items-center gap-2 text-[13px] text-ink">
                <input type="checkbox" name="needs" value={s.code} defaultChecked={round?.needs.includes(s.code)} />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
        <Switch
          name="police_clearance_required"
          defaultChecked={round?.policeClearanceRequired ?? false}
          label="Require a police clearance certificate"
          hint="SAPS certificates take weeks, so requiring one up front puts many applicants off. You can still ask an individual applicant for one later."
        />
        <Result state={state} />
      </form>
    </Dialog>
  );
}
