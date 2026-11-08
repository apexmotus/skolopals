import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../common/cache/cache.service.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type {
  CreateBillingSettingsDto,
  BillingSettingsDto,
} from './dto/billing-settings.dto.js';
import type {
  SetPackagePriceDto,
  PackagePriceDto,
} from './dto/package-price.dto.js';
import type { CreatePackageDto, PackageDto } from './dto/package.dto.js';
import {
  packagesCacheKeys,
  PACKAGES_CACHE_TTL_SECONDS,
} from './packages-cache-keys.js';
import { PackagesMapper } from './packages.mapper.js';
import { PackagesRepository } from './packages.repository.js';

@Injectable()
export class PackagesManager {
  constructor(
    private readonly repo: PackagesRepository,
    private readonly cache: CacheService,
  ) {}

  /**
   * One path for both audiences (`03-endpoints-and-business-rules.md`
   * §packages row 1/3 flagged this as an open decision): an admin actor
   * sees every package (including inactive); anyone else sees active-only.
   * Gated by the actor's actual role, not a client-suppliable query param,
   * so there's nothing to spoof.
   */
  async listPackages(actor: AuthUser | undefined): Promise<PackageDto[]> {
    if (actor?.roles.includes('admin')) {
      return (await this.repo.listAll()).map((row) =>
        PackagesMapper.toDto(row),
      );
    }
    const cached = await this.cache.get<PackageDto[]>(
      packagesCacheKeys.listActive,
    );
    if (cached) return cached;
    const dtos = (await this.repo.listActive()).map((row) =>
      PackagesMapper.toDto(row),
    );
    await this.cache.set(
      packagesCacheKeys.listActive,
      dtos,
      PACKAGES_CACHE_TTL_SECONDS,
    );
    return dtos;
  }

  async create(dto: CreatePackageDto): Promise<PackageDto> {
    const row = await this.repo.create(dto);
    await this.cache.del(packagesCacheKeys.listActive);
    return PackagesMapper.toDto(row);
  }

  async getPriceOn(code: string, on?: string): Promise<number> {
    const date = on ?? (await this.repo.today());
    const key = packagesCacheKeys.priceOn(code, date);
    const cached = await this.cache.get<number>(key);
    if (cached !== undefined) return cached;

    const cents = await this.repo.getPriceOn(code, date);
    if (cents === undefined)
      throw new NotFoundException(
        `No price in effect for "${code}" on ${date}.`,
      );
    await this.cache.set(key, cents, PACKAGES_CACHE_TTL_SECONDS);
    return cents;
  }

  async setPrice(
    code: string,
    dto: SetPackagePriceDto,
  ): Promise<PackagePriceDto> {
    const row = await this.repo.setPrice(
      code,
      dto.amountCents,
      dto.effectiveFrom,
    );
    await this.cache.del(packagesCacheKeys.listActive);
    return PackagesMapper.priceToDto(row);
  }

  async getCurrentBillingSettings(): Promise<BillingSettingsDto> {
    const today = await this.repo.today();
    const row = await this.repo.getBillingSettingsEffectiveOn(today);
    if (!row) throw new NotFoundException('No billing settings are in effect.');
    return PackagesMapper.billingSettingsToDto(row);
  }

  async createBillingSettings(
    dto: CreateBillingSettingsDto,
  ): Promise<BillingSettingsDto> {
    const row = await this.repo.createBillingSettings(dto);
    return PackagesMapper.billingSettingsToDto(row);
  }
}
