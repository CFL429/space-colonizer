/**
 * Synthetic threads for exercising the UI on demand — a status, a model tag, a payout
 * popup — without waiting for a real agent thread to be in the right state.
 *
 * A spawned thread is shaped exactly like one `server/harnesses/*` would hand back, so it
 * flows through `Colony.setThreads` and `applyCurrency` unmodified: the astronaut that walks
 * out, the badge over its head, and the pay popup when its "tokens" move are the genuine
 * article, not a UI mockup of one. The `__test` flag is only ever read by the caller
 * deciding whether an action (open in a harness, archive against a real record) makes sense.
 *
 * Threads belong to an "environment" — a pretend platform, one hex plot of its own — so a
 * handful of fake repos can stand in for several harnesses at once rather than everything
 * landing on a single shared pad. `main.js` decides whether the *real* scan or this module
 * feeds the colony; this module only ever knows about its own fake roster.
 */

export const TEST_MODELS = [
  ['claude-opus-5-20260201', 'Opus 5'],
  ['claude-sonnet-5-20260201', 'Sonnet 5'],
  ['claude-fable-5-1-20260201', 'Fable 5.1'],
  ['claude-haiku-4-5-20251001', 'Haiku 4.5'],
  ['', 'No model tag'],
]

export const TEST_STATUSES = [
  ['working', 'Working'],
  ['waiting', 'Waiting on you'],
  ['blocked', 'Blocked'],
  ['celebrating', 'Shipped'],
  ['idle', 'Idle'],
  ['sleeping', 'Dormant'],
]

const STALE_MS = 3 * 24 * 60 * 60 * 1000

let envSeq = 0
let threadSeq = 0
const environments = new Map()
const threads = new Map()

export function addEnvironment(name) {
  const n = ++envSeq
  const env = { id: `env-${n}`, name: name || `Environment ${n}` }
  environments.set(env.id, env)
  return env
}

/** Renaming carries every thread already standing there along with it — the project name
 *  *is* the plot's identity, so a thread left on the old name would found a second, empty
 *  plot next to the renamed one instead of following it. */
export function renameEnvironment(id, name) {
  const env = environments.get(id)
  if (!env || !name || name === env.name) return
  env.name = name
  for (const thread of threads.values()) {
    if (thread.envId === id) thread.project = name
  }
}

/** Drops the environment and every thread standing in it. */
export function removeEnvironment(id) {
  environments.delete(id)
  for (const [tid, thread] of threads) {
    if (thread.envId === id) threads.delete(tid)
  }
}

export function listEnvironments() {
  return [...environments.values()]
}

/** The thread flags that add up to each status, mirroring `statusFor` in `colony.js`. */
function flagsFor(status, now) {
  switch (status) {
    case 'working':
      return { running: true }
    case 'waiting':
      return { unread: true }
    case 'blocked':
      return { hasError: true }
    case 'celebrating':
      return { prState: 'MERGED' }
    case 'sleeping':
      return { lastActivityAt: now - STALE_MS - 60_000 }
    default:
      return {}
  }
}

export function spawnTest({ envId, model = '', status = 'idle' } = {}) {
  const env = environments.get(envId)
  if (!env) return null
  const now = Date.now()
  const n = ++threadSeq
  const id = `test-${now}-${n}`
  const flags = flagsFor(status, now)
  const thread = {
    id,
    __test: true,
    envId,
    testStatus: status,
    title: `Test astronaut #${n}`,
    project: env.name,
    projectPath: '',
    worktree: '',
    gitBranch: '',
    model,
    createdAt: now,
    lastActivityAt: flags.lastActivityAt ?? now,
    hasError: Boolean(flags.hasError),
    running: Boolean(flags.running),
    unread: Boolean(flags.unread),
    prState: flags.prState || '',
    archived: false,
    sizeBytes: 4_000 + Math.floor(Math.random() * 60_000),
    tokensSpent: 0,
    receipts: [],
    harness: 'test',
    harnessName: 'Test environment',
    canOpen: false,
  }
  threads.set(id, thread)
  return thread
}

/** Add tokens to a test thread the same way a real one accrues them, receipt included.
 *  Returns the amount paid, or null if `id` is not a live test thread. */
export function payTest(id, amount = 500 + Math.floor(Math.random() * 24_500)) {
  const thread = threads.get(id)
  if (!thread) return null
  thread.tokensSpent += amount
  thread.lastActivityAt = Date.now()
  thread.receipts = [{ ts: Date.now(), tokens: amount, why: 'Test payout' }, ...thread.receipts].slice(0, 20)
  return amount
}

export function removeTest(id) {
  threads.delete(id)
}

/** Every thread in one environment, for its own card in the panel. */
export function listEnvThreads(envId) {
  return [...threads.values()].filter((t) => t.envId === envId)
}

/** Every fake thread across every environment — what actually reaches the colony when the
 *  test environment is switched on. */
export function listAllTest() {
  return [...threads.values()]
}

export function clearAllTest() {
  environments.clear()
  threads.clear()
}
