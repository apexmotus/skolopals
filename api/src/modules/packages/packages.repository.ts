import { Injectable } from '@nestjs/common';
import { p } from '../../database/sp-param';
import { StoredProcRunner } from '../../database/stored-proc.runner';
import type { BillingSettingsRow } from './rows/billing-settings.row';
import type { PackagePriceRow } from './rows/package-price.row';
import type { PackageRow } from './rows/package.row';

const PACKAGE_COLUMNS =
  'code, name, description, service_type, billing_period, subject_allowance, is_active, sort_order';

/**
 * Plain table reads/writes, same convention as `reference`/`people` — no
 * dedicated function exists for packages/prices/billing-settings CRUD
 * (confirmed: grepped `db/migrations/*.sql` for `create or replace function
 * public\.` and found only the read helper `package_price_on`, reused below
 * rather than re-derived). The overlap guards on `package_prices` and
 * `billing_settings` are native `EXCLUDE USING GIST` constraints — nothing
 * to check before inserting, `SqlErrorMapper` surfaces a violation as 409.
 */
@Injectable()
export class PackagesRepository {
  constructor(private readonly sp: StoredProcRunner) {}

  listActive(): Promise<PackageRow[]> {
    return this.sp.selectMany<PackageRow>(
      `select ${PACKAGE_COLUMNS} from public.packages where is_active order by sort_order`,
    );
  }

  listAll(): Promise<PackageRow[]> {
    return this.sp.selectMany<PackageRow>(
      `select ${PACKAGE_COLUMNS} from public.packages order by sort_order`,
    );
  }

  async create(input: {
    code: string;
    name: string;
    description?: string;
    serviceType: string;
    billingPeriod: string;
    subjectAllowance?: number;
    isActive?: boolean;
    sortOrder: number;
  }): Promise<PackageRow> {
    const result = await this.sp.executeRaw<PackageRow>(
      `insert into public.packages (code, name, description, service_type, billing_period, subject_allowance, is_active, sort_order)
       values ($1, $2, coalesce($3, ''), $4, $5, $6, coalesce($7, true), $8)
       returning ${PACKAGE_COLUMNS}`,
      [
        input.code,
        input.name,
        input.description ?? null,
        input.serviceType,
        input.billingPeriod,
        input.subjectAllowance ?? null,
        input.isActive ?? null,
        input.sortOrder,
      ],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  /**
   * `package_price_on(p_on date)` has no SQL default, so a caller omitting
   * the date needs a concrete value to pass — resolved on the database's
   * own clock (`current_date`, Postgres's own timezone) rather than in JS,
   * same "no app-layer tz math" reasoning as the tutor pay-rate default.
   */
  today(): Promise<string> {
    return this.sp
      .selectOne<{ today: string }>('select current_date as today')
      .then((row) => {
        if (!row)
          throw new Error('select current_date unexpectedly returned no row');
        return row.today;
      });
  }

  /** Reuses the existing `public.package_price_on(p_package_code, p_on)` function — "the price of a package on a date, one place that rule lives." */
  async getPriceOn(
    packageCode: string,
    on: string,
  ): Promise<number | undefined> {
    const row = await this.sp.queryOne<{ package_price_on: number | null }>(
      'public.package_price_on',
      [p.text('p_package_code', packageCode), p.date('p_on', on)],
    );
    return row?.package_price_on ?? undefined;
  }

  async setPrice(
    packageCode: string,
    amountCents: number,
    effectiveFrom: string,
  ): Promise<PackagePriceRow> {
    const result = await this.sp.executeRaw<PackagePriceRow>(
      `insert into public.package_prices (package_code, amount_cents, effective_from)
       values ($1, $2, $3)
       returning id, package_code, amount_cents, effective_from, effective_to, created_at`,
      [packageCode, amountCents, effectiveFrom],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }

  getBillingSettingsEffectiveOn(
    on: string,
  ): Promise<BillingSettingsRow | undefined> {
    return this.sp.selectOne<BillingSettingsRow>(
      `select id, invoice_prefix, issue_day, due_day, grace_days, late_fee_cents, effective_from, effective_to
       from public.billing_settings
       where $1 >= effective_from and (effective_to is null or $1 < effective_to)`,
      [on],
    );
  }

  async createBillingSettings(input: {
    invoicePrefix?: string;
    issueDay: number;
    dueDay: number;
    graceDays: number;
    lateFeeCents: number;
    effectiveFrom: string;
  }): Promise<BillingSettingsRow> {
    const result = await this.sp.executeRaw<BillingSettingsRow>(
      `insert into public.billing_settings (invoice_prefix, issue_day, due_day, grace_days, late_fee_cents, effective_from)
       values (coalesce($1, 'SKP'), $2, $3, $4, $5, $6)
       returning id, invoice_prefix, issue_day, due_day, grace_days, late_fee_cents, effective_from, effective_to`,
      [
        input.invoicePrefix ?? null,
        input.issueDay,
        input.dueDay,
        input.graceDays,
        input.lateFeeCents,
        input.effectiveFrom,
      ],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error('INSERT ... RETURNING unexpectedly returned no row');
    return row;
  }
}
