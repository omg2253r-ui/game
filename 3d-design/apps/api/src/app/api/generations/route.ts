import { createHash } from 'node:crypto';
import { checkPrompt, creditCost, GenerateRequestSchema } from '@3d-design/shared';
import { z } from 'zod';
import { json, toJob } from '../../../server/dto';
import { assertSameOrigin, clientIp, readJson, route } from '../../../server/http';
import { newId, newSeed } from '../../../server/ids';
import { getServices } from '../../../server/services';
import { currentUser } from '../../../server/session';
import { AppError, type JobRecord } from '../../../server/types';

export const dynamic = 'force-dynamic';

const BodySchema = GenerateRequestSchema.extend({
  /** Client-generated UUID; resubmitting the same one returns the same job (no double charge). */
  requestId: z.uuid().optional(),
});

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  const { config, repo, queue, provider, rateLimiter } = await getServices();
  const user = (await currentUser({ create: true }))!;

  const body = await readJson(req, BodySchema);
  const jobId = body.requestId
    ? `job_${createHash('sha256').update(`${user.id}:${body.requestId}`).digest('hex').slice(0, 20)}`
    : newId('job');
  const existing = await repo.getJob(jobId);
  if (existing && existing.userId === user.id) {
    return json({ job: toJob(existing, await queue.position(jobId)), credits: user.credits });
  }

  for (const [key, limit] of [
    [`gen:user:${user.id}`, config.RATE_LIMIT_USER_PER_MIN],
    [`gen:ip:${clientIp(req, config.TRUST_PROXY)}`, config.RATE_LIMIT_IP_PER_MIN],
  ] as const) {
    const retryAfter = await rateLimiter.hit(key, limit, 60);
    if (retryAfter > 0) throw new AppError('rate_limited', 429, { retryAfter });
  }

  const verdict = checkPrompt(body.prompt, body.negativePrompt);
  if (!verdict.ok) throw new AppError(verdict.code, 422, { term: verdict.term });

  const { requestId: _r, ...request } = body;
  const cost = creditCost(request.quality);
  const balance = await repo.adjustCredits(user.id, -cost, 'generation', jobId);
  if (balance === null) {
    throw new AppError('insufficient_credits', 402, { required: cost, balance: user.credits });
  }

  const now = new Date().toISOString();
  const job: JobRecord = {
    id: jobId,
    userId: user.id,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    request: { ...request, seed: request.seed ?? newSeed() },
    creditsCharged: cost,
    provider: provider.id,
    providerTaskId: null,
    modelId: null,
    errorCode: null,
    errorDetail: null,
    startedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await repo.createJob(job);
    await queue.enqueue(jobId);
  } catch (e) {
    await repo.adjustCredits(user.id, cost, 'refund', jobId);
    throw e;
  }
  const fresh = (await repo.getJob(jobId)) ?? job;
  return json(
    { job: toJob(fresh, await queue.position(jobId)), credits: balance },
    { status: 201 },
  );
});
