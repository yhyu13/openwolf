# Hippocampus Memory System — Implementation Plan

> **Status**: Phase 1 complete | Phase 2 pending
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
**Verification**: Build passes, `openwolf init` creates hippocampus.json

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
- [ ] File edit creates event in hippocampus.json (runtime test pending)
- [ ] Pre-read shows trauma warning (runtime test pending)

---

## Phase 2: Basic Recall

**Target**: 2 sessions
**Prerequisite**: Phase 1 complete

- [ ] Implement recall() with scoring (location match, recency, intensity)
- [ ] Build cue-index.json for fast path → event lookup
- [ ] Enhance valence detection (recurring edits, user correction language)

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
├── event-store.ts         # hippocampus.json CRUD
├── cue-recall.ts         # Recall algorithm + cue-index (Phase 2)
└── consolidation.ts       # Neocortex transfer + decay (Phase 3)

src/templates/
└── hippocampus.json      # Template for openwolf init

src/hooks/
├── post-write.ts         # Wire: addEvent() call
└── pre-read.ts           # Wire: trauma warnings

src/cli/
└── init.ts               # Wire: create hippocampus.json
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
