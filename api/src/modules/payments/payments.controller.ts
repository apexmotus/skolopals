import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  AttachProofDto,
  PaymentSubmissionDto,
  ProofLinkDto,
  RejectPaymentDto,
  VerifyPaymentDto,
  VerifyPaymentResultDto,
} from './dto/payment.dto.js';
import { PaymentsManager } from './payments.manager.js';

/** SPEC-2026-11-enrolment-payments-ux.md §3 and §8. */
@ApiTags('payments')
@ApiBearerAuth()
@Controller()
export class PaymentsController {
  constructor(private readonly manager: PaymentsManager) {}

  @Post('invoices/:invoiceId/payment-submissions')
  @Roles('parent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '"I have made the payment": opens (or returns) the submission for an invoice; re-quotes an offer from an earlier month',
  })
  @ApiOkResponse({ type: PaymentSubmissionDto })
  start(@Param('invoiceId', ParseUUIDPipe) invoiceId: string): Promise<PaymentSubmissionDto> {
    return this.manager.start(invoiceId);
  }

  @Post('payment-submissions/:id/proof')
  @Roles('parent')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Attach a confirmed upload as proof of payment; admins are told there is a proof to check' })
  @ApiNoContentResponse()
  attachProof(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachProofDto,
  ): Promise<void> {
    return this.manager.attachProof(id, dto);
  }

  @Get('payment-submissions/:id/proof')
  @Roles('parent', 'admin')
  @ApiOperation({ summary: 'A 60-second signed URL for the proof (account holder or admin)' })
  @ApiOkResponse({ type: ProofLinkDto })
  proofLink(@Param('id', ParseUUIDPipe) id: string): Promise<ProofLinkDto> {
    return this.manager.proofLink(id);
  }

  @Post('payment-submissions/:id/verify')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Record the PayShap payment. For an offer invoice: activates, places the learner, bills any month now due. Verifying twice is refused',
  })
  @ApiOkResponse({ type: VerifyPaymentResultDto })
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyPaymentDto,
  ): Promise<VerifyPaymentResultDto> {
    return this.manager.verify(id, dto);
  }

  @Post('payment-submissions/:id/reject')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reject a proof with a reason; the parent is told and can upload again' })
  @ApiNoContentResponse()
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPaymentDto,
  ): Promise<void> {
    return this.manager.reject(id, dto.reason);
  }
}
