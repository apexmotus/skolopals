import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Button, ButtonLink, Card, CardTitle, DataTable, FormMessage, PageHeading, Textarea } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { TUTOR_STATUS_LABEL, shortDate } from "@/lib/format";
import { decideApplication } from "../../actions";

export const metadata: Metadata = { title: "Tutor review" };

const DOC_LABEL: Record<string, string> = { identity: "Identity document", certificate: "Certificate", video: "Intro video" };
const STATUS_TONE = { pending: "warning", more_info: "warning", approved: "success", declined: "danger", suspended: "danger" } as const;

export default async function TutorReviewPage({ params, searchParams }: PageProps<"/admin/applications/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: app } = await supabase.from("tutor_applications").select("*").eq("id", id).maybeSingle();
  if (!app) notFound();

  // Short-lived links so admins can open private uploads.
  const { data: signed } = app.documents.length
    ? await supabase.storage.from("tutor-documents").createSignedUrls(app.documents, 600)
    : { data: [] };
  const docs = app.documents.map((path, i) => {
    const kind = path.split("/").pop()!.split("-")[0]!;
    return { path, kind, label: DOC_LABEL[kind] ?? "Document", url: signed?.[i]?.signedUrl ?? null };
  });
  const video = docs.find((d) => d.kind === "video");
  const hasId = docs.some((d) => d.kind === "identity");
  const certCount = docs.filter((d) => d.kind === "certificate").length;
  const open = app.status === "pending" || app.status === "more_info";

  return (
    <>
      <PageHeading title={`Review: ${app.full_name}`} description={`${app.subjects} · submitted ${shortDate(app.submitted_at)}`} />
      {sp.error ? <FormMessage>That decision couldn’t be saved. Please try again.</FormMessage> : null}
      {sp.requested ? <FormMessage tone="success">Request sent. The applicant has been notified.</FormMessage> : null}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-[14px]">
          <Card>
            <CardTitle>Verification checks</CardTitle>
            <p className="text-[13px] text-ink">
              Identity {hasId ? "provided ✓" : "missing ✗"} · {certCount} certificate{certCount === 1 ? "" : "s"} · Email {app.email}
            </p>
          </Card>
          <Card>
            <CardTitle>Documents</CardTitle>
            <DataTable
              rows={docs}
              rowKey={(d) => d.path}
              empty="No documents uploaded."
              columns={[
                { header: "Document", primary: true, cell: (d) => d.label },
                {
                  header: "File",
                  cell: (d) =>
                    d.url ? (
                      <a href={d.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                        Open
                      </a>
                    ) : (
                      "Unavailable"
                    ),
                },
                { header: "Status", cell: () => <Badge tone="neutral">To review</Badge> },
              ]}
            />
          </Card>
          <Card>
            <CardTitle>Teaching experience</CardTitle>
            <p className="whitespace-pre-line text-[13px] text-ink">{app.experience || "Not provided."}</p>
            <p className="text-[12px] text-muted">
              Qualifications: {app.qualifications || "—"} · Grades: {app.grades || "—"}
            </p>
          </Card>
          <Card>
            <CardTitle>Intro video</CardTitle>
            {video?.url ? (
              <video src={video.url} controls className="h-[220px] w-full rounded-[8px] bg-night" />
            ) : (
              <div className="flex h-[100px] items-center justify-center rounded-[8px] bg-canvas text-[12px] text-muted">No video provided</div>
            )}
          </Card>
        </div>

        <Card className="w-full shrink-0 lg:w-[280px]">
          <CardTitle>Decision</CardTitle>
          <Badge tone={STATUS_TONE[app.status]}>{TUTOR_STATUS_LABEL[app.status]}</Badge>
          {app.admin_notes ? (
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-bold text-muted">Last note</p>
              <p className="text-[12px] text-ink">{app.admin_notes}</p>
            </div>
          ) : null}
          {open ? (
            <form action={decideApplication} className="flex flex-col gap-[14px]">
              <input type="hidden" name="application_id" value={app.id} />
              <p className="text-[12px] text-muted">Approving publishes the tutor’s profile to the marketplace.</p>
              <Button name="decision" value="approved" className="w-fit">
                Approve tutor
              </Button>
              <ButtonLink href={`/admin/applications/${app.id}/request-info`} variant="secondary" className="w-fit">
                Request more information
              </ButtonLink>
              <Button name="decision" value="declined" variant="secondary" className="w-fit text-danger">
                Decline application
              </Button>
              <div className="flex flex-col gap-[6px] rounded-[8px] bg-canvas p-3">
                <label htmlFor="note" className="text-[11px] font-bold text-muted">
                  Decision note (sent to applicant)
                </label>
                <Textarea id="note" name="note" rows={3} maxLength={2000} placeholder="Optional message" />
              </div>
            </form>
          ) : (
            <p className="text-[12px] text-muted">This application has been decided.</p>
          )}
        </Card>
      </div>
    </>
  );
}
