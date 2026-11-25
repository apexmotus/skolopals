import { NotificationsView } from "@/components/notifications/notifications-view";

export const metadata = { title: "Notifications" };

export default function ParentNotificationsPage() {
  return <NotificationsView portal="parent" />;
}
