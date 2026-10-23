// Split an AI message into short "conversation pieces" the player clicks through.

const MAX_PIECE = 170;

export function splitPieces(text: string): string[] {
  const pieces: string[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const b = block.trim();
    if (!b) continue;
    // Lists stay together line by line (e.g. the cop's deal), one line per piece if long.
    if (/^\s*([-*]|\d+\.)\s/m.test(b)) {
      pack(b.split("\n").map((l) => l.trim()).filter(Boolean), pieces, "\n");
      continue;
    }
    const sentences = b.split(/(?<=[.!?…])\s+(?=["“(*A-Z0-9])/);
    pack(sentences, pieces, " ");
  }
  return pieces.length ? pieces : [text];
}

function pack(parts: string[], out: string[], joiner: string) {
  let cur = "";
  for (const p of parts) {
    if (cur && (cur + joiner + p).length > MAX_PIECE) {
      out.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + joiner + p : p;
    }
  }
  if (cur) out.push(cur);
}
