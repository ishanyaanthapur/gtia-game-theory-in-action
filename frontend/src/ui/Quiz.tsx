// Before/after understanding check. Before: ONE rotating question. After: all 5 + ratings.
// Learning gain = that one question, before vs after, for the same player.
import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import type { QuizQuestion, QuizResult } from "../types";

const NOT_SURE = -1;

interface Props {
  phase: "pre" | "post";
  participantId: string;
  sessionId?: string | null;
  onDone: (result: QuizResult) => void;
  onSkip?: () => void;
}

export function Quiz({ phase, participantId, sessionId, onDone, onSkip }: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [scenario, setScenario] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [confidence, setConfidence] = useState<number | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.quiz(phase).then((d) => (setQuestions(d.questions), setScenario(d.scenario))).catch(() => setError("Couldn't load the questions. Is the server running?"));
  }, []);

  const complete = questions.length > 0 && questions.every((q) => q.id in answers) && (phase === "pre" || (confidence !== null && rating !== null));

  const submit = async () => {
    if (!complete || sending) return;
    setSending(true);
    try {
      const result = await api.submitQuiz({
        participant_id: participantId,
        phase,
        answers: Object.fromEntries(questions.map((q) => [q.id, answers[q.id] === NOT_SURE ? null : answers[q.id]])),
        confidence: phase === "post" ? confidence : null,
        rating: phase === "post" ? rating : null,
        feedback: phase === "post" && feedback.trim() ? feedback.trim() : null,
        consent_quote: phase === "post" && consent,
        session_id: sessionId ?? null,
      });
      onDone(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't submit. Is the server running?");
      setSending(false);
    }
  };

  return (
    <div className="screen quiz-screen">
      <div className="quiz-card">
        <p className="eyebrow">{phase === "pre" ? "Before you play" : "After the game"}</p>
        <h1>{phase === "pre" ? "One quick question before you play" : "Now, what did you learn?"}</h1>
        <p className="sub">
          {phase === "pre"
            ? "Just one, and \"Not sure\" is a perfectly good answer. We'll ask again after the game to see what it taught you."
            : "5 quick questions (including the one you saw before). Then you'll see your before vs. after and what each question was testing."}
        </p>

        {scenario && (
          <div className="scenario">
            <b>The scenario</b>
            {scenario}
          </div>
        )}

        {questions.map((q, i) => (
          <fieldset key={q.id} className="quiz-q">
            <legend>
              <span className="q-num">{i + 1}</span> {q.prompt}
            </legend>
            <div className="quiz-options">
              {q.options.map((opt, j) => (
                <button key={j} className={`quiz-opt ${answers[q.id] === j ? "picked" : ""}`} onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: j }))}>
                  {opt}
                </button>
              ))}
              <button className={`quiz-opt unsure ${answers[q.id] === NOT_SURE ? "picked" : ""}`} onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: NOT_SURE }))}>
                Not sure
              </button>
            </div>
          </fieldset>
        ))}

        {phase === "post" && (
          <>
            <Scale
              label="How confident would you be explaining the Prisoner's Dilemma to a friend now?"
              low="Not at all"
              high="Very"
              value={confidence}
              onChange={setConfidence}
            />
            <Scale label="How useful was the game for learning this?" low="Not useful" high="Very useful" value={rating} onChange={setRating} />
            <fieldset className="quiz-q">
              <legend>What did you learn, or what was confusing? (optional)</legend>
              <textarea maxLength={500} rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="e.g. I finally get why both confessing is the equilibrium…" />
            </fieldset>
            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> You can quote my feedback anonymously in the class report.
            </label>
          </>
        )}

        {error && <p className="quiz-error">⚠️ {error}</p>}
        <div className="quiz-actions">
          {onSkip ? (
            <button className="ghost" onClick={onSkip}>Skip</button>
          ) : (
            <span />
          )}
          <button className="primary big" disabled={!complete || sending} onClick={submit}>
            {sending ? "Saving…" : phase === "pre" ? "Start the game →" : "See my results →"}
          </button>
        </div>
        <p className="fine">Anonymous: we store your answers with a random ID, never your name.</p>
      </div>
    </div>
  );
}

function Scale({ label, low, high, value, onChange }: { label: string; low: string; high: string; value: number | null; onChange: (n: number) => void }) {
  return (
    <fieldset className="quiz-q">
      <legend>{label}</legend>
      <div className="scale">
        <small>{low}</small>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={`scale-btn ${value === n ? "picked" : ""}`} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
        <small>{high}</small>
      </div>
    </fieldset>
  );
}

export function QuizResults({ result, onContinue }: { result: QuizResult; onContinue: () => void }) {
  const pre = result.pre;
  const mark = (ok: boolean) => (ok ? "✓ Right" : "✗ Not yet");
  return (
    <div className="screen quiz-screen">
      <div className="quiz-card">
        <p className="eyebrow">Your results</p>
        {pre && (
          <>
            <h1 style={{ textAlign: "center" }}>{pre.concept}</h1>
            <p className="sub" style={{ textAlign: "center", marginBottom: 6 }}>The question you saw before the game:</p>
            <div className="score-compare">
              <div className={`score-box ${pre.correct_before ? "after" : ""}`}>
                <small>Before</small>
                <strong>{mark(pre.correct_before)}</strong>
              </div>
              <span className="arrow">→</span>
              <div className={`score-box ${pre.correct_after ? "after" : ""}`}>
                <small>After</small>
                <strong>{mark(pre.correct_after)}</strong>
              </div>
            </div>
          </>
        )}
        <p className="sub" style={{ textAlign: "center" }}>
          All 5 questions after the game: <b style={{ color: "var(--text)" }}>{result.score}/{result.total}</b>
          {result.minutes_since_pre !== null && ` · learned in about ${Math.max(1, Math.round(result.minutes_since_pre))} min`}
        </p>
        <ul className="result-list">
          {result.results.map((r) => (
            <li key={r.id} className={r.correct ? "ok" : "miss"}>
              <b>{r.correct ? "✓" : "✗"} {r.concept}</b>
              <span>{r.explanation}</span>
            </li>
          ))}
        </ul>
        <div className="quiz-actions" style={{ justifyContent: "center" }}>
          <button className="primary big" onClick={onContinue}>Back to the hall →</button>
        </div>
      </div>
    </div>
  );
}
