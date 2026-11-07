import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class MessageDto {
  @ApiProperty() id!: string;
  @ApiProperty() threadId!: string;
  @ApiProperty() senderId!: string;
  @ApiProperty() body!: string;
  @ApiProperty() createdAt!: Date;
}

export class PostMessageDto {
  @ApiProperty() @IsString() @MaxLength(4000) body!: string;
}

export class MarkThreadReadResultDto {
  @ApiProperty() markedCount!: number;
}
