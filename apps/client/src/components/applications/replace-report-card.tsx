"use client";

import { useState, useTransition } from "react";
import { Button, Field, FormMessage, Select } from "@skolopals/ui/ui";
import { Dialog } from "@skolopals/ui/dialog";
import { UploadField, type UploadedFile } from "@/components/uploads/upload-field";
import { replaceReportCard } from "./actions";

export function ReplaceReportCard({ enrolmentId, currentYear }: { enrolmentId: string; currentYear: number }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [year, setYear] = useState(String(currentYear));
  const [term, setTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!file) return setError("Upload the report card first.");
    setError(null);
    startTransition(async () => {
      const result = await replaceReportCard(enrolmentId, {
        ...file,
        year: Number(year),
        term: term ? Number(term) : undefined,
      });
      if (result.error) return setError(result.error);
      setDone(true);
    });
  }

  return (
    <>
      <Button type="button" variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
        Replace report card
      </Button>
      {open ? (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title="Replace the report card"
          description="The centre will see the new copy straight away. The old one is kept for the record."
          footer={
            <div className="flex justify-end gap-3">
              {done ? (
                <Button type="button" onClick={() => setOpen(false)}>
                  Done
                </Button>
              ) : (
                <Button type="button" onClick={save} disabled={pending || !file}>
                  {pending ? "Saving…" : "Save"}
                </Button>
              )}
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            {done ? (
              <FormMessage tone="success">Thank you. The centre now has the new report card.</FormMessage>
            ) : (
              <>
                <UploadField purpose="report_card" label="Report card" value={file} onChange={setFile} />
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Field label="Year it covers" htmlFor="rc_year" className="flex-1">
                    <Select id="rc_year" value={year} onChange={(e) => setYear(e.target.value)}>
                      {[currentYear, currentYear - 1].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Term" htmlFor="rc_term" className="flex-1">
                    <Select id="rc_term" value={term} onChange={(e) => setTerm(e.target.value)}>
                      <option value="">Select a term</option>
                      {[1, 2, 3, 4].map((t) => (
                        <option key={t} value={t}>
                          Term {t}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {error ? <FormMessage>{error}</FormMessage> : null}
              </>
            )}
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
