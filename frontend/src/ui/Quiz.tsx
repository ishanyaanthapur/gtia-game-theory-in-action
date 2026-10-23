// Before/after understanding check. Same 5 questions both times; the score change is the learning gain.
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
    api.quiz().then((d) => (setQuestions(d.questions), setScenario(d.scenario))).catch(() => setError("Couldn't load the questions. Is the server running?"));
  }, []);

  const complete = questions.length > 0 && questions.every((q) => q.id in answers) && confidence !== null && (phase === "pre" || rating !== null);

  const submit = async () => {
    if (!complete || sending) return;
    setSending(true);
    try {
      const result = await api.submitQuiz({
        participant_id: participantId,
        phase,
        answers: questions.map((q) => (answers[q.id] === NOT_SURE ? null : answers[q.id])),
        confidence: confidence!,
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
        <h1>{phase === "pre" ? "Quick check: what do you already know?" : "Same questions, one more time"}</h1>
        <p className="sub">
          {phase === "pre"
            ? "5 questions, about a minute. Guessing is totally fine, and \"Not sure\" is a great answer. We ask the same questions after the game to see what it taught you."
            : "Answer the same 5 questions again. Then you'll see your before vs. after score and what each question was testing."}
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

        <Scale
          label="How confident would you be explaining the Prisoner's Dilemma to a friend?"
          low="Not at all"
          high="Very"
          value={confidence}
          onChange={setConfidence}
        />

        {phase === "post" && (
          <>
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
  const gain = result.pre_score !== null ? result.score - result.pre_score : null;
  return (
    <div className="screen quiz-screen">
      <div className="quiz-card">
        <p className="eyebrow">Your results</p>
        <div className="score-compare">
          {result.pre_score !== null && (
            <>
              <div className="score-box">
                <small>Before</small>
                <strong>{result.pre_score}/{result.total}</strong>
              </div>
              <span className="arrow">→</span>
            </>
          )}
          <div className="score-box after">
            <small>After</small>
            <strong>{result.score}/{result.total}</strong>
          </div>
        </div>
        {gain !== null && (
          <p className="sub" style={{ textAlign: "center" }}>
            {gain > 0 ? `+${gain} question${gain > 1 ? "s" : ""}, nice! ` : gain === 0 ? "Same score. " : ""}
            {result.minutes_since_pre !== null && `Learned in about ${Math.max(1, Math.round(result.minutes_since_pre))} min.`}
          </p>
        )}
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
