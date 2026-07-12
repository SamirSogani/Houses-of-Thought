// Backward-compatibility shim. The AI layer is no longer Groq-only: model/provider
// selection now lives in the multi-provider routing engine at lib/ai/router.ts,
// which owns the failover lanes, the Groq penalty box, and the daily airbag.
//
// This file is kept so existing `@/lib/ai/groq` imports keep resolving. New code
// should import from '@/lib/ai/router' directly.

export {
  completeJSON,
  AiError,
  dailyLimitsExhausted,
  type AiRole,
} from './router'
