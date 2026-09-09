export type MessageRole = "system" | "user" | "assistant" | "tool";

export type SessionMessage = {
  id: string;
  role: MessageRole;
  content: string;
  /** Epoch ms when the message was appended */
  createdAt: number;
  /** Optional link to a tool-call record */
  toolCallId?: string;
};

export type ToolCallStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ToolCallRecord = {
  id: string;
  name: string;
  args: unknown;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
  /** Epoch ms */
  startedAt: number;
  /** Epoch ms when the tool finished (if finished) */
  endedAt?: number;
};

export type TimingRecord = {
  id: string;
  /** What was timed (e.g. "request", "tool:run_script", "think") */
  label: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Epoch ms when timing was recorded */
  recordedAt: number;
  toolCallId?: string;
};

export type ProviderSelection = {
  provider: string;
  model: string;
  /** Session-only credentials; never persisted by this store */
  credentials: Record<string, string>;
};

export type SessionSnapshot = {
  messages: SessionMessage[];
  toolCalls: ToolCallRecord[];
  timings: TimingRecord[];
  provider: ProviderSelection | null;
  interrupted: boolean;
};

export type AppendMessageInput = {
  role: MessageRole;
  content: string;
  toolCallId?: string;
};

export type StartToolCallInput = {
  name: string;
  args?: unknown;
};

export type FinishToolCallInput = {
  status: Extract<ToolCallStatus, "completed" | "failed" | "cancelled">;
  result?: unknown;
  error?: string;
};

export type RecordTimingInput = {
  label: string;
  durationMs: number;
  toolCallId?: string;
};
