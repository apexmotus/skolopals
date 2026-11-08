import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { CommunicationController } from './communication.controller.js';

function getHandler(methodName: string): object {
  const handler = (CommunicationController.prototype as unknown as Record<string, object>)[methodName];
  if (!handler) throw new Error(`No such method: ${methodName}`);
  return handler;
}

/**
 * `03-endpoints-and-business-rules.md` §communication: "Messages and read
 * receipts are append-only: no update path exists for `messages`,
 * `report_acknowledgements`, or `thread_participants` membership rows."
 * The plan's own Phase 3e "Verify" section asks this to be tested as an
 * absence — the controller must not expose a PATCH/PUT route — not merely
 * that the Manager happens to reject one. Reads every route's real
 * decorator metadata off the controller class rather than trusting a
 * hand-maintained list of "the routes I wrote", so a future PATCH/PUT
 * accidentally added to this controller fails this test immediately.
 */
describe('CommunicationController — append-only enforcement', () => {
  it('exposes no PUT/PATCH route targeting a thread message or a thread participant', () => {
    const basePath = Reflect.getMetadata(PATH_METADATA, CommunicationController) as string;
    const methodNames = Object.getOwnPropertyNames(CommunicationController.prototype).filter(
      (name) => name !== 'constructor',
    );

    const offendingRoutes: string[] = [];
    for (const methodName of methodNames) {
      const handler = getHandler(methodName);
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string;
      const fullPath = `${basePath}/${path}`;

      const isUpdateVerb = method === RequestMethod.PUT || method === RequestMethod.PATCH;
      const targetsAppendOnlyResource = fullPath.includes('messages') || fullPath.includes('participants');
      if (isUpdateVerb && targetsAppendOnlyResource) {
        offendingRoutes.push(`${RequestMethod[method]} ${fullPath}`);
      }
    }

    expect(offendingRoutes).toEqual([]);
  });

  it('notifications/:id/read is the one legitimate PATCH on this controller (read state on notification_recipients, not an append-only table)', () => {
    const methodNames = Object.getOwnPropertyNames(CommunicationController.prototype).filter(
      (name) => name !== 'constructor',
    );
    const patchRoutes = methodNames.filter((methodName) => {
      const handler = getHandler(methodName);
      return (Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod) === RequestMethod.PATCH;
    });

    expect(patchRoutes).toEqual(['markNotificationRead']);
  });
});
