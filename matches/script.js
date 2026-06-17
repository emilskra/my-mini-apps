/* =========================================================
   VESTA — the matchbox willpower exercise
   Drag every match out, one by one; drag each back the same way.
   When a full round closes, name the five things that tried to stop you.
   ========================================================= */

(function () {
  "use strict";

  const boxTray   = document.getElementById("box-tray");
  const asideTray = document.getElementById("aside-tray");
  const slab      = document.querySelector(".slab");
  const boxCount  = document.getElementById("box-count");
  const asideCount= document.getElementById("aside-count");
  const cue       = document.getElementById("cue");
  const tally     = document.getElementById("tally");
  const repsNum   = document.getElementById("reps-num");
  const slabEmpty = document.getElementById("slab-empty");
  const timerEl   = document.getElementById("timer");
  const status    = document.getElementById("status");

  const overlay   = document.getElementById("overlay");
  const roundTime = document.getElementById("round-time");
  const reasonsEl = document.getElementById("reasons");
  const beginBtn  = document.getElementById("begin-again");
  const sheetDay  = document.getElementById("sheet-day");

  const dayNumEl  = document.getElementById("day-num");
  const noteEl    = document.getElementById("course-note");
  const pipsEl    = document.getElementById("pips");

  const onboard    = document.getElementById("onboard");
  const onboardBtn = document.getElementById("onboard-begin");
  const ledgerList = document.getElementById("ledger-list");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const total = 50;
  let reps = 0;
  let wasEmptied = false;   // box has reached zero this round

  const timer = { running: false, start: 0, elapsed: 0 };

  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  };

  /* =========================================================
     The seven-day journal (localStorage)
     Everything is grouped by calendar day, so practising twice
     in one day still counts — and saves — as a single day.
     ========================================================= */
  const COURSE_LENGTH = 7;
  const STORE_KEY = "vesta.journal";

  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  let memJournal = null; // in-memory mirror; keeps a session consistent
                         // even where file:// localStorage is blocked
  function loadJournal() {
    if (memJournal) return memJournal;
    try {
      const j = JSON.parse(localStorage.getItem(STORE_KEY));
      if (j && j.days) { memJournal = j; return j; }
    } catch (err) { /* unreadable — start fresh */ }
    memJournal = { days: {} };
    return memJournal;
  }
  function saveJournal(j) {
    memJournal = j;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(j)); }
    catch (err) { /* storage unavailable — keep going in memory */ }
  }

  // which day of the course are we on? distinct practice days,
  // plus today if today has not been started yet.
  function dayState() {
    const j = loadJournal();
    const distinct = Object.keys(j.days).length;
    const todayDone = !!j.days[todayKey()];
    return { j, distinct, todayDone, current: distinct + (todayDone ? 0 : 1) };
  }

  // record that practice has begun today (idempotent)
  function markToday() {
    const j = loadJournal();
    const t = todayKey();
    if (!j.days[t]) {
      j.days[t] = { rounds: [] };
      saveJournal(j);
      renderCourse();
    }
  }

  // append a finished round's reasons under today's entry
  function recordRound(reasons, ms) {
    const j = loadJournal();
    const t = todayKey();
    if (!j.days[t]) j.days[t] = { rounds: [] };
    j.days[t].rounds.push({
      at: new Date().toISOString(),
      ms: Math.round(ms),
      reasons: reasons,
    });
    saveJournal(j);
    renderCourse();
  }

  /* ---- first-visit onboarding ---- */
  const SEEN_KEY = "vesta.seen";
  let memSeen = false;
  function hasSeen() {
    if (memSeen) return true;
    try { if (localStorage.getItem(SEEN_KEY)) { memSeen = true; } } catch (err) { /* ignore */ }
    return memSeen;
  }
  function markSeen() {
    memSeen = true;
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (err) { /* ignore */ }
  }
  function openOnboard() {
    onboard.classList.add("open");
    onboard.setAttribute("aria-hidden", "false");
    onboardBtn.focus();
  }
  function closeOnboard() {
    markSeen();
    onboard.classList.remove("open");
    onboard.setAttribute("aria-hidden", "true");
  }
  onboardBtn.addEventListener("click", closeOnboard);
  onboard.addEventListener("keydown", (e) => { if (e.key === "Escape") closeOnboard(); });

  function noteFor(day) {
    if (day > COURSE_LENGTH)
      return "Seven days complete — the discipline is yours. Continue if it serves you.";
    if (day === COURSE_LENGTH)
      return "The seventh day. Finish what you began.";
    if (day >= 4)
      return "The hardest days are behind you. Let the act settle into routine.";
    return "The first three days are the hardest — the resistance you feel now is the exercise doing its work.";
  }

  function renderCourse() {
    const { distinct, current } = dayState();
    dayNumEl.textContent = current;
    noteEl.textContent = noteFor(current);

    pipsEl.innerHTML = "";
    const count = Math.max(COURSE_LENGTH, current);
    for (let i = 0; i < count; i++) {
      const cls = i < distinct ? "done" : (i === current - 1 ? "active" : "future");
      const pip = document.createElement("span");
      pip.className = "pip " + cls;
      pip.innerHTML = '<span class="pip-head"></span><span class="pip-stick"></span>';
      pipsEl.appendChild(pip);
    }
    renderLedger();
  }

  /* the journal: every practised day with the reasons logged that day */
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function prettyDate(key) {
    const p = key.split("-");
    if (p.length !== 3) return key;
    return parseInt(p[2], 10) + " " + (MONTHS[parseInt(p[1], 10) - 1] || "") + " " + p[0];
  }
  function renderLedger() {
    const j = loadJournal();
    const keys = Object.keys(j.days).sort();
    if (!keys.length) {
      ledgerList.innerHTML =
        '<p class="ledger-empty">Your reflections will gather here, day by day.</p>';
      return;
    }
    ledgerList.innerHTML = "";
    keys.forEach((key, i) => {
      const rounds = j.days[key].rounds || [];
      const reasons = rounds.reduce((acc, r) => acc.concat(r.reasons || []), []);

      const art = document.createElement("article");
      art.className = "ledger-day";

      const head = document.createElement("p");
      head.className = "ledger-day-head";
      head.innerHTML =
        "<span>Day " + (i + 1) + "</span>" +
        "<span class='meta'>" + prettyDate(key) + "</span>" +
        "<span class='meta'>" + rounds.length + " round" + (rounds.length === 1 ? "" : "s") + "</span>";
      art.appendChild(head);

      if (reasons.length) {
        const ul = document.createElement("ul");
        ul.className = "ledger-reasons";
        reasons.forEach((r) => {
          const li = document.createElement("li");
          li.textContent = r;
          ul.appendChild(li);
        });
        art.appendChild(ul);
      } else {
        const none = document.createElement("p");
        none.className = "ledger-none";
        none.textContent = "— no resistances noted —";
        art.appendChild(none);
      }
      ledgerList.appendChild(art);
    });
  }

  /* ---- build the matchbox full of fresh matches ---- */
  function build() {
    boxTray.innerHTML = "";
    asideTray.innerHTML = "";
    boxTray.style.minHeight = "";
    asideTray.style.minHeight = "";
    wasEmptied = false;

    for (let i = 0; i < total; i++) {
      const m = document.createElement("button");
      m.type = "button";
      m.className = "match enter";
      m.setAttribute("role", "listitem");
      if (!reduceMotion) m.style.animationDelay = (i * 14) + "ms";
      m.innerHTML = '<span class="head"></span><span class="stick"></span>';
      m.addEventListener("animationend", () => m.classList.remove("enter"), { once: true });
      boxTray.appendChild(m);
    }

    // lock both columns to the full height so the layout never jumps
    // as matches travel between the box and the slab
    const full = Math.ceil(boxTray.getBoundingClientRect().height);
    boxTray.style.minHeight = full + "px";
    asideTray.style.minHeight = full + "px";

    // reset the timer
    timer.running = false;
    timer.start = 0;
    timer.elapsed = 0;
    renderTimer();

    update();
  }

  /* ---- FLIP: animate matches from old positions to new ones ---- */
  function flip(mutate) {
    if (reduceMotion) { mutate(); return; }
    const all = [...document.querySelectorAll(".match")];
    const first = new Map(all.map((el) => [el, el.getBoundingClientRect()]));

    mutate();

    all.forEach((el) => {
      const a = first.get(el);
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (!dx && !dy) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    requestAnimationFrame(() => {
      all.forEach((el) => {
        el.style.transition = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      });
    });
  }

  /* =========================================================
     Drag and drop (pointer based — works with mouse and touch)
     The match resists: while in transit it can slip from your
     grip and fall back, so a steady, patient hand is rewarded.
     ========================================================= */
  let drag = null;
  const SLIP_CHANCE = 0.05;   // probability per roll while a match is in transit
  const SLIP_ROLL_MS = 110;   // how often that probability is rolled

  function onPointerDown(e) {
    if (drag) return;
    const match = e.target.closest(".match");
    if (!match) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();

    const rect = match.getBoundingClientRect();
    drag = {
      el: match,
      origin: match.parentElement,
      next: match.nextSibling,
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      startX: e.clientX,
      startY: e.clientY,
      lastRoll: performance.now(),
    };

    match.classList.add("dragging");
    match.style.position = "fixed";
    match.style.width = rect.width + "px";
    match.style.left = rect.left + "px";
    match.style.top = rect.top + "px";
    match.style.zIndex = "100";
    match.style.pointerEvents = "none";
    document.body.style.cursor = "grabbing";

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function within(rect, x, y) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }
  function zoneAt(x, y) {
    if (within(boxTray.getBoundingClientRect(), x, y)) return "box";
    if (within(slab.getBoundingClientRect(), x, y)) return "aside";
    return null;
  }
  function highlight(zone) {
    boxTray.classList.toggle("drop-active", zone === "box");
    slab.classList.toggle("drop-active", zone === "aside");
  }

  function onPointerMove(e) {
    if (!drag) return;
    drag.el.style.left = (e.clientX - drag.offX) + "px";
    drag.el.style.top = (e.clientY - drag.offY) + "px";
    highlight(zoneAt(e.clientX, e.clientY));

    // once it is genuinely in transit, it may slip and fall back
    const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    const now = performance.now();
    if (dist > 26 && now - drag.lastRoll >= SLIP_ROLL_MS) {
      drag.lastRoll = now;
      if (Math.random() < SLIP_CHANCE) endDrag(drag.origin, true);
    }
  }

  function onPointerUp(e) {
    if (!drag) return;
    const zone = zoneAt(e.clientX, e.clientY);
    const dest = zone === "box" ? boxTray : zone === "aside" ? asideTray : drag.origin;
    endDrag(dest, false);
  }

  function endDrag(dest, slipped) {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);

    const el = drag.el, origin = drag.origin, next = drag.next;
    if (slipped) {
      dest = origin; // it falls back to where it came from
      el.classList.add("slip");
      setTimeout(() => el.classList.remove("slip"), 480);
    }

    // FLIP from the floating position into its settled slot
    flip(() => {
      el.classList.remove("dragging");
      el.style.position = "";
      el.style.width = "";
      el.style.left = "";
      el.style.top = "";
      el.style.zIndex = "";
      el.style.pointerEvents = "";
      el.style.transform = "";
      if (dest === origin) origin.insertBefore(el, next); // keep its place
      else dest.appendChild(el);
    });

    highlight(null);
    document.body.style.cursor = "";
    drag = null;
    update();

    if (slipped) {
      cue.classList.remove("done");
      cue.textContent = "It slipped from your grip — steady, and draw it out again.";
    }
  }

  boxTray.addEventListener("pointerdown", onPointerDown);
  asideTray.addEventListener("pointerdown", onPointerDown);

  /* keyboard fallback so the exercise stays usable without a pointer */
  function onKey(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const match = e.target.closest(".match");
    if (!match) return;
    e.preventDefault();
    const dest = match.parentElement === boxTray ? asideTray : boxTray;
    flip(() => dest.appendChild(match));
    update();
  }
  boxTray.addEventListener("keydown", onKey);
  asideTray.addEventListener("keydown", onKey);

  /* =========================================================
     State, counts, timer, cue
     ========================================================= */
  function update() {
    const inBox = boxTray.children.length;
    const aside = asideTray.children.length;

    boxCount.textContent = pad(inBox);
    asideCount.textContent = pad(aside);
    slabEmpty.style.display = aside === 0 ? "" : "none";

    [...boxTray.children].forEach((m) => {
      m.setAttribute("aria-label", "Drag this match out of the box");
      m.title = "Drag it out";
    });
    [...asideTray.children].forEach((m) => {
      m.setAttribute("aria-label", "Drag this match back into the box");
      m.title = "Drag it back";
    });

    if (inBox === 0) wasEmptied = true;

    let finished = false;
    if (inBox === total && wasEmptied) {
      reps += 1;
      wasEmptied = false;
      finished = true;
      renderTally();
    }

    // timer: runs whenever the box is not full
    const now = performance.now();
    if (inBox === total) {
      if (timer.running) {
        timer.elapsed = now - timer.start;
        timer.running = false;
        renderTimer();
      }
    } else if (!timer.running) {
      timer.start = now;
      timer.elapsed = 0;
      timer.running = true;
      renderTimer();
      requestAnimationFrame(tick);
      markToday(); // first match out today — log the day
    }

    cue.classList.toggle("done", finished);
    if (finished) {
      cue.textContent = "A round complete. Name what tried to stop you.";
    } else if (wasEmptied) {
      cue.textContent = "Now bring them back — one by one.";
    } else if (aside === 0) {
      cue.textContent = "Drag them out — one by one.";
    } else {
      cue.textContent = "Keep going — one by one.";
    }

    status.textContent =
      `${inBox} in the box, ${aside} set aside. ${reps} round${reps === 1 ? "" : "s"} complete.`;

    if (finished) {
      const ms = timer.elapsed;
      window.setTimeout(() => openSheet(ms), reduceMotion ? 0 : 480);
    }
  }

  function tick() {
    if (!timer.running) return;
    timer.elapsed = performance.now() - timer.start;
    renderTimer();
    requestAnimationFrame(tick);
  }

  function renderTimer() {
    timerEl.textContent = fmt(timer.elapsed);
    timerEl.classList.toggle("running", timer.running);
  }

  /* repetition count drawn as matchstick tally marks */
  function renderTally() {
    repsNum.textContent = reps;
    tally.innerHTML = "";
    let left = reps;
    while (left > 0) {
      const n = Math.min(5, left);
      const group = document.createElement("span");
      group.className = "tally-group";
      for (let i = 0; i < (n === 5 ? 4 : n); i++) {
        const bar = document.createElement("span");
        bar.className = "bar";
        group.appendChild(bar);
      }
      if (n === 5) {
        const s = document.createElement("span");
        s.className = "strike";
        group.appendChild(s);
      }
      tally.appendChild(group);
      left -= n;
    }
  }

  /* =========================================================
     The reflection sheet
     ========================================================= */
  function inputs() {
    return [...reasonsEl.querySelectorAll("input")];
  }

  function openSheet(ms) {
    roundTime.textContent = fmt(ms);
    sheetDay.textContent = dayState().current;
    overlay._roundMs = ms;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    const first = inputs()[0];
    if (first) first.focus();
  }

  function closeSheet() {
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
  }

  beginBtn.addEventListener("click", () => {
    const list = inputs().map((i) => i.value.trim()).filter(Boolean);
    recordRound(list, overlay._roundMs || 0);
    inputs().forEach((i) => (i.value = ""));
    closeSheet();
  });

  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
  });

  renderCourse();
  build();

  // show onboarding only the first time the page is opened.
  // a returning practitioner (already has journal days) skips it.
  if (!hasSeen()) {
    if (dayState().distinct > 0) markSeen();
    else openOnboard();
  }
})();
