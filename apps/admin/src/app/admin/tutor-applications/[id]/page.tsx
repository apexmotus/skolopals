import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError } from "@skolopals/shared/api";
import { Badge, Card, CardTitle, DetailRow, PageHeading } from "@skolopals/ui/ui";
import { dateTime, shortDate } from "@skolopals/shared/format";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_TONE,
  getTutorApplication,
  type ApplicationDocument,
} from "@/lib/tutor-applications";
import {
  ApproveButton,
  IdentityCheckedButton,
  RejectButton,
  RequestPoliceClearanceButton,
  ShortlistButton,
} from "../review-forms";

export const metadata = { title: "Tutor application" };

const DOC_LABEL: Record<ApplicationDocument["docType"], string> = {
  id: "ID (front)",
  id_back: "ID (back)",
  selfie: "Selfie",
  cv: "CV",
  qualification: "Qualification",
  police_clearance: "Police clearance",
};

/** wa.me wants the number without the plus. */
const waLink = (n: string) => `https://wa.me/${n.replace(/^\+/, "")}`;

function Photo({ doc, label }: { doc?: ApplicationDocument; label: string }) {
  return (
    <figure className="flex min-w-0 flex-1 flex-col gap-2">
      <figcaption className="text-[12px] font-semibold text-muted">{label}</figcaption>
      {doc?.url && doc.mimeType.startsWith("image/") ? (
        <a href={doc.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[10px] border border-line bg-canvas">
          {/* Signed, short-lived storage URL: next/image would cache it past its expiry. */}
          <img src={doc.url} alt={label} className="h-[280px] w-full object-contain" />
        </a>
      ) : doc?.url ? (
        <a href={doc.url} target="_blank" rel="noreferrer" className="text-[13px] text-link hover:underline">
          Open {label.toLowerCase()} (PDF)
        </a>
      ) : (
        <p className="flex h-[280px] items-center justify-center rounded-[10px] border border-dashed border-line text-[13px] text-muted">
          Not uploaded
        </p>
      )}
    </figure>
  );
}

export default async function TutorApplicationPage({ params }: PageProps<"/admin/tutor-applications/[id]">) {
  const { id } = await params;
  const app = await getTutorApplication(id).catch((err: unknown) => {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) return null;
    throw err;
  });
  if (!app) notFound();

  const name = `${app.firstName} ${app.lastName}`;
  const byType = (t: ApplicationDocument["docType"]) => app.documents.filter((d) => d.docType === t);
  const [idFront] = byType("id");
  const [idBack] = byType("id_back");
  const [selfie] = byType("selfie");
  const [clearance] = byType("police_clearance");
  const others = app.documents.filter((d) => d.docType === "cv" || d.docType === "qualification");
  const underReview = app.status === "submitted" || app.status === "shortlisted";
  const missingClearance = !clearance && (app.policeClearanceRequired || !!app.policeClearanceRequestedAt);

  const clearanceState = clearance
    ? `Received ${shortDate(clearance.uploadedAt)}`
    : app.policeClearanceRequestedAt
      ? `Requested ${shortDate(app.policeClearanceRequestedAt)}, waiting`
      : app.policeClearanceRequired
        ? "Required for this round, but not uploaded"
        : "Not required for this round";

  return (
    <>
      <p className="text-[13px]">
        <Link href="/admin/tutor-applications" className="text-link hover:underline">
          ← Tutor applications
        </Link>
      </p>
      <PageHeading title={name} description={`Applied ${dateTime(app.submittedAt)}`} />
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={APPLICATION_STATUS_TONE[app.status]}>{APPLICATION_STATUS_LABEL[app.status]}</Badge>
        {app.tutorId ? (
          <Link href={`/admin/tutors/${app.tutorId}`} className="text-[13px] text-link hover:underline">
            Open tutor record
          </Link>
        ) : null}
      </div>

      {underReview ? (
        <Card>
          <CardTitle>Decision</CardTitle>
          <div className="flex flex-wrap items-start gap-3">
            <ApproveButton
              applicationId={app.id}
              name={name}
              identityChecked={!!app.identityCheckedAt}
              missingClearance={missingClearance}
            />
            <ShortlistButton applicationId={app.id} done={app.status !== "submitted"} />
            <RejectButton applicationId={app.id} />
          </div>
        </Card>
      ) : app.decisionNote ? (
        <Card>
          <CardTitle>Decision</CardTitle>
          <DetailRow label="Internal note" value={app.decisionNote} />
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Identity</CardTitle>
          {app.identityCheckedAt ? (
            <Badge tone="success">Checked {shortDate(app.identityCheckedAt)}</Badge>
          ) : (
            <Badge tone="warning">Not checked</Badge>
          )}
        </div>
        <p className="text-[13px] text-muted">
          Compare the face on the ID with the selfie, and the name on the ID with <strong className="text-ink">{name}</strong>.
        </p>
        <div className="flex flex-col gap-4 md:flex-row">
          <Photo doc={idFront} label="ID (front)" />
          <Photo doc={selfie} label="Selfie" />
        </div>
        {idBack ? (
          <div className="md:w-1/2 md:pr-2">
            <Photo doc={idBack} label="ID (back)" />
          </div>
        ) : null}
        {underReview ? <IdentityCheckedButton applicationId={app.id} done={!!app.identityCheckedAt} /> : null}
      </Card>

      <Card>
        <CardTitle>Police clearance</CardTitle>
        <DetailRow label="Status" value={clearanceState} />
        {app.policeClearanceRequestedAt && app.policeClearanceRequestNote ? (
          <DetailRow label="Your message" value={app.policeClearanceRequestNote} />
        ) : null}
        {clearance?.url ? (
          <a href={clearance.url} target="_blank" rel="noreferrer" className="text-[13px] text-link hover:underline">
            Open certificate
          </a>
        ) : null}
        {underReview && !clearance ? (
          <RequestPoliceClearanceButton applicationId={app.id} again={!!app.policeClearanceRequestedAt} />
        ) : null}
      </Card>

      <Card>
        <CardTitle>Contact and address</CardTitle>
        <DetailRow label="Email" value={<a href={`mailto:${app.email}`} className="text-link hover:underline">{app.email}</a>} />
        <DetailRow label="Phone" value={<a href={`tel:${app.phone}`} className="text-link hover:underline">{app.phone}</a>} />
        <DetailRow
          label="WhatsApp"
          value={
            <a href={waLink(app.whatsappNumber)} target="_blank" rel="noreferrer" className="text-link hover:underline">
              {app.whatsappNumber}
            </a>
          }
        />
        <DetailRow
          label="Address"
          value={[app.addressLine1, app.addressLine2, app.city, app.province, app.country].filter(Boolean).join(", ")}
        />
      </Card>

      <Card>
        <CardTitle>What they can teach</CardTitle>
        <div className="flex flex-col gap-2">
          {app.competencies.map((c) => (
            <DetailRow key={`${c.subjectCode}-${c.gradeCode}`} label={`${c.subjectName} · ${c.gradeName}`} value={c.languages.join(", ")} />
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>CV and qualifications</CardTitle>
        <ul className="flex flex-col gap-2 text-[13px]">
          {others.map((d) => (
            <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-ink">
                <span className="font-semibold">{DOC_LABEL[d.docType]}</span>
                {d.docType === "qualification"
                  ? ` · ${[d.title, d.institution, d.yearAwarded].filter(Boolean).join(", ")}`
                  : d.originalName
                    ? ` · ${d.originalName}`
                    : ""}
              </span>
              {d.url ? (
                <a href={d.url} target="_blank" rel="noreferrer" className="text-link hover:underline">
                  Open
                </a>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-muted">Links work for 5 minutes. Reload the page for fresh ones.</p>
      </Card>

      <Card>
        <CardTitle>References</CardTitle>
        <div className="flex flex-col gap-3">
          {app.references.map((r) => (
            <div key={r.position} className="flex flex-col gap-1 text-[13px]">
              <span className="font-semibold text-ink">
                {r.fullName} <span className="font-normal text-muted">· {r.relationship}</span>
              </span>
              <span className="text-muted">
                <a href={`tel:${r.phone}`} className="text-link hover:underline">
                  {r.phone}
                </a>
                {r.email ? (
                  <>
                    {" · "}
                    <a href={`mailto:${r.email}`} className="text-link hover:underline">
                      {r.email}
                    </a>
                  </>
                ) : null}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted">Record reference checks on the tutor record after approval.</p>
      </Card>
    </>
  );
}
