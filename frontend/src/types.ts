// Mirrors backend/models.py
export type Move = "silent" | "confess";
export type AvatarId = "jujubee" | "yoshi" | "kimchi";
export type Phase = "interrogation" | "matrix" | "challenge" | "complete";
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
  predicted_partner: Move | null;
  prediction_correct: boolean | null;
}

export interface Award {
  reason: string;
  points: number;
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
  tutor_questions_left: number;
  challenge_attempts: number;
  dominant_found: boolean | null;
  score: number;
  streak: number;
  best_streak: number;
  badges: string[];
  last_awards: Award[];
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
  preview?: boolean;
}

export interface PayoffTable {
  rows: string[]; // your move
  cols: string[]; // Tung Tung Tung Sahur's move
  cells: [number, number][][]; // years in jail (you, Tung Tung Tung Sahur)
}

// ---------- Door 3: The Ultimatum (mirrors backend/game/ultimatum.py) ----------
export type UPhase = "propose" | "respond" | "challenge" | "complete";

export interface URound {
  round: number;
  proposer: "player" | "tung";
  offer_to_responder: number;
  accepted: boolean;
  player_gets: number;
  tung_gets: number;
  tung_line: string;
  overridden: boolean;
}

export interface UltimatumView {
  session_id: string;
  avatar: AvatarId;
  phase: UPhase;
  round: number;
  max_rounds: number;
  proposer: "player" | "tung" | null;
  pending_offer_to_player: number | null;
  pot: number;
  step: number;
  player_total: number;
  tung_total: number;
  rounds: URound[];
  tutor_questions_left: number;
  challenge_attempts: number;
  challenge_found: boolean | null;
  challenge_options: string[];
  llm_calls_used: number;
  llm_calls_limit: number;
  messages: Message[];
}

export interface UltTurn {
  new_messages: Message[];
  correct: boolean | null;
  state: UltimatumView;
}
