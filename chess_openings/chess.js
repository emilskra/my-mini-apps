/* ================================================================
   chess.js — a small, complete rules core for the trainer.
   Legal move generation (castling, en passant, promotion, check),
   SAN in and out. No search, no engine: the book does the thinking.
   Squares are 0..63, a1 = 0, h1 = 7, a8 = 56.
   ================================================================ */
(function (global) {
  'use strict';

  const FILES = 'abcdefgh';
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  // which castling rights die when a piece leaves or lands on a square
  const RIGHTS_LOST = { 0: 'Q', 4: 'KQ', 7: 'K', 56: 'q', 60: 'kq', 63: 'k' };

  const sqName = (i) => FILES[i & 7] + ((i >> 3) + 1);
  const sqIndex = (s) => (s.charCodeAt(1) - 49) * 8 + (s.charCodeAt(0) - 97);
  const colorOf = (p) => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
  const at = (f, r) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1);
  const stripSan = (s) => s.replace(/[+#!?]+$/g, '').replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O');

  class Position {
    constructor(fen = START) {
      if (fen instanceof Position) {
        this.board = fen.board.slice();
        this.turn = fen.turn;
        this.castling = fen.castling;
        this.ep = fen.ep;
        this.half = fen.half;
        this.full = fen.full;
        return;
      }
      const [placement, turn, castling, ep, half, full] = fen.trim().split(/\s+/);
      this.board = new Array(64).fill(null);
      let r = 7, f = 0;
      for (const ch of placement) {
        if (ch === '/') { r--; f = 0; }
        else if (/\d/.test(ch)) f += +ch;
        else { this.board[r * 8 + f] = ch; f++; }
      }
      this.turn = turn === 'b' ? 'b' : 'w';
      this.castling = castling && castling !== '-' ? castling : '';
      this.ep = ep && ep !== '-' ? sqIndex(ep) : -1;
      this.half = +half || 0;
      this.full = +full || 1;
    }

    get(sq) { return this.board[typeof sq === 'string' ? sqIndex(sq) : sq]; }
    kingSquare(color) { return this.board.indexOf(color === 'w' ? 'K' : 'k'); }

    /** Is `sq` attacked by any piece of colour `by`? */
    attacked(sq, by) {
      const b = this.board, f = sq & 7, r = sq >> 3;
      const w = by === 'w';
      const P = w ? 'P' : 'p', N = w ? 'N' : 'n', K = w ? 'K' : 'k';
      const B = w ? 'B' : 'b', R = w ? 'R' : 'r', Q = w ? 'Q' : 'q';
      const pr = w ? r - 1 : r + 1;
      for (const df of [-1, 1]) { const i = at(f + df, pr); if (i >= 0 && b[i] === P) return true; }
      for (const [df, dr] of KNIGHT) { const i = at(f + df, r + dr); if (i >= 0 && b[i] === N) return true; }
      for (const [df, dr] of KING) { const i = at(f + df, r + dr); if (i >= 0 && b[i] === K) return true; }
      const slide = (dirs, a, c) => {
        for (const [df, dr] of dirs) {
          let x = f + df, y = r + dr;
          while (x >= 0 && x < 8 && y >= 0 && y < 8) {
            const p = b[y * 8 + x];
            if (p) { if (p === a || p === c) return true; break; }
            x += df; y += dr;
          }
        }
        return false;
      };
      return slide(ROOK_DIRS, R, Q) || slide(BISHOP_DIRS, B, Q);
    }

    inCheck(color = this.turn) {
      return this.attacked(this.kingSquare(color), color === 'w' ? 'b' : 'w');
    }

    /** Moves that obey piece movement, ignoring whether the king is left in check. */
    pseudoMoves() {
      const b = this.board, us = this.turn, them = us === 'w' ? 'b' : 'w';
      const moves = [];
      for (let i = 0; i < 64; i++) {
        const p = b[i];
        if (!p || colorOf(p) !== us) continue;
        const t = p.toLowerCase(), f = i & 7, r = i >> 3;

        if (t === 'p') {
          const dir = us === 'w' ? 1 : -1;
          const lastRank = us === 'w' ? 7 : 0;
          const add = (to, flag) => {
            if ((to >> 3) === lastRank) for (const promo of 'qrbn') moves.push({ from: i, to, flag, promo });
            else moves.push({ from: i, to, flag });
          };
          const one = at(f, r + dir);
          if (one >= 0 && !b[one]) {
            add(one, 'n');
            const two = at(f, r + 2 * dir);
            if (r === (us === 'w' ? 1 : 6) && !b[two]) moves.push({ from: i, to: two, flag: 'b' });
          }
          for (const df of [-1, 1]) {
            const c = at(f + df, r + dir);
            if (c < 0) continue;
            if (b[c] && colorOf(b[c]) === them) add(c, 'c');
            else if (c === this.ep) moves.push({ from: i, to: c, flag: 'e' });
          }
          continue;
        }

        if (t === 'n' || t === 'k') {
          for (const [df, dr] of (t === 'n' ? KNIGHT : KING)) {
            const j = at(f + df, r + dr);
            if (j < 0) continue;
            if (!b[j]) moves.push({ from: i, to: j, flag: 'n' });
            else if (colorOf(b[j]) === them) moves.push({ from: i, to: j, flag: 'c' });
          }
          if (t === 'k') {
            const home = us === 'w' ? 4 : 60;
            const [kSide, qSide] = us === 'w' ? ['K', 'Q'] : ['k', 'q'];
            const rook = us === 'w' ? 'R' : 'r';
            if (i === home && !this.attacked(home, them)) {
              if (this.castling.includes(kSide) && b[home + 3] === rook && !b[home + 1] && !b[home + 2] &&
                  !this.attacked(home + 1, them) && !this.attacked(home + 2, them)) {
                moves.push({ from: i, to: home + 2, flag: 'k' });
              }
              if (this.castling.includes(qSide) && b[home - 4] === rook && !b[home - 1] && !b[home - 2] && !b[home - 3] &&
                  !this.attacked(home - 1, them) && !this.attacked(home - 2, them)) {
                moves.push({ from: i, to: home - 2, flag: 'q' });
              }
            }
          }
          continue;
        }

        const dirs = t === 'b' ? BISHOP_DIRS : t === 'r' ? ROOK_DIRS : ROOK_DIRS.concat(BISHOP_DIRS);
        for (const [df, dr] of dirs) {
          let x = f + df, y = r + dr;
          while (x >= 0 && x < 8 && y >= 0 && y < 8) {
            const j = y * 8 + x;
            if (!b[j]) moves.push({ from: i, to: j, flag: 'n' });
            else { if (colorOf(b[j]) === them) moves.push({ from: i, to: j, flag: 'c' }); break; }
            x += df; y += dr;
          }
        }
      }
      return moves;
    }

    /** Returns the position after `m`. Never mutates this one. */
    play(m) {
      const p = new Position(this);
      const b = p.board, us = this.turn;
      const piece = b[m.from];
      b[m.to] = m.promo ? (us === 'w' ? m.promo.toUpperCase() : m.promo) : piece;
      b[m.from] = null;
      if (m.flag === 'e') b[m.to + (us === 'w' ? -8 : 8)] = null;
      if (m.flag === 'k') { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = null; }
      if (m.flag === 'q') { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = null; }
      for (const s of [m.from, m.to]) {
        const lost = RIGHTS_LOST[s];
        if (lost) for (const ch of lost) p.castling = p.castling.replace(ch, '');
      }
      p.ep = m.flag === 'b' ? (m.from + m.to) / 2 : -1;
      p.half = piece.toLowerCase() === 'p' || m.flag === 'c' || m.flag === 'e' ? 0 : this.half + 1;
      if (us === 'b') p.full = this.full + 1;
      p.turn = us === 'w' ? 'b' : 'w';
      return p;
    }

    legalMoves() {
      if (this._legal) return this._legal;
      const us = this.turn;
      this._legal = this.pseudoMoves().filter((m) => !this.play(m).inCheck(us));
      return this._legal;
    }

    /** Standard algebraic notation for a legal move in this position. */
    san(m) {
      let s;
      if (m.flag === 'k') s = 'O-O';
      else if (m.flag === 'q') s = 'O-O-O';
      else {
        const piece = this.board[m.from];
        const t = piece.toLowerCase();
        const capture = m.flag === 'c' || m.flag === 'e';
        if (t === 'p') {
          s = (capture ? FILES[m.from & 7] + 'x' : '') + sqName(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
        } else {
          s = t.toUpperCase();
          const rivals = this.legalMoves().filter((o) => o.to === m.to && o.from !== m.from && this.board[o.from] === piece);
          if (rivals.length) {
            const sameFile = rivals.some((o) => (o.from & 7) === (m.from & 7));
            const sameRank = rivals.some((o) => (o.from >> 3) === (m.from >> 3));
            if (!sameFile) s += FILES[m.from & 7];
            else if (!sameRank) s += (m.from >> 3) + 1;
            else s += sqName(m.from);
          }
          s += (capture ? 'x' : '') + sqName(m.to);
        }
      }
      const next = this.play(m);
      if (next.inCheck()) s += next.legalMoves().length ? '+' : '#';
      return s;
    }

    /** Finds the legal move written as `san`, or null. Check marks are optional. */
    moveFromSan(san) {
      const want = stripSan(san.trim());
      for (const m of this.legalMoves()) if (stripSan(this.san(m)) === want) return m;
      return null;
    }

    fen() {
      let out = '';
      for (let r = 7; r >= 0; r--) {
        let empty = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.board[r * 8 + f];
          if (!p) { empty++; continue; }
          if (empty) { out += empty; empty = 0; }
          out += p;
        }
        if (empty) out += empty;
        if (r) out += '/';
      }
      return `${out} ${this.turn} ${this.castling || '-'} ${this.ep < 0 ? '-' : sqName(this.ep)} ${this.half} ${this.full}`;
    }
  }

  global.Chess = { Position, START, sqName, sqIndex, colorOf, stripSan };
})(typeof window !== 'undefined' ? window : globalThis);
