import { NotFoundException } from '@nestjs/common';
import type { UnitOfWork } from '../../database/unit-of-work.js';
import { ResourcesManager } from './resources.manager.js';
import type { ResourcesRepository } from './resources.repository.js';

function makeUow(): UnitOfWork {
  return { run: vi.fn((fn: () => Promise<unknown>) => fn()) } as unknown as UnitOfWork;
}

const RESOURCE_ROW = {
  id: 'r1',
  title: 'Worksheet',
  subject_code: 'maths',
  url: '',
  storage_path: '',
  created_by: 'tutor-1',
  created_at: new Date('2026-11-01T00:00:00Z'),
  audiences: [{ id: 'a1', audience_type: 'all', learner_id: null, class_group_id: null, grade_code: null }],
};

describe('ResourcesManager.create', () => {
  it('creates the resource then its audience inside one UnitOfWork, in that order', async () => {
    const order: string[] = [];
    const uow = makeUow();
    const create = vi.fn().mockImplementation(() => {
      order.push('create');
      return Promise.resolve('r1');
    });
    const createAudience = vi.fn().mockImplementation(() => {
      order.push('createAudience');
      return Promise.resolve();
    });
    const repo = {
      create,
      createAudience,
      getById: vi.fn().mockResolvedValue(RESOURCE_ROW),
    } as unknown as ResourcesRepository;
    const manager = new ResourcesManager(repo, uow);

    const dto = await manager.create(
      { id: 'tutor-1', roles: ['tutor'], claims: {} },
      { title: 'Worksheet', audienceType: 'all' },
    );

    expect(uow.run).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['create', 'createAudience']);
    expect(dto.audiences).toHaveLength(1);
  });
});

describe('ResourcesManager.update', () => {
  it('404s when the resource is not found', async () => {
    const repo = { update: vi.fn().mockResolvedValue(undefined) } as unknown as ResourcesRepository;
    const manager = new ResourcesManager(repo, makeUow());

    await expect(manager.update('missing', { title: 'New title' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('ResourcesManager.removeAudience', () => {
  it('404s when nothing was deleted', async () => {
    const repo = { removeAudience: vi.fn().mockResolvedValue(false) } as unknown as ResourcesRepository;
    const manager = new ResourcesManager(repo, makeUow());

    await expect(manager.removeAudience('r1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
