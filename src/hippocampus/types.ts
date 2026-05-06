// Hippocampus Memory System — Type Definitions

export type Valence = "reward" | "neutral" | "penalty" | "trauma";

export type ActionType =
  | "read"
  | "write"
  | "edit"
  | "delete"
  | "execute"
  | "correct"
  | "approve"
  | "reject"
  | "discover"
  | "fix"
  | "refactor";

export type ConsolidationStage = "short-term" | "consolidating" | "long-term";

export interface EventContext {
  project_root: string;
  files_involved: string[];
  cwd_at_time: string;
  spatial_path: string;
  spatial_depth: number;
  session_start: string;
  turn_in_session: number;
  current_goal?: string;
  recent_errors?: string[];
}

export interface EventAction {
  type: ActionType;
  subtype?: string;
  description: string;
  tokens_spent: number;
  files_modified?: string[];
  files_read?: string[];
  succeeded?: boolean;
  error_message?: string;
}

export interface EventOutcome {
  valence: Valence;
  intensity: number;
  reflection: string;
  is_recurring?: boolean;
  first_event_id?: string;
  user_correction?: string;
}

export interface EventConsolidation {
  stage: ConsolidationStage;
  access_count: number;
  last_accessed: string;
  consolidation_score: number;
  should_consolidate: boolean;
  decay_factor: number;
  last_decay_check: string;
  forgotten?: boolean;
  forgotten_at?: string;
}

export interface WolfEvent {
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

export interface HippocampusStore {
  version: 1;
  schema_version: 1;
  project_root: string;
  created_at: string;
  last_updated: string;
  buffer: WolfEvent[];
  stats: {
    total_events: number;
    reward_count: number;
    penalty_count: number;
    trauma_count: number;
    neutral_count: number;
    oldest_event: string | null;
    newest_event: string | null;
  };
  size_bytes: number;
  max_size_bytes: number;
  retention_days: number;
  max_buffer_size: number;
}

export type QuestionType = "how-to" | "why-not" | "what-if" | "what-happened" | "general";

export interface RecallFilters {
  valence?: Valence[];
  min_intensity?: number;
  max_age_days?: number;
  tags?: string[];
  exclude_forgotten?: boolean;
}

export interface ConsolidationResult {
  event_id: string;
  action: "promote" | "merge" | "decay" | "forget" | "keep";
  new_location: string;
  details: string;
}

export interface HippoStats {
  total_events: number;
  buffer_size: number;
  trauma_count: number;
  reward_count: number;
  penalty_count: number;
  neutral_count: number;
  last_consolidation: string | null;
}

// ============================================================
// Phase 2: Cue and Recall Types
// ============================================================

export type CueType = "location" | "question" | "state";

export type LocationMatchMode = "exact" | "prefix" | "glob" | "parent" | "sibling";

export interface LocationCue {
  type: "location";
  path: string | string[];
  match_mode?: LocationMatchMode; // Default: "exact"
}

export interface QuestionCue {
  type: "question";
  query: string;
  entities?: string[];
  question_type?: QuestionType;
}

export interface StateCue {
  type: "state";
  goal?: string;
  error?: {
    type: string;
    message: string;
    file?: string;
    line?: number;
  };
  turn_count: number;
}

export type Cue = LocationCue | QuestionCue | StateCue;

export interface RecallRequest {
  cue: Cue;
  filters?: RecallFilters;
  limit?: number; // Default: 5
  offset?: number;
}

export interface MatchDetail {
  event_id: string;
  confidence: number;
  match_reasons: string[];
}

export interface RecallResponse {
  events: WolfEvent[];
  total_matches: number;
  confidence: number; // Average confidence of returned events
  match_details: MatchDetail[];
}

// ============================================================
// Phase 2: Cue Index Types
// ============================================================

export interface CueIndex {
  version: 1;
  last_updated: string;
  location_index: Record<string, string[]>; // path -> event IDs (recency-sorted)
  tag_index: Record<string, string[]>;
  trauma_index: {
    all_trauma_ids: string[]; // Sorted by intensity desc
    by_path: Record<string, string[]>; // path -> trauma event IDs
  };
}
