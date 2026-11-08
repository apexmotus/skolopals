import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import { UnitOfWork } from '../../database/unit-of-work.js';
import type { CreateResourceDto, ResourceDto, UpdateResourceDto } from './dto/resource.dto.js';
import { ResourcesMapper } from './resources.mapper.js';
import { ResourcesRepository } from './resources.repository.js';

/** No caching — targeting is per-actor (`03-endpoints-and-business-rules.md` §resources). */
@Injectable()
export class ResourcesManager {
  constructor(
    private readonly repo: ResourcesRepository,
    private readonly uow: UnitOfWork,
  ) {}

  async listForActor(): Promise<ResourceDto[]> {
    const rows = await this.repo.listForActor();
    return rows.map((row) => ResourcesMapper.toDto(row));
  }

  async create(actor: AuthUser, dto: CreateResourceDto): Promise<ResourceDto> {
    const resourceId = await this.uow.run(async () => {
      const id = await this.repo.create({
        title: dto.title,
        subjectCode: dto.subjectCode,
        url: dto.url,
        storagePath: dto.storagePath,
        createdBy: actor.id,
      });
      await this.repo.createAudience({
        resourceId: id,
        audienceType: dto.audienceType,
        learnerId: dto.learnerId,
        classGroupId: dto.classGroupId,
        gradeCode: dto.gradeCode,
      });
      return id;
    });

    const row = await this.repo.getById(resourceId);
    if (!row) throw new Error('Freshly created resource could not be re-read');
    return ResourcesMapper.toDto(row);
  }

  async update(id: string, dto: UpdateResourceDto): Promise<ResourceDto> {
    const row = await this.repo.update(id, dto);
    if (!row) throw new NotFoundException('Resource not found.');
    return ResourcesMapper.toDto(row);
  }

  async removeAudience(resourceId: string, audienceId: string): Promise<void> {
    const removed = await this.repo.removeAudience(resourceId, audienceId);
    if (!removed) throw new NotFoundException('Resource audience not found.');
  }
}
