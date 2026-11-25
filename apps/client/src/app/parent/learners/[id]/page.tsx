import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardTitle, DetailRow, PageHeading } from "@skolopals/ui/ui";
import { api } from "@skolopals/shared/api";
import { createClient } from "@skolopals/shared/supabase/server";
import { LearnerEditor } from "@skolopals/ui/learner-edit";
import { getLearnerForEdit, splitName } from "@skolopals/shared/learner-edit";
import {
  addCollector,
  addEmergencyContact,
  removeCollector,
  removeEmergencyContact,
  setLeaveAlone,
  updateLearner,
} from "../actions";

export const metadata = { title: "Edit learner" };

export default async function ParentLearnerPage({ params }: PageProps<"/parent/learners/[id]">) {
  const { id } = await params;
  // RLS returns nothing for a learner this account may not see, which becomes a 404.
  const data = await getLearnerForEdit(id);
  if (!data) notFound();
  const { learner, contacts, collectors, grades, languages } = data;
  const name = splitName(learner.full_name);

  // D6: the level and sub-scores reach the family once the centre has decided,
  // never the item breakdown. The API refuses before then, which shows nothing.
  const supabase = await createClient();
  const { data: attempt } = await supabase
    .from("aptitude_attempts")
    .select("id")
    .eq("learner_id", id)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const aptitude = attempt
    ? await api
        .get<{ levelLabel: string; literacyPct: number; logicPct: number; tutorNote?: string }>(
            `/aptitude/attempts/${attempt.id}/result`,
          )
        .catch(() => null)
    : null;

  return (
    <>
      <Link href="/parent/learners" className="w-fit text-[12px] text-accent underline-offset-2 hover:underline">
        ← My learners
      </Link>
      <PageHeading title={learner.full_name} description="Keep your child’s details and safety contacts up to date." />
      {aptitude ? (
        <Card>
          <CardTitle>Aptitude test</CardTitle>
          <DetailRow label="Level" value={aptitude.levelLabel} />
          <DetailRow label="Reading" value={`${aptitude.literacyPct}% right`} />
          <DetailRow label="Logic" value={`${aptitude.logicPct}% right`} />
          {aptitude.tutorNote ? (
            <p className="text-[13px] leading-[1.6] text-ink">
              <span className="font-semibold">What this means: </span>
              {aptitude.tutorNote}
            </p>
          ) : null}
        </Card>
      ) : null}
      <LearnerEditor
        learner={{ ...learner, first: name.first, last: name.last }}
        contacts={contacts}
        collectors={collectors}
        grades={grades}
        languages={languages}
        actions={{
          update: updateLearner,
          addContact: addEmergencyContact,
          removeContact: removeEmergencyContact,
          addCollector,
          removeCollector,
          setLeaveAlone,
        }}
      />
    </>
  );
}
