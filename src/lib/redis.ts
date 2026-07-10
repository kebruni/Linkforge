import Redis, { type RedisOptions } from "ioredis";
import { env, isDev } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

const opts: RedisOptions = {
  // BullMQ requires this for blocking commands.
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  // Lazy connect avoids noisy ECONNREFUSED during `next build` (no Redis in image build).
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 20) return null;
    return Math.min(times * 200, 2000);
  },
};

export const redis: Redis =
  globalThis.__redis ?? new Redis(env.REDIS_URL, opts);

// Connect once in long-running processes; ignore race if already connecting.
void redis.connect().catch(() => {
  /* first real command will surface the error */
});

if (isDev) globalThis.__redis = redis;
