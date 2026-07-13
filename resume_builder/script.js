/* Resume Typesetter — form on the left, LaTeX-style letter page on the right. */
"use strict";

const LS_KEY = "resume-typesetter-v1";
const PAGE_W = 816;  // 8.5in at 96dpi
const PAGE_H = 1056; // 11in at 96dpi

/* ---------------- sample data ---------------- */

const SAMPLE = {
  name: "John Doe",
  location: "San Francisco, CA",
  phone: "+1 (555) 010-1234",
  email: "john.doe@example.com",
  linkedin: "linkedin.com/in/johndoe",
  github: "github.com/johndoe",
  website: "johndoe.dev",
  summary:
    "Full-stack software engineer with 7+ years building and shipping production systems --- backends, data pipelines, and web apps. Comfortable owning a feature end-to-end, from infrastructure to UI, and mentoring the engineers around me.",
  experience: [
    {
      company: "Acme Corp",
      role: "Senior Software Engineer",
      dates: "January 2022 -- Present",
      bullets: [
        "Lead backend development for a **high-traffic SaaS platform** serving **millions of requests per day**",
        "Designed and shipped a **real-time analytics pipeline** that cut reporting latency **from minutes to seconds**",
        "Own **billing, subscriptions, and payments** end-to-end across the product",
        "Reshaped the release process from **weekly** to **multiple deploys per day**",
        "Mentor a team of **4 engineers** and drive architecture, code quality, and delivery cadence",
      ].join("\n"),
    },
    {
      company: "Globex",
      role: "Software Engineer",
      dates: "June 2019 -- December 2021",
      bullets: [
        "Built and maintained **REST and GraphQL APIs** powering the company's flagship web app",
        "Migrated a legacy monolith to **containerized microservices**, improving deploy reliability",
        "Introduced an **automated test suite** that raised coverage from **20% to 80%**",
        "Collaborated with product and design to ship features from spec to production ([example.com](https://example.com))",
      ].join("\n"),
    },
    {
      company: "Initech",
      role: "Junior Software Developer",
      dates: "July 2017 -- May 2019",
      bullets: [
        "Developed internal **CRM and reporting tools** used across the sales organization",
        "Automated recurring data-entry tasks, **saving the team several hours per week**",
      ].join("\n"),
    },
  ],
  education: [
    {
      school: "State University",
      location: "Springfield, USA",
      degree: "Bachelor's degree, Computer Science",
      dates: "September 2013 -- June 2017",
    },
  ],
  skills: [
    { label: "Backend & Data", value: "Python, FastAPI, PostgreSQL, Redis, RabbitMQ, ETL" },
    { label: "Frontend", value: "JavaScript, TypeScript, React, HTML, CSS" },
    { label: "Cloud & Infra", value: "AWS, Docker, Kubernetes, CI/CD" },
    { label: "Practices", value: "Testing, Code Review, Agile, Mentoring" },
    { label: "Languages", value: "English (Native), Spanish (Conversational)" },
  ],
};

const BLANK = {
  name: "", location: "", phone: "", email: "", linkedin: "", github: "", website: "",
  summary: "",
  experience: [{ company: "", role: "", dates: "", bullets: "" }],
  education: [{ school: "", location: "", degree: "", dates: "" }],
  skills: [{ label: "", value: "" }],
};

/* ---------------- state ---------------- */

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function normalize(raw) {
  const s = clone(BLANK);
  if (!raw || typeof raw !== "object") return s;
  for (const k of ["name", "location", "phone", "email", "linkedin", "github", "website", "summary"]) {
    if (typeof raw[k] === "string") s[k] = raw[k];
  }
  const pick = (o, keys) => {
    const out = {};
    keys.forEach((k) => (out[k] = typeof (o || {})[k] === "string" ? o[k] : ""));
    return out;
  };
  if (Array.isArray(raw.experience)) s.experience = raw.experience.map((j) => pick(j, ["company", "role", "dates", "bullets"]));
  if (Array.isArray(raw.education)) s.education = raw.education.map((e) => pick(e, ["school", "location", "degree", "dates"]));
  if (Array.isArray(raw.skills)) s.skills = raw.skills.map((e) => pick(e, ["label", "value"]));
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch (_) {
    return null;
  }
}

let state = loadState() || clone(SAMPLE);
const openEntries = new WeakSet(); // which experience/education cards are expanded

/* ---------------- dom refs ---------------- */

const editor = document.getElementById("editor");
const sheet = document.getElementById("sheet");
const scaler = document.getElementById("scaler");
const desk = document.getElementById("desk");
const saveState = document.getElementById("save-state");
const fileImport = document.getElementById("file-import");

/* ---------------- text formatting (mini-TeX) ---------------- */

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// **bold**, *italic*, [text](url), --- → em dash, -- → en dash
function fmt(s) {
  let t = esc(s);
  t = t.replace(/---/g, "—").replace(/--/g, "–");
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const href = /^https?:\/\//i.test(url) ? url : "https://" + url;
    return `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return t;
}

function linkify(v) {
  const clean = v.trim().replace(/\/+$/, "");
  const href = /^https?:\/\//i.test(clean) ? clean : "https://" + clean;
  const display = clean.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  return `<a class="u" href="${esc(href)}" target="_blank" rel="noopener">${esc(display)}</a>`;
}

/* ---------------- preview render ---------------- */

function renderPreview() {
  const s = state;
  const out = [];

  out.push(`<div class="r-name${s.name.trim() ? "" : " ph"}">${s.name.trim() ? fmt(s.name) : "Your Name"}</div>`);

  const contacts = [];
  if (s.location.trim()) contacts.push(esc(s.location));
  if (s.phone.trim()) contacts.push(esc(s.phone));
  if (s.email.trim()) contacts.push(`<a class="u" href="mailto:${esc(s.email.trim())}">${esc(s.email.trim())}</a>`);
  for (const k of ["linkedin", "github", "website"]) if (s[k].trim()) contacts.push(linkify(s[k]));
  if (contacts.length) out.push(`<div class="r-contact">${contacts.join(' <span class="r-sep">|</span> ')}</div>`);

  if (s.summary.trim()) {
    out.push(`<div class="r-sec">Summary</div>`);
    out.push(`<div class="r-summary">${fmt(s.summary.trim())}</div>`);
  }

  const jobs = s.experience.filter((j) => (j.company + j.role + j.dates + j.bullets).trim());
  if (jobs.length) {
    out.push(`<div class="r-sec">Experience</div>`);
    for (const j of jobs) {
      out.push(`<div class="r-job"><div class="r-jobhead">` +
        (j.company.trim() ? `<span class="r-co">${fmt(j.company)}</span>` : "") +
        (j.role.trim() ? `<span class="r-role">${fmt(j.role)}</span>` : "") +
        (j.dates.trim() ? `<span class="r-dates">${fmt(j.dates)}</span>` : "") +
        `</div>`);
      const items = j.bullets.split("\n").map((t) => t.trim()).filter(Boolean);
      if (items.length) out.push(`<ul class="r-ul">${items.map((t) => `<li>${fmt(t)}</li>`).join("")}</ul>`);
      out.push(`</div>`);
    }
  }

  const edus = s.education.filter((e) => (e.school + e.location + e.degree + e.dates).trim());
  if (edus.length) {
    out.push(`<div class="r-sec">Education</div>`);
    for (const e of edus) {
      out.push(`<div class="r-edu">` +
        `<div class="r-edurow"><span class="r-eduschool">${fmt(e.school)}</span><span class="right r-edudates">${fmt(e.dates)}</span></div>` +
        `<div class="r-edurow"><span class="r-edudegree">${fmt(e.degree)}</span><span class="right r-small">${fmt(e.location)}</span></div>` +
        `</div>`);
    }
  }

  const skills = s.skills.filter((e) => (e.label + e.value).trim());
  if (skills.length) {
    out.push(`<div class="r-sec">Skills</div>`);
    out.push(`<div class="r-skills">` +
      skills.map((e) => `<div class="r-skill">${e.label.trim() ? `<b>${fmt(e.label)}</b>: ` : ""}${fmt(e.value)}</div>`).join("") +
      `</div>`);
  }

  if (out.length === 1 && !s.name.trim()) {
    out.push(`<div class="r-empty">Start typing on the left — the page typesets as you go.</div>`);
  }

  sheet.innerHTML = out.join("");
  addBreakMarkers();
  fit();
}

function addBreakMarkers() {
  const h = sheet.scrollHeight;
  for (let k = 1; k * PAGE_H < h - 24; k++) {
    const m = document.createElement("div");
    m.className = "break-marker";
    m.style.top = k * PAGE_H + "px";
    sheet.appendChild(m);
  }
}

/* ---------------- fit page to pane ---------------- */

function fit() {
  const pad = 56;
  const scale = Math.min((desk.clientWidth - pad) / PAGE_W, 1);
  sheet.style.transform = scale < 1 ? `scale(${scale})` : "";
  scaler.style.width = Math.round(PAGE_W * scale) + "px";
  scaler.style.height = Math.round(sheet.offsetHeight * scale) + "px";
}

new ResizeObserver(fit).observe(desk);
window.addEventListener("resize", fit);

/* ---------------- form: static fields ---------------- */

function syncStaticFields() {
  editor.querySelectorAll("[data-k]:not([data-list])").forEach((el) => {
    el.value = state[el.dataset.k] || "";
    if (el.tagName === "TEXTAREA") grow(el);
  });
}

function grow(ta) {
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + 2 + "px";
}

/* ---------------- form: list editors ---------------- */

function entryControls(list, i, len) {
  return `<span class="entry-controls">` +
    `<button class="btn-ic" type="button" data-act="up" data-list="${list}" data-i="${i}" title="Move up" ${i === 0 ? "disabled" : ""}>↑</button>` +
    `<button class="btn-ic" type="button" data-act="down" data-list="${list}" data-i="${i}" title="Move down" ${i === len - 1 ? "disabled" : ""}>↓</button>` +
    `<button class="btn-ic" type="button" data-act="del" data-list="${list}" data-i="${i}" title="Remove">✕</button>` +
    `</span>`;
}

function field(label, list, i, key, opts = {}) {
  const span = opts.span2 ? " span2" : "";
  const input = opts.textarea
    ? `<textarea data-list="${list}" data-i="${i}" data-k="${key}" rows="${opts.rows || 3}" placeholder="${esc(opts.ph || "")}"></textarea>`
    : `<input type="text" data-list="${list}" data-i="${i}" data-k="${key}" placeholder="${esc(opts.ph || "")}" autocomplete="off" />`;
  return `<label class="f-field${span}"><span class="f-label">${label}</span>${input}</label>`;
}

function buildExperience() {
  const box = document.getElementById("exp-list");
  box.innerHTML = state.experience.map((j, i) => {
    const title = j.company.trim()
      ? `${esc(j.company)}${j.role.trim() ? ` <span class="muted">— ${esc(j.role)}</span>` : ""}`
      : `<span class="muted">new position</span>`;
    return `<details class="entry" data-list="experience" data-i="${i}" ${openEntries.has(j) ? "open" : ""}>` +
      `<summary><span class="entry-title">${title}</span>${entryControls("experience", i, state.experience.length)}</summary>` +
      `<div class="entry-body">` +
      field("company", "experience", i, "company", { ph: "Acme Corp" }) +
      field("role", "experience", i, "role", { ph: "Senior Software Engineer" }) +
      field("dates", "experience", i, "dates", { ph: "January 2022 -- Present", span2: true }) +
      field("bullets — one per line", "experience", i, "bullets", { textarea: true, rows: 5, span2: true, ph: "Shipped **something impressive** that…" }) +
      `</div></details>`;
  }).join("");
  box.querySelectorAll("[data-list]").forEach((el) => {
    if (!el.dataset.k) return;
    el.value = state.experience[+el.dataset.i][el.dataset.k];
    if (el.tagName === "TEXTAREA") grow(el);
  });
}

function buildEducation() {
  const box = document.getElementById("edu-list");
  box.innerHTML = state.education.map((e, i) => {
    const title = e.school.trim() ? esc(e.school) : `<span class="muted">new education</span>`;
    return `<details class="entry" data-list="education" data-i="${i}" ${openEntries.has(e) ? "open" : ""}>` +
      `<summary><span class="entry-title">${title}</span>${entryControls("education", i, state.education.length)}</summary>` +
      `<div class="entry-body">` +
      field("school", "education", i, "school", { ph: "State University" }) +
      field("location", "education", i, "location", { ph: "Springfield, USA" }) +
      field("degree", "education", i, "degree", { ph: "BSc, Computer Science" }) +
      field("dates", "education", i, "dates", { ph: "2014 -- 2018" }) +
      `</div></details>`;
  }).join("");
  box.querySelectorAll("[data-list]").forEach((el) => {
    if (!el.dataset.k) return;
    el.value = state.education[+el.dataset.i][el.dataset.k];
  });
}

function buildSkills() {
  const box = document.getElementById("skill-list");
  box.innerHTML = state.skills.map((e, i) =>
    `<div class="skill-row">` +
    `<input type="text" data-list="skills" data-i="${i}" data-k="label" placeholder="label" autocomplete="off" />` +
    `<input type="text" data-list="skills" data-i="${i}" data-k="value" placeholder="Python, FastAPI, PostgreSQL, …" autocomplete="off" />` +
    entryControls("skills", i, state.skills.length) +
    `</div>`
  ).join("");
  box.querySelectorAll("[data-list]").forEach((el) => {
    if (!el.dataset.k) return;
    el.value = state.skills[+el.dataset.i][el.dataset.k];
  });
}

function buildLists() {
  buildExperience();
  buildEducation();
  buildSkills();
}

/* ---------------- events ---------------- */

editor.addEventListener("input", (e) => {
  const el = e.target;
  const { k, list, i } = el.dataset;
  if (!k) return;
  if (list) state[list][+i][k] = el.value;
  else state[k] = el.value;
  if (el.tagName === "TEXTAREA") grow(el);
  if (list && (k === "company" || k === "role" || k === "school")) {
    const details = el.closest("details");
    if (details) {
      const item = state[list][+details.dataset.i];
      const titleEl = details.querySelector(".entry-title");
      if (list === "experience") {
        titleEl.innerHTML = item.company.trim()
          ? `${esc(item.company)}${item.role.trim() ? ` <span class="muted">— ${esc(item.role)}</span>` : ""}`
          : `<span class="muted">new position</span>`;
      } else {
        titleEl.innerHTML = item.school.trim() ? esc(item.school) : `<span class="muted">new education</span>`;
      }
    }
  }
  renderPreview();
  saveSoon();
});

editor.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  e.preventDefault();
  const { act, list, i } = btn.dataset;
  const arr = state[list];
  const idx = +i;

  if (act === "add") {
    const item = list === "experience"
      ? { company: "", role: "", dates: "", bullets: "" }
      : list === "education"
        ? { school: "", location: "", degree: "", dates: "" }
        : { label: "", value: "" };
    arr.push(item);
    openEntries.add(item);
  } else if (act === "del") {
    arr.splice(idx, 1);
  } else if (act === "up" && idx > 0) {
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
  } else if (act === "down" && idx < arr.length - 1) {
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
  }

  buildLists();
  renderPreview();
  saveSoon();
});

// remember which cards the user opened/closed
editor.addEventListener("toggle", (e) => {
  const d = e.target;
  if (!d.matches || !d.matches("details.entry")) return;
  const item = state[d.dataset.list][+d.dataset.i];
  if (d.open) openEntries.add(item);
  else openEntries.delete(item);
}, true);

/* ---------------- persistence ---------------- */

let saveTimer = null;
let saveFade = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      saveState.textContent = "✓ saved";
      saveState.classList.add("on");
      clearTimeout(saveFade);
      saveFade = setTimeout(() => saveState.classList.remove("on"), 1400);
    } catch (_) { /* storage full / private mode — preview still works */ }
  }, 300);
}

/* ---------------- toolbar ---------------- */

function resetTo(data) {
  state = clone(data);
  syncStaticFields();
  buildLists();
  renderPreview();
  saveSoon();
}

document.getElementById("btn-sample").addEventListener("click", () => {
  if (confirm("Replace everything with the sample résumé?")) resetTo(SAMPLE);
});

document.getElementById("btn-clear").addEventListener("click", () => {
  if (confirm("Clear all fields and start blank?")) resetTo(BLANK);
});

document.getElementById("btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (state.name.trim() || "resume").toLowerCase().replace(/\s+/g, "-") + "-resume.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById("btn-import").addEventListener("click", () => fileImport.click());
fileImport.addEventListener("change", () => {
  const file = fileImport.files[0];
  fileImport.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      resetTo(normalize(JSON.parse(reader.result)));
    } catch (_) {
      alert("That file doesn't look like a résumé JSON export.");
    }
  };
  reader.readAsText(file);
});

document.getElementById("btn-print").addEventListener("click", () => window.print());

// suggested PDF filename comes from the document title
const APP_TITLE = document.title;
window.addEventListener("beforeprint", () => {
  const n = state.name.trim();
  if (n) document.title = n.replace(/\s+/g, "_") + "_Resume";
});
window.addEventListener("afterprint", () => { document.title = APP_TITLE; });

/* ---------------- boot ---------------- */

syncStaticFields();
buildLists();
renderPreview();
