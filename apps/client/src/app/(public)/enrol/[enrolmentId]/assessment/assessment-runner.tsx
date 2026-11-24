"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, ButtonLink, Card, CardTitle, FormMessage } from "@skolopals/ui/ui";
import { answerQuestion, nextQuestion, type AptitudeQuestion, type AptitudeStep } from "./actions";

type Screen = "intro" | "question" | "finished" | "sent";

/**
 * One question per screen, no back button (the test is adaptive) and no
 * right/wrong feedback (SPEC §4.3 UX). Choosing an answer and pressing Next
 * are separate steps so a young child's mis-tap is not final. The answer is
 * saved on Next; a closed tab comes back to the same question.
 */
export function AssessmentRunner({
  attemptId,
  childName,
  fullName,
  young,
  first,
}: {
  attemptId: string;
  childName: string;
  fullName: string;
  young: boolean;
  first: AptitudeStep;
}) {
  const [screen, setScreen] = useState<Screen>(first.done ? "finished" : "intro");
  const [step, setStep] = useState<AptitudeStep>(first);
  const [choice, setChoice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shownAt = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);

  const question = step.question;
  const resuming = (question?.seq ?? 1) > 1;

  // Time each question from when it appears, and move focus to it for screen readers.
  useEffect(() => {
    if (screen !== "question") return;
    shownAt.current = performance.now();
    heading.current?.focus();
  }, [screen, question?.itemId]);

  function apply(next: AptitudeStep) {
    if (next.error) {
      setStep((current) => ({ ...current, error: next.error }));
      return;
    }
    setChoice(null);
    setStep(next);
    if (next.done) setScreen("finished");
  }

  function begin() {
    if (question) {
      setScreen("question");
      return;
    }
    // The first fetch failed on the server; try again now.
    startTransition(async () => {
      const next = await nextQuestion(attemptId);
      apply(next);
      if (!next.error && !next.done) setScreen("question");
    });
  }

  function submit() {
    if (!question || !choice) return;
    const msTaken = performance.now() - shownAt.current;
    startTransition(async () => {
      apply(await answerQuestion(attemptId, question.itemId, choice, msTaken));
    });
  }

  if (screen === "sent") return <ApplicationSent name={fullName} />;

  if (screen === "finished") {
    return (
      <Card className="items-center gap-4 py-10 text-center">
        <p className="text-[40px] leading-none" aria-hidden>
          ★
        </p>
        <h1 className="text-[26px] font-bold text-ink">Well done, {childName}, you’re finished!</h1>
        <p className="max-w-[420px] text-[14px] leading-[1.6] text-muted">
          Thank you for working so hard. Please hand the device back to your grown-up now.
        </p>
        <Button type="button" onClick={() => setScreen("sent")}>
          I’m the grown-up
        </Button>
      </Card>
    );
  }

  if (screen === "intro") {
    return (
      <Card className="gap-4">
        <h1 className="text-[24px] font-bold text-ink">
          {resuming ? `Welcome back, ${childName}` : `Hi ${childName}!`}
        </h1>
        {resuming ? (
          <p className="text-[14px] leading-[1.6] text-ink">
            Your answers so far are saved. You’ll carry on from question {question?.seq} of {question?.total}.
          </p>
        ) : (
          <div className="flex flex-col gap-3 text-[14px] leading-[1.6] text-ink">
            <p>
              This is a short activity with some reading questions and some puzzles. It helps your tutor
              know where to start with you.
            </p>
            <p className="font-semibold">It’s not a pass or fail test. Just do your best.</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-muted">
              <li>There are {question?.total ?? 25} questions. It takes about 20 minutes.</li>
              <li>Some questions get harder as you go, and that’s fine.</li>
              <li>Once you press Next you can’t go back, so take your time.</li>
              <li>You can stop and come back later. Your answers are saved.</li>
            </ul>
          </div>
        )}
        {young ? (
          <p className="rounded-[10px] border-l-4 border-accent bg-white/[0.04] px-4 py-3 text-[13px] leading-[1.6] text-ink">
            <span className="font-semibold">For the grown-up:</span> younger children may need you to read the
            questions and answers aloud. Please don’t help with the answers.
          </p>
        ) : null}
        {step.error ? <FormMessage>{step.error}</FormMessage> : null}
        <Button type="button" className="w-fit" onClick={begin} disabled={pending}>
          {pending ? "Loading…" : resuming ? "Carry on" : "Start"}
        </Button>
      </Card>
    );
  }

  if (!question) return null;
  return (
    <QuestionScreen
      question={question}
      choice={choice}
      onChoose={setChoice}
      onSubmit={submit}
      pending={pending}
      error={step.error}
      headingRef={heading}
    />
  );
}

function QuestionScreen({
  question,
  choice,
  onChoose,
  onSubmit,
  pending,
  error,
  headingRef,
}: {
  question: AptitudeQuestion;
  choice: string | null;
  onChoose: (id: string) => void;
  onSubmit: () => void;
  pending: boolean;
  error?: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const percent = Math.round(((question.seq - 1) / question.total) * 100);
  const groupName = `answer-${question.itemId}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-semibold text-muted" aria-live="polite">
          Question {question.seq} of {question.total}
        </p>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label="Progress"
          aria-valuemin={0}
          aria-valuemax={question.total}
          aria-valuenow={question.seq - 1}
        >
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {question.passage ? <Passage key={question.passage.id} passage={question.passage} /> : null}

      <Card className="gap-4">
        <h1 ref={headingRef} tabIndex={-1} className="text-[19px] font-semibold leading-[1.5] text-ink outline-none">
          {question.stem}
        </h1>
        <fieldset className="flex flex-col gap-3" disabled={pending}>
          <legend className="sr-only">Choose one answer</legend>
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex min-h-[56px] cursor-pointer items-center gap-4 rounded-[12px] border-2 border-line bg-surface px-4 py-3 text-[16px] text-ink transition-colors hover:border-white/40 has-[:checked]:border-accent has-[:checked]:bg-white/[0.06] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
            >
              <input
                type="radio"
                name={groupName}
                value={option.id}
                checked={choice === option.id}
                onChange={() => onChoose(option.id)}
                className="sr-only"
              />
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white/30 text-[15px] font-bold"
              >
                {option.id}
              </span>
              <span>{option.text}</span>
            </label>
          ))}
        </fieldset>
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Button type="button" className="w-full sm:w-fit" onClick={onSubmit} disabled={!choice || pending}>
          {pending ? "Saving…" : question.seq === question.total ? "Finish" : "Next"}
        </Button>
      </Card>
    </div>
  );
}

/** Always visible above its questions; on a phone it folds away so the question fits on screen. */
function Passage({ passage }: { passage: NonNullable<AptitudeQuestion["passage"]> }) {
  const body = (
    <p className="whitespace-pre-line text-[16px] leading-[1.75] text-ink">{passage.text}</p>
  );
  return (
    <>
      <div className="hidden md:block">
        <Card className="gap-2">
          <CardTitle>{passage.title}</CardTitle>
          {body}
        </Card>
      </div>
      <details open className="rounded-[10px] border border-line bg-surface p-4 md:hidden">
        <summary className="cursor-pointer text-[14px] font-semibold text-ink">
          {passage.title} <span className="font-normal text-muted">· Read the story again</span>
        </summary>
        <div className="pt-3">{body}</div>
      </details>
    </>
  );
}

/** Shown to the parent once the test is done, and on any later visit to this page. */
export function ApplicationSent({ name }: { name: string }) {
  return (
    <Card className="gap-3">
      <h1 className="text-[22px] font-bold text-ink">Application sent for review</h1>
      <p className="text-[14px] leading-[1.6] text-ink">
        Thank you. {name}’s application is with the centre for review. We’ll let you know as soon as a decision
        has been made.
      </p>
      <p className="text-[13px] text-muted">
        Payment is only requested once the application is accepted.
      </p>
      <ButtonLink href="/parent" className="w-fit">
        Go to your portal
      </ButtonLink>
    </Card>
  );
}
