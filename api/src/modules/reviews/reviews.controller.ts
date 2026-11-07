import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { ModerateReviewDto, ReviewDto, SubmitReviewDto } from './dto/review.dto';
import { ReviewsManager } from './reviews.manager';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly manager: ReviewsManager) {}

  @Get('tutors/:id/reviews')
  @Public()
  @ApiOperation({ summary: "List a tutor's published reviews" })
  @ApiOkResponse({ type: ReviewDto, isArray: true })
  listPublished(@Param('id', ParseUUIDPipe) id: string): Promise<ReviewDto[]> {
    return this.manager.listPublished(id);
  }

  @Get('reviews/mine')
  @Roles('parent')
  @ApiBearerAuth()
  @ApiOperation({ summary: "List the caller's own reviews, any status" })
  @ApiOkResponse({ type: ReviewDto, isArray: true })
  listMine(@CurrentUser() actor: AuthUser): Promise<ReviewDto[]> {
    return this.manager.listMine(actor);
  }

  @Post('tutors/:id/reviews')
  @Roles('parent')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a review for a tutor (status is always forced to pending)' })
  @ApiCreatedResponse({ type: ReviewDto })
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: SubmitReviewDto,
  ): Promise<ReviewDto> {
    return this.manager.submit(id, actor, dto);
  }

  @Patch('reviews/:id/moderate')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish or reject a pending review' })
  @ApiOkResponse({ type: ReviewDto })
  moderate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
    @Body() dto: ModerateReviewDto,
  ): Promise<ReviewDto> {
    return this.manager.moderate(id, dto, actor);
  }
}
