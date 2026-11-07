import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class NotificationDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiPropertyOptional() createdBy?: string;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional({ description: 'When the caller marked this read. Absent means unread.' })
  readAt?: Date;
}

/** Exactly one of `broadcast` or `recipientIds` — validated in the Manager, since "exactly one of two optional fields" has no single-field class-validator decorator worth reaching for here. */
export class CreateNotificationDto {
  @ApiProperty() @IsString() @MaxLength(200) title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;

  @ApiPropertyOptional({ description: 'Send to every profile in the system.' })
  @IsOptional()
  @IsBoolean()
  broadcast?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Send to exactly these profiles.' })
  @IsOptional()
  @IsUUID('all', { each: true })
  @ArrayMinSize(1)
  recipientIds?: string[];
}
