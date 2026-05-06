// Hippocampus Memory System — Main Module
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { createEmptyStore, loadStore, saveStore, addEventToStore, getTraumaEventsForPath, filterEvents, } from "./event-store.js";
export class Hippocampus {
    projectRoot;
    hippocampusPath;
    store = null;
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.hippocampusPath = path.join(projectRoot, ".wolf", "hippocampus.json");
    }
    ensureLoaded() {
        if (!this.store) {
            this.store = loadStore(this.hippocampusPath);
            if (!this.store) {
                this.store = createEmptyStore(this.projectRoot);
                saveStore(this.hippocampusPath, this.store);
            }
        }
        return this.store;
    }
    save() {
        if (this.store) {
            saveStore(this.hippocampusPath, this.store);
        }
    }
    /**
     * Add a new event to the hippocampus buffer.
     */
    addEvent(eventData) {
        const store = this.ensureLoaded();
        const event = {
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
        return event;
    }
    /**
     * Get all trauma events for a specific file path.
     */
    getTraumas(filePath) {
        const store = this.ensureLoaded();
        if (filePath) {
            return getTraumaEventsForPath(store, filePath);
        }
        return store.buffer.filter((e) => e.outcome.valence === "trauma");
    }
    /**
     * Get recent events from the buffer.
     */
    getRecentEvents(limit = 10) {
        const store = this.ensureLoaded();
        return store.buffer
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }
    /**
     * Get events matching filters.
     */
    getEvents(filters) {
        const store = this.ensureLoaded();
        if (!filters) {
            return store.buffer;
        }
        return filterEvents(store, filters);
    }
    /**
     * Get statistics about the hippocampus store.
     */
    getStats() {
        const store = this.ensureLoaded();
        return {
            total_events: store.stats.total_events,
            buffer_size: store.buffer.length,
            trauma_count: store.stats.trauma_count,
            reward_count: store.stats.reward_count,
            penalty_count: store.stats.penalty_count,
            neutral_count: store.stats.neutral_count,
            last_consolidation: null, // TODO: track this
        };
    }
    /**
     * Check if hippocampus store exists.
     */
    exists() {
        return fs.existsSync(this.hippocampusPath);
    }
}
// Singleton instance for use in hooks
export function createHippocampus(projectRoot) {
    return new Hippocampus(projectRoot);
}
