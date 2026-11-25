import "server-only";
import { cache } from "react";
import { createClient } from "@skolopals/shared/supabase/server";
import { firstName, money, shortDate } from "@skolopals/shared/format";
import { getAccount, getApplications } from "@/lib/parent";

export type Portal = "parent" | "learner" | "tutor";

/** Something that needs the person, and the page where they deal with it. */
export type AttentionItem = { id: string; title: string; detail: string; href: string; at: string | null };

/** A message from the centre: read in full on the notifications page, nothing to go and do. */
export type Update = { id: string; title: string; body: string; at: string };

async function unreadThreads(portal: Portal): Promise<AttentionItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_my_threads")
    .select("id, subject, learner_name, last_message, last_message_at, unread_count")
    .gt("unread_count", 0)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  return (data ?? []).map((t) => ({
    id: `thread:${t.id}`,
    title: `New message: ${t.subject || "Conversation"}`,
    detail: t.last_message ?? (t.learner_name ? `About ${t.learner_name}` : ""),
    href: `/${portal}/messages?thread=${t.id}`,
    at: t.last_message_at,
  }));
}

/** The one thing each application waits on the parent for (stages from `v_enrolment_progress`). */
async function applicationTasks(): Promise<AttentionItem[]> {
  const apps = await getApplications();
  return apps.flatMap((app): AttentionItem[] => {
    const name = firstName(app.learnerName);
    const by = app.offer_expires_on ? ` by ${shortDate(app.offer_expires_on)}` : "";
    const base = { id: `application:${app.enrolment_id}`, at: app.created_at };
    switch (app.stage) {
      case "details":
        return [{ ...base, title: `${name}’s application needs a report card`, detail: "Please contact the centre.", href: "/contact" }];
      case "assessment":
        return [{ ...base, title: `${name} still needs to do the aptitude test`, detail: "About 20 minutes. Answers so far are saved.", href: `/enrol/${app.enrolment_id}/assessment` }];
      case "payment":
        return [{
          ...base,
          title: `${name}’s application was accepted`,
          detail: `Pay${app.offer_balance_cents ? ` ${money(app.offer_balance_cents)}` : ""}${by} to secure the place.`,
          href: "/parent",
        }];
      case "proof":
        return [{ ...base, title: `Upload proof of payment for ${name}`, detail: `So the centre can confirm it${by}.`, href: "/parent" }];
      default:
        return [];
    }
  });
}

export async function getUpdates(): Promise<Update[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_recipients")
    .select("notification_id, notifications(title, body, created_at)")
    .is("read_at", null);
  return (data ?? [])
    .flatMap((r) => (r.notifications ? [{ id: r.notification_id, title: r.notifications.title, body: r.notifications.body, at: r.notifications.created_at }] : []))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function getAttention(portal: Portal): Promise<AttentionItem[]> {
  if (portal !== "parent") return unreadThreads(portal);

  const [threads, tasks, account] = await Promise.all([unreadThreads(portal), applicationTasks(), getAccount()]);
  // An unpaid offer is already in the balance; only flag fees when no application covers them.
  const fees: AttentionItem[] =
    account.outstanding > 0 && !tasks.some((t) => t.href === "/parent")
      ? [{ id: "fees", title: `${money(account.outstanding)} is due`, detail: "See your statement and pay.", href: "/parent/account", at: null }]
      : [];
  return [...tasks, ...fees, ...threads];
}

/** What the bell counts: things to do plus unread updates. Cached per request: the shell renders the bell twice. */
export const attentionCount = cache(async (portal: Portal) => {
  const [items, updates] = await Promise.all([getAttention(portal), getUpdates()]);
  return items.length + updates.length;
});
