import type { Metadata } from "next";
import { MessagesView } from "@/components/messages-view";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Messages" };

export default async function TutorMessagesPage({ searchParams }: PageProps<"/tutor/messages">) {
  const profile = await requireRole("tutor");
  const { with: withId } = await searchParams;
  return <MessagesView profile={profile} withId={typeof withId === "string" ? withId : undefined} />;
}
