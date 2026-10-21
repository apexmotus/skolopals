import { PageHeading } from "@/components/ui";
import { MessagesView } from "@/components/messages/messages-view";
import { NewThreadForm } from "@/components/messages/message-forms";
import { getContactableStaff } from "@/lib/messages";
import { getLearners } from "@/lib/parent";

export const metadata = { title: "Messages" };

export default async function ParentMessagesPage({ searchParams }: PageProps<"/parent/messages">) {
  const sp = await searchParams;
  const thread = Array.isArray(sp.thread) ? sp.thread[0] : sp.thread;
  const [staff, learners] = await Promise.all([getContactableStaff(), getLearners()]);

  return (
    <>
      <PageHeading
        title="Messages"
        description="Talk to your learner's tutor or the centre about progress, absence or fees."
      />
      <NewThreadForm
        recipients={staff}
        learners={learners.map((l) => ({ id: l.id, full_name: l.full_name }))}
      />
      <MessagesView openThreadId={thread} />
    </>
  );
}
