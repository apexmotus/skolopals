import type { ResourceAudienceDto, ResourceDto } from './dto/resource.dto';
import type { ResourceAudienceRow, ResourceRow } from './rows/resource.row';

export class ResourcesMapper {
  static audienceToDto(row: ResourceAudienceRow): ResourceAudienceDto {
    return {
      id: row.id,
      audienceType: row.audience_type,
      learnerId: row.learner_id ?? undefined,
      classGroupId: row.class_group_id ?? undefined,
      gradeCode: row.grade_code ?? undefined,
    };
  }

  static toDto(row: ResourceRow): ResourceDto {
    return {
      id: row.id,
      title: row.title,
      subjectCode: row.subject_code ?? undefined,
      url: row.url,
      storagePath: row.storage_path,
      createdBy: row.created_by ?? undefined,
      createdAt: row.created_at,
      audiences: row.audiences.map((a) => ResourcesMapper.audienceToDto(a)),
    };
  }
}
