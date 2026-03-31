// ─────────────────────────────────────────────
//  Run types — matches webapp/core/models.py
// ─────────────────────────────────────────────

export type RunStatus =
  | "running"
  | "checkpoint"
  | "completed"
  | "error"
  | "saved_draft";

export interface RunListItem {
  run_id: string;
  squad: string;
  status: RunStatus;
  started_at: string;
  current_step?: string | null;
}

// ─────────────────────────────────────────────
//  Checkpoint payloads — mirrors checkpoint_handler.py
// ─────────────────────────────────────────────

export interface CheckpointOption {
  value: string;
  label: string;
  description?: string;
}

export interface CheckpointAction {
  action: string;
  label: string;
  style: "primary" | "secondary" | "danger" | "ghost";
  has_feedback?: boolean;
}

export interface Story {
  headline: string;
  source?: string;
  url?: string;
  published_date?: string;
  viral_potential_score?: number;
  why_interesting?: string;
  key_data?: string;
}

export interface Hook {
  letter: string;
  driver: string;
  text: string;
  rationale: string;
}

export interface CheckpointPayload {
  step_id: string;
  step_name: string;
  type:
    | "period_selection"
    | "story_selection"
    | "hook_selection"
    | "draft_review"
    | "quality_decision"
    | "design_approval"
    | "generic";
  title: string;
  subtitle: string;
  // period_selection
  options?: CheckpointOption[];
  // story_selection
  stories?: Story[];
  // hook_selection
  brief_md?: string;
  hooks?: Hook[];
  // draft_review
  draft_md?: string;
  // quality_decision
  review_md?: string;
  verdict?: string;
  // design_approval
  slides?: string[];
  run_id?: string;
  // most types
  actions?: CheckpointAction[];
}

// ─────────────────────────────────────────────
//  SSE event union
// ─────────────────────────────────────────────

export type SSEEvent =
  | {
      event: "step_start";
      data: {
        step_id: string;
        step_name: string;
        agent_id: string;
        agent_name: string;
        agent_icon: string;
      };
    }
  | { event: "agent_token"; data: { token: string } }
  | {
      event: "step_done";
      data: { step_id: string; step_name: string; agent_id: string };
    }
  | { event: "checkpoint"; data: CheckpointPayload }
  | { event: "checkpoint_resolved"; data: { step_id: string; action: string } }
  | {
      event: "run_complete";
      data: { run_id: string; status: string; message: string };
    }
  | { event: "run_error"; data: { error: string; detail?: string } }
  | { event: "ping"; data: Record<string, never> };
