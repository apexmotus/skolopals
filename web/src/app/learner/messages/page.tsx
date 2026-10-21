import { PageHeading } from "@/components/ui";
import { MessagesView } from "@/components/messages/messages-view";

export const metadata = { title: "Messages" };

export default async function LearnerMessagesPage({ searchParams }: PageProps<"/learner/messages">) {
  const sp = await searchParams;
  const thread = Array.isArray(sp.thread) ? sp.thread[0] : sp.thread;

  return (
    <>
      <PageHeading title="Messages" description="Conversations with your tutor." />
      <MessagesView openThreadId={thread} />
    </>
  );
}
