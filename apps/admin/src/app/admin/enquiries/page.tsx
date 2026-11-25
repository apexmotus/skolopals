import { Badge, Card, CardTitle, DetailRow, EmptyState, PageHeading } from "@skolopals/ui/ui";
import { getEnquiries, getLearners } from "@/lib/admin";
import { ENQUIRY_SOURCE_LABEL, ENQUIRY_STATUS_LABEL, labelFor, shortDate } from "@skolopals/shared/format";
import { ConvertEnquiryForm, EnquiryStatusForm, LogEnquiryForm } from "./enquiry-forms";

export const metadata = { title: "Enquiries" };

const STATUS_TONE = { new: "warning", contacted: "brand", enrolled: "success", closed: "neutral" } as const;

export default async function EnquiriesPage() {
  const [enquiries, learners] = await Promise.all([getEnquiries(), getLearners()]);
  const learnerName = new Map(learners.map((l) => [l.id, l.full_name]));
  const learnerOptions = learners
    .map((l) => ({ id: l.id, full_name: l.full_name }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <>
      <PageHeading title="Enquiries" description="Messages from the website and other channels." />
      <LogEnquiryForm />
      {enquiries.length === 0 ? (
        <EmptyState title="No enquiries" description="Enquiries from the contact page appear here." />
      ) : (
        <div className="flex flex-col gap-4">
          {enquiries.map((e) => (
            <Card key={e.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{e.full_name}</CardTitle>
                <Badge tone={STATUS_TONE[e.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                  {labelFor(ENQUIRY_STATUS_LABEL, e.status)}
                </Badge>
              </div>
              <DetailRow label="Contact" value={[e.phone, e.email].filter(Boolean).join(" · ") || "—"} />
              <DetailRow label="Source" value={labelFor(ENQUIRY_SOURCE_LABEL, e.source)} />
              <DetailRow label="Received" value={shortDate(e.created_at)} />
              {e.topic ? <DetailRow label="Topic" value={e.topic} /> : null}
              <p className="whitespace-pre-wrap text-[13px] leading-[1.5] text-ink">{e.message}</p>
              {e.status === "enrolled" ? (
                <p className="text-[12px] text-muted">
                  Enrolled as {learnerName.get(e.converted_learner_id ?? "") ?? "a learner"}.
                </p>
              ) : (
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-6">
                  <EnquiryStatusForm enquiryId={e.id} status={e.status} />
                  <ConvertEnquiryForm enquiryId={e.id} learners={learnerOptions} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
