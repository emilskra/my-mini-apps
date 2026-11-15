/* ================================================================
   Opening Drills — library, study pages, walk-throughs and drills.
   Hash routes:
     #/                         library
     #/<opening>                study page
     #/<opening>/walk/<line>    step through a line with notes
     #/<opening>/drill/<w|b>[/<line>]   drill one line, or all of them
   ================================================================ */
(function () {
  'use strict';

  const { Position, stripSan } = window.Chess;
  const app = document.getElementById('app');
  const SIDE = { w: 'White', b: 'Black' };
  const other = (s) => (s === 'w' ? 'b' : 'w');
  const COMPUTER_DELAY = 520;
  const TAKEBACK_DELAY = 720;
  const MASTERED = 3; // clean runs in a row

  /* ---------------- book preparation ---------------- */

  const parseMoves = (text) => text.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/);
  const labelOf = (ply, san) => `${Math.floor(ply / 2) + 1}${ply % 2 ? '...' : '.'}${san}`;
  const prettyLabel = (label) => label.replace('...', '…');

  const OPENINGS = window.OPENINGS.map((o) => {
    const lines = [];
    for (const l of o.lines) {
      let pos = new Position();
      const steps = [];
      let ok = true;
      for (const raw of parseMoves(l.moves)) {
        const move = pos.moveFromSan(raw);
        if (!move) { console.error(`[book] ${o.id}/${l.id}: illegal move ${raw}`); ok = false; break; }
        const san = pos.san(move);
        const after = pos.play(move);
        steps.push({ san, key: stripSan(san), move, before: pos, after, label: labelOf(steps.length, stripSan(san)) });
        pos = after;
      }
      if (ok) lines.push({ ...l, steps, notes: l.notes || {} });
    }
    return { ...o, lines };
  });
  const findOpening = (id) => OPENINGS.find((o) => o.id === id);

  function noteFor(o, line, ply) {
    const step = line.steps[ply];
    return line.notes[step.label] || o.notes[step.label] || '';
  }

  /* ---------------- progress (localStorage) ---------------- */

  const STORE = 'opening-drills:v1';
  let progress = {};
  try { progress = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (_) { progress = {}; }
  const pkey = (o, side, line) => `${o.id}/${side}/${line.id}`;
  const stat = (o, side, line) => progress[pkey(o, side, line)] || { runs: 0, clean: 0, streak: 0 };
  function record(o, side, line, clean) {
    const s = { ...stat(o, side, line) };
    s.runs++;
    if (clean) { s.clean++; s.streak++; } else s.streak = 0;
    s.last = Date.now();
    progress[pkey(o, side, line)] = s;
    try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch (_) { /* private mode */ }
    return s;
  }
  const mastered = (o, side) => o.lines.filter((l) => stat(o, side, l).streak >= MASTERED).length;

  /* ---------------- tiny helpers ---------------- */

  const esc = (s) => String(s)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    .replace(/…(?=\S)/g, '…\u2060'); // keep "…c6" together
  const lineLabel = (l) => esc(l.name);
  function movesText(line, upto = line.steps.length) {
    let out = '';
    line.steps.slice(0, upto).forEach((s, i) => {
      if (i % 2 === 0) out += `${i / 2 + 1}.${s.san} `;
      else out += `${s.san} `;
    });
    return out.trim();
  }
  function pips(streak) {
    let h = '<span class="pips" aria-hidden="true">';
    for (let i = 0; i < MASTERED; i++) h += `<i class="${i < streak ? 'on' : ''}"></i>`;
    return h + '</span>';
  }
  function progressText(s) {
    if (!s.runs) return 'Not drilled yet';
    if (s.streak >= MASTERED) return `Learned · ${s.clean} clean of ${s.runs}`;
    return `${s.streak} of ${MASTERED} clean in a row`;
  }

  let teardown = [];
  const onCleanup = (fn) => teardown.push(fn);
  function later(fn, ms) { const t = setTimeout(fn, ms); onCleanup(() => clearTimeout(t)); return t; }

  /* ================================================================
     Board component
     ================================================================ */

  function createBoard(host, { onMove, small = false } = {}) {
    const el = document.createElement('div');
    el.className = 'board' + (small ? ' board--small' : '');
    el.setAttribute('role', 'img');
    const squaresEl = document.createElement('div');
    squaresEl.className = 'squares';
    const piecesEl = document.createElement('div');
    piecesEl.className = 'pieces';
    const svgNS = 'http://www.w3.org/2000/svg';
    const arrowsEl = document.createElementNS(svgNS, 'svg');
    arrowsEl.setAttribute('class', 'arrows');
    arrowsEl.setAttribute('viewBox', '0 0 8 8');
    arrowsEl.setAttribute('aria-hidden', 'true');
    el.append(squaresEl, piecesEl, arrowsEl);
    host.replaceChildren(el);

    let orientation = 'w';
    let pos = new Position();
    let last = null;
    let interactive = false;
    let myColor = 'w';
    let selected = -1;
    let drag = null;
    const sqEls = new Array(64);
    const pieceEls = new Map();

    const cell = (sq) => {
      const f = sq & 7, r = sq >> 3;
      return orientation === 'w' ? { x: f, y: 7 - r } : { x: 7 - f, y: r };
    };
    function squareAt(cx, cy) {
      const rect = el.getBoundingClientRect();
      const x = Math.floor(((cx - rect.left) / rect.width) * 8);
      const y = Math.floor(((cy - rect.top) / rect.height) * 8);
      if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
      return orientation === 'w' ? (7 - y) * 8 + x : y * 8 + (7 - x);
    }

    function buildSquares() {
      squaresEl.replaceChildren();
      for (let sq = 0; sq < 64; sq++) {
        const d = document.createElement('div');
        const { x, y } = cell(sq);
        d.className = 'sq ' + (((sq & 7) + (sq >> 3)) % 2 ? 'light' : 'dark');
        d.style.gridColumn = x + 1;
        d.style.gridRow = y + 1;
        if (y === 7) d.insertAdjacentHTML('beforeend', `<span class="coord file">${'abcdefgh'[sq & 7]}</span>`);
        if (x === 0) d.insertAdjacentHTML('beforeend', `<span class="coord rank">${(sq >> 3) + 1}</span>`);
        sqEls[sq] = d;
        squaresEl.append(d);
      }
    }
    buildSquares();

    const place = (node, sq) => {
      const { x, y } = cell(sq);
      node.style.transform = `translate(${x * 100}%, ${y * 100}%)`;
    };

    function paintSquares() {
      const legal = interactive && selected >= 0 ? pos.legalMoves().filter((m) => m.from === selected) : [];
      const checkSq = pos.inCheck() ? pos.kingSquare(pos.turn) : -1;
      for (let sq = 0; sq < 64; sq++) {
        const c = sqEls[sq].classList;
        c.toggle('last', !!last && (last.from === sq || last.to === sq));
        c.toggle('sel', sq === selected);
        c.toggle('check', sq === checkSq);
        const target = legal.find((m) => m.to === sq);
        c.toggle('target', !!target && !pos.board[sq]);
        c.toggle('capture', !!target && !!pos.board[sq]);
        c.toggle('movable', interactive && !!pos.board[sq] && Chess.colorOf(pos.board[sq]) === myColor);
      }
    }

    function renderPieces(anim) {
      piecesEl.replaceChildren();
      pieceEls.clear();
      for (let sq = 0; sq < 64; sq++) {
        const p = pos.board[sq];
        if (!p) continue;
        const node = document.createElement('span');
        node.className = 'piece ' + (Chess.colorOf(p) === 'w' ? 'w' : 'b');
        node.dataset.p = p;
        const slide = anim && anim.find((a) => a.to === sq);
        place(node, slide ? slide.from : sq);
        if (slide) node.classList.add('instant');
        piecesEl.append(node);
        pieceEls.set(sq, node);
      }
      if (anim && anim.length) {
        // two frames: commit the start position, then let the transition run
        requestAnimationFrame(() => requestAnimationFrame(() => {
          for (const a of anim) {
            const node = pieceEls.get(a.to);
            if (!node) continue;
            node.classList.remove('instant');
            place(node, a.to);
          }
        }));
      }
    }

    function describe() {
      const names = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
      const list = [];
      for (let sq = 0; sq < 64; sq++) {
        const p = pos.board[sq];
        if (p && p.toLowerCase() !== 'p') list.push(`${Chess.colorOf(p) === 'w' ? 'white' : 'black'} ${names[p.toLowerCase()]} ${Chess.sqName(sq)}`);
      }
      el.setAttribute('aria-label', `Chess board, ${SIDE[pos.turn]} to move. ${list.join(', ')}.`);
    }

    function set(position, opts = {}) {
      pos = position;
      last = opts.last || null;
      selected = -1;
      let anim = null;
      if (opts.animate) {
        const m = opts.animate;
        anim = [{ from: m.from, to: m.to }];
        if (m.flag === 'k') anim.push({ from: m.from + 3, to: m.from + 1 });
        if (m.flag === 'q') anim.push({ from: m.from - 4, to: m.from - 1 });
      }
      renderPieces(anim);
      paintSquares();
      describe();
    }

    function arrows(list) {
      arrowsEl.replaceChildren();
      for (const a of list || []) {
        const s = cell(a.from), t = cell(a.to);
        const x1 = s.x + 0.5, y1 = s.y + 0.5, x2 = t.x + 0.5, y2 = t.y + 0.5;
        const len = Math.hypot(x2 - x1, y2 - y1);
        const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
        const head = 0.42, w = 0.17, hw = 0.3;
        const bx = x2 - ux * head, by = y2 - uy * head;
        const sx = x1 + ux * 0.18, sy = y1 + uy * 0.18;
        const px = -uy, py = ux;
        const pts = [
          [sx + px * w / 2, sy + py * w / 2], [bx + px * w / 2, by + py * w / 2], [bx + px * hw, by + py * hw],
          [x2, y2], [bx - px * hw, by - py * hw], [bx - px * w / 2, by - py * w / 2], [sx - px * w / 2, sy - py * w / 2],
        ].map((p) => p.map((n) => n.toFixed(3)).join(',')).join(' ');
        const poly = document.createElementNS(svgNS, 'polygon');
        poly.setAttribute('points', pts);
        poly.setAttribute('class', 'arrow ' + (a.kind || 'hint'));
        arrowsEl.append(poly);
      }
    }

    function flash(sq, kind) {
      const c = sqEls[sq].classList;
      c.remove('flash-bad', 'flash-good');
      void sqEls[sq].offsetWidth;
      c.add(kind === 'bad' ? 'flash-bad' : 'flash-good');
    }

    function setOrientation(side) {
      if (side === orientation) return;
      orientation = side;
      buildSquares();
      set(pos, { last });
    }

    function setInteractive(on, color) {
      interactive = on;
      if (color) myColor = color;
      selected = -1;
      el.classList.toggle('is-live', on);
      paintSquares();
    }

    /* ---- input: click-click and drag, one pointer at a time ---- */

    const isMine = (sq) => sq >= 0 && pos.board[sq] && Chess.colorOf(pos.board[sq]) === myColor && pos.turn === myColor;
    const canGo = (from, to) => pos.legalMoves().some((m) => m.from === from && m.to === to);

    function tryMove(from, to) {
      selected = -1;
      paintSquares();
      if (onMove) onMove(from, to);
    }

    el.addEventListener('pointerdown', (e) => {
      if (!interactive || e.button > 0) return;
      const sq = squareAt(e.clientX, e.clientY);
      if (selected >= 0 && sq !== selected && canGo(selected, sq)) { e.preventDefault(); tryMove(selected, sq); return; }
      if (!isMine(sq)) { selected = -1; paintSquares(); return; }
      e.preventDefault();
      const wasSelected = selected === sq;
      selected = sq;
      paintSquares();
      const node = pieceEls.get(sq);
      drag = { sq, node, x: e.clientX, y: e.clientY, moved: false, wasSelected, id: e.pointerId };
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      drag.moved = true;
      const rect = el.getBoundingClientRect();
      const size = rect.width / 8;
      if (drag.node) {
        drag.node.classList.add('dragging');
        drag.node.style.transform = `translate(${e.clientX - rect.left - size / 2}px, ${e.clientY - rect.top - size / 2}px)`;
      }
      const over = squareAt(e.clientX, e.clientY);
      sqEls.forEach((s, i) => s.classList.toggle('hover', i === over && canGo(drag.sq, i)));
    });

    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      sqEls.forEach((s) => s.classList.remove('hover'));
      if (d.node) { d.node.classList.remove('dragging'); d.node.classList.add('instant'); place(d.node, d.sq); requestAnimationFrame(() => d.node.classList.remove('instant')); }
      if (e.type === 'pointercancel') return;
      const to = squareAt(e.clientX, e.clientY);
      if (d.moved) {
        if (to !== d.sq && canGo(d.sq, to)) {
          if (d.node) { d.node.classList.add('instant'); place(d.node, to); }
          tryMove(d.sq, to);
        }
        return;
      }
      if (d.wasSelected) { selected = -1; paintSquares(); }
    };
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);

    return { set, arrows, flash, setOrientation, setInteractive, get position() { return pos; } };
  }

  /* ================================================================
     Library
     ================================================================ */

  function renderLibrary() {
    document.title = 'Opening Drills — Chess Opening Trainer';
    const group = (g) => OPENINGS.filter((o) => o.group === g).map((o) => {
      const done = mastered(o, o.side);
      const total = o.lines.length;
      return `
        <li>
          <a class="card" href="#/${o.id}">
            <span class="card-top">
              <span class="eco">${esc(o.eco)}</span>
              <span class="count">${total} lines</span>
            </span>
            <span class="card-name">${esc(o.name)}</span>
            <span class="card-tag">${esc(o.tagline)}</span>
            <span class="card-moves">${esc(o.diagram)}</span>
            <span class="meter" aria-label="${done} of ${total} lines learned as ${SIDE[o.side]}">
              <span class="meter-bar"><span style="width:${(done / total) * 100}%"></span></span>
              <span class="meter-text">${done ? `${done}/${total} learned` : 'Not started'}</span>
            </span>
          </a>
        </li>`;
    }).join('');

    app.innerHTML = `
      <section class="intro">
        <p class="kicker">Chess opening trainer</p>
        <h1>Learn the lines by <em>playing</em> them.</h1>
        <p class="lede">Read what an opening is trying to do, step through each main line with notes, then drill it.
          The board plays the other side. Leave the book and the move is taken back, with the right move and the reason for it.</p>
        <ol class="how">
          <li><b>Read</b> the ideas and plans for both sides.</li>
          <li><b>Walk through</b> a line, one move and one note at a time.</li>
          <li><b>Drill</b> it as either colour until you play it three times clean.</li>
        </ol>
      </section>
      <section class="shelf" aria-labelledby="def-h">
        <h2 id="def-h">Defences for Black</h2>
        <ul class="cards">${group('defence')}</ul>
      </section>
      <section class="shelf" aria-labelledby="gam-h">
        <h2 id="gam-h">Gambits for White</h2>
        <ul class="cards">${group('gambit')}</ul>
      </section>
      <p class="foot">Progress is saved in this browser only.</p>`;
  }

  /* ================================================================
     Study page
     ================================================================ */

  function renderStudy(o) {
    document.title = `${o.name} — Opening Drills`;
    const mine = o.side, theirs = other(o.side);
    const lineCards = o.lines.map((l) => {
      const a = stat(o, mine, l), b = stat(o, theirs, l);
      return `
        <li class="line">
          <div class="line-head">
            <h3>${lineLabel(l)}</h3>
            <span class="line-len">${Math.ceil(l.steps.length / 2)} moves</span>
          </div>
          <p class="line-moves">${esc(movesText(l))}</p>
          <p class="line-sum">${esc(l.summary)}</p>
          <div class="line-foot">
            <div class="line-progress">
              <span title="${esc(progressText(a))}">${pips(a.streak)} as ${SIDE[mine]}</span>
              <span title="${esc(progressText(b))}">${pips(b.streak)} as ${SIDE[theirs]}</span>
            </div>
            <div class="line-actions">
              <a class="btn btn--ghost" href="#/${o.id}/walk/${l.id}">Walk through</a>
              <a class="btn" href="#/${o.id}/drill/${mine}/${l.id}">Drill as ${SIDE[mine]}</a>
              <a class="btn btn--quiet" href="#/${o.id}/drill/${theirs}/${l.id}" aria-label="Drill ${esc(l.name)} as ${SIDE[theirs]}">as ${SIDE[theirs]}</a>
            </div>
          </div>
        </li>`;
    }).join('');

    app.innerHTML = `
      <nav class="crumbs"><a href="#/">All openings</a></nav>
      <section class="study-head">
        <div class="study-text">
          <p class="kicker">${o.group === 'gambit' ? 'Gambit for White' : 'Defence for Black'} · ${esc(o.eco)}</p>
          <h1>${esc(o.name)}</h1>
          <p class="lede">${esc(o.tagline)}</p>
          <p class="study-moves">${esc(o.diagram)}</p>
          <div class="cta-row">
            <a class="btn btn--big" href="#/${o.id}/drill/${mine}">Drill all lines as ${SIDE[mine]}</a>
            <a class="btn btn--big btn--ghost" href="#/${o.id}/drill/${theirs}">…or as ${SIDE[theirs]}</a>
          </div>
        </div>
        <div class="study-board" id="study-board"></div>
      </section>

      <section class="study-body">
        <div class="prose">
          <h2>The idea</h2>
          ${o.idea.map((p) => `<p>${esc(p)}</p>`).join('')}
        </div>
        <div class="plans">
          <div class="plan">
            <h3><span class="dot dot--${mine}"></span>Playing it as ${SIDE[mine]}</h3>
            <ul>${o.plans.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
          </div>
          <div class="plan">
            <h3><span class="dot dot--${theirs}"></span>Facing it as ${SIDE[theirs]}</h3>
            <ul>${o.against.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
          </div>
        </div>
      </section>

      <section class="lines-sec" aria-labelledby="lines-h">
        <h2 id="lines-h">The lines</h2>
        <ol class="lines">${lineCards}</ol>
      </section>`;

    const board = createBoard(document.getElementById('study-board'), { small: true });
    const first = o.lines[0];
    const plies = parseMoves(o.diagram).length;
    board.setOrientation(o.side);
    board.set(first.steps[plies - 1].after, { last: first.steps[plies - 1].move });
  }

  /* ================================================================
     Shared play layout (walk-through and drill)
     ================================================================ */

  function playLayout(o, { title, subtitle, side, sideText, panel }) {
    app.innerHTML = `
      <nav class="crumbs"><a href="#/">All openings</a><span>/</span><a href="#/${o.id}">${esc(o.name)}</a></nav>
      <section class="play">
        <div class="board-col">
          <div class="status" id="status" role="status"></div>
          <div class="board-host" id="board-host"></div>
          <div class="latest" id="latest" aria-hidden="true"></div>
        </div>
        <aside class="panel">
          <header class="panel-head">
            <p class="kicker">${esc(subtitle)}</p>
            <h1 class="panel-title" id="panel-title">${title}</h1>
            <p class="side-tag"><span class="dot dot--${side}"></span>${sideText || `You are ${SIDE[side]}`}</p>
          </header>
          ${panel}
        </aside>
      </section>`;
  }

  function renderMoveList(host, steps, current, onPick) {
    let h = '';
    steps.forEach((s, i) => {
      if (i % 2 === 0) h += `<span class="mv-no">${i / 2 + 1}.</span>`;
      const tag = onPick ? 'button' : 'span';
      h += `<${tag} class="mv${i === current ? ' is-current' : ''}" data-i="${i}"${onPick ? ' type="button"' : ''}>${esc(s.san)}</${tag}>`;
    });
    host.innerHTML = h || '<span class="mv-empty">No moves yet.</span>';
    if (onPick) host.querySelectorAll('button.mv').forEach((b) => b.addEventListener('click', () => onPick(+b.dataset.i)));
    const cur = host.querySelector('.is-current');
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* ================================================================
     Walk-through
     ================================================================ */

  function renderWalk(o, lineId) {
    const line = o.lines.find((l) => l.id === lineId);
    if (!line) { location.hash = `#/${o.id}`; return; }
    document.title = `${line.name} · ${o.name} — Opening Drills`;
    const side = o.side;
    playLayout(o, {
      title: lineLabel(line),
      subtitle: `${o.name} · walk-through`,
      side,
      sideText: `Repertoire side: ${SIDE[side]}`,
      panel: `
        <div class="note" id="note" aria-live="polite"></div>
        <div class="moves" id="moves"></div>
        <div class="stepper">
          <button class="btn btn--icon" type="button" id="first" aria-label="Start position">⏮</button>
          <button class="btn btn--icon" type="button" id="prev" aria-label="Previous move">◀</button>
          <button class="btn btn--icon btn--primary" type="button" id="next" aria-label="Next move">▶</button>
          <button class="btn btn--icon" type="button" id="end" aria-label="Last move">⏭</button>
          <button class="btn btn--icon" type="button" id="flip" aria-label="Flip board">⇅</button>
        </div>
        <p class="keys">Tap the board or use ← and → to step.</p>
        <div class="panel-actions">
          <a class="btn" href="#/${o.id}/drill/${side}/${line.id}">Drill as ${SIDE[side]}</a>
          <a class="btn btn--ghost" href="#/${o.id}/drill/${other(side)}/${line.id}">Drill as ${SIDE[other(side)]}</a>
        </div>`,
    });

    const board = createBoard(document.getElementById('board-host'));
    let orient = side;
    board.setOrientation(orient);
    const note = document.getElementById('note');
    const status = document.getElementById('status');
    const movesEl = document.getElementById('moves');
    let i = 0; // number of plies shown

    function show(n, animate) {
      i = Math.max(0, Math.min(line.steps.length, n));
      const step = line.steps[i - 1];
      board.set(i ? step.after : new Position(), { last: step && step.move, animate: animate && step ? step.move : null });
      board.arrows(i < line.steps.length ? [{ from: line.steps[i].move.from, to: line.steps[i].move.to, kind: 'next' }] : []);
      renderMoveList(movesEl, line.steps, i - 1, (k) => show(k + 1));
      if (!i) {
        note.innerHTML = `<p class="note-sum">${esc(line.summary)}</p><p class="note-hint">The arrow shows the next move. Press ▶ to play it.</p>`;
        status.textContent = `Start · ${line.steps.length} half-moves`;
      } else {
        const text = noteFor(o, line, i - 1);
        const who = step.before.turn;
        note.innerHTML = `
          <p class="note-move"><span class="dot dot--${who}"></span>${esc(prettyLabel(labelOf(i - 1, step.san)))}</p>
          ${text ? `<p>${esc(text)}</p>` : ''}
          ${i === line.steps.length ? `<p class="note-end">End of the line. ${esc(line.summary)}</p>` : ''}`;
        status.textContent = i === line.steps.length ? 'End of line' : `Move ${i} of ${line.steps.length}`;
      }
      document.getElementById('latest').innerHTML = note.innerHTML;
      document.getElementById('prev').disabled = document.getElementById('first').disabled = i === 0;
      document.getElementById('next').disabled = document.getElementById('end').disabled = i === line.steps.length;
    }

    document.getElementById('board-host').addEventListener('click', () => show(i + 1, true));
    document.getElementById('first').onclick = () => show(0);
    document.getElementById('prev').onclick = () => show(i - 1);
    document.getElementById('next').onclick = () => show(i + 1, true);
    document.getElementById('end').onclick = () => show(line.steps.length);
    document.getElementById('flip').onclick = () => { orient = other(orient); board.setOrientation(orient); show(i); };
    const keys = (e) => {
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
      if (e.key === 'Home') show(0);
      if (e.key === 'End') show(line.steps.length);
    };
    document.addEventListener('keydown', keys);
    onCleanup(() => document.removeEventListener('keydown', keys));
    show(0);
  }

  /* ================================================================
     Drill
     ================================================================ */

  function renderDrill(o, side, lineId) {
    const target = lineId ? o.lines.find((l) => l.id === lineId) : null;
    if (lineId && !target) { location.hash = `#/${o.id}/drill/${side}`; return; }
    document.title = `Drill · ${target ? target.name + ' · ' : ''}${o.name} — Opening Drills`;

    const options = [`<option value="">All lines, mixed</option>`]
      .concat(o.lines.map((l) => `<option value="${l.id}"${target === l ? ' selected' : ''}>${esc(l.name)}</option>`)).join('');

    playLayout(o, {
      title: target ? lineLabel(target) : 'All lines, mixed',
      subtitle: `${o.name} · drill`,
      side,
      panel: `
        <div class="drill-controls">
          <label class="field">
            <span>Line</span>
            <select id="line-pick">${options}</select>
          </label>
          <div class="seg" role="group" aria-label="Play as">
            <a class="seg-btn${side === 'w' ? ' is-on' : ''}" href="#/${o.id}/drill/w${target ? '/' + target.id : ''}"${side === 'w' ? ' aria-current="true"' : ''}>White</a>
            <a class="seg-btn${side === 'b' ? ' is-on' : ''}" href="#/${o.id}/drill/b${target ? '/' + target.id : ''}"${side === 'b' ? ' aria-current="true"' : ''}>Black</a>
          </div>
        </div>
        <ol class="feed" id="feed" aria-live="polite"></ol>
        <div class="moves" id="moves"></div>
        <form class="type-move" id="type-move" autocomplete="off">
          <label for="san-input" class="sr">Type a move</label>
          <input id="san-input" type="text" inputmode="text" spellcheck="false" placeholder="Type a move, e.g. Nf3" />
          <button class="btn btn--quiet" type="submit">Play</button>
        </form>
        <div class="panel-actions">
          <button class="btn btn--ghost" type="button" id="hint">Hint</button>
          <button class="btn btn--ghost" type="button" id="restart">Restart</button>
          <button class="btn" type="button" id="next-line">${target ? 'Next line' : 'New line'}</button>
        </div>`,
    });

    document.getElementById('line-pick').addEventListener('change', (e) => {
      location.hash = `#/${o.id}/drill/${side}${e.target.value ? '/' + e.target.value : ''}`;
    });

    const statusEl = document.getElementById('status');
    const feed = document.getElementById('feed');
    const movesEl = document.getElementById('moves');
    const latest = document.getElementById('latest');
    const board = createBoard(document.getElementById('board-host'), { onMove: (f, t) => userMove(f, t) });
    const onAct = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'again') start(); else nextLine();
    };
    feed.addEventListener('click', onAct);
    latest.addEventListener('click', onAct);
    board.setOrientation(side);

    let pos, played, candidates, aim, mistakes, hints, wrongHere, finished, lastMove;

    function setStatus(text, tone = '') {
      statusEl.textContent = text;
      statusEl.dataset.tone = tone;
    }
    function say(html, kind) {
      const li = document.createElement('li');
      li.className = 'f f--' + kind;
      li.innerHTML = html;
      feed.append(li);
      feed.scrollTop = feed.scrollHeight;
      latest.className = 'latest ' + li.className;
      latest.innerHTML = li.innerHTML;
      return li;
    }
    function weight(l) {
      const s = stat(o, side, l);
      return (s.runs ? 1 : 2.5) / (1 + s.streak * 1.5);
    }
    function pickLine(list) {
      const total = list.reduce((a, l) => a + weight(l), 0);
      let r = Math.random() * total;
      for (const l of list) { r -= weight(l); if (r <= 0) return l; }
      return list[list.length - 1];
    }
    const ply = () => played.length;
    const alive = () => candidates.filter((l) => l.steps.length > ply());
    function expected() {
      const seen = new Map();
      for (const l of alive()) {
        const s = l.steps[ply()];
        if (!seen.has(s.key)) seen.set(s.key, { step: s, line: l });
      }
      // the line we're steering toward goes first
      const arr = [...seen.values()];
      arr.sort((a, b) => (b.line === aim) - (a.line === aim));
      return arr;
    }

    function start() {
      teardownTimers();
      pos = new Position();
      played = [];
      candidates = target ? [target] : o.lines.slice();
      aim = target || pickLine(candidates);
      mistakes = 0; hints = 0; wrongHere = 0; finished = false; lastMove = null;
      feed.replaceChildren();
      board.arrows([]);
      board.set(pos);
      renderMoveList(movesEl, [], -1);
      say(target
        ? `<p>Drilling <b>${lineLabel(target)}</b> as ${SIDE[side]}. Play the book moves; I play ${SIDE[other(side)]}.</p>`
        : `<p>Mixed drill as ${SIDE[side]}. I pick a line for ${SIDE[other(side)]} — lines you know least come up most.${side === o.side ? ' Where the book offers you a choice, any book move counts.' : ''}</p>`, 'info');
      advance();
    }
    let timers = [];
    function wait(fn, ms) { timers.push(later(fn, ms)); }
    function teardownTimers() { timers.forEach(clearTimeout); timers = []; }

    function advance() {
      if (finished) return;
      if (pos.turn === side) {
        wrongHere = 0;
        board.setInteractive(true, side);
        setStatus(`Your move · ${SIDE[side]} to play`, 'you');
      } else {
        board.setInteractive(false);
        setStatus(`${SIDE[other(side)]} to move…`, 'wait');
        wait(computerMove, COMPUTER_DELAY);
      }
    }

    function computerMove() {
      if (!alive().includes(aim)) aim = pickLine(alive());
      apply(aim.steps[ply()], 'them');
    }

    function apply(step, who, quiet) {
      const before = pos;
      pos = step.after;
      lastMove = step.move;
      played.push(step);
      candidates = candidates.filter((l) => l.steps[ply() - 1] && l.steps[ply() - 1].key === step.key);
      if (!candidates.includes(aim)) aim = pickLine(candidates);
      board.arrows([]);
      board.set(pos, { last: step.move, animate: who === 'them' ? step.move : null });
      if (who === 'you') board.flash(step.move.to, 'good');
      const text = quiet ? '' : noteFor(o, aim, ply() - 1);
      const mover = before.turn;
      say(`<p><span class="mark" aria-hidden="true">${who === 'you' ? '✓' : ''}</span><b class="mv-tag mv-tag--${mover}">${esc(prettyLabel(step.label))}</b>${text ? ' ' + esc(text) : ''}</p>`, who);
      renderMoveList(movesEl, played, ply() - 1);
      const done = candidates.find((l) => l.steps.length === ply());
      if (done) { finish(done); return; }
      advance();
    }

    function userMove(from, to) {
      if (finished || pos.turn !== side) return;
      const moves = pos.legalMoves().filter((m) => m.from === from && m.to === to);
      if (!moves.length) { board.set(pos, { last: lastMove }); return; }
      const exp = expected();
      const hit = exp.find((e) => e.step.move.from === from && e.step.move.to === to &&
        (!e.step.move.promo || moves.some((m) => m.promo === e.step.move.promo)));
      if (hit) {
        board.setInteractive(false);
        apply(hit.step, 'you', wrongHere > 0);
        return;
      }
      wrong(moves.find((m) => !m.promo || m.promo === 'q'), exp);
    }

    function wrong(move, exp) {
      mistakes++;
      wrongHere++;
      board.setInteractive(false);
      board.arrows([]);
      const san = pos.san(move);
      const label = prettyLabel(labelOf(ply(), stripSan(san)));
      const best = exp[0];
      const bestLabel = prettyLabel(best.step.label);
      // did they play a different line of this opening?
      const sideline = target && o.lines.find((l) => l !== target &&
        l.steps.length > ply() && l.steps[ply()].key === stripSan(san) &&
        played.every((s, i) => l.steps[i].key === s.key));

      board.set(pos.play(move), { last: move });
      board.flash(move.to, 'bad');

      let why;
      if (sideline) why = `<p><b>${esc(label)}</b> is the ${lineLabel(sideline)} — real theory, but this drill is the ${lineLabel(target)}. Taken back.</p>`;
      else why = `<p><b>${esc(label)}</b> leaves the book. Taken back.</p>`;
      const note = noteFor(o, best.line, ply());
      let fix = `<p>Here ${SIDE[side]} plays <b class="mv-tag mv-tag--${side}">${esc(bestLabel)}</b>.${note ? ' ' + esc(note) : ''}</p>`;
      if (exp.length > 1) {
        fix += `<p class="alts">Also book here: ${exp.slice(1).map((e) => `<b>${esc(prettyLabel(e.step.label))}</b> (${lineLabel(e.line)})`).join(', ')}.</p>`;
      }
      say(`<span class="mark" aria-hidden="true">✗</span>${why}${fix}`, 'bad');
      setStatus(`Not the book move — see the note`, 'bad');

      wait(() => {
        board.set(pos, { last: lastMove, animate: { from: move.to, to: move.from, flag: 'n' } });
        board.arrows(exp.map((e, i) => ({ from: e.step.move.from, to: e.step.move.to, kind: i ? 'alt' : 'hint' })));
        board.setInteractive(true, side);
        setStatus(`Your move · play ${bestLabel}`, 'you');
      }, TAKEBACK_DELAY);
    }

    function hint() {
      if (finished || pos.turn !== side) return;
      hints++;
      const exp = expected();
      board.arrows(exp.map((e, i) => ({ from: e.step.move.from, to: e.step.move.to, kind: i ? 'alt' : 'hint' })));
      setStatus(exp.length > 1 ? 'Hint: any arrow is a book move' : 'Hint: follow the arrow', 'you');
    }

    function finish(line) {
      finished = true;
      board.setInteractive(false);
      const clean = mistakes === 0 && hints === 0;
      const s = record(o, side, line, clean);
      const verdict = clean ? 'Clean run.' : `${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}${hints ? `, ${hints} ${hints === 1 ? 'hint' : 'hints'}` : ''}.`;
      const learned = s.streak >= MASTERED;
      say(`
        <p class="done-title">Line complete: ${lineLabel(line)}</p>
        <p>${esc(verdict)} ${learned ? `<b>Learned</b> — ${s.streak} clean runs in a row.` : clean ? `${s.streak} of ${MASTERED} clean in a row.` : 'Clean runs reset; go again.'}</p>
        <p class="done-sum">${esc(line.summary)}</p>
        <div class="done-actions">
          <button class="btn btn--ghost" type="button" data-act="again">Again</button>
          <button class="btn" type="button" data-act="next">${target ? 'Next line' : 'New line'}</button>
        </div>`, 'done');
      setStatus(clean ? 'Line complete · clean' : 'Line complete', clean ? 'good' : '');
    }

    function nextLine() {
      if (!target) { start(); return; }
      const i = o.lines.indexOf(target);
      location.hash = `#/${o.id}/drill/${side}/${o.lines[(i + 1) % o.lines.length].id}`;
    }

    document.getElementById('hint').onclick = hint;
    document.getElementById('restart').onclick = start;
    document.getElementById('next-line').onclick = nextLine;
    const input = document.getElementById('san-input');
    document.getElementById('type-move').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v || finished || pos.turn !== side) return;
      const m = pos.moveFromSan(v);
      if (!m) { input.setCustomValidity('Not a legal move here'); input.reportValidity(); return; }
      input.setCustomValidity('');
      input.value = '';
      userMove(m.from, m.to);
    });
    input.addEventListener('input', () => input.setCustomValidity(''));
    const keys = (e) => {
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'h') hint();
    };
    document.addEventListener('keydown', keys);
    onCleanup(() => document.removeEventListener('keydown', keys));
    onCleanup(teardownTimers);

    start();
  }

  /* ================================================================
     Router
     ================================================================ */

  function route() {
    teardown.forEach((fn) => fn());
    teardown = [];
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const o = parts.length ? findOpening(parts[0]) : null;
    document.body.dataset.view = !o ? 'library' : parts[1] || 'study';
    if (!o) renderLibrary();
    else if (parts[1] === 'walk') renderWalk(o, parts[2]);
    else if (parts[1] === 'drill') renderDrill(o, parts[2] === 'w' || parts[2] === 'b' ? parts[2] : o.side, parts[3]);
    else renderStudy(o);
    window.scrollTo(0, 0);
    const h1 = app.querySelector('h1');
    if (h1 && route.ran) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
    route.ran = true;
  }

  window.addEventListener('hashchange', route);
  route();
})();
