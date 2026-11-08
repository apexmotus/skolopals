import type { EnquiryDto } from './dto/enquiry.dto.js';
import type { EnquiryRow } from './rows/enquiry.row.js';

export class EnquiriesMapper {
  static toDto(row: EnquiryRow): EnquiryDto {
    return {
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      topic: row.topic,
      message: row.message,
      source: row.source,
      status: row.status,
      handledBy: row.handled_by ?? undefined,
      handledAt: row.handled_at ?? undefined,
      convertedLearnerId: row.converted_learner_id ?? undefined,
      createdAt: row.created_at,
    };
  }
}
