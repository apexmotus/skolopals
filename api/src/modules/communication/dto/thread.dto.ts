import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ThreadDto {
  @ApiProperty() id!: string;
  @ApiProperty() subject!: string;
  @ApiPropertyOptional() learnerId?: string;
  @ApiPropertyOptional() learnerName?: string;
  @ApiProperty() createdAt!: Date;
  @ApiPropertyOptional() lastMessageAt?: Date;
  @ApiPropertyOptional() lastMessage?: string;
  @ApiProperty() unreadCount!: number;
}

export class StartThreadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty() @IsString() @MaxLength(4000) body!: string;

  @ApiProperty({ type: [String], description: 'Other participants besides the caller, who is always added.' })
  @IsUUID('all', { each: true })
  @ArrayMaxSize(50)
  participantIds!: string[];

  @ApiPropertyOptional({ description: 'What this conversation is about. The caller must be entitled to view this learner.' })
  @IsOptional()
  @IsUUID()
  learnerId?: string;
}

export class AddParticipantDto {
  @ApiProperty() @IsUUID() profileId!: string;
}

export class ThreadParticipantDto {
  @ApiProperty() threadId!: string;
  @ApiProperty() profileId!: string;
  @ApiProperty() addedAt!: Date;
}
