import { NotFoundException } from '@nestjs/common';
import { EnquiriesManager } from './enquiries.manager';
import type { EnquiriesRepository } from './enquiries.repository';

const ENQUIRY_ROW = {
  id: 'e1',
  full_name: 'Jane Parent',
  email: '',
  phone: '',
  topic: '',
  message: 'Tell me more',
  source: 'website',
  status: 'new',
  handled_by: null,
  handled_at: null,
  converted_learner_id: null,
  created_at: new Date('2026-11-01T00:00:00Z'),
};

describe('EnquiriesManager.submit', () => {
  it('maps the inserted row straight through', async () => {
    const repo = { submit: vi.fn().mockResolvedValue(ENQUIRY_ROW) } as unknown as EnquiriesRepository;
    const manager = new EnquiriesManager(repo);

    const dto = await manager.submit({ fullName: 'Jane Parent', message: 'Tell me more' });

    expect(dto.status).toBe('new');
    expect(dto.handledBy).toBeUndefined();
  });
});

describe('EnquiriesManager.updateStatus', () => {
  it('404s when the enquiry does not exist', async () => {
    const repo = { updateStatus: vi.fn().mockResolvedValue(undefined) } as unknown as EnquiriesRepository;
    const manager = new EnquiriesManager(repo);

    await expect(
      manager.updateStatus('missing', { status: 'contacted' }, { id: 'admin-1', roles: ['admin'], claims: {} }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('passes the actor as handledBy, never a client-supplied value', async () => {
    const updateStatus = vi.fn().mockResolvedValue({ ...ENQUIRY_ROW, status: 'contacted', handled_by: 'admin-1' });
    const repo = { updateStatus } as unknown as EnquiriesRepository;
    const manager = new EnquiriesManager(repo);

    await manager.updateStatus('e1', { status: 'contacted' }, { id: 'admin-1', roles: ['admin'], claims: {} });

    expect(updateStatus).toHaveBeenCalledWith('e1', 'contacted', 'admin-1');
  });
});

describe('EnquiriesManager.convert', () => {
  it('404s when the enquiry does not exist', async () => {
    const repo = { convert: vi.fn().mockResolvedValue(undefined) } as unknown as EnquiriesRepository;
    const manager = new EnquiriesManager(repo);

    await expect(
      manager.convert('missing', { learnerId: 'l1' }, { id: 'admin-1', roles: ['admin'], claims: {} }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('links the enquiry to the resulting learner', async () => {
    const convert = vi.fn().mockResolvedValue({
      ...ENQUIRY_ROW,
      status: 'enrolled',
      converted_learner_id: 'l1',
      handled_by: 'admin-1',
    });
    const repo = { convert } as unknown as EnquiriesRepository;
    const manager = new EnquiriesManager(repo);

    const dto = await manager.convert('e1', { learnerId: 'l1' }, { id: 'admin-1', roles: ['admin'], claims: {} });

    expect(convert).toHaveBeenCalledWith('e1', 'l1', 'admin-1');
    expect(dto.convertedLearnerId).toBe('l1');
    expect(dto.status).toBe('enrolled');
  });
});
