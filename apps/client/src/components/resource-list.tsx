import { Badge, DataTable, EmptyState } from "@skolopals/ui/ui";
import { getResources } from "@/lib/parent";
import { shortDate } from "@skolopals/shared/format";

/** Resources visible to the signed-in parent or learner. Shared by both portals. */
export async function ResourceList() {
  const resources = await getResources();

  if (resources.length === 0) {
    return (
      <EmptyState
        title="No resources yet"
        description="Worksheets and study material appear here once a tutor shares them."
      />
    );
  }

  return (
    <DataTable
      rows={resources}
      rowKey={(r) => r.id}
      columns={[
        {
          header: "Resource",
          primary: true,
          cell: (r) =>
            r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline">
                {r.title}
              </a>
            ) : (
              r.title
            ),
        },
        {
          header: "Subject",
          cell: (r) => (r.subjects?.name ? <Badge tone="brand">{r.subjects.name}</Badge> : "General"),
        },
        { header: "Shared", cell: (r) => shortDate(r.created_at) },
      ]}
    />
  );
}
