# @dorad/ai-prompts

Claude API client and structured-output prompt service for the Dorad.ai deal
analysis pipeline. Implements the 12-stage prompt architecture from doc 06,
with strict JSON validation on every response and automatic retry on malformed
output.

## What's here today

- `src/client.ts` — JSON-mode Claude client with validator retry + per-call cost tracking.
- `src/prompts/stage0-classifier.ts` — document classifier (Haiku, temp 0, ~$0.0005/call).
- `src/prompts/stage1-initial-screen.ts` — BBS listing → pursue/monitor/pass verdict (Opus, temp 0.2, ~$0.05/call).
- `src/schemas/` — strict validators for each stage's output.
- `tests/run-tests.ts` — 8 validator tests. No API calls (no key needed).

Stages 2–11 follow the same pattern and can be added one file at a time — see
doc 06 for prompts.

## Run

```bash
node --experimental-strip-types --disable-warning=ExperimentalWarning tests/run-tests.ts
```

## Usage

```typescript
import { initialScreen } from "@dorad/ai-prompts";

const res = await initialScreen({
  buyBox: { deal_size_min: 500_000, deal_size_max: 3_000_000, financing_plan: "SBA 7(a)" },
  listing: { /* BBS record */ },
}, process.env.ANTHROPIC_API_KEY);

console.log(res.output.verdict);        // "pursue" | "monitor" | "pass"
console.log(res.cost_usd);               // e.g. 0.047
console.log(res.output.thesis_draft);    // one-liner + bull / bear / unknowns
```

## Models

Defined in `src/client.ts`:
- opus   → `claude-opus-4-6`       ($15 / $75 per MTok)
- sonnet → `claude-sonnet-4-6`     ($3  / $15)
- haiku  → `claude-haiku-4-5-20251001` ($0.80 / $4)
