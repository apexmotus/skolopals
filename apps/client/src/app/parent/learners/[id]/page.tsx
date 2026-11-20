import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@skolopals/ui/ui";
import { LearnerEditor } from "@skolopals/ui/learner-edit";
import { getLearnerForEdit, splitName } from "@skolopals/shared/learner-edit";
import {
  addCollector,
  addEmergencyContact,
  removeCollector,
  removeEmergencyContact,
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

  return (
    <>
      <Link href="/parent/learners" className="w-fit text-[12px] text-brand underline-offset-2 hover:underline">
        ← My learners
      </Link>
      <PageHeading title={learner.full_name} description="Keep your child’s details and safety contacts up to date." />
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
        }}
      />
    </>
  );
}
