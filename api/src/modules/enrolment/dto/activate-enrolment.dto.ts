import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * An admin retry (SPEC §5.2): normally payment verification activates. Only
 * an accepted application whose offer invoice is fully paid can be activated;
 * it raises no invoice.
 */
export class ActivateEnrolmentDto {
  @ApiPropertyOptional({ description: 'Leave out to keep the tutor chosen by automatic placement.' })
  @IsOptional()
  @IsUUID()
  assignedTutorId?: string;
}

export class ActivateEnrolmentResultDto {
  @ApiProperty() enrolmentId!: string;
}
