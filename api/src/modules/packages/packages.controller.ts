import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import {
  BillingSettingsDto,
  CreateBillingSettingsDto,
} from './dto/billing-settings.dto';
import {
  GetPriceOnQueryDto,
  PackagePriceDto,
  SetPackagePriceDto,
} from './dto/package-price.dto';
import { CreatePackageDto, PackageDto } from './dto/package.dto';
import { PackagesManager } from './packages.manager';

@ApiTags('packages')
@ApiBearerAuth()
@Controller()
export class PackagesController {
  constructor(private readonly manager: PackagesManager) {}

  @Get('packages')
  @Public()
  @ApiOperation({
    summary:
      'List packages (the pricing page). Admin sees every package, including inactive ones.',
  })
  @ApiOkResponse({ type: PackageDto, isArray: true })
  listPackages(@CurrentUser() actor?: AuthUser): Promise<PackageDto[]> {
    return this.manager.listPackages(actor);
  }

  @Post('packages')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a package' })
  @ApiCreatedResponse({ type: PackageDto })
  create(@Body() dto: CreatePackageDto): Promise<PackageDto> {
    return this.manager.create(dto);
  }

  @Get('packages/:code/price')
  @Public()
  @ApiOperation({
    summary: 'The price of a package on a date (defaults to today)',
  })
  @ApiOkResponse()
  async getPriceOn(
    @Param('code') code: string,
    @Query() query: GetPriceOnQueryDto,
  ): Promise<{ amountCents: number }> {
    return { amountCents: await this.manager.getPriceOn(code, query.on) };
  }

  @Post('packages/:code/prices')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Set a new price, effective from a date (no two prices on the same day)',
  })
  @ApiCreatedResponse({ type: PackagePriceDto })
  setPrice(
    @Param('code') code: string,
    @Body() dto: SetPackagePriceDto,
  ): Promise<PackagePriceDto> {
    return this.manager.setPrice(code, dto);
  }

  @Get('billing-settings/current')
  @Roles('admin')
  @ApiOperation({
    summary:
      'The billing settings in effect today (internal only, no public read)',
  })
  @ApiOkResponse({ type: BillingSettingsDto })
  getCurrentBillingSettings(): Promise<BillingSettingsDto> {
    return this.manager.getCurrentBillingSettings();
  }

  @Post('billing-settings')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new billing-settings period' })
  @ApiCreatedResponse({ type: BillingSettingsDto })
  createBillingSettings(
    @Body() dto: CreateBillingSettingsDto,
  ): Promise<BillingSettingsDto> {
    return this.manager.createBillingSettings(dto);
  }
}
