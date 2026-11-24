import type { FileStorageService } from '../../common/file-storage/file-storage.service.js';
import type { StoredProcRunner } from '../../database/stored-proc.runner.js';
import type { UnitOfWork } from '../../database/unit-of-work.js';
import { PaymentsManager } from './payments.manager.js';
import { PaymentsRepository } from './payments.repository.js';

function makeUow(): UnitOfWork {
  return { run: vi.fn((fn: () => Promise<unknown>) => fn()) } as unknown as UnitOfWork;
}

describe('PaymentsRepository', () => {
  it('only ever calls functions in the private schema', async () => {
    const queryOne = vi.fn().mockResolvedValue({ x: {} });
    const repo = new PaymentsRepository({ queryOne } as unknown as StoredProcRunner);
    await repo.start('i1').catch(() => undefined);
    await repo.attachProof('s1', {}).catch(() => undefined);
    await repo.proofLocation('s1').catch(() => undefined);
    await repo.verify('s1', 100, null, null).catch(() => undefined);
    await repo.reject('s1', 'Blurry');
    for (const [fn] of queryOne.mock.calls) expect(fn).toMatch(/^private\./);
  });

  it('names every verify parameter, passing nulls for the defaults', async () => {
    const queryOne = vi.fn().mockResolvedValue({ verify_payment_submission: { paymentId: 'p1', activated: true } });
    const repo = new PaymentsRepository({ queryOne } as unknown as StoredProcRunner);
    await repo.verify('s1', 30000, null, null);
    expect(queryOne).toHaveBeenCalledWith('private.verify_payment_submission', [
      { name: 'p_submission_id', value: 's1' },
      { name: 'p_amount_cents', value: 30000 },
      { name: 'p_paid_on', value: null },
      { name: 'p_reference', value: null },
    ]);
  });
});

describe('PaymentsManager.attachProof', () => {
  it('records the proof, then moves the file, in one unit of work', async () => {
    const order: string[] = [];
    const repo = {
      attachProof: vi.fn().mockImplementation(() => {
        order.push('attach');
        return Promise.resolve({ stagingPath: 'staging/u/f.jpg', storagePath: 'acc/sub/f.jpg' });
      }),
    } as unknown as PaymentsRepository;
    const move = vi.fn().mockImplementation(() => {
      order.push('move');
      return Promise.resolve();
    });
    const uow = makeUow();
    const manager = new PaymentsManager(repo, uow, { move } as unknown as FileStorageService);

    await manager.attachProof('s1', {
      path: 'staging/u/f.jpg',
      mimeType: 'image/jpeg',
      claimedAmountCents: 30000,
      payerReference: 'SKP-2026-0042',
    });

    expect(uow.run).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['attach', 'move']);
    expect(repo.attachProof).toHaveBeenCalledWith('s1', {
      stagingPath: 'staging/u/f.jpg',
      mime: 'image/jpeg',
      claimedAmountCents: 30000,
      claimedPaidOn: undefined,
      payerReference: 'SKP-2026-0042',
    });
    expect(move).toHaveBeenCalledWith('payment-proofs', 'staging/u/f.jpg', 'acc/sub/f.jpg');
  });
});

describe('PaymentsManager.proofLink', () => {
  it('signs a 60-second link to the stored proof', async () => {
    const repo = {
      proofLocation: vi.fn().mockResolvedValue({ storagePath: 'acc/sub/f.pdf', mime: 'application/pdf' }),
    } as unknown as PaymentsRepository;
    const createDownloadUrl = vi.fn().mockResolvedValue('https://signed');
    const manager = new PaymentsManager(repo, makeUow(), { createDownloadUrl } as unknown as FileStorageService);

    await expect(manager.proofLink('s1')).resolves.toEqual({ url: 'https://signed', mime: 'application/pdf' });
    expect(createDownloadUrl).toHaveBeenCalledWith('payment-proofs', 'acc/sub/f.pdf', 60);
  });
});
