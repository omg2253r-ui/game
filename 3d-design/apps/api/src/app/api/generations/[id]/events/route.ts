import { requireUser } from '../../../../../server/access';
import { toJob } from '../../../../../server/dto';
import { route } from '../../../../../server/http';
import { getServices } from '../../../../../server/services';
import { AppError } from '../../../../../server/types';

export const dynamic = 'force-dynamic';

const POLL_MS = 400;
const HEARTBEAT_MS = 15_000;
const MAX_MS = 30 * 60_000;

/**
 * Server-Sent Events stream of job snapshots. Polls the job row rather than
 * using pub/sub so it works the same with the inline queue and BullMQ workers
 * on other machines.
 */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const { repo, queue } = await getServices();
  const first = await repo.getJob(id);
  if (!first || first.userId !== user.id) throw new AppError('not_found', 404);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let last = '';
      let lastBeat = Date.now();
      const started = Date.now();
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        while (!req.signal.aborted && Date.now() - started < MAX_MS) {
          const job = await repo.getJob(id);
          if (!job) break;
          const dto = toJob(job, await queue.position(id));
          const payload = JSON.stringify({ job: dto });
          if (payload !== last) {
            send(`data: ${payload}\n\n`);
            last = payload;
          } else if (Date.now() - lastBeat > HEARTBEAT_MS) {
            send(': ping\n\n');
            lastBeat = Date.now();
          }
          if (job.status === 'succeeded' || job.status === 'failed') break;
          await new Promise((r) => setTimeout(r, POLL_MS));
        }
      } catch (e) {
        console.error('[sse] stream error', e);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
