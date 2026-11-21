import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  ConfirmedUploadDto,
  ConfirmUploadDto,
  SignUploadDto,
  SignUploadResponseDto,
} from './dto/upload.dto.js';
import { UploadsManager } from './uploads.manager.js';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly manager: UploadsManager) {}

  @Post('sign')
  @Roles('parent', 'admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Start an upload: returns a signed Storage URL in the caller’s staging folder. Never proxies the bytes.',
  })
  @ApiCreatedResponse({ type: SignUploadResponseDto })
  sign(
    @CurrentUser() user: AuthUser,
    @Body() dto: SignUploadDto,
  ): Promise<SignUploadResponseDto> {
    return this.manager.sign(user, dto);
  }

  @Post('confirm')
  @Roles('parent', 'admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Check an uploaded file by its contents and size; converts iPhone HEIC photos to JPEG',
  })
  @ApiOkResponse({ type: ConfirmedUploadDto })
  confirm(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmUploadDto,
  ): Promise<ConfirmedUploadDto> {
    return this.manager.confirm(user, dto);
  }
}
