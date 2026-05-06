// Hippocampus Memory System — Cue Index
// Phase 2: Fast lookup index for recall

import * as fs from "fs";
import * as path from "path";
import type { WolfEvent, CueIndex } from "./types.js";

// ============================================================
// Constants
// ============================================================

const CUE_INDEX_FILENAME = "cue-index.json";

// ============================================================
// Index Building
// ============================================================

/**
 * Build a new CueIndex from an array of WolfEvents.
 * Events are sorted by recency (most recent first) within each index.
 */
export function buildIndex(events: WolfEvent[]): CueIndex {
  const index: CueIndex = {
    version: 1,
    last_updated: new Date().toISOString(),
    location_index: {},
    tag_index: {},
    trauma_index: {
      all_trauma_ids: [],
      by_path: {},
    },
  };

  // Sort events by timestamp desc (most recent first)
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  for (const event of sorted) {
    // Location index - index each file involved
    for (const file of event.context.files_involved) {
      if (!index.location_index[file]) {
        index.location_index[file] = [];
      }
      // Avoid duplicates
      if (!index.location_index[file].includes(event.id)) {
        index.location_index[file].push(event.id);
      }
    }

    // Tag index
    for (const tag of event.tags) {
      if (!index.tag_index[tag]) {
        index.tag_index[tag] = [];
      }
      if (!index.tag_index[tag].includes(event.id)) {
        index.tag_index[tag].push(event.id);
      }
    }

    // Trauma index - special fast track for warnings
    if (event.outcome.valence === "trauma") {
      index.trauma_index.all_trauma_ids.push(event.id);
      for (const file of event.context.files_involved) {
        if (!index.trauma_index.by_path[file]) {
          index.trauma_index.by_path[file] = [];
        }
        if (!index.trauma_index.by_path[file].includes(event.id)) {
          index.trauma_index.by_path[file].push(event.id);
        }
      }
    }
  }

  // Sort trauma IDs by intensity desc
  // We'll need the actual events to sort by intensity, so we do a second pass
  // For now, we'll sort when loading
  return index;
}

/**
 * Sort trauma IDs by intensity (highest first).
 * Requires access to events to get intensity values.
 */
export function sortTraumaByIntensity(
  traumaIds: string[],
  events: Map<string, WolfEvent>
): string[] {
  return [...traumaIds].sort((a, b) => {
    const eventA = events.get(a);
    const eventB = events.get(b);
    if (!eventA || !eventB) return 0;
    return eventB.outcome.intensity - eventA.outcome.intensity;
  });
}

// ============================================================
// Index Persistence
// ============================================================

/**
 * Get the path to cue-index.json given the project root
 */
export function getCueIndexPath(projectRoot: string): string {
  return path.join(projectRoot, ".wolf", CUE_INDEX_FILENAME);
}

/**
 * Load cue index from disk.
 * Returns null if file doesn't exist or is invalid.
 */
export function loadIndex(hippocampusPath: string): CueIndex | null {
  try {
    if (!fs.existsSync(hippocampusPath)) {
      return null;
    }
    const content = fs.readFileSync(hippocampusPath, "utf-8");
    const parsed = JSON.parse(content);

    // Validate structure
    if (
      typeof parsed.version !== "number" ||
      typeof parsed.location_index !== "object" ||
      typeof parsed.trauma_index !== "object"
    ) {
      return null;
    }

    return parsed as CueIndex;
  } catch {
    // Corrupted JSON or parse error
    return null;
  }
}

/**
 * Save cue index to disk
 */
export function saveIndex(hippocampusPath: string, index: CueIndex): void {
  const dir = path.dirname(hippocampusPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  index.last_updated = new Date().toISOString();
  fs.writeFileSync(hippocampusPath, JSON.stringify(index, null, 2), "utf-8");
}

// ============================================================
// Index Update Operations
// ============================================================

/**
 * Add a single event to the index (in-memory only)
 */
export function addEventToIndex(index: CueIndex, event: WolfEvent): void {
  // Location index
  for (const file of event.context.files_involved) {
    if (!index.location_index[file]) {
      index.location_index[file] = [];
    }
    if (!index.location_index[file].includes(event.id)) {
      index.location_index[file].unshift(event.id); // Add to front (most recent)
    }
  }

  // Tag index
  for (const tag of event.tags) {
    if (!index.tag_index[tag]) {
      index.tag_index[tag] = [];
    }
    if (!index.tag_index[tag].includes(event.id)) {
      index.tag_index[tag].unshift(event.id);
    }
  }

  // Trauma index
  if (event.outcome.valence === "trauma") {
    index.trauma_index.all_trauma_ids.unshift(event.id);
    for (const file of event.context.files_involved) {
      if (!index.trauma_index.by_path[file]) {
        index.trauma_index.by_path[file] = [];
      }
      if (!index.trauma_index.by_path[file].includes(event.id)) {
        index.trauma_index.by_path[file].unshift(event.id);
      }
    }
  }
}

/**
 * Remove an event from the index (in-memory only)
 */
export function removeEventFromIndex(
  index: CueIndex,
  eventId: string
): void {
  // Location index
  for (const path of Object.keys(index.location_index)) {
    index.location_index[path] = index.location_index[path].filter(
      (id) => id !== eventId
    );
    if (index.location_index[path].length === 0) {
      delete index.location_index[path];
    }
  }

  // Tag index
  for (const tag of Object.keys(index.tag_index)) {
    index.tag_index[tag] = index.tag_index[tag].filter(
      (id) => id !== eventId
    );
    if (index.tag_index[tag].length === 0) {
      delete index.tag_index[tag];
    }
  }

  // Trauma index
  index.trauma_index.all_trauma_ids = index.trauma_index.all_trauma_ids.filter(
    (id) => id !== eventId
  );
  for (const path of Object.keys(index.trauma_index.by_path)) {
    index.trauma_index.by_path[path] = index.trauma_index.by_path[path].filter(
      (id) => id !== eventId
    );
    if (index.trauma_index.by_path[path].length === 0) {
      delete index.trauma_index.by_path[path];
    }
  }
}

/**
 * Create an empty cue index template
 */
export function createEmptyIndex(): CueIndex {
  return {
    version: 1,
    last_updated: new Date().toISOString(),
    location_index: {},
    tag_index: {},
    trauma_index: {
      all_trauma_ids: [],
      by_path: {},
    },
  };
}

// ============================================================
// Index Verification
// ============================================================

/**
 * Check if an index needs rebuilding (stale or corrupted)
 */
export function indexNeedsRebuild(
  index: CueIndex | null,
  eventCount: number
): boolean {
  if (index === null) return true;

  // Check if index is empty but events exist
  const indexEventCount = new Set([
    ...Object.values(index.location_index).flat(),
  ]).size;

  if (indexEventCount === 0 && eventCount > 0) {
    return true;
  }

  return false;
}
