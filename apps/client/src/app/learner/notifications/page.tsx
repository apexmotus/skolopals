import { NotificationsView } from "@/components/notifications/notifications-view";

export const metadata = { title: "Notifications" };

export default function LearnerNotificationsPage() {
  return <NotificationsView portal="learner" />;
}
