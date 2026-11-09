import { json } from '../../../server/dto';
import { route } from '../../../server/http';
import { currentUser } from '../../../server/session';

export const dynamic = 'force-dynamic';

/** Returns (and on first visit creates) the guest account with its balance. */
export const GET = route(async () => {
  const user = (await currentUser({ create: true }))!;
  return json({ userId: user.id, isGuest: user.isGuest, credits: user.credits });
});
