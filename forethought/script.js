(() => {
  'use strict';

  /* ================= helpers ================= */
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const shuffle = a => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const sample = (a, n) => shuffle(a).slice(0, n);
  const cap = s => s[0].toUpperCase() + s.slice(1);

  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k in n) n[k] = v;
      else n.setAttribute(k, v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.append(c);
    return n;
  }

  const KEY = 'forethought.v1';
  let store = {};
  try { store = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { store = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* private mode */ } };

  /* Multiple choice: options are {label, ok, ...}. Marks right/wrong, then calls done(option). */
  function mc(host, options, done, cls) {
    const box = el('div', { class: 'choices ' + (cls || '') });
    options.forEach(o => {
      o.btn = el('button', {
        type: 'button', class: 'choice',
        onclick: () => {
          options.forEach(p => { p.btn.disabled = true; if (p.ok) p.btn.classList.add('is-right'); });
          if (!o.ok) o.btn.classList.add('is-wrong');
          done(o);
        },
      }, o.label);
      box.append(o.btn);
    });
    host.append(box);
    return box;
  }

  /* Run n rounds; round(i, done) calls done(points) when the player moves on. */
  function series(ctx, n, maxPer, round) {
    let score = 0, i = 0;
    const next = () => {
      if (i >= n) return ctx.finish(score, n * maxPer);
      ctx.progress(i + 1, n);
      ctx.clear();
      round(i++, pts => { score += pts; next(); });
    };
    next();
  }

  /* ================= 1. Count or Pass ================= */
  function runDots(ctx) {
    const plan = shuffle([1, 1, 1, 1, 1, 1, 0, 0, 0, 0]); // 1 = clear gap, 0 = too close to call
    series(ctx, plan.length, 1, (i, done) => {
      const T = pick([20, 30, 40]);
      const gap = plan[i] ? Math.round(T * (0.35 + Math.random() * 0.2)) : 1 + rnd(3);
      const n = T + (rnd(2) ? gap : -gap);
      const field = el('div', { class: 'dots' }, '·');
      const answers = el('div');
      const go = el('button', { type: 'button', class: 'btn', onclick: flash }, 'Show the dots');
      ctx.stage.append(
        el('h2', { class: 'prompt' }, `More than ${T} dots, or fewer?`),
        field, answers, go,
        el('p', { class: 'note', style: 'margin-top:1rem' }, 'Right +1 · Wrong −2 · “I don’t know” 0'));

      function flash() {
        go.remove();
        field.textContent = '';
        const pts = [];
        let guard = 0;
        while (pts.length < n && guard++ < 4000) {
          const x = 5 + Math.random() * 90, y = 7 + Math.random() * 86;
          if (pts.every(p => Math.hypot(p[0] - x, (p[1] - y) * 0.66) > 4.2)) pts.push([x, y]);
        }
        pts.forEach(p => field.append(el('i', { style: `left:${p[0]}%;top:${p[1]}%` })));
        ctx.later(() => {
          field.textContent = '?';
          mc(answers, [
            { label: `More than ${T}`, v: 1 },
            { label: `Fewer than ${T}`, v: -1 },
            { label: 'I don’t know', v: 0 },
          ].map(o => ({ ...o, ok: o.v === 0 ? !plan[i] : (n > T) === (o.v > 0) })), o => {
            if (o.v === 0) {
              ctx.verdict(null, plan[i]
                ? `There were ${n} — far enough from ${T} to call. No points, no harm.`
                : `There were ${n}, a hair from ${T}. Nobody could see that. Good pass.`, () => done(0));
            } else if (o.ok) {
              ctx.verdict(true, `Right — there were ${n}.` + (plan[i] ? '' : ' That one was a coin flip, though.'), () => done(1));
            } else {
              ctx.verdict(false, `There were ${n}. A confident wrong answer costs two.`, () => done(-2));
            }
          }, 'row3');
        }, 900);
      }
    });
  }

  /* ================= 2. The Hidden Rule ================= */
  const RULES = [
    ['Each number is bigger than the one before', (a, b, c) => a < b && b < c],
    ['All three are even', (a, b, c) => a % 2 === 0 && b % 2 === 0 && c % 2 === 0],
    ['The steps between them are equal', (a, b, c) => b - a === c - b],
    ['All three are different', (a, b, c) => a !== b && b !== c && a !== c],
    ['The last is the biggest', (a, b, c) => c > a && c > b],
    ['The total is even', (a, b, c) => (a + b + c) % 2 === 0],
    ['The first is the smallest', (a, b, c) => a < b && a < c],
    ['The total is a multiple of 3', (a, b, c) => (a + b + c) % 3 === 0],
    ['None of them is above 20', (a, b, c) => a <= 20 && b <= 20 && c <= 20],
  ];
  function runRule(ctx) {
    const seeds = shuffle([[2, 4, 6], [4, 8, 12], [6, 12, 18]]);
    const truths = sample(RULES, 3);
    series(ctx, 3, 1, (i, done) => {
      const seed = seeds[i], truth = truths[i];
      const options = shuffle([truth, ...sample(RULES.filter(r => r !== truth), 3)]);
      let left = 8, nos = 0;
      const inputs = [0, 1, 2].map(k => el('input', { type: 'number', inputMode: 'numeric', min: 0, max: 99, 'aria-label': `Number ${k + 1}` }));
      const log = el('ul', { class: 'log' });
      const leftNote = el('p', { class: 'note' });
      const testBtn = el('button', { type: 'submit', class: 'btn small' }, 'Test');
      const upd = () => {
        leftNote.textContent = left ? `${left} tests left. Try triples you expect to fail, too.` : 'No tests left. Name the rule.';
        testBtn.disabled = !left;
      };
      const form = el('form', {
        class: 'probe',
        onsubmit: e => {
          e.preventDefault();
          const v = inputs.map(x => (x.value === '' ? NaN : Number(x.value)));
          if (!left || v.some(x => !Number.isInteger(x) || x < 0 || x > 99)) { leftNote.textContent = 'Enter three whole numbers from 0 to 99.'; return; }
          const fits = truth[1](...v);
          if (!fits) nos++;
          left--;
          log.prepend(el('li', null, el('span', null, v.join('  ')), el('span', { class: fits ? 'yes' : 'no' }, fits ? 'fits the rule' : 'does not fit')));
          inputs.forEach(x => { x.value = ''; });
          inputs[0].focus();
          upd();
        },
      }, inputs, testBtn);
      upd();
      ctx.stage.append(el('div', { class: 'stack' },
        el('p', null, 'These three numbers fit a rule:'),
        el('div', { class: 'triple' }, seed.map(x => el('span', null, String(x)))),
        form, leftNote, log),
      el('h2', { class: 'prompt', style: 'margin-top:1.6rem' }, 'When you’re sure, name the rule.'));
      mc(ctx.stage, options.map(r => ({ label: r[0], ok: r === truth })), o => {
        testBtn.disabled = true;
        const heard = nos === 0
          ? 'Every test you ran got a “yes”. A test that can’t fail can’t tell you anything.'
          : `You heard “no” ${nos} time${nos > 1 ? 's' : ''} — those were the tests that taught you something.`;
        ctx.verdict(o.ok, [el('p', null, o.ok ? 'That’s the rule.' : `The rule was: ${truth[0].toLowerCase()}.`), el('p', null, heard)], () => done(o.ok ? 1 : 0));
      });
    });
  }

  /* ================= 3. Once Only ================= */
  const TALKS = [
    {
      who: 'Maya',
      lines: ['We’re moving the launch.', 'Not because the build is late — the build is actually done.', 'Legal wants another week with the pricing page.', 'So the new date is the 21st, a Thursday.', 'I’d like you to tell the support team today.', 'But hold off on telling customers until I confirm on Monday.'],
      qs: [
        ['Why is the launch moving?', 'Legal needs more time with the pricing page', 'The build is running late', 'Support isn’t ready', 'Customers asked for more time'],
        ['What does Maya want you to do today?', 'Tell the support team', 'Tell customers the new date', 'Check in with legal', 'Nothing until Monday'],
        ['When will she confirm?', 'On Monday', 'On Thursday', 'On the 21st', 'She didn’t say'],
      ],
    },
    {
      who: 'Tom',
      lines: ['I can pick you up from the airport.', 'But only if you land before six — after that I’ve got my daughter’s recital.', 'If it’s later, take the train to Elm Street.', 'I’ll meet you there around nine.', 'Oh, and bring a jacket.', 'The heating is broken in the guest room — not the whole house, just that room.'],
      qs: [
        ['When can Tom pick you up from the airport?', 'Only if you land before six', 'Any time before nine', 'Only after the recital', 'He can’t — take the train'],
        ['If you land late, where do you meet him?', 'Elm Street, around nine', 'The airport, around nine', 'At the recital', 'At his house, at six'],
        ['What’s broken?', 'The heating in the guest room', 'The heating in the whole house', 'His car', 'The train line'],
      ],
    },
    {
      who: 'Priya',
      lines: ['The report is good. I only have two notes.', 'First, the summary buries the main number.', 'Put the 12% drop in the first sentence.', 'Second — I don’t doubt the chart, but I can’t tell where the data came from.', 'So add the source underneath it.', 'Leave everything else as it is. Please don’t rewrite the conclusion again.'],
      qs: [
        ['How many changes did Priya ask for?', 'Two', 'Three', 'A full rewrite', 'None — it’s good'],
        ['What’s her issue with the chart?', 'She can’t tell where the data came from', 'She thinks the chart is wrong', 'It’s too small to read', 'She wants it removed'],
        ['What should happen to the conclusion?', 'Leave it alone', 'Rewrite it', 'Move it to the top', 'Add the 12% drop to it'],
      ],
    },
    {
      who: 'Sam',
      lines: ['The plumber is coming Wednesday — not Tuesday, like I said before.', 'He needs to get under the kitchen sink, so please clear that out.', 'The water will be off for about an hour.', 'You don’t have to be home; I’ll let him in.', 'But text me if the dog is going to be loose.'],
      qs: [
        ['Which day is the plumber coming?', 'Wednesday', 'Tuesday', 'Thursday', 'Sam will confirm later'],
        ['Do you need to be home?', 'No — Sam will let him in', 'Yes, for the whole visit', 'Only for the first hour', 'Sam didn’t say'],
        ['When should you text Sam?', 'If the dog will be loose', 'When the plumber arrives', 'When the water is back on', 'If you can’t be home'],
      ],
    },
    {
      who: 'Coach Lena',
      lines: ['You ran the first half too fast again.', 'I’m not worried about your fitness — the last four weeks were your best.', 'It’s pacing.', 'So on Sunday, start behind the 1:50 group.', 'Don’t pass them until the bridge, around kilometre twelve.', 'If you feel great there, go.'],
      qs: [
        ['What does Lena say the problem is?', 'Pacing', 'Fitness', 'Not enough rest', 'Starting too slowly'],
        ['When may you pass the 1:50 group?', 'At the bridge, around kilometre twelve', 'Right from the start', 'At the halfway mark', 'Only in the last kilometre'],
        ['How does she describe your last four weeks?', 'Your best', 'Too fast', 'Worrying', 'Uneven'],
      ],
    },
  ];
  function runListen(ctx) {
    const talks = sample(TALKS, 2);
    const total = talks.length * 3;
    let score = 0, asked = 0;
    const doTalk = t => {
      if (t >= talks.length) return ctx.finish(score, total);
      const talk = talks[t];
      const bubble = el('p', { class: 'bubble', 'aria-live': 'polite' });
      ctx.clear();
      ctx.progress(0, 0, 'Listening');
      ctx.stage.append(el('p', { class: 'kicker', style: 'margin-bottom:0.8rem' }, `${talk.who} is talking. Each line shows once.`), bubble);
      let s = 0;
      const say = () => {
        if (s >= talk.lines.length) return ask(0);
        const line = talk.lines[s++];
        bubble.textContent = line;
        ctx.later(say, 1300 + line.length * 55);
      };
      ctx.later(say, 500);
      const ask = q => {
        if (q >= talk.qs.length) return doTalk(t + 1);
        const [text, right, ...wrong] = talk.qs[q];
        ctx.clear();
        ctx.progress(++asked, total);
        ctx.stage.append(el('p', { class: 'kicker' }, `${talk.who} has finished`), el('h2', { class: 'prompt' }, text));
        mc(ctx.stage, shuffle([{ label: right, ok: true }, ...wrong.map(w => ({ label: w }))]), o => {
          if (o.ok) score++;
          ctx.verdict(!!o.ok, o.ok ? 'That’s what was said.' : `What ${talk.who} actually said: ${right.toLowerCase()}.`, () => ask(q + 1));
        });
      };
    };
    doTalk(0);
  }

  /* ================= 4. Telephone ================= */
  const CHAINS = [
    { src: 'In a study of 48 adults, those who walked 30 minutes a day reported better sleep after six weeks.',
      tell: ['A small study found that adults who walked half an hour daily said they slept better after six weeks.', 'Walking 30 minutes a day improves sleep, a study has found.', 'Scientists: a daily walk cures insomnia.'],
      bad: 1, why: '48 people “reporting” better sleep became a flat fact about what walking does.' },
    { src: 'The council voted 5–4 to study closing Main Street to cars on weekends.',
      tell: ['Council to close Main Street to cars on weekends after 5–4 vote.', 'Main Street is going car-free on weekends.', 'City bans cars downtown.'],
      bad: 0, why: 'They voted to study it, not to do it.' },
    { src: 'Revenue rose 8% from last year, while profit fell 3% because of higher shipping costs.',
      tell: ['Revenue was up 8% year over year, but profit dipped 3% on shipping costs.', 'Sales grew 8% on the year; higher shipping costs trimmed profit by 3%.', 'Company grows 8% in a strong year.'],
      bad: 2, why: 'The falling profit quietly disappeared, and “strong” was added.' },
    { src: 'The author writes: “I rarely drink coffee after noon, though I don’t think it matters for most people.”',
      tell: ['The author says she seldom has coffee after noon, but doubts it matters for most people.', 'Author’s advice: don’t drink coffee after noon.', 'Experts warn against afternoon coffee.'],
      bad: 1, why: 'A personal habit — with an explicit “it probably doesn’t matter” — turned into advice.' },
    { src: 'The update fixes a crash on older phones; about 2% of all users were affected.',
      tell: ['The update fixes an older-phone crash that hit about 2% of all users.', 'Roughly one user in fifty was hit by the older-phone crash this update fixes.', 'Update fixes a crash that hit 20% of users.'],
      bad: 2, why: '2% became 20%. One in fifty and 2% are the same number.' },
    { src: 'Of 200 customers surveyed, 60% said they would consider switching if prices rose again.',
      tell: ['60% of customers will switch if prices rise again, survey shows.', 'Most customers are set to leave over prices.', 'Customers are abandoning the brand.'],
      bad: 0, why: '“Would consider” became “will”, and 200 people surveyed became all customers.' },
    { src: 'The bridge will close for repairs from 10pm to 5am on weeknights in March.',
      tell: ['Overnight repairs will shut the bridge on March weeknights, 10pm to 5am.', 'The bridge is closed on weeknights in March, from 10 at night until 5 in the morning.', 'Bridge closed throughout March for repairs.'],
      bad: 2, why: 'Seven hours a night on weeknights became the whole month.' },
  ];
  function runTelephone(ctx) {
    const chains = sample(CHAINS, 4);
    series(ctx, chains.length, 1, (i, done) => {
      const c = chains[i];
      ctx.stage.append(
        el('h2', { class: 'prompt' }, 'Tap the first retelling that says something the source doesn’t.'),
        el('div', { class: 'source' }, el('span', { class: 'tag' }, 'The source'), c.src));
      mc(ctx.stage, c.tell.map((t, k) => ({ label: [el('span', { class: 'tag' }, ['Retold once', 'Retold twice', 'Retold three times'][k]), t], ok: k === c.bad, k })), o => {
        const hint = o.ok ? '' : o.k < c.bad ? ' The one you picked still matches the source.' : ' It had already gone wrong one step earlier.';
        ctx.verdict(!!o.ok, c.why + hint, () => done(o.ok ? 1 : 0));
      });
    });
  }

  /* ================= 5. Plain Words ================= */
  // each: term, textbook line, [plain and true, plain but wrong, still jargon, says nothing]
  const PLAIN = [
    ['Compound interest', 'Interest accrues on both the principal and previously accumulated interest.',
      'You earn interest on your savings, and then you earn interest on that interest too.',
      'The bank pays you the same amount of interest every year.',
      'Returns are capitalised periodically, enlarging the interest-bearing base.',
      'Your money works for you over time.'],
    ['Inflation', 'A sustained increase in the general price level.',
      'Over time the same money buys a little less, because prices keep creeping up.',
      'It’s when one thing, like petrol, suddenly gets expensive.',
      'Purchasing power erodes as aggregate prices trend upward.',
      'It’s when the economy heats up.'],
    ['A vaccine', 'Primes adaptive immunity through controlled antigen exposure.',
      'It shows your body a harmless piece of a germ, so it learns to fight the real one.',
      'It’s a medicine that kills the germ once you’re sick.',
      'It elicits an antibody response to a target pathogen.',
      'It boosts your health against illness.'],
    ['Opportunity cost', 'The value of the best alternative forgone.',
      'Whatever you choose, you give up the best other thing you could have had instead.',
      'It’s the extra money you pay when you miss a good deal.',
      'The implicit cost of the next-best foregone allocation.',
      'Every choice has a price.'],
    ['Encryption', 'Transforms plaintext into ciphertext using a cryptographic key.',
      'It scrambles a message so that only someone with the right key can read it.',
      'It hides a message so that nobody can ever read it again.',
      'It encodes data with a cipher so it is unintelligible without the key material.',
      'It keeps your data safe online.'],
    ['Natural selection', 'Differential reproductive success shifts trait frequencies across generations.',
      'Creatures born with traits that help them survive have more babies, so those traits spread.',
      'Animals change their bodies during their lives to suit where they live.',
      'Heritable variation in fitness drives changes in a population’s gene pool.',
      'Nature picks the strongest.'],
    ['The placebo effect', 'A beneficial response attributable to expectation rather than to the intervention.',
      'People can feel better just because they believe they were treated, even if the pill does nothing.',
      'It’s when a fake pill secretly contains real medicine.',
      'A psychogenic improvement following an inert intervention.',
      'Mind over matter.'],
  ];
  const PLAIN_MISS = ['', 'Simple — but it isn’t true.', 'True — but it’s still jargon. A twelve-year-old would be lost.', 'Short — but it doesn’t actually say how it works.'];
  function runPlain(ctx) {
    const items = sample(PLAIN, 4);
    series(ctx, items.length, 1, (i, done) => {
      const [term, book, ...opts] = items[i];
      ctx.stage.append(
        el('p', { class: 'kicker' }, term),
        el('p', { class: 'note', style: 'margin:0.4rem 0 0' }, `Textbook: “${book}”`),
        el('h2', { class: 'prompt', style: 'margin-top:1rem' }, 'Which one explains it to a twelve-year-old — simply, and still correctly?'));
      mc(ctx.stage, shuffle(opts.map((label, k) => ({ label, ok: k === 0, k }))), o => {
        ctx.verdict(!!o.ok, o.ok ? 'Plain, and still true.' : PLAIN_MISS[o.k], () => done(o.ok ? 1 : 0));
      });
    });
  }

  /* ================= 6. Footprints ================= */
  const FW = 7, FH = 5;
  function makeField() {
    for (;;) {
      const safe = new Set();
      let r = rnd(FH), c = 0;
      safe.add(r * FW);
      while (c < FW - 1) {
        const m = rnd(3);
        if (m === 0 && r > 0) r--; else if (m === 1 && r < FH - 1) r++; else c++;
        safe.add(r * FW + c);
      }
      const all = [...Array(FW * FH).keys()];
      const mines = new Set(shuffle(all.filter(k => !safe.has(k))).slice(0, 10));
      const prints = new Set(), dead = new Set();
      let ghosts = 0, tries = 0;
      while (ghosts < 5 && tries++ < 300) {
        let p = rnd(FH) * FW;
        const path = [];
        const seen = new Set([p]);
        let died = -1;
        if (mines.has(p)) died = p;
        for (let step = 0; died < 0 && step < 14; step++) {
          path.push(p);
          const pr = Math.floor(p / FW), pc = p % FW;
          if (pc === FW - 1) break; // made it across — a full safe path would give the game away
          const opts = [];
          if (pc < FW - 1) opts.push(p + 1, p + 1, p + 1);
          if (pr > 0) opts.push(p - FW);
          if (pr < FH - 1) opts.push(p + FW);
          const go = opts.filter(k => !seen.has(k));
          if (!go.length) break;
          p = pick(go);
          seen.add(p);
          if (mines.has(p)) died = p;
        }
        if (died < 0 || dead.has(died)) continue;
        dead.add(died);
        path.forEach(k => prints.add(k));
        ghosts++;
      }
      if (ghosts === 5) return { mines, prints, dead };
    }
  }
  function runFootprints(ctx) {
    series(ctx, 3, 3, (i, done) => {
      const f = makeField();
      const walked = new Set(), found = new Set();
      let pos = -1, hits = 0, over = false, fresh = -1;
      const grid = el('div', { class: 'field' });
      const status = el('p', { class: 'note', role: 'status' });
      ctx.stage.append(
        el('h2', { class: 'prompt' }, 'Cross the field, left to right.'),
        grid,
        el('div', { class: 'field-ends' }, el('span', null, '← start'), el('span', null, 'far side →')),
        status,
        el('p', { class: 'legend', style: 'margin-top:0.6rem' },
          el('span', null, el('b', null, '• '), 'someone walked here safely'),
          el('span', null, el('b', { style: 'color:var(--bad)' }, '✕ '), 'someone’s walk ended here')));

      const reach = k => {
        if (over || f.dead.has(k) || found.has(k)) return false;
        if (pos < 0) return k % FW === 0;
        const dr = Math.abs(Math.floor(k / FW) - Math.floor(pos / FW)), dc = Math.abs(k % FW - pos % FW);
        return dr + dc === 1;
      };
      const draw = focus => {
        grid.replaceChildren();
        for (let k = 0; k < FW * FH; k++) {
          const isMine = f.dead.has(k) || found.has(k);
          const can = reach(k);
          const cls = ['cell'];
          let ch = '', label = 'unknown ground';
          if (isMine) { cls.push('mine'); ch = '✕'; label = 'mine'; if (k === fresh) cls.push('fresh'); }
          else if (k === pos) { cls.push('here'); ch = '●'; label = 'you are here'; }
          else if (walked.has(k)) { cls.push('walked'); ch = '●'; label = 'your path'; }
          else if (f.prints.has(k)) { cls.push('print'); ch = '•'; label = 'safe footprints'; }
          else if (over && f.mines.has(k)) { cls.push('hidden-mine'); ch = '✕'; label = 'hidden mine'; }
          if (can) cls.push('can');
          const b = el('button', {
            type: 'button', class: cls.join(' '), disabled: !can,
            'aria-label': `Row ${Math.floor(k / FW) + 1}, column ${k % FW + 1}: ${label}`,
            onclick: () => step(k),
          }, ch);
          grid.append(b);
          if (k === focus) b.focus({ preventScroll: true });
        }
        status.textContent = over ? '' : `Mines you can still afford to hit: ${2 - hits}.` + (pos < 0 ? ' Start anywhere in the left column.' : '');
      };
      const step = k => {
        if (f.mines.has(k)) {
          hits++; found.add(k); fresh = k;
          if (hits >= 3) {
            over = true; draw();
            return ctx.verdict(false, 'Three mines — the crossing is over. The grey marks are the ones nobody had found yet.', () => done(0));
          }
          return draw(pos);
        }
        pos = k; walked.add(k); fresh = -1;
        if (k % FW === FW - 1) {
          over = true; draw();
          const used = [...walked].filter(x => f.prints.has(x)).length;
          return ctx.verdict(hits === 0 ? true : null,
            (hits === 0 ? 'Across without a scratch.' : `Across, after hitting ${hits} mine${hits > 1 ? 's' : ''}.`) +
            ` ${used} of your ${walked.size} steps were in someone else’s footprints.`, () => done(3 - hits));
        }
        draw(k);
      };
      draw();
    });
  }

  /* ================= 7. The Shortest Rule ================= */
  const DIM = { size: ['big', 'small'], color: ['red', 'blue', 'yellow'], shape: ['circle', 'square', 'triangle'] };
  const DIMS = Object.keys(DIM);
  const ALL_ITEMS = [];
  DIM.size.forEach(size => DIM.color.forEach(color => DIM.shape.forEach(shape => ALL_ITEMS.push({ size, color, shape }))));
  const HEX = { red: '#f0605d', blue: '#5b9bff', yellow: '#f5cf4a' };
  const describe = f => [f.size, f.color, f.shape ? f.shape + 's' : 'ones'].filter(Boolean).join(' ');
  function shapeSvg(it) {
    const s = it.size === 'big' ? 1 : 0.55, c = HEX[it.color];
    const body = it.shape === 'circle' ? `<circle cx="24" cy="24" r="${20 * s}" fill="${c}"/>`
      : it.shape === 'square' ? `<rect x="${24 - 19 * s}" y="${24 - 19 * s}" width="${38 * s}" height="${38 * s}" rx="3" fill="${c}"/>`
        : `<path d="M24 ${24 - 21 * s} L${24 + 22 * s} ${24 + 18 * s} L${24 - 22 * s} ${24 + 18 * s} Z" fill="${c}"/>`;
    return `<svg viewBox="0 0 48 48" aria-hidden="true">${body}</svg>`;
  }
  function makeOccam() {
    for (;;) {
      const d = pick(DIMS), v = pick(DIM[d]);
      const items = sample(ALL_ITEMS, 6);
      const ins = items.filter(x => x[d] === v);
      if (ins.length < 2 || ins.length > 4) continue;
      const fits = (dd, vv) => items.every(x => (x[dd] === vv) === (x[d] === v));
      const singles = [];
      DIMS.forEach(dd => DIM[dd].forEach(vv => { if (dd !== d || vv !== v) singles.push([dd, vv]); }));
      if (singles.some(s => fits(...s))) continue;
      const [wd, wv] = pick(singles.filter(s => s[0] !== d));
      const unseen = ALL_ITEMS.filter(x => !items.includes(x));
      const base = describe({ [d]: v });
      const extra = rnd(2)
        ? `${cap(base)}, except ${describe(pick(unseen.filter(x => x[d] === v)))}`
        : `${cap(base)}, plus ${describe(pick(unseen.filter(x => x[d] !== v)))}`;
      const od = pick(DIMS.filter(k => k !== d));
      const ov = pick(DIM[od].filter(vv => !ins.every(x => x[od] === vv)));
      return {
        items, ins, outs: items.filter(x => x[d] !== v),
        options: shuffle([
          { label: cap(base), ok: true },
          { label: cap(describe({ [wd]: wv })), miss: 'That one doesn’t fit what you can see — check each pile again.' },
          { label: extra, miss: 'It fits — but it adds a clause nothing here asks for. The plain version explains just as much.' },
          { label: 'Only ' + describe({ [d]: v, [od]: ov }), miss: 'That one is narrower than the evidence: something in the box breaks it.' },
        ]),
      };
    }
  }
  function runOccam(ctx) {
    series(ctx, 5, 1, (i, done) => {
      const g = makeOccam();
      const pile = (cls, title, list) => el('div', { class: 'pile ' + cls },
        el('span', { class: 'tag' }, title),
        el('div', { class: 'pile-items' }, list.map(it => el('div', { class: 'item', html: shapeSvg(it) + `<span>${it.size} ${it.color} ${it.shape}</span>` }))));
      ctx.stage.append(
        el('h2', { class: 'prompt' }, 'What’s the simplest rule that fits everything here?'),
        el('div', { class: 'evidence' }, pile('in', 'In the box', g.ins), pile('', 'Left out', g.outs)));
      mc(ctx.stage, g.options, o => ctx.verdict(!!o.ok, o.ok ? 'Fits everything, assumes nothing extra.' : o.miss, () => done(o.ok ? 1 : 0)));
    });
  }

  /* ================= 8. Compared to What? ================= */
  const CLAIMS = [
    { q: 'Which one prevents more cases?', names: ['Programme A', 'Programme B'], pcts: [10, 20, 25, 40, 50, 75], bases: [20, 40, 80, 200, 400, 1000, 2000],
      head: p => `Cuts the risk by ${p}%`, base: b => `Before: ${b.toLocaleString('en')} cases per 100,000 people`, eff: n => `${n.toLocaleString('en')} fewer cases per 100,000` },
    { q: 'Which one added more sales?', names: ['Team A', 'Team B'], pcts: [10, 20, 25, 50, 100, 200], bases: [20, 40, 100, 300, 800, 2000],
      head: p => `Sales up ${p}%`, base: b => `From ${b.toLocaleString('en')} sales a month`, eff: n => `${n.toLocaleString('en')} more sales a month` },
    { q: 'Which one saves you more money?', names: ['Shop A', 'Shop B'], pcts: [10, 20, 25, 40, 50, 60], bases: [20, 40, 60, 120, 200, 400, 800],
      head: p => `${p}% off`, base: b => `Usual price: $${b}`, eff: n => `$${n} saved` },
  ];
  function runCompared(ctx) {
    const plan = shuffle([true, true, true, false, false, false]); // does the bigger headline also win?
    let blind = 0;
    series(ctx, plan.length, 1, (i, done) => {
      const kind = CLAIMS[i % CLAIMS.length];
      let p, b, e;
      for (;;) {
        p = sample(kind.pcts, 2); b = sample(kind.bases, 2);
        e = [p[0] * b[0] / 100, p[1] * b[1] / 100];
        if (Math.max(...e) / Math.min(...e) < 1.25) continue;
        if (((p[0] > p[1]) === (e[0] > e[1])) === plan[i]) break;
      }
      const win = e[0] > e[1] ? 0 : 1;
      const asked = [false, false];
      const cards = [0, 1].map(k => {
        const baseBox = el('div', { class: 'claim-base' });
        const reveal = () => { asked[k] = true; baseBox.replaceChildren(kind.base(b[k])); };
        baseBox.append(el('button', { type: 'button', class: 'linkish', onclick: reveal }, 'Compared to what?'));
        const choose = el('button', { type: 'button', class: 'btn small', onclick: () => answer(k) }, `Choose ${kind.names[k].slice(-1)}`);
        const card = el('div', { class: 'claim' }, el('span', { class: 'tag' }, kind.names[k]), el('p', { class: 'claim-head' }, kind.head(p[k])), baseBox, choose);
        return { card, baseBox, choose };
      });
      const answer = k => {
        const wasBlind = !(asked[0] && asked[1]);
        if (wasBlind) blind++;
        cards.forEach((c, j) => {
          c.choose.disabled = true;
          c.baseBox.replaceChildren(kind.base(b[j]), el('strong', null, kind.eff(e[j])));
        });
        cards[win].card.classList.add('is-right');
        if (k !== win) cards[k].card.classList.add('is-wrong');
        const ok = k === win;
        ctx.verdict(ok, (ok ? `${kind.names[win]} it is.` : `${kind.names[win]} did more.`) +
          (wasBlind ? (ok ? ' You chose without asking for both baselines, though — that was luck.' : ' You chose without asking what the percentage was a percentage of.') : ''),
        () => done(ok ? 1 : 0));
      };
      ctx.stage.append(el('h2', { class: 'prompt' }, kind.q), el('div', { class: 'claims' }, cards.map(c => c.card)));
    });
  }

  /* ================= 9. Six Months Later ================= */
  const PLANS = [
    { name: 'The street fair',
      brief: 'You’re running the neighbourhood’s first street fair, outdoors, this Saturday in early April. Forty stalls are booked and all of them need electricity; the street has two outdoor sockets. The permit application went in on Monday — the council usually answers within ten working days. Posters have been up for three weeks, the local paper ran a piece, and your volunteer list is long and keen.',
      real: [['There isn’t enough power for the stalls', 'Forty stalls, two sockets.'], ['The permit doesn’t arrive in time', 'Applied Monday, ten working days, fair on Saturday.'], ['It pours with rain', 'Outdoors in early April, and no plan B in the brief.']],
      fake: [['Not enough volunteers turn up', 'The list was long and keen.'], ['Too few stalls sign up', 'Forty were already booked.'], ['Nobody hears about it', 'Posters for three weeks, plus the paper.']] },
    { name: 'The app launch',
      brief: 'Your team of five ships a new app in two weeks. Dana wrote the whole payment system alone and starts her holiday on launch day. Testing has been done on the team’s own phones, all bought this year. Marketing has an email going to 80,000 people at 9am on launch day; in last month’s trial the server handled 500 users comfortably. The design is finished and everyone likes it.',
      real: [['Payments break and only Dana can fix them', 'One author, away from launch day.'], ['It fails on older phones', 'Only this year’s phones were ever tested.'], ['The server buckles under the 9am rush', 'Proven at 500 users; 80,000 are being invited at once.']],
      fake: [['The design isn’t ready in time', 'It was already finished.'], ['Nobody knows the app exists', 'An email to 80,000 people says otherwise.'], ['The team is too big to coordinate', 'There are five of you.']] },
    { name: 'The ridge walk',
      brief: 'You’re leading six friends along a mountain ridge tomorrow, in late August. The route takes eight hours; you plan to set off at 11am and sunset is at 6pm. Everyone is fit and has done longer walks. The only water on the way is a spring the map marks “seasonal”. The forecast is clear and still. The route is saved on your phone — nobody else has it.',
      real: [['Darkness catches you on the ridge', 'Eight hours from 11am ends an hour after sunset.'], ['You run out of water', 'One “seasonal” spring, at the end of summer.'], ['Your phone dies and the route goes with it', 'A single copy of the map.']],
      fake: [['A storm rolls in', 'The forecast was clear and still.'], ['Someone isn’t fit enough to finish', 'They’ve all done longer walks.'], ['Snow blocks the path', 'It’s late August.']] },
    { name: 'Moving day',
      brief: 'You move flats on Friday. The van is booked from 9 to 1. Two friends said “probably” when you asked for help carrying. The new flat is on the fifth floor, and the building’s lift is being serviced that week. You haven’t measured the sofa; the new stairwell is narrow. Everything is boxed and labelled, and the new keys are already in your pocket.',
      real: [['Your helpers don’t show up', '“Probably” is not “yes”.'], ['No lift: five floors of stairs eat the van time', 'Lift serviced that week, van only until 1.'], ['The sofa won’t go up the stairwell', 'Unmeasured sofa, narrow stairs.']],
      fake: [['You can’t get into the new flat', 'The keys were in your pocket.'], ['The packing isn’t finished', 'Everything was boxed and labelled.'], ['The van was never booked', 'It was booked, 9 to 1.']] },
  ];
  function runPremortem(ctx) {
    const plans = sample(PLANS, 2);
    series(ctx, plans.length, 3, (i, done) => {
      const p = plans[i];
      const risks = shuffle([...p.real.map(r => ({ text: r[0], why: r[1], real: true })), ...p.fake.map(r => ({ text: r[0], why: r[1] }))]);
      const chosen = new Set();
      const lock = el('button', { type: 'button', class: 'btn', disabled: true, style: 'margin-top:1.2rem' }, 'Guard against these three');
      const box = el('div', { class: 'choices' }, risks.map(r => {
        r.btn = el('button', {
          type: 'button', class: 'choice', 'aria-pressed': 'false',
          onclick: () => {
            if (chosen.has(r)) chosen.delete(r); else if (chosen.size < 3) chosen.add(r);
            risks.forEach(x => x.btn.setAttribute('aria-pressed', String(chosen.has(x))));
            lock.disabled = chosen.size !== 3;
          },
        }, r.text);
        return r.btn;
      }));
      lock.addEventListener('click', () => {
        const got = risks.filter(r => r.real && chosen.has(r)).length;
        const shown = risks.filter(r => r.real || chosen.has(r));
        ctx.clear();
        ctx.stage.append(
          el('p', { class: 'kicker' }, p.name),
          el('h2', { class: 'prompt' }, 'Six months later…'),
          el('ul', { class: 'outcomes' }, shown.map(r => r.real
            ? el('li', { class: chosen.has(r) ? 'good' : 'bad' }, el('strong', null, r.text), el('span', null, (chosen.has(r) ? 'You saw it coming. ' : 'It happened, unguarded. ') + r.why))
            : el('li', null, el('strong', null, r.text), el('span', null, 'Never came up. ' + r.why)))));
        ctx.verdict(got === 3 ? true : got === 0 ? false : null, `You guarded against ${got} of the 3 things that actually went wrong.`, () => done(got));
      });
      ctx.stage.append(
        el('p', { class: 'kicker', style: 'margin-bottom:0.6rem' }, p.name),
        el('p', { class: 'brief' }, p.brief),
        el('h2', { class: 'prompt' }, 'Imagine it failed. Pick the three most likely reasons.'),
        box, lock);
    });
  }

  /* ================= 10. Second Marble ================= */
  const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V5M5 11l7-7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function roll(board, start) { // mutates board
    let p = start;
    const path = [p];
    for (let s = 0; s < 12; s++) {
      const d = board[p];
      board[p] = (d + 1) % 4;
      const r = (p >> 2) + DR[d], c = (p & 3) + DC[d];
      if (r < 0 || r > 3 || c < 0 || c > 3) return { path, exit: p };
      p = r * 4 + c;
      path.push(p);
    }
    return null;
  }
  function makeMarbles() {
    for (;;) {
      const board = Array.from({ length: 16 }, () => rnd(4));
      const start = rnd(16);
      const b = board.slice();
      const one = roll(b, start);
      if (!one || one.path.length < 3) continue;
      const two = roll(b, start);
      if (!two || two.path.length < 3 || two.exit === one.exit) continue;
      return { board, start, one, two };
    }
  }
  function runMarbles(ctx) {
    series(ctx, 4, 1, (i, done) => {
      const g = makeMarbles();
      const turns = g.board.slice();
      const names = ['up', 'right', 'down', 'left'];
      const tiles = g.board.map((d, k) => el('button', {
        type: 'button', class: 'tile' + (k === g.start ? ' start' : ''), html: ARROW,
        onclick: () => answer(k),
      }));
      const paint = k => {
        tiles[k].firstChild.style.transform = `rotate(${turns[k] * 90}deg)`;
        tiles[k].setAttribute('aria-label', `Row ${(k >> 2) + 1}, column ${(k & 3) + 1}, arrow pointing ${names[turns[k] % 4]}${k === g.start ? ', the drop tile' : ''}`);
      };
      tiles.forEach((t, k) => paint(k));
      const status = el('p', { class: 'note', role: 'status', style: 'text-align:center' }, 'The ringed tile is where both marbles are dropped.');
      ctx.stage.append(
        el('h2', { class: 'prompt' }, 'Tap the tile the second marble leaves the board from.'),
        el('div', { class: 'board' }, tiles), status);

      const answer = k => {
        tiles.forEach(t => { t.disabled = true; });
        if (k !== g.two.exit) tiles[k].classList.add('picked');
        const run = (m, label, then) => {
          let s = 0;
          status.textContent = label;
          const tick = () => {
            tiles.forEach(t => t.classList.remove('marble'));
            if (s > 0) { turns[m.path[s - 1]]++; paint(m.path[s - 1]); }
            if (s >= m.path.length) return ctx.later(then, 350);
            tiles[m.path[s++]].classList.add('marble');
            ctx.later(tick, 380);
          };
          tick();
        };
        run(g.one, 'First marble…', () => run(g.two, 'Second marble, on the board the first one left behind…', () => {
          tiles[g.two.exit].classList.add('exit');
          status.textContent = '';
          const ok = k === g.two.exit;
          ctx.verdict(ok, ok ? 'Exactly — you followed the board as the first marble left it.'
            : k === g.one.exit ? 'That’s where the first marble left. It turned every tile it touched, so the second one took a different road.'
              : 'The green tile is the exit. Trace the first marble, turn each tile it leaves, then trace again.', () => done(ok ? 1 : 0));
        }));
      };
    });
  }

  /* ================= 11. Start from the End ================= */
  function makeChain(len) {
    for (;;) {
      let x = 2 + rnd(11);
      const start = x, ops = [], vals = [];
      let ok = true, mult = 0;
      for (let i = 0; i < len && ok; i++) {
        const t = rnd(5);
        const prev = ops.length ? ops[ops.length - 1][0] : '';
        if (t === 0 && prev !== '−') { const n = 1 + rnd(9); x += n; ops.push(['+', n, '−']); }
        else if (t === 1 && prev !== '+') { const n = 1 + rnd(9); if (x - n < 1) ok = false; x -= n; ops.push(['−', n, '+']); }
        else if (t === 2 && prev !== '÷') { x *= 2; mult++; ops.push(['×', 2, '÷']); }
        else if (t === 3) { x *= 3; mult++; ops.push(['×', 3, '÷']); }
        else if (t === 4 && prev !== '×' && x % 2 === 0) { x /= 2; mult++; ops.push(['÷', 2, '×']); }
        else ok = false;
        vals.push(x);
      }
      if (ok && mult && x <= 150) return { start, ops, vals, end: x };
    }
  }
  function runBackwards(ctx) {
    const lens = [2, 3, 3, 4, 5];
    series(ctx, lens.length, 1, (i, done) => {
      const g = makeChain(lens[i]);
      const input = el('input', { type: 'number', inputMode: 'numeric', 'aria-label': 'The starting number' });
      const btn = el('button', { type: 'submit', class: 'btn' }, 'Check');
      const form = el('form', {
        class: 'answer',
        onsubmit: e => {
          e.preventDefault();
          if (input.value === '') return input.focus();
          input.disabled = btn.disabled = true;
          const ok = Number(input.value) === g.start;
          const back = [String(g.end)];
          for (let k = g.ops.length - 1; k >= 0; k--) {
            back.push(`${g.ops[k][2]}${g.ops[k][1]}`, '=', String(k ? g.vals[k - 1] : g.start));
          }
          ctx.verdict(ok, [el('p', null, ok ? `Yes — ${g.start}.` : `It was ${g.start}.`), el('p', null, 'From the end, undoing each step: ' + back.join(' '))], () => done(ok ? 1 : 0));
        },
      }, input, btn);
      ctx.stage.append(
        el('h2', { class: 'prompt' }, 'What number did it start with?'),
        el('div', { class: 'chain' },
          el('span', { class: 'q' }, '?'),
          g.ops.map(o => [el('i', null, '→'), el('span', null, `${o[0]} ${o[1]}`)]),
          el('i', null, '→'), el('span', { class: 'end' }, `= ${g.end}`)),
        form);
      input.focus({ preventScroll: true });
    });
  }

  /* ================= 12. The Fence ================= */
  // [the odd thing, why it is still needed, why it is truly dead] — one of the two is picked at random
  const FENCES = [
    ['A two-second pause before the nightly upload script runs', 'The file server needs two seconds to release its lock. Without the pause, every upload fails.', 'It was added for a tape drive that was scrapped in 2019.'],
    ['A brick on the lid of the office compost bin', 'Raccoons. Without it the lid is open by morning.', 'A builder left it there. The bin has had a latch for years.'],
    ['A rule: no releases on Fridays', 'Nobody is on call at weekends, so a Friday bug sits until Monday.', 'It dates from when releases took six hours by hand. They take four minutes now, and there is weekend cover.'],
    ['A second signature on any refund over $50', 'It’s how the last two refund frauds were caught.', 'It was demanded by a payment provider the company left three years ago.'],
    ['A gate across a path through an empty-looking field', 'Cattle graze there from May, and the path opens onto a road.', 'The farm sold its herd ten years ago. The field is a meadow now.'],
    ['A weekly meeting nobody seems to need', 'It’s the only time the night shift and day shift talk. Handover mistakes tripled the one time it lapsed.', 'It was set up for a project that shipped two years ago.'],
    ['An unused-looking “old ID” column in the customer table', 'The invoicing system still looks customers up by it every night.', 'It was left over from a migration. Nothing has read it since.'],
    ['A sign by a switch: “Do not turn off this light”', 'The same switch feeds the freezer in the next room.', 'The switch was rewired last year. It’s only the light now.'],
    ['An extra approval step before any blog post goes out', 'Legal checks claims about competitors there. It has stopped two lawsuits.', 'It was added for one intern in 2021, who has long since left.'],
    ['A bucket under a ceiling pipe in the stockroom', 'The pipe drips whenever the heating comes on.', 'The pipe was replaced in spring. The bucket has been dry ever since.'],
  ];
  function runFence(ctx) {
    ctx.progress(1, 1);
    const items = sample(FENCES, 6).map(f => ({ thing: f[0], live: rnd(2) === 0, why: '', asked: false, act: '' }));
    items.forEach((it, k) => { it.why = FENCES.find(f => f[0] === it.thing)[it.live ? 1 : 2]; });
    let asks = 3;
    const askNote = el('p', { class: 'note', role: 'status' });
    const commit = el('button', { type: 'button', class: 'btn', disabled: true, style: 'margin-top:1.2rem' }, 'Do it');
    const refresh = () => {
      askNote.textContent = `You have time to ask “why is this here?” about ${asks} more.`;
      items.forEach(it => {
        it.askBtn.disabled = it.asked || !asks;
        it.keep.setAttribute('aria-pressed', String(it.act === 'keep'));
        it.remove.setAttribute('aria-pressed', String(it.act === 'remove'));
      });
      commit.disabled = items.some(it => !it.act);
    };
    const cards = items.map(it => {
      const whyBox = el('p', { class: 'fence-why', hidden: true });
      it.askBtn = el('button', { type: 'button', class: 'btn ghost small', onclick: () => { it.asked = true; asks--; whyBox.hidden = false; whyBox.textContent = it.why; refresh(); } }, 'Ask why');
      it.keep = el('button', { type: 'button', onclick: () => { it.act = 'keep'; refresh(); } }, 'Keep');
      it.remove = el('button', { type: 'button', onclick: () => { it.act = 'remove'; refresh(); } }, 'Remove');
      return el('div', { class: 'fence-item' }, el('p', null, it.thing), whyBox,
        el('div', { class: 'fence-row' }, el('div', { class: 'seg', role: 'group', 'aria-label': it.thing }, it.keep, it.remove), it.askBtn));
    });
    commit.addEventListener('click', () => {
      let score = 0;
      const rows = items.map(it => {
        let pts, cls = '', head;
        if (it.act === 'remove' && it.live) { pts = -2; cls = 'bad'; head = 'Removed — and it broke something.'; }
        else if (it.act === 'remove' && it.asked) { pts = 1; cls = 'good'; head = 'Removed, knowing it was dead.'; }
        else if (it.act === 'remove') { pts = 0; head = 'Removed blind. It happened to be dead — that was luck.'; }
        else if (it.live) { pts = 1; cls = 'good'; head = it.asked ? 'Kept, knowing why.' : 'Kept. You didn’t know why — and that was reason enough.'; }
        else if (it.asked) { pts = 0; head = 'Kept, though you knew it was dead weight.'; }
        else { pts = 1; cls = 'good'; head = 'Kept. It was dead weight — but you had no way to know.'; }
        score += pts;
        return el('li', { class: cls }, el('strong', null, it.thing), el('span', null, `${head} ${it.why}`));
      });
      ctx.clear();
      ctx.stage.append(el('h2', { class: 'prompt' }, 'A month later…'), el('ul', { class: 'outcomes' }, rows));
      ctx.verdict(score >= 5 ? true : score <= 1 ? false : null, 'Removing something you understand is tidying. Removing something you don’t is gambling.', () => ctx.finish(score, 6), 'See result');
    });
    ctx.stage.append(
      el('h2', { class: 'prompt' }, 'You’ve inherited these. Tidy up.'), askNote,
      el('div', { class: 'stack', style: 'margin-top:1rem' }, cards), commit);
    refresh();
  }

  /* ================= catalogue ================= */
  const TIERS = [
    ['At the surface', '0 m'], ['Just under', '20 m'], ['Deeper', '60 m'], ['Deep water', '120 m'], ['The bottom', '200 m'],
  ];
  const GAMES = [
    { id: 'count-or-pass', tier: 0, name: 'Count or Pass', habit: 'Say “I don’t know”', run: runDots,
      how: ['A cloud of dots flashes for under a second. Were there more than the number shown, or fewer?', 'A right answer earns 1. A wrong answer costs 2. “I don’t know” costs nothing.', 'Some rounds are easy to call. Some are honestly too close. The skill is telling which is which.'],
      lesson: 'A guess dressed up as an answer costs more than an honest “I don’t know”.' },
    { id: 'hidden-rule', tier: 0, name: 'The Hidden Rule', habit: 'Ask dumb questions', run: runRule,
      how: ['Three numbers fit a secret rule. Test any triples you like, and you’ll be told whether each one fits.', 'Then name the rule from four candidates. All four fit the example you were given.', 'The obvious tests will all come back “yes”. The useful ones are the odd, dumb-looking tests that might come back “no”.'],
      lesson: 'The question that feels too dumb to ask is often the only one that can prove you wrong.' },
    { id: 'once-only', tier: 0, name: 'Once Only', habit: 'Listen more than you talk', run: runListen,
      how: ['Someone tells you something, one line at a time. Each line appears once and is gone.', 'Then you’re asked what they actually said — not what a person in their position would probably say.', 'The wrong answers are the ones you’d fill in yourself if you were only half listening.'],
      lesson: 'Most of what we “heard” is what we expected to hear.' },
    { id: 'telephone', tier: 1, name: 'Telephone', habit: 'Go to the source', run: runTelephone,
      how: ['You get a source, then the same thing retold three times, each one a step further away.', 'Somewhere along the chain the meaning changes. Tap the first retelling that says something the source doesn’t.', 'Rewording is fine. Watch for hedges that vanish, numbers that drift, and “might” becoming “will”.'],
      lesson: 'Every retelling is a chance for the claim to change. The original is usually one click away.' },
    { id: 'plain-words', tier: 1, name: 'Plain Words', habit: 'Explain it simply', run: runPlain,
      how: ['You get an idea and its textbook definition, then four ways to explain it.', 'Pick the one a twelve-year-old would follow that is also still true.', 'The others fail in three different ways: simple but wrong, right but jargon, or short and empty.'],
      lesson: 'If you can only say it in jargon, you may not understand it yet.' },
    { id: 'footprints', tier: 1, name: 'Footprints', habit: 'Learn from others’ errors', run: runFootprints,
      how: ['Cross a mined field from the left edge to the right, one step at a time — up, down, left or right.', 'Five people tried before you. Their footprints show where the ground held; a cross marks where each walk ended.', 'You can afford two mines of your own per field. The fewer you hit, the more you score.'],
      lesson: 'Someone has already paid for most of the lessons you need. Read their tracks first.' },
    { id: 'shortest-rule', tier: 2, name: 'The Shortest Rule', habit: 'Occam’s razor', run: runOccam,
      how: ['Some shapes were put in a box and some were left out, according to a rule.', 'Four rules are on offer. Pick the simplest one that fits everything you can see.', 'Beware the rule that fits perfectly but carries an extra “except…” or “plus…” that nothing in front of you calls for.'],
      lesson: 'When two explanations fit equally well, take the one that asks you to assume less.' },
    { id: 'compared-to-what', tier: 2, name: 'Compared to What?', habit: '“Compared to what?”', run: runCompared,
      how: ['Two headlines, each with an impressive percentage. Decide which one actually did more.', 'Neither card tells you what the percentage is a percentage of — unless you ask. Asking is free.', 'Half the time the bigger percentage is the smaller result.'],
      lesson: 'A number means nothing until you know what it is being measured against.' },
    { id: 'six-months-later', tier: 3, name: 'Six Months Later', habit: 'Run a pre-mortem', run: runPremortem,
      how: ['You’re handed a plan. Assume it has already failed.', 'From six possible causes, pick the three most likely. The clues are all in the brief, if you read it as a pessimist.', 'Then time runs forward and you see what really went wrong.'],
      lesson: 'It is far easier to explain a failure that has “already happened” than to predict one that might.' },
    { id: 'second-marble', tier: 3, name: 'Second Marble', habit: 'Second-order thinking', run: runMarbles,
      how: ['A marble dropped on a tile rolls where the arrow points, tile to tile, until it rolls off the board.', 'Every tile turns a quarter-turn clockwise as the marble leaves it.', 'Two marbles are dropped on the same ringed tile, one after the other. Where does the second one leave the board? To know, you have to work out what the first one changed.'],
      lesson: 'The first effect is easy to see. Ask “and then what?” and the board looks different.' },
    { id: 'start-from-the-end', tier: 3, name: 'Start from the End', habit: 'Solve it backwards', run: runBackwards,
      how: ['A hidden number goes through a chain of steps and comes out as a result you can see.', 'Find the number it started as.', 'Guessing forwards takes many tries. Walking back from the result, undoing one step at a time, takes one.'],
      lesson: 'When the start is foggy and the end is clear, begin at the end.' },
    { id: 'the-fence', tier: 4, name: 'The Fence', habit: 'Chesterton’s fence', run: runFence,
      how: ['You’ve inherited six odd-looking things: rules, objects, leftovers. Each one is either quietly holding something up, or truly dead.', 'Decide what to keep and what to remove. You only have time to ask “why is this here?” about three of them.', 'Removing dead weight you understand scores. Removing something that turns out to matter costs double.'],
      lesson: 'Don’t take a fence down until you know why it was put up.' },
  ];

  /* ================= shell ================= */
  const app = document.getElementById('app');
  let timers = [];
  const stopTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function showMenu() {
    stopTimers();
    document.title = 'Forethought — Twelve games for thinking before you act';
    app.replaceChildren(
      el('header', { class: 'masthead' },
        el('h1', { html: 'Fore<em>thought</em>' }),
        el('p', null, 'Twelve small games for the habits behind good planning. Each takes a couple of minutes, and they get less comfortable the deeper you go.')),
      ...TIERS.map(([label, depth], t) => el('section', { class: 'tier' },
        el('h2', { class: 'tier-head' }, el('span', null, label), el('span', null, depth)),
        el('ul', { class: 'games' }, GAMES.filter(g => g.tier === t).map(g => {
          const rec = store[g.id];
          return el('li', null, el('a', { class: 'game-link', href: '#/' + g.id },
            el('span', null, el('span', { class: 'game-name' }, g.name), el('span', { class: 'game-habit' }, g.habit)),
            el('span', { class: 'game-best' + (rec ? ' has' : '') }, rec ? `Best ${rec.best} / ${rec.max}` : 'Not played')));
        })))),
      el('p', { class: 'colophon' }, 'Scores are kept in this browser only. ', el('a', { href: '../' }, 'More small apps →')));
    window.scrollTo(0, 0);
  }

  function showGame(g) {
    stopTimers();
    document.title = `${g.name} — Forethought`;
    const count = el('span', { class: 'count' });
    const stage = el('div', { id: 'stage', tabIndex: -1 });
    app.replaceChildren(el('div', { class: 'bar' }, el('a', { href: '#/' }, '← All games'), count), stage);

    const ctx = {
      stage,
      later(fn, ms) { timers.push(setTimeout(fn, ms)); },
      clear() { stage.replaceChildren(); window.scrollTo(0, 0); stage.focus({ preventScroll: true }); },
      progress(i, n, text) { count.textContent = text || `${i} / ${n}`; },
      verdict(ok, body, next, label) {
        const b = el('button', { type: 'button', class: 'btn', onclick: next }, label || 'Next');
        const v = el('div', { class: 'verdict ' + (ok === true ? 'good' : ok === false ? 'bad' : ''), role: 'status' },
          typeof body === 'string' ? el('p', null, body) : el('div', null, body), b);
        stage.append(v);
        b.focus({ preventScroll: true });
        v.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      },
      finish(score, max) {
        stopTimers();
        const rec = store[g.id] || { best: -Infinity, max, plays: 0 };
        const isBest = score > rec.best;
        store[g.id] = { best: Math.max(score, rec.best), max, plays: rec.plays + 1 };
        save();
        const ratio = score / max;
        count.textContent = '';
        stage.replaceChildren(
          el('p', { class: 'kicker' }, g.name + (isBest && rec.plays ? ' · new best' : '')),
          el('p', { class: 'score' }, String(score).replace('-', '−'), el('span', null, ` / ${max}`)),
          el('p', { style: 'margin-top:0.6rem;color:var(--muted)' },
            ratio >= 0.85 ? 'Sharp.' : ratio >= 0.6 ? 'Solid.' : ratio >= 0.35 ? 'Getting there.' : 'That’s what practice is for.'),
          el('p', { class: 'lesson' }, g.lesson),
          el('div', { class: 'actions' },
            el('button', { type: 'button', class: 'btn', onclick: play }, 'Play again'),
            el('a', { class: 'btn ghost', href: '#/' }, 'All games')));
        window.scrollTo(0, 0);
      },
    };
    function play() { stopTimers(); ctx.clear(); g.run(ctx); }

    stage.append(
      el('p', { class: 'kicker' }, g.habit),
      el('h1', { class: 'title' }, g.name),
      el('div', { class: 'how' }, g.how.map(t => el('p', null, t))),
      el('div', { class: 'actions' }, el('button', { type: 'button', class: 'btn', onclick: play }, 'Start')));
    window.scrollTo(0, 0);
  }

  function route() {
    const g = GAMES.find(x => '#/' + x.id === location.hash);
    if (g) showGame(g); else showMenu();
  }
  window.addEventListener('hashchange', route);
  route();
})();
