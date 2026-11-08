import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommunicationManager } from './communication.manager.js';
import type { CommunicationRepository } from './communication.repository.js';

const THREAD_ROW = {
  id: 't1',
  subject: 'Homework',
  learner_id: 'l1',
  learner_name: 'Jane Learner',
  created_at: new Date('2026-11-01T00:00:00Z'),
  last_message_at: new Date('2026-11-01T00:00:00Z'),
  last_message: 'Hi there',
  unread_count: '3',
};

describe('CommunicationManager.listMessages', () => {
  it('404s when the thread is invisible (not a participant, not admin) instead of an ambiguous empty list', async () => {
    const listMessages = vi.fn();
    const repo = {
      threadIsVisible: vi.fn().mockResolvedValue(undefined),
      listMessages,
    } as unknown as CommunicationRepository;
    const manager = new CommunicationManager(repo);

    await expect(manager.listMessages('t1')).rejects.toBeInstanceOf(NotFoundException);
    expect(listMessages).not.toHaveBeenCalled();
  });
});

describe('CommunicationManager.startThread', () => {
  it('parses the bigint unread_count from v_my_threads to a real number', async () => {
    const repo = {
      startThread: vi.fn().mockResolvedValue('t1'),
      getThreadById: vi.fn().mockResolvedValue(THREAD_ROW),
    } as unknown as CommunicationRepository;
    const manager = new CommunicationManager(repo);

    const dto = await manager.startThread({ body: 'Hi', participantIds: ['p1'] });

    expect(dto.unreadCount).toBe(3);
  });
});

describe('CommunicationManager.createNotification', () => {
  it('rejects when neither broadcast nor recipientIds is given', async () => {
    const repo = {} as unknown as CommunicationRepository;
    const manager = new CommunicationManager(repo);

    await expect(
      manager.createNotification({ id: 'admin-1', roles: ['admin'], claims: {} }, { title: 'Hi' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when both broadcast and recipientIds are given', async () => {
    const repo = {} as unknown as CommunicationRepository;
    const manager = new CommunicationManager(repo);

    await expect(
      manager.createNotification(
        { id: 'admin-1', roles: ['admin'], claims: {} },
        { title: 'Hi', broadcast: true, recipientIds: ['p1'] },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fans out to every profile when broadcast is true', async () => {
    const fanOutToAllProfiles = vi.fn().mockResolvedValue(undefined);
    const fanOutToRecipients = vi.fn();
    const repo = {
      createNotification: vi.fn().mockResolvedValue('n1'),
      fanOutToAllProfiles,
      fanOutToRecipients,
    } as unknown as CommunicationRepository;
    const manager = new CommunicationManager(repo);

    await manager.createNotification({ id: 'admin-1', roles: ['admin'], claims: {} }, {
      title: 'Hi',
      broadcast: true,
    });

    expect(fanOutToAllProfiles).toHaveBeenCalledWith('n1');
    expect(fanOutToRecipients).not.toHaveBeenCalled();
  });

  it('fans out to only the named recipients when recipientIds is given', async () => {
    const fanOutToRecipients = vi.fn().mockResolvedValue(undefined);
    const fanOutToAllProfiles = vi.fn();
    const repo = {
      createNotification: vi.fn().mockResolvedValue('n1'),
      fanOutToAllProfiles,
      fanOutToRecipients,
    } as unknown as CommunicationRepository;
    const manager = new CommunicationManager(repo);

    await manager.createNotification({ id: 'admin-1', roles: ['admin'], claims: {} }, {
      title: 'Hi',
      recipientIds: ['p1', 'p2'],
    });

    expect(fanOutToRecipients).toHaveBeenCalledWith('n1', ['p1', 'p2']);
    expect(fanOutToAllProfiles).not.toHaveBeenCalled();
  });
});

describe('CommunicationManager.markNotificationRead', () => {
  it('404s when the actor is not a recipient of that notification', async () => {
    const repo = {
      markNotificationRead: vi.fn().mockResolvedValue(undefined),
    } as unknown as CommunicationRepository;
    const manager = new CommunicationManager(repo);

    await expect(
      manager.markNotificationRead('n1', { id: 'p1', roles: ['parent'], claims: {} }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
