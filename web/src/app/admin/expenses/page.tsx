import { Card, CardTitle, DataTable, PageHeading, StatCard } from "@/components/ui";
import { ExpenseForm } from "./expense-form";
import { createClient } from "@/lib/supabase/server";
import { money, shortDate } from "@/lib/format";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";

  const [{ data: categories }, { data: expenses }] = await Promise.all([
    supabase.from("expense_categories").select("*").order("sort_order"),
    supabase
      .from("expenses")
      .select("*, expense_categories(name)")
      .order("incurred_on", { ascending: false })
      .limit(100),
  ]);

  const cats = categories ?? [];
  const rows = expenses ?? [];
  const budget = cats.reduce((s, c) => s + Number(c.budget_cents ?? 0), 0);
  const thisMonth = rows
    .filter((e) => e.incurred_on >= monthStart)
    .reduce((s, e) => s + e.amount_cents, 0);

  return (
    <>
      <PageHeading
        title="Expenses"
        description="Recorded against the monthly budget from the business plan, section 17."
      />

      <div className="flex flex-col gap-4 md:flex-row">
        <StatCard label="Monthly budget" value={money(budget)} />
        <StatCard
          label="Spent this month"
          value={money(thisMonth)}
          hint={thisMonth > budget ? "Over budget" : `${money(budget - thisMonth)} remaining`}
        />
      </div>

      <ExpenseForm categories={cats.map((c) => ({ code: c.code, name: c.name }))} today={today} />

      <Card>
        <CardTitle>Budget by category</CardTitle>
        <DataTable
          rows={cats}
          rowKey={(c) => c.code}
          columns={[
            { header: "Category", cell: (c) => c.name, primary: true },
            { header: "Monthly budget", cell: (c) => money(Number(c.budget_cents ?? 0)) },
            {
              header: "Spent this month",
              cell: (c) =>
                money(
                  rows
                    .filter((e) => e.category_code === c.code && e.incurred_on >= monthStart)
                    .reduce((s, e) => s + e.amount_cents, 0),
                ),
            },
          ]}
        />
      </Card>

      <Card>
        <CardTitle>Recent expenses</CardTitle>
        <DataTable
          rows={rows}
          rowKey={(e) => e.id}
          empty="Nothing recorded yet."
          columns={[
            { header: "Date", cell: (e) => shortDate(e.incurred_on), primary: true },
            { header: "Category", cell: (e) => e.expense_categories?.name ?? e.category_code },
            { header: "Description", cell: (e) => e.description || "—" },
            { header: "Amount", cell: (e) => money(e.amount_cents) },
          ]}
        />
      </Card>
    </>
  );
}
