// Hippocampus Memory System — Main Module

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type {
  WolfEvent,
  HippocampusStore,
  HippoStats,
  RecallFilters,
  RecallRequest,
  RecallResponse,
  CueIndex,
} from "./types.js";
import {
  createEmptyStore,
  loadStore,
  saveStore,
  addEventToStore,
  getTraumaEventsForPath,
  filterEvents,
} from "./event-store.js";
import {
  buildIndex,
  loadIndex,
  saveIndex,
  addEventToIndex,
  createEmptyIndex,
  getCueIndexPath,
  indexNeedsRebuild,
} from "./cue-index.js";
import { recallEvents } from "./cue-recall.js";
import {
  createEmptyNeocortex,
  loadNeocortex,
  saveNeocortex,
  runConsolidation,
  getNeocortexEvents,
  type NeocortexStore,
  type ConsolidationReport,
} from "./consolidation.js";

export type { NeocortexStore, ConsolidationReport };

export type {
  WolfEvent,
  HippocampusStore,
  HippoStats,
  RecallFilters,
  RecallRequest,
  RecallResponse,
  CueIndex,
};

export class Hippocampus {
  private projectRoot: string;
  private hippocampusPath: string;
  private cueIndexPath: string;
  private neocortexPath: string;
  private store: HippocampusStore | null = null;
  private cueIndex: CueIndex | null = null;
  private neocortex: NeocortexStore | null = null;
  private eventCountSinceIndexPersist: number = 0;
  private static readonly BATCH_SIZE = 10; // Persist index every 10 events

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.hippocampusPath = path.join(projectRoot, ".wolf", "hippocampus.json");
    this.cueIndexPath = path.join(projectRoot, ".wolf", "cue-index.json");
    this.neocortexPath = path.join(projectRoot, ".wolf", "neocortex.json");
  }

  private ensureLoaded(): HippocampusStore {
    if (!this.store) {
      this.store = loadStore(this.hippocampusPath);
      if (!this.store) {
        this.store = createEmptyStore(this.projectRoot);
        saveStore(this.hippocampusPath, this.store);
      }
    }
    return this.store;
  }

  private ensureIndexLoaded(): CueIndex {
    if (!this.cueIndex) {
      const loadedIndex = loadIndex(this.cueIndexPath);

      // Check if index needs rebuild
      const store = this.ensureLoaded();
      if (indexNeedsRebuild(loadedIndex, store.buffer.length)) {
        this.cueIndex = buildIndex(store.buffer);
        this.persistIndex();
      } else {
        this.cueIndex = loadedIndex!;
      }
    }
    return this.cueIndex;
  }

  private ensureNeocortexLoaded(): NeocortexStore {
    if (!this.neocortex) {
      const loaded = loadNeocortex(this.neocortexPath);
      if (loaded) {
        this.neocortex = loaded;
      } else {
        this.neocortex = createEmptyNeocortex(this.projectRoot);
        saveNeocortex(this.neocortexPath, this.neocortex);
      }
    }
    return this.neocortex;
  }

  private persistNeocortex(): void {
    if (this.neocortex) {
      saveNeocortex(this.neocortexPath, this.neocortex);
    }
  }

  private save(): void {
    if (this.store) {
      saveStore(this.hippocampusPath, this.store);
    }
  }

  private persistIndex(): void {
    if (this.cueIndex) {
      saveIndex(this.cueIndexPath, this.cueIndex);
      this.eventCountSinceIndexPersist = 0;
    }
  }

  /**
   * Add a new event to the hippocampus buffer.
   */
  addEvent(
    eventData: Omit<WolfEvent, "id" | "consolidation">
  ): WolfEvent {
    const store = this.ensureLoaded();
    const index = this.ensureIndexLoaded();

    const event: WolfEvent = {
      ...eventData,
      id: `evt-${crypto.randomUUID()}`,
      consolidation: {
        stage: "short-term",
        access_count: 0,
        last_accessed: eventData.timestamp,
        consolidation_score: 0,
        should_consolidate: false,
        decay_factor: 1.0,
        last_decay_check: eventData.timestamp,
      },
    };

    addEventToStore(store, event);
    this.save();

    // Update cue index
    addEventToIndex(index, event);
    this.eventCountSinceIndexPersist++;

    // Batch persist index every BATCH_SIZE events
    if (this.eventCountSinceIndexPersist >= Hippocampus.BATCH_SIZE) {
      this.persistIndex();
    }

    return event;
  }

  /**
   * Get all trauma events for a specific file path.
   */
  getTraumas(filePath?: string): WolfEvent[] {
    const store = this.ensureLoaded();
    if (filePath) {
      return getTraumaEventsForPath(store, filePath);
    }
    return store.buffer.filter((e) => e.outcome.valence === "trauma");
  }

  /**
   * Get recent events from the buffer.
   */
  getRecentEvents(limit: number = 10): WolfEvent[] {
    const store = this.ensureLoaded();
    return store.buffer
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);
  }

  /**
   * Get events matching filters.
   */
  getEvents(filters?: RecallFilters): WolfEvent[] {
    const store = this.ensureLoaded();
    if (!filters) {
      return store.buffer;
    }
    return filterEvents(store, filters);
  }

  /**
   * Recall events matching a cue using scoring algorithm.
   * Uses pre-computed cue index for fast lookup.
   */
  recall(request: RecallRequest): RecallResponse {
    const store = this.ensureLoaded();
    const index = this.ensureIndexLoaded();

    return recallEvents(store.buffer, request.cue, request, index);
  }

  /**
   * Run consolidation pass to transfer events from short-term to long-term memory.
   * Returns a report of actions taken.
   */
  consolidate(options?: { maxToPromote?: number }): ConsolidationReport {
    const store = this.ensureLoaded();
    const neocortex = this.ensureNeocortexLoaded();

    const report = runConsolidation(store, neocortex, {
      maxToPromote: options?.maxToPromote ?? 50,
    });

    this.save();
    this.persistNeocortex();

    return report;
  }

  /**
   * Get events from long-term (neocortex) memory.
   */
  getLongTermMemory(filters?: {
    valence?: string[];
    minIntensity?: number;
    limit?: number;
  }): WolfEvent[] {
    const neocortex = this.ensureNeocortexLoaded();
    return getNeocortexEvents(neocortex, filters);
  }

  /**
   * Get neocortex store statistics.
   */
  getNeocortexStats(): { total_consolidated: number; by_valence: Record<string, number>; last_consolidation: string | null } {
    const neocortex = this.ensureNeocortexLoaded();
    return {
      total_consolidated: neocortex.stats.total_consolidated,
      by_valence: { ...neocortex.stats.by_valence },
      last_consolidation: neocortex.stats.last_consolidation,
    };
  }

  /**
   * Check if neocortex store exists.
   */
  neocortexExists(): boolean {
    return fs.existsSync(this.neocortexPath);
  }

  /**
   * Get statistics about the hippocampus store.
   */
  getStats(): HippoStats {
    const store = this.ensureLoaded();
    const neocortex = this.ensureNeocortexLoaded();
    return {
      total_events: store.stats.total_events,
      buffer_size: store.buffer.length,
      trauma_count: store.stats.trauma_count,
      reward_count: store.stats.reward_count,
      penalty_count: store.stats.penalty_count,
      neutral_count: store.stats.neutral_count,
      last_consolidation: neocortex.stats.last_consolidation,
    };
  }

  /**
   * Check if hippocampus store exists.
   */
  exists(): boolean {
    return fs.existsSync(this.hippocampusPath);
  }
}

// Singleton instance for use in hooks
export function createHippocampus(projectRoot: string): Hippocampus {
  return new Hippocampus(projectRoot);
}
