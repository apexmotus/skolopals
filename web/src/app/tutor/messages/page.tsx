import { PageHeading } from "@/components/ui";
import { MessagesView } from "@/components/messages/messages-view";

export const metadata = { title: "Messages" };

export default async function TutorMessagesPage({ searchParams }: PageProps<"/tutor/messages">) {
  const sp = await searchParams;
  const thread = Array.isArray(sp.thread) ? sp.thread[0] : sp.thread;

  return (
    <>
      <PageHeading
        title="Messages"
        description="Conversations with parents about the learners you teach."
      />
      <MessagesView openThreadId={thread} />
    </>
  );
}
