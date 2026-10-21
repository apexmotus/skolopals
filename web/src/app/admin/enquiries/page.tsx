import { Badge, DataTable, EmptyState, PageHeading } from "@/components/ui";
import { getEnquiries } from "@/lib/admin";
import { shortDate } from "@/lib/format";

export const metadata = { title: "Enquiries" };

export default async function EnquiriesPage() {
  const enquiries = await getEnquiries();

  return (
    <>
      <PageHeading title="Enquiries" description="Messages from the website and other channels." />
      {enquiries.length === 0 ? (
        <EmptyState title="No enquiries" description="Enquiries from the contact page appear here." />
      ) : (
        <DataTable
          rows={enquiries}
          rowKey={(e) => e.id}
          columns={[
            { header: "From", cell: (e) => e.full_name, primary: true },
            { header: "Contact", cell: (e) => e.phone || e.email || "—" },
            { header: "Source", cell: (e) => e.source },
            { header: "Received", cell: (e) => shortDate(e.created_at) },
            {
              header: "Status",
              cell: (e) => (
                <Badge tone={e.status === "new" ? "warning" : e.status === "enrolled" ? "success" : "neutral"}>
                  {e.status}
                </Badge>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
