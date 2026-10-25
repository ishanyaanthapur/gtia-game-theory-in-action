import type { AvatarId, Move, PayoffTable, QuizQuestion, UltTurn, QuizResult, QuizSubmission, TurnResponse, Usage } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = typeof data.detail === "string" ? data.detail : "That input isn't valid.";
    } catch {
      /* non-JSON error */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  newSession: (avatar: AvatarId) => call<TurnResponse>("/session", { avatar }),
  chat: (id: string, message: string) => call<TurnResponse>(`/session/${id}/chat`, { message }),
  move: (id: string, move: Move, prediction: Move | null = null) =>
    call<TurnResponse>(`/session/${id}/move`, { move, prediction }),
  cell: (id: string, player_years: number, partner_years: number) =>
    call<TurnResponse>(`/session/${id}/cell`, { player_years, partner_years }),
  tutor: (id: string, message: string) => call<TurnResponse>(`/session/${id}/tutor`, { message }),
  dominant: (id: string, move: Move) => call<TurnResponse>(`/session/${id}/dominant`, { move }),
  ultStart: (avatar: AvatarId) => call<UltTurn>("/ultimatum", { avatar }),
  ultOffer: (id: string, offer_to_tung: number) => call<UltTurn>(`/ultimatum/${id}/offer`, { offer_to_tung }),
  ultRespond: (id: string, accept: boolean) => call<UltTurn>(`/ultimatum/${id}/respond`, { accept }),
  ultTutor: (id: string, message: string) => call<UltTurn>(`/ultimatum/${id}/tutor`, { message }),
  ultAnswer: (id: string, choice: number) => call<UltTurn>(`/ultimatum/${id}/answer`, { choice }),
  usage: (id: string) => call<Usage>(`/session/${id}/usage`),
  quiz: (phase: "pre" | "post") =>
    call<{ scenario: string; questions: QuizQuestion[]; matrix: PayoffTable | null }>(`/quiz?phase=${phase}`),
  submitQuiz: (body: QuizSubmission) => call<QuizResult>("/quiz", body),
};
