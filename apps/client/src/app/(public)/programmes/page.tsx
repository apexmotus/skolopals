import type { Metadata } from "next";
import { Card, CardTitle, DetailRow, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { getPublishedProgrammes } from "@/lib/queries";
import { money, shortDate } from "@skolopals/shared/format";

export const metadata: Metadata = { title: "Holiday programmes" };

export default async function ProgrammesPage() {
  const programmes = await getPublishedProgrammes();

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-[24px]">
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
              <p className="text-[14px] text-muted">{p.description}</p>
              <DetailRow label="Dates" value={`${shortDate(p.startsOn)} – ${shortDate(p.endsOn)}`} />
              <DetailRow label="Fee" value={money(p.priceCents)} />
              <DetailRow label="Places" value={String(p.capacity)} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
