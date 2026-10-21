import type { Metadata } from "next";
import { Card, CardTitle, DetailRow, EmptyState, PageHeading } from "@/components/ui";
import { getPublishedProgrammes } from "@/lib/queries";
import { money, shortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Holiday programmes" };

export default async function ProgrammesPage() {
  const programmes = await getPublishedProgrammes();

  return (
    <div className="flex flex-col gap-5 p-4 md:p-7">
      <PageHeading
        title="Holiday and Saturday programmes"
        description="School-holiday revision, examination preparation and Saturday classes."
      />
      {programmes.length === 0 ? (
        <EmptyState
          title="Nothing scheduled right now"
          description="Holiday programmes are announced before each school holiday."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {programmes.map((p) => (
            <Card key={p.id}>
              <CardTitle>{p.name}</CardTitle>
              <p className="text-[13px] text-black">{p.description}</p>
              <DetailRow label="Dates" value={`${shortDate(p.starts_on)} – ${shortDate(p.ends_on)}`} />
              <DetailRow label="Fee" value={money(p.price_cents)} />
              <DetailRow label="Places" value={String(p.capacity)} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
