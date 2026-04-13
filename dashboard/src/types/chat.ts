export type ChatRole = "agent" | "human" | "system" | "checkpoint";

export interface AgentMeta {
  id: string;
  name: string;
  icon: string;
}

export interface CheckpointOption {
  value: string;
  label: string;
  description?: string;
}

export interface CheckpointHook {
  letter: string;
  driver: string;
  text: string;
  rationale: string;
}

export interface CheckpointStory {
  rank?: number;
  title: string;
  summary?: string;
  source?: string;
  relevance?: string;
  angle?: string;
  why_interesting?: string;
  viral_score?: number | string;
  url?: string;
  date?: string;
}

export interface CheckpointAction {
  action: string;
  label: string;
  style: "primary" | "secondary" | "danger" | "ghost";
  has_feedback?: boolean;
}

export interface CheckpointPayload {
  type: "period_selection" | "story_selection" | "content_review" | "design_approval" | "generic";
  title: string;
  subtitle?: string;
  // period_selection
  options?: CheckpointOption[];
  // story_selection
  stories?: CheckpointStory[];
  // content_review
  draft_md?: string;
  review_md?: string;
  verdict?: string;
  // design_approval
  slides?: string[];
  card_html_url?: string;
  caption?: string;
  run_id?: string;
  // actions
  actions?: CheckpointAction[];
}

export type ChatMessage =
  | {
      id: string;
      type: "agent_start";
      agent: AgentMeta;
      stepId: string;
      stepName: string;
      timestamp: string;
    }
  | {
      id: string;
      type: "agent_token";
      agentId: string;
      token: string;
    }
  | {
      id: string;
      type: "agent_output";
      agent: AgentMeta;
      stepId: string;
      stepName: string;
      timestamp: string;
    }
  | {
      id: string;
      type: "checkpoint";
      stepId: string;
      stepName: string;
      payload: CheckpointPayload;
      resolved: boolean;
      resolution?: { action: string; feedback?: string };
      timestamp: string;
    }
  | {
      id: string;
      type: "human";
      content: string;
      timestamp: string;
    }
  | {
      id: string;
      type: "system";
      content: string;
      variant: "info" | "success" | "error" | "warning";
      timestamp: string;
    };
