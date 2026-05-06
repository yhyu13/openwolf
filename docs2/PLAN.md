# Hippocampus Memory System — Implementation Plan

> **Status**: Phase 1 ✅ | Phase 2 pending
> **Goal**: Implement neuroscience-inspired episodic/spatial memory for OpenWolf
> **Docs**: [00-hippocampus-memory-system.md](./00-hippocampus-memory-system.md)

---

## Overview

The hippocampus system extends OpenWolf's flat, append-only memory with:
- **Events**: Context × Action × Outcome triplets with valence (reward/penalty/trauma)
- **Cues**: Location/Question/State triggers that recall relevant past events
- **Consolidation**: Short-term (hippocampus) → Long-term (neocortex) memory transfer

---

## Phase 1: Minimum Viable Hippocampus ✅

**Target**: 1 session to complete
**Verification**: Build passes, `openwolf init` creates hippocampus.json, 98 tests passing

### Phase 1.1 — Create Type Definitions ✅
- [x] `src/hippocampus/types.ts` — WolfEvent + all interfaces

### Phase 1.2 — Create Hippocampus Core Module ✅
- [x] `src/hippocampus/index.ts` — Hippocampus class with addEvent(), recall(), getTraumas()

### Phase 1.3 — Create Event Store ✅
- [x] `src/hippocampus/event-store.ts` — hippocampus.json CRUD operations

### Phase 1.4 — Add Hippocampus Template ✅
- [x] `src/templates/hippocampus.json` — Template for `openwolf init`

### Phase 1.5 — Wire post-write.ts Hook ✅
- [x] `src/hooks/post-write.ts` — Call `hippocampus.addEvent()` on file writes

### Phase 1.6 — Wire pre-read.ts Hook ✅
- [x] `src/hooks/pre-read.ts` — Show trauma warnings before reading files

### Phase 1.7 — Modify init.ts ✅
- [x] `src/cli/init.ts` — Create `.wolf/hippocampus.json` on `openwolf init`

### Phase 1.8 — Build and Verify ✅
- [x] `pnpm build` passes
- [x] `openwolf init` creates hippocampus.json
- [x] File edit creates event in hippocampus.json (runtime tested)
- [x] Pre-read shows trauma warning (runtime tested)
- [x] Test suite: 98 tests passing

---

## Phase 2: Basic Recall

**Target**: 2 sessions (1 complete, 1 for tests)
**Prerequisite**: Phase 1 complete
**Status**: Implementation complete | Tests pending

### Phase 2.1 — Cue Index System ✅
- [x] `src/hippocampus/cue-index.ts` — CueIndex type and build logic
- [x] `src/templates/cue-index.json` — Template for cue-index.json
- [x] Index updates on addEvent (batch every 10 events)
- [x] Wire into init.ts to create cue-index.json

### Phase 2.2 — Recall API ✅
- [x] `Hippocampus.recall(cue, filters)` — Main recall entry point
- [x] Location cue scoring (exact, prefix, glob, parent, sibling)
- [x] Recency scoring with exponential decay (half-life 30 days)
- [x] Valence/intensity scoring boost

### Phase 2.3 — Question/Semantic Cue (Light) ✅
- [x] Tag-based matching fallback (via tag_index)
- [ ] Entity extraction from question cues (Phase 3)

### Phase 2.4 — State Cue Integration ✅
- [x] Error pattern matching from action.error_message
- [ ] Recent valence sequence detection (Phase 3)

### Phase 2.5 — Enhance pre-write Hook ✅
- [x] Check for trauma patterns before editing
- [x] Show warnings for high-intensity trauma events

### Phase 2.6 — CLI: `openwolf recall` Command ✅
- [x] `openwolf recall <query>` — CLI to trigger recall
- [x] Pretty-print recall results
- [x] JSON output option

### Phase 2.7 — Tests ⏳
- [ ] T9_cue-index.test.ts
- [ ] T10_recall.test.ts
- [ ] T11_recall-cli.test.sh
- [ ] T12_integration.sh

---

## Phase 3: Consolidation

**Target**: 3-4 sessions
**Prerequisite**: Phase 2 complete

- [ ] Create neocortex.json store
- [ ] Add decay logic (weekly decay check, trauma never decays)
- [ ] Wire daemon for off-peak consolidation

---

## File Structure

```
src/hippocampus/
├── index.ts              # Hippocampus class + public API
├── types.ts              # All type definitions (WolfEvent, Valence, etc.)
├── event-store.ts        # hippocampus.json CRUD
├── cue-index.ts          # Cue index builder (Phase 2)
├── cue-recall.ts         # Recall algorithm (Phase 2)
└── consolidation.ts       # Neocortex transfer + decay (Phase 3)

src/templates/
├── hippocampus.json      # Template for openwolf init
└── cue-index.json       # Template for cue-index (Phase 2)

src/hooks/
├── post-write.ts         # Wire: addEvent() call
├── pre-read.ts           # Wire: trauma warnings
└── pre-write.ts          # Wire: penalty warnings (Phase 2)

src/cli/
├── init.ts               # Wire: create hippocampus.json
└── recall.ts             # Recall CLI command (Phase 2)
```

---

## Core Types

```typescript
type Valence = "reward" | "neutral" | "penalty" | "trauma";
type ActionType = "read" | "write" | "edit" | "delete" | "execute" | "correct" | "approve" | "reject" | "discover" | "fix" | "refactor";
type ConsolidationStage = "short-term" | "consolidating" | "long-term";

interface WolfEvent {
  id: string;
  version: 1;
  timestamp: string;
  session_id: string;
  context: EventContext;
  action: EventAction;
  outcome: EventOutcome;
  consolidation: EventConsolidation;
  source: "hook" | "daemon" | "manual";
  tags: string[];
}
```

---

## Verification Commands

```bash
# Build
pnpm build

# Runtime test
cd /tmp/test-project
openwolf init
echo '// test' > src/test.ts
# Edit file in Claude
# Check .wolf/hippocampus.json has new event

# Trauma warning test
# Edit same file 3 times (creates trauma)
# Pre-read should show warning
```
