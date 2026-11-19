// Shared app setup: data loading, nav, hero typing, tooltip, incident drawer.
const App = (window.App = {});

App.KIND_LABEL = { testing: "Lab test", public: "Real world" };
App.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

App.ready = d3.json("data/site-data.json").then((data) => {
  data.byId = new Map(data.incidents.map((d) => [d.id, d]));
  App.data = data;
  return data;
});

/* ---------- Nav ---------- */
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
toggle.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  toggle.setAttribute("aria-expanded", String(open));
});
links.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    links.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

/* ---------- Hero typing effect ---------- */
(function typing() {
  const lines = [
    '> agent.run(goal="make all tests pass")',
    "> deleting tests/... done",
    "> all tests pass ✓",
  ];
  const el = document.getElementById("typed");
  if (App.reducedMotion) {
    el.textContent = lines[lines.length - 1];
    return;
  }
  let line = 0, char = 0;
  (function type() {
    const current = lines[line];
    el.textContent = current.slice(0, ++char);
    if (char < current.length) return setTimeout(type, 45);
    setTimeout(() => {
      line = (line + 1) % lines.length;
      char = 0;
      type();
    }, 1600);
  })();
})();

/* ---------- Helpers ---------- */
App.esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

App.kindBadge = (kind) => `<span class="badge ${kind}">${App.KIND_LABEL[kind]}</span>`;

/* ---------- Tooltip ---------- */
const tip = document.getElementById("tooltip");
App.tooltip = {
  show(html, event) {
    tip.innerHTML = html;
    tip.hidden = false;
    this.move(event);
  },
  move(event) {
    const pad = 14;
    const { innerWidth: w, innerHeight: h } = window;
    const r = tip.getBoundingClientRect();
    let x = event.clientX + pad, y = event.clientY + pad;
    if (x + r.width > w - 8) x = event.clientX - r.width - pad;
    if (y + r.height > h - 8) y = event.clientY - r.height - pad;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  },
  hide() { tip.hidden = true; },
};

/* ---------- Incident drawer ---------- */
const drawer = document.getElementById("drawer");
const backdrop = document.getElementById("drawer-backdrop");
const drawerBody = document.getElementById("drawer-body");
let lastFocus = null;

App.openIncident = (id) => {
  const d = App.data.byId.get(id);
  if (!d) return;
  const e = App.esc;
  const behaviors = d.behaviors.map((b) => `<span class="badge tag">${e(b)}</span>`).join("");
  drawerBody.innerHTML = `
    <div class="badges">${App.kindBadge(d.kind)}<span class="badge date">${e(d.dates)}</span>${behaviors}</div>
    <h3 id="drawer-title">${e(d.title)}</h3>
    <p class="drawer-summary">${e(d.summary)}</p>
    <h4>What happened</h4>
    <p>${e(d.what)}</p>
    ${d.affected ? `<h4>Who was affected</h4><p>${e(d.affected)}</p>` : ""}
    ${d.model ? `<h4>AI model</h4><p>${e(d.model)}${d.developer ? ` (${e(d.developer)})` : ""}</p>` : ""}
    <div class="drawer-links">
      <a class="btn" href="${e(d.source)}" target="_blank" rel="noopener">Read the original source &nearr;</a>
      <a class="btn ghost" href="${e(d.page)}" target="_blank" rel="noopener">AI Misalignment Watch entry &nearr;</a>
    </div>
    <p class="drawer-meta">${d.reports} report${d.reports === 1 ? "" : "s"} in the dataset</p>`;
  lastFocus = document.activeElement;
  backdrop.hidden = false;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  drawer.scrollTop = 0;
  drawer.focus();
  App.tooltip.hide();
};

App.closeIncident = () => {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  backdrop.hidden = true;
  if (lastFocus) lastFocus.focus();
};

document.getElementById("drawer-close").addEventListener("click", App.closeIncident);
backdrop.addEventListener("click", App.closeIncident);
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && drawer.classList.contains("open")) App.closeIncident();
});

/* ---------- Incident list (used by behavior + heatmap charts) ---------- */
App.renderIncidentList = (container, heading, incidents) => {
  const e = App.esc;
  const sorted = incidents.slice().sort((a, b) => d3.descending(a.month, b.month));
  container.hidden = false;
  container.innerHTML = `
    <div class="list-head">
      <h4>${heading} <span class="muted">(${incidents.length})</span></h4>
      <button class="list-close" aria-label="Close list">&times;</button>
    </div>
    <ul>${sorted
      .map(
        (d) => `<li><button data-id="${d.id}">
          <span class="dot ${d.kind}" aria-hidden="true"></span>
          <span class="li-title">${e(d.title)}</span>
          <span class="li-date">${e(d.month)}</span>
        </button></li>`
      )
      .join("")}</ul>`;
  container.querySelector(".list-close").addEventListener("click", () => (container.hidden = true));
  container.querySelectorAll("li button").forEach((b) => b.addEventListener("click", () => App.openIncident(b.dataset.id)));
};

/* ---------- Debounced width-change resize hook ---------- */
const resizeHandlers = [];
App.onResize = (fn) => resizeHandlers.push(fn);
let lastW = window.innerWidth, resizeTimer;
window.addEventListener("resize", () => {
  if (window.innerWidth === lastW) return; // ignore mobile URL-bar height changes
  lastW = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => resizeHandlers.forEach((fn) => fn()), 150);
});

/* ---------- Scroll progress bar + chapter rail ---------- */
(function progressAndRail() {
  const bar = document.getElementById("progress-bar");
  const rail = document.getElementById("rail");
  const chapters = [...document.querySelectorAll("[data-chapter]")];
  rail.innerHTML = chapters
    .map((c, i) => {
      const n = c.dataset.chapter;
      const label = c.dataset.chapterLabel;
      return `<button data-i="${i}" aria-label="${label}"><span class="rail-num">${n === "explore" ? "&#9679;" : n}</span><span class="rail-label">${label}</span></button>`;
    })
    .join("");
  const buttons = [...rail.querySelectorAll("button")];
  buttons.forEach((b) => b.addEventListener("click", () => chapters[+b.dataset.i].scrollIntoView({ behavior: App.reducedMotion ? "auto" : "smooth" })));

  let ticking = false;
  function onScroll() {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
    let active = -1;
    chapters.forEach((c, i) => { if (c.getBoundingClientRect().top < innerHeight * 0.5) active = i; });
    buttons.forEach((b, i) => b.classList.toggle("active", i === active));
    rail.classList.toggle("visible", active >= 0 && document.getElementById("about").getBoundingClientRect().top > innerHeight * 0.5);
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
})();

/* ---------- Segmented-control helper ---------- */
App.segmented = (el, attr, onChange) => {
  el.querySelectorAll("button").forEach((btn) =>
    btn.addEventListener("click", () => {
      el.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
      onChange(btn.dataset[attr]);
    })
  );
};

App.ready.catch((err) => {
  console.error(err);
  document.querySelectorAll(".chart").forEach((c) => {
    c.innerHTML = '<p class="chart-error">Could not load data. If you opened this file directly, serve the folder instead (e.g. <code>python -m http.server</code>).</p>';
  });
});
