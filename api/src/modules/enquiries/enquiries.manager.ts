import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user';
import {
  ConvertEnquiryDto,
  EnquiryDto,
  SubmitEnquiryDto,
  UpdateEnquiryStatusDto,
} from './dto/enquiry.dto';
import { EnquiriesMapper } from './enquiries.mapper';
import { EnquiriesRepository } from './enquiries.repository';

@Injectable()
export class EnquiriesManager {
  constructor(private readonly repo: EnquiriesRepository) {}

  async submit(dto: SubmitEnquiryDto): Promise<EnquiryDto> {
    const row = await this.repo.submit(dto);
    return EnquiriesMapper.toDto(row);
  }

  async list(status?: string): Promise<EnquiryDto[]> {
    const rows = await this.repo.list(status);
    return rows.map((row) => EnquiriesMapper.toDto(row));
  }

  async updateStatus(id: string, dto: UpdateEnquiryStatusDto, actor: AuthUser): Promise<EnquiryDto> {
    const row = await this.repo.updateStatus(id, dto.status, actor.id);
    if (!row) throw new NotFoundException('Enquiry not found.');
    return EnquiriesMapper.toDto(row);
  }

  async convert(id: string, dto: ConvertEnquiryDto, actor: AuthUser): Promise<EnquiryDto> {
    const row = await this.repo.convert(id, dto.learnerId, actor.id);
    if (!row) throw new NotFoundException('Enquiry not found.');
    return EnquiriesMapper.toDto(row);
  }
}
