import type { BillingSettingsDto } from './dto/billing-settings.dto';
import type { PackagePriceDto } from './dto/package-price.dto';
import type { PackageDto } from './dto/package.dto';
import type { BillingSettingsRow } from './rows/billing-settings.row';
import type { PackagePriceRow } from './rows/package-price.row';
import type { PackageRow } from './rows/package.row';

export class PackagesMapper {
  static toDto(row: PackageRow): PackageDto {
    return {
      code: row.code,
      name: row.name,
      description: row.description,
      serviceType: row.service_type,
      billingPeriod: row.billing_period,
      subjectAllowance: row.subject_allowance ?? undefined,
      isActive: row.is_active,
      sortOrder: row.sort_order,
    };
  }

  static priceToDto(row: PackagePriceRow): PackagePriceDto {
    return {
      id: row.id,
      packageCode: row.package_code,
      amountCents: row.amount_cents,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to ?? undefined,
    };
  }

  static billingSettingsToDto(row: BillingSettingsRow): BillingSettingsDto {
    return {
      id: row.id,
      invoicePrefix: row.invoice_prefix,
      issueDay: row.issue_day,
      dueDay: row.due_day,
      graceDays: row.grace_days,
      lateFeeCents: row.late_fee_cents,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to ?? undefined,
    };
  }
}
