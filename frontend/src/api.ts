import type { AvatarId, Move, TurnResponse, Usage } from "./types";

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
  move: (id: string, move: Move) => call<TurnResponse>(`/session/${id}/move`, { move }),
  cell: (id: string, player_years: number, partner_years: number) =>
    call<TurnResponse>(`/session/${id}/cell`, { player_years, partner_years }),
  usage: (id: string) => call<Usage>(`/session/${id}/usage`),
};
