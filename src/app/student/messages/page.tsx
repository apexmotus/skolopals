import type { Metadata } from "next";
import { MessagesView } from "@/components/messages-view";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Messages" };

export default async function StudentMessagesPage({ searchParams }: PageProps<"/student/messages">) {
  const profile = await requireRole("student");
  const { with: withId } = await searchParams;
  return <MessagesView profile={profile} withId={typeof withId === "string" ? withId : undefined} />;
}
