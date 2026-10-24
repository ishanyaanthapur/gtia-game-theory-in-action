// Mirrors backend/models.py
export type Move = "silent" | "confess";
export type AvatarId = "jujubee" | "yoshi" | "kimchi";
export type Phase = "interrogation" | "matrix" | "complete";
export type Speaker = "cop" | "partner" | "tutor" | "player" | "system";

export interface Message {
  speaker: Speaker;
  text: string;
  mood?: string | null;
}

export interface RoundResult {
  round: number;
  player_move: Move;
  partner_move: Move;
  player_years: number;
  partner_years: number;
  partner_forced: boolean;
  partner_overridden: boolean;
  partner_line: string;
  cell_answered: boolean;
  cell_attempts: number;
}

export interface MatrixCell {
  player_move: Move;
  partner_move: Move;
  revealed: boolean;
  player_years: number | null;
  partner_years: number | null;
}

export interface SessionView {
  session_id: string;
  avatar: AvatarId;
  phase: Phase;
  round: number;
  max_rounds: number;
  locked_moves: Move[];
  cop_messages_left: number;
  llm_calls_used: number;
  llm_calls_limit: number;
  matrix: MatrixCell[];
  history: RoundResult[];
  messages: Message[];
}

export interface TurnResponse {
  new_messages: Message[];
  correct: boolean | null;
  state: SessionView;
}

export interface Usage {
  agent_runs: number;
  requests: number;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
}

export interface QuizQuestion {
  id: string;
  concept: string;
  prompt: string;
  options: string[];
}

export interface QuizResultItem {
  id: string;
  concept: string;
  chosen: number | null;
  answer: number;
  correct: boolean;
  explanation: string;
}

export interface QuizResult {
  phase: "pre" | "post";
  score: number;
  total: number;
  results: QuizResultItem[];
  pre: { question_id: string; concept: string; correct_before: boolean; correct_after: boolean } | null;
  minutes_since_pre: number | null;
}

export interface QuizSubmission {
  participant_id: string;
  phase: "pre" | "post";
  answers: Record<string, number | null>; // question id -> option index (null = "Not sure")
  confidence?: number | null;
  rating?: number | null;
  feedback?: string | null;
  consent_quote?: boolean;
  session_id?: string | null;
}

export interface PayoffTable {
  rows: string[]; // your move
  cols: string[]; // Tung Tung Tung Sahur's move
  cells: [number, number][][]; // years in jail (you, Tung Tung Tung Sahur)
}
