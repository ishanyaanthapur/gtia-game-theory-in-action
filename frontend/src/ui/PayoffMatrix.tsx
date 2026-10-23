import { useEffect, useRef, useState } from "react";
import type { MatrixCell, Move, SessionView } from "../types";

const LABEL: Record<Move, string> = { silent: "Silent", confess: "Confess" };
const ROWS: Move[] = ["silent", "confess"];

interface Props {
  view: SessionView;
  busy: boolean;
  wrongPulse: number; // increments on each wrong answer to retrigger the shake
  onSubmit: (you: number, them: number) => void;
}

export function PayoffMatrix({ view, busy, wrongPulse, onSubmit }: Props) {
  const current = view.phase === "matrix" ? view.history[view.history.length - 1] : undefined;
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
    <div className="matrix-panel">
      <h3>
        Payoff matrix: years in jail (you, Tung Tung)
        <small>{filled}/4 cells</small>
      </h3>
      <div className="matrix">
        <div className="head" />
        <div className="head">Tung Tung: {LABEL.silent}</div>
        <div className="head">Tung Tung: {LABEL.confess}</div>
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
                      aria-label="Tung Tung's years"
                      inputMode="numeric"
                      value={them}
                      placeholder="tung"
                      onChange={(e) => setThem(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      onKeyDown={(e) => e.key === "Enter" && submit()}
                    />
                  </div>
                );
              return c.revealed ? (
                <div key={col} className="cell">
                  (<span className="you">{c.player_years}</span>, <span className="them">{c.partner_years}</span>)
                </div>
              ) : (
                <div key={col} className="cell empty">?</div>
              );
            })}
          </Row>
        ))}
      </div>
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
