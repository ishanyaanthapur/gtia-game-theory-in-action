import { useEffect, useRef, useState } from "react";
import { audio } from "../audio/engine";
import type { MatrixCell, Move, SessionView } from "../types";

const LABEL: Record<Move, string> = { silent: "Silent", confess: "Confess" };
const ROWS: Move[] = ["silent", "confess"];

interface Props {
  view: SessionView;
  busy: boolean;
  wrongPulse: number; // increments on each wrong answer to retrigger the shake
  onSubmit: (you: number, them: number) => void;
  highlight?: number; // bump to (re)play the dominant-strategy highlight
  onReplay?: () => void;
}

// ---------- dominant-strategy highlight: a short guided animation over the finished matrix ----------
type Key = `${Move},${Move}`; // "<your move>,<partner move>"
interface Step {
  caption: string;
  youWin?: Key[];
  youLose?: Key[];
  themWin?: Key[];
  themLose?: Key[];
  row?: Move; // your dominant row
  col?: Move; // partner's dominant column
  ne?: Key; // Nash equilibrium
  pareto?: Key; // better for both
}
const STEPS: Step[] = [
  {
    caption: "If Tung Tung Tung Sahur stays silent: Confess gives you 0 years instead of 1. Confess wins.",
    youWin: ["confess,silent"],
    youLose: ["silent,silent"],
  },
  {
    caption: "If he confesses: Confess gives you 2 years instead of 3. Confess wins again.",
    youWin: ["confess,confess"],
    youLose: ["silent,confess"],
  },
  {
    caption: "Confess is better for you no matter what he does: it's YOUR dominant strategy.",
    youWin: ["confess,silent", "confess,confess"],
    row: "confess",
  },
  {
    caption: "Same for Tung Tung Tung Sahur: 0 < 1 and 2 < 3, so Confess is dominant for him too.",
    themWin: ["silent,confess", "confess,confess"],
    themLose: ["silent,silent", "confess,silent"],
    col: "confess",
  },
  {
    caption: "Both confess → (2, 2): the Nash equilibrium. Yet (1, 1) is better for both. That's the dilemma!",
    row: "confess",
    col: "confess",
    ne: "confess,confess",
    pareto: "silent,silent",
  },
];
const STEP_MS = 4800; // ~4.8 s per step so players can read each comparison

export function PayoffMatrix({ view, busy, wrongPulse, onSubmit, highlight = 0, onReplay }: Props) {
  const current = view.phase === "matrix" ? view.history[view.history.length - 1] : undefined;
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (!highlight) return setStep(null);
    setStep(0);
    const timers = STEPS.slice(1).map((_, i) => setTimeout(() => setStep(i + 1), STEP_MS * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, [highlight]);
  useEffect(() => {
    if (step !== null) audio.sfx("step");
  }, [step]);
  const st = step === null ? null : STEPS[step];
  const numClass = (key: Key, who: "you" | "them") => {
    if (!st) return who;
    const win = who === "you" ? st.youWin : st.themWin;
    const lose = who === "you" ? st.youLose : st.themLose;
    return `${who}${win?.includes(key) ? " hl-win" : ""}${lose?.includes(key) ? " hl-lose" : ""}`;
  };
  const cellClass = (row: Move, col: Move) => {
    if (!st) return "";
    const key = `${row},${col}` as Key;
    return [
      st.row === row ? "row-glow" : "",
      st.col === col ? "col-glow" : "",
      st.ne === key ? "ne" : "",
      st.pareto === key ? "pareto" : "",
    ].join(" ");
  };
  const [you, setYou] = useState("");
  const [them, setThem] = useState("");
  const [shake, setShake] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setYou("");
    setThem("");
    firstInput.current?.focus();
  }, [current?.round]);

  useEffect(() => {
    if (!wrongPulse) return;
    setShake(true);
    const t = setTimeout(() => setShake(false), 400);
    return () => clearTimeout(t);
  }, [wrongPulse]);

  const submit = () => {
    if (you === "" || them === "" || busy) return;
    onSubmit(Number(you), Number(them));
  };

  const cellFor = (row: Move, col: Move): MatrixCell => view.matrix.find((c) => c.player_move === row && c.partner_move === col)!;
  const filled = view.matrix.filter((c) => c.revealed).length;

  return (
    <div className={`matrix-panel ${st ? "highlighting" : ""}`}>
      <h3>
        Payoff matrix: years in jail (you, Tung Tung Tung Sahur)
        <small>{st ? `Step ${step! + 1} of ${STEPS.length}` : `${filled}/4 cells`}</small>
      </h3>
      {st && (
        <p key={step} className="matrix-caption">
          {st.caption}
        </p>
      )}
      <div className="matrix">
        <div className="head" />
        <div className="head">Tung Tung Tung Sahur: {LABEL.silent}</div>
        <div className="head">Tung Tung Tung Sahur: {LABEL.confess}</div>
        {ROWS.map((row) => (
          <Row key={row} row={row}>
            {ROWS.map((col) => {
              const c = cellFor(row, col);
              const active = current && current.player_move === row && current.partner_move === col;
              if (active)
                return (
                  <div key={col} className={`cell active ${shake ? "wrong" : ""}`}>
                    <input
                      ref={firstInput}
                      aria-label="Your years"
                      inputMode="numeric"
                      value={you}
                      placeholder="you"
                      onChange={(e) => setYou(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      onKeyDown={(e) => e.key === "Enter" && submit()}
                    />
                    ,
                    <input
                      aria-label="Tung Tung Tung Sahur's years"
                      inputMode="numeric"
                      value={them}
                      placeholder="tung"
                      onChange={(e) => setThem(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      onKeyDown={(e) => e.key === "Enter" && submit()}
                    />
                  </div>
                );
              const key = `${row},${col}` as Key;
              return c.revealed ? (
                <div key={col} className={`cell ${cellClass(row, col)}`}>
                  (<span className={numClass(key, "you")}>{c.player_years}</span>,{" "}
                  <span className={numClass(key, "them")}>{c.partner_years}</span>)
                  {st?.ne === key && <em className="cell-badge gold">Nash equilibrium</em>}
                  {st?.pareto === key && <em className="cell-badge">best for both</em>}
                </div>
              ) : (
                <div key={col} className="cell empty">?</div>
              );
            })}
          </Row>
        ))}
      </div>
      {step === STEPS.length - 1 && onReplay && (
        <div className="matrix-actions">
          <span>Confess is the dominant strategy for both players.</span>
          <button className="ghost" onClick={onReplay}>
            ▶ Replay highlight
          </button>
        </div>
      )}
      {current && (
        <div className="matrix-actions">
          <span>Attempt {current.cell_attempts + 1} of 3 · your years first</span>
          <button className="primary" disabled={busy || you === "" || them === ""} onClick={submit}>
            Check answer
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ row, children }: { row: Move; children: React.ReactNode }) {
  return (
    <>
      <div className="head row">You: {LABEL[row]}</div>
      {children}
    </>
  );
}
