"use client";

import { useActionState, useState } from "react";
import { time } from "@skolopals/shared/format";
import { Badge, Button, FormMessage } from "./ui";

/**
 * The door for one in-centre session, shared by the tutor register and the admin door page.
 * Each app passes its own server actions. Phone first: one row per learner, big buttons.
 * docs/SPEC-2026-11-door-and-online-attendance.md.
 */

type State = { error?: string; ok?: string };
type Action = (prev: State, formData: FormData) => Promise<State>;

export type DoorActions = { signIn: Action; signOut: Action; undo: Action };

type Contact = { id: string; name: string; relationship: string; phone: string; idLast4: string | null };

export type DoorPanelLearner = {
  id: string;
  name: string;
  mayLeaveAlone: boolean;
  guardians: Contact[];
  collectors: Contact[];
  checkIn: {
    id: string;
    arrivedAt: string;
    departedAt: string | null;
    collectedByName: string | null;
    leftAlone: boolean;
  } | null;
};

const UNDO_MINUTES = 10;

function Result({ state }: { state: State }) {
  if (state.error) return <FormMessage>{state.error}</FormMessage>;
  if (state.ok) return <FormMessage tone="success">{state.ok}</FormMessage>;
  return null;
}

const firstName = (name: string) => name.split(" ")[0] ?? name;

function SignInForm({ sessionId, learnerId, action }: { sessionId: string; learnerId: string; action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="learner_id" value={learnerId} />
      <Button type="submit" className="w-full sm:w-fit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <Result state={state} />
    </form>
  );
}

function SignOutForm({ learner, action }: { learner: DoorPanelLearner; action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [open, setOpen] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const first = firstName(learner.name);

  if (!open) {
    return (
      <Button type="button" variant="secondary" className="w-full sm:w-fit" onClick={() => setOpen(true)}>
        Sign out
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[8px] border border-line bg-canvas p-3">
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="check_in_id" value={learner.checkIn?.id ?? ""} />
        <p className="text-[13px] font-semibold text-ink">Who is collecting {first}?</p>
        {learner.guardians.map((g) => (
          <label key={g.id} className="flex items-start gap-3 rounded-[8px] border border-line bg-surface p-3 text-[13px]">
            <input type="radio" name="collector" value={`guardian:${g.id}`} required className="mt-1 size-4" />
            <span>
              <span className="font-semibold text-ink">{g.name}</span>
              <span className="block text-muted">
                {g.relationship || "Guardian"} · {g.phone || "no phone"}
              </span>
            </span>
          </label>
        ))}
        {learner.collectors.map((c) => (
          <label key={c.id} className="flex items-start gap-3 rounded-[8px] border border-line bg-surface p-3 text-[13px]">
            <input type="radio" name="collector" value={`collector:${c.id}`} required className="mt-1 size-4" />
            <span>
              <span className="font-semibold text-ink">{c.name}</span>
              <span className="block text-muted">
                {c.relationship || "Authorised to collect"} · {c.phone}
              </span>
              <span className="block font-semibold text-warning">
                {c.idLast4 ? `Check their ID ends in ${c.idLast4}` : "No ID digits on record: phone a guardian first"}
              </span>
            </span>
          </label>
        ))}
        {learner.mayLeaveAlone ? (
          <label className="flex items-start gap-3 rounded-[8px] border border-line bg-surface p-3 text-[13px]">
            <input type="radio" name="collector" value="alone" required className="mt-1 size-4" />
            <span>
              <span className="font-semibold text-ink">Left on their own</span>
              <span className="block text-muted">A guardian has allowed {first} to leave without being collected.</span>
            </span>
          </label>
        ) : null}
        <Result state={state} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Signing out…" : "Sign out"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setRefusing(!refusing)}>
            Someone else is here
          </Button>
          <Button type="button" variant="bare" className="text-[12px] text-muted underline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </form>
      {refusing ? (
        <div className="flex flex-col gap-2 rounded-[8px] bg-danger-soft p-3 text-[13px] text-danger">
          <p className="font-semibold">Don’t release {first}.</p>
          <p>
            Only the people listed above may collect. Call a guardian; once they agree, an administrator can add the
            person to {first}’s collector list.
          </p>
          {learner.guardians.map((g) =>
            g.phone ? (
              <a key={g.id} href={`tel:${g.phone}`} className="font-semibold underline">
                Call {g.name} · {g.phone}
              </a>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}

function UndoForm({ checkInId, action }: { checkInId: string; action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="check_in_id" value={checkInId} />
      <Button type="submit" variant="bare" className="w-fit text-[12px] text-muted underline" disabled={pending}>
        {pending ? "Undoing…" : "Undo sign-out"}
      </Button>
      <Result state={state} />
    </form>
  );
}

function DoorRow({ sessionId, learner, actions }: { sessionId: string; learner: DoorPanelLearner; actions: DoorActions }) {
  const c = learner.checkIn;
  // Shown for a short while after signing out; the server enforces the same limit.
  const [now] = useState(() => Date.now());
  const canUndo = Boolean(c?.departedAt) && now - new Date(c!.departedAt!).getTime() < UNDO_MINUTES * 60_000;

  return (
    <div className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14px] font-semibold text-ink">{learner.name}</span>
        {!c ? (
          <Badge tone="neutral">Not arrived</Badge>
        ) : c.departedAt ? (
          <Badge tone="success">Gone home</Badge>
        ) : (
          <Badge tone="warning">In the centre</Badge>
        )}
      </div>
      {c ? (
        <p className="text-[12px] text-muted">
          In {time(c.arrivedAt)}
          {c.departedAt
            ? ` · Out ${time(c.departedAt)} · ${c.leftAlone ? "Left on their own" : `Collected by ${c.collectedByName ?? "—"}`}`
            : ""}
        </p>
      ) : null}
      {!c ? <SignInForm sessionId={sessionId} learnerId={learner.id} action={actions.signIn} /> : null}
      {c && !c.departedAt ? <SignOutForm learner={learner} action={actions.signOut} /> : null}
      {c?.departedAt && canUndo ? <UndoForm checkInId={c.id} action={actions.undo} /> : null}
    </div>
  );
}

export function DoorPanel({
  sessionId,
  learners,
  actions,
}: {
  sessionId: string;
  learners: DoorPanelLearner[];
  actions: DoorActions;
}) {
  if (learners.length === 0) return <p className="text-[13px] text-muted">No learners are placed in this class yet.</p>;
  return (
    <div className="flex flex-col divide-y divide-line">
      {learners.map((l) => (
        <DoorRow key={l.id} sessionId={sessionId} learner={l} actions={actions} />
      ))}
    </div>
  );
}
