// "Who told us?": the incident dots re-sorted by who reported each one first.
// The same dots take two arrangements (by month, by first reporter). The page's
// lab / real-world filter fades the other kind, and a guess-first question sits on top.
// Needs the first-report fields written by scripts/prepare_data.py (by, byType, doc, reported, self).
App.ready.then((data) => {
  const el = document.getElementById("sources-chart");
  const inc = data.incidents.filter((d) => d.by);
  if (!el || !inc.length) return;

  const { C, T, binOf, monthKeys, parseMonth } = App.shared;
  const e = App.esc;
  const fmtDay = d3.timeFormat("%b %-d, %Y");
  const parseDay = d3.timeParse("%Y-%m-%d");
  const fmtMonthLong = d3.timeFormat("%B %Y");
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six"];
  const word = (n) => WORDS[n] ?? String(n);
  const plural = (n, w) => `${w}${n === 1 ? "" : "s"}`;
  const trim = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
  const binName = (bin) => (bin === "pre" ? "the years before 2025" : fmtMonthLong(parseMonth(bin)));

  // The dataset's reporter categories, in plain words.
  const LAB = "Frontier AI lab";
  const TYPE_LABEL = {
    "Frontier AI lab": "AI labs",
    "Independent evaluator": "Independent evaluators",
    "University or institute": "Universities",
    "Research group": "Research groups",
    "Government institute": "Government institutes",
    "AI company": "Other AI companies",
    "Independent researcher": "Independent researchers",
  };
  const isPublic = (d) => d.kind === "public";
  const kindRank = (d) => (isPublic(d) ? 0 : 1);

  /* ---------- who published what ---------- */
  const docKey = (d) => `${d.by}|${d.doc}|${d.reported}`;
  const docs = d3.group(inc, docKey);
  const docSize = (d) => docs.get(docKey(d)).length;
  // reports that cover more than one incident get a shaded backdrop
  const shared = [...docs].filter(([, v]) => v.length > 1).map(([key, items]) => ({ key, items }));
  // order inside every pile: multi-incident reports first, then real world before lab
  const pileOrder = (a, b) => {
    const sa = docSize(a) > 1 ? docSize(a) : 0, sb = docSize(b) > 1 ? docSize(b) : 0;
    return d3.descending(sa, sb) || (sa ? d3.ascending(docKey(a), docKey(b)) : 0) ||
      d3.ascending(kindRank(a), kindRank(b)) || d3.ascending(a.month, b.month) || d3.ascending(a.id, b.id);
  };

  /* ---------- numbers used in the headlines ---------- */
  const pub = inc.filter(isPublic);
  const testing = inc.filter((d) => !isPublic(d));
  const selfPub = pub.filter((d) => d.self === true);
  const byCount = (list, key) => d3.rollups(list, (v) => v.length, key).sort((a, b) => d3.descending(a[1], b[1]) || d3.ascending(a[0], b[0]));
  const selfPubOrgs = byCount(selfPub, (d) => d.by);
  const topOrgs = byCount(inc, (d) => d.by).slice(0, 3);
  const outsideTesting = testing.filter((d) => d.byType !== LAB).length;
  const listPhrase = (arr) => (arr.length < 2 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`);

  const BIG = 5; // a report is "big" once it covers this many incidents
  const bins = d3.groups(inc, binOf).map(([bin, items]) => {
    const big = items.filter((d) => docSize(d) >= BIG);
    return {
      bin, items, n: items.length,
      sharedN: items.filter((d) => docSize(d) > 1).length,
      bigN: big.length,
      bigDocs: new Set(big.map(docKey)).size,
      bigOrgs: [...new Set(big.map((d) => d.by))],
      docs: new Set(items.map(docKey)).size,
    };
  });
  // the three tallest months get a note beside them
  const tallest = bins.filter((b) => b.n >= 12).sort((a, b) => d3.descending(a.n, b.n)).slice(0, 3);
  const mostlyBig = (b) => b.bigN / b.n >= 0.5;
  const lead = tallest.filter(mostlyBig).sort((a, b) => d3.descending(a.bigN / a.n, b.bigN / b.n))[0];
  const peak = tallest[0];

  /* ---------- state ---------- */
  const state = { view: "when", filter: "all" };
  const visible = (d) => state.filter === "all" || d.kind === state.filter;

  function headline() {
    const f = state.filter;
    if (state.view === "when") {
      if (f === "public") return ["When it happened", `${pub.length} real-world incidents, by the month they happened`, "Lab tests are faded out."];
      if (f === "testing") return ["When it happened", `${testing.length} lab-test incidents, by the month they happened`, "Real-world incidents are faded out."];
      const sub = "Shaded dots were published together in one report." +
        (peak && peak !== lead && !mostlyBig(peak) ? ` The ${peak.n} from ${binName(peak.bin)} came from ${peak.docs} separate reports.` : "");
      if (!lead) return ["When it happened", "Every incident, in the month it happened", sub];
      return ["When it happened",
        `${lead.bigN} of the ${lead.n} incidents in ${binName(lead.bin)} came out in ${lead.bigDocs === 1 ? "a single report" : `${word(lead.bigDocs)} reports`}`,
        sub];
    }
    if (f === "public") {
      const who = selfPubOrgs.slice(0, 2).map(([org, n], i) => (i ? `${org} ${n}` : `${org} disclosed ${n}`));
      return ["Who reported it first",
        `${selfPub.length} of the ${pub.length} real-world incidents were first reported by the company that built the model`,
        `${listPhrase(who)}. Lab tests are faded out.`];
    }
    if (f === "testing") return ["Who reported it first",
      `${outsideTesting} of the ${testing.length} lab-test incidents were first reported by someone outside the AI labs`,
      "Mostly universities, independent evaluators and research groups. Real-world incidents are faded out."];
    return ["Who reported it first",
      `${d3.sum(topOrgs, (o) => o[1])} of the ${inc.length} incidents were first reported by just ${word(topOrgs.length)} organisations`,
      `${listPhrase(topOrgs.map(([org, n]) => `${org} (${n})`))}. Same dots as before, sorted by who published them first.`];
  }

  /* ---------- layouts: Map(id -> {x, y, cell}) ---------- */
  function layoutWhen(width) {
    const m = { top: 28, right: 6, bottom: 34, left: 6 };
    const x = d3.scaleBand().domain(monthKeys).range([m.left, width - m.right]).paddingInner(0.18);
    const maxBin = d3.max(bins, (b) => b.n);
    const maxH = width < 600 ? 380 : 400;
    // dots per row that gives the biggest dots without the tallest month running away
    const fit = (c) => Math.min(16, x.bandwidth() / c, maxH / Math.ceil(maxBin / c));
    const cols = [1, 2, 3].reduce((best, c) => (fit(c) > fit(best) + 0.01 ? c : best), 1);
    const s = fit(cols);
    const height = m.top + Math.ceil(maxBin / cols) * s + m.bottom;
    const baseline = height - m.bottom;
    const pos = new Map();
    const towers = bins.map((b) => {
      const x0 = x(b.bin) + (x.bandwidth() - cols * s) / 2;
      b.items.slice().sort(pileOrder).forEach((d, k) => {
        const col = k % cols, row = Math.floor(k / cols);
        pos.set(d.id, { x: x0 + col * s + s / 2, y: baseline - row * s - s / 2, cell: [b.bin, col, row] });
      });
      return { b, x0, x1: x0 + cols * s, h: Math.ceil(b.n / cols) * s, sharedH: Math.ceil(b.sharedN / cols) * s };
    });
    return { view: "when", pos, s, cols, height, baseline, x, towers, width };
  }

  function layoutWho(width) {
    const narrow = width < 640;
    const k = narrow ? 4 : 2; // dots per column in a strip
    const labelW = narrow ? 0 : 204;
    const gap = 0.7; // space between organisation blocks, in dot pitches
    const rows = d3.groups(inc, (d) => d.byType).map(([type, items]) => {
      const orgs = byCount(items, (d) => d.by);
      const named = orgs.filter(([, n]) => n >= 5).map(([org]) => ({ org, items: items.filter((d) => d.by === org).sort(pileOrder) }));
      const rest = items.filter((d) => !named.some((b) => b.org === d.by)).sort(pileOrder);
      const blocks = rest.length ? [...named, { org: null, items: rest }] : named;
      return { type, items, blocks, units: d3.sum(blocks, (b) => Math.ceil(b.items.length / k)) + gap * (blocks.length - 1) };
    }).sort((a, b) => d3.descending(a.items.length, b.items.length) || d3.ascending(a.type, b.type));
    const s = Math.min(18, (width - labelW - 2) / d3.max(rows, (r) => r.units));
    const head = narrow ? 22 : 0, blockLine = 17, rowGap = narrow ? 16 : 14;
    const pos = new Map();
    let y = 4;
    rows.forEach((r, ri) => {
      r.yLabel = y + 14;
      // on phones a strip with no named organisations sits right under its row label
      r.y0 = y + head + (narrow && !r.blocks.some((b) => b.org) ? 6 : blockLine);
      let bx = labelW;
      r.blocks.forEach((b, bi) => {
        b.x = bx;
        b.items.forEach((d, i) => {
          const col = Math.floor(i / k), row = i % k;
          pos.set(d.id, { x: bx + col * s + s / 2, y: r.y0 + row * s + s / 2, cell: [`${ri}/${bi}`, col, row] });
        });
        bx += Math.ceil(b.items.length / k) * s + gap * s;
      });
      y = r.y0 + k * s + rowGap;
    });
    return { view: "who", pos, s, k, height: y - rowGap + 6, rows, labelW, narrow, width };
  }

  // One thick rounded stroke through neighbouring dots of the same report: a soft backdrop that follows the pile.
  function tintPath(doc, L) {
    const cellKey = (c) => c.join("|");
    const at = new Map(doc.items.map((d) => { const p = L.pos.get(d.id); return [cellKey(p.cell), p]; }));
    let path = "";
    for (const p of at.values()) {
      const [pile, col, row] = p.cell;
      path += `M${p.x},${p.y}l0.01,0`;
      for (const q of [at.get(cellKey([pile, col + 1, row])), at.get(cellKey([pile, col, row + 1]))]) {
        if (q) path += `M${p.x},${p.y}L${q.x},${q.y}`;
      }
    }
    return path;
  }

  /* ---------- drawing ---------- */
  const TINT = 0.2;
  const svg = d3.select(el).append("svg").attr("role", "img");
  const gTint = svg.append("g"); // one group opacity, so overlapping backdrops never add up
  const hoverTint = svg.append("path").attr("fill", "none").attr("stroke", C.text).attr("stroke-linecap", "round").attr("stroke-linejoin", "round").attr("opacity", 0);
  const gAxis = svg.append("g").attr("class", "axis");
  const gCounts = svg.append("g").attr("class", "col-counts");
  const gLabels = svg.append("g");
  const gDots = svg.append("g");
  const ring = svg.append("circle").attr("fill", "none").attr("stroke", C.text).attr("stroke-width", 2).attr("opacity", 0).style("pointer-events", "none");
  gDots.selectAll("circle").data(inc, (d) => d.id).join("circle").attr("fill", (d) => C[d.kind]).style("pointer-events", "none");

  const head = { kicker: document.getElementById("src-kicker"), title: document.getElementById("src-title"), sub: document.getElementById("src-sub") };
  let L = null, finder = null, hoverable = [], drawnView = null;

  function render(animate = true) {
    const width = el.clientWidth;
    if (!width) return;
    const moved = drawnView !== state.view; // dots change place only when the arrangement changes
    L = state.view === "when" ? layoutWhen(width) : layoutWho(width);
    const dur = animate && drawnView ? (moved ? T * 1.3 : T * 0.5) : 0;
    // labels and backdrops wait for the dots to land; a filter change alone redraws them in place
    const fade = (sel, to = 1) => (moved && dur
      ? sel.interrupt().attr("opacity", 0).transition().delay(dur * 0.9).duration(350).attr("opacity", to)
      : sel.interrupt().attr("opacity", to));
    drawnView = state.view;
    clearHover();

    [head.kicker.textContent, head.title.textContent, head.sub.textContent] = headline();
    svg.attr("width", width).attr("aria-label", `${head.title.textContent}. ${head.sub.textContent}`)
      .transition().duration(dur).ease(d3.easeCubicInOut).attr("height", L.height);

    gDots.selectAll("circle").transition().duration(dur).ease(d3.easeCubicInOut)
      .delay((d, i) => (moved && dur ? (i % 40) * 5 : 0))
      .attr("cx", (d) => L.pos.get(d.id).x).attr("cy", (d) => L.pos.get(d.id).y)
      .attr("r", Math.max(1.8, L.s * 0.4))
      .attr("opacity", (d) => (visible(d) ? 1 : 0.1));

    // backdrops for reports that cover several incidents
    const tintTo = state.filter === "all" ? TINT : TINT * 0.45; // step back while a filter is on
    if (moved || !dur) {
      gTint.selectAll("path").data(shared, (d) => d.key).join("path")
        .attr("d", (doc) => tintPath(doc, L)).attr("fill", "none").attr("stroke", C.text)
        .attr("stroke-width", L.s + 5).attr("stroke-linecap", "round").attr("stroke-linejoin", "round");
      fade(gTint, tintTo);
    } else gTint.interrupt().transition().duration(dur).attr("opacity", tintTo);

    gAxis.selectAll("*").remove();
    gCounts.selectAll("*").remove();
    gLabels.selectAll("*").remove();
    if (L.view === "when") drawWhen(fade); else drawWho(fade);

    hoverable = inc.filter(visible);
    finder = d3.Delaunay.from(hoverable, (d) => L.pos.get(d.id).x, (d) => L.pos.get(d.id).y);
  }

  function drawWhen(fade) {
    const { x, baseline, towers, width } = L;
    gAxis.attr("transform", `translate(0,${baseline + 6})`);
    gAxis.append("line").attr("x1", x.range()[0]).attr("x2", x.range()[1]).attr("stroke", C.grid);
    App.charts.monthAxis(gAxis.append("g"), x, width, 18);
    fade(gAxis);

    // how many of the visible kind sit in each tall month
    const minShown = state.filter === "all" ? 8 : 4;
    const counted = towers.map((t) => ({ t, v: t.b.items.filter(visible).length })).filter((c) => c.v >= minShown);
    gCounts.selectAll("text").data(counted).join("text")
      .attr("x", (c) => (c.t.x0 + c.t.x1) / 2).attr("y", (c) => baseline - c.t.h - 7).attr("text-anchor", "middle").text((c) => c.v);
    fade(gCounts);

    if (state.filter !== "all") return;
    // a two-line note beside each of the tallest months, kept clear of the other towers and of each other
    const lineH = 15, placed = [];
    const notes = tallest.map((b) => ({
      t: towers.find((t) => t.b === b),
      strong: mostlyBig(b) ? `${b.bigN} of ${b.n}` : `${b.n} incidents`,
      rest: mostlyBig(b)
        ? `from ${word(b.bigDocs)} ${b.bigOrgs.length === 1 ? b.bigOrgs[0] + " " : ""}${plural(b.bigDocs, "report")}`
        : `from ${b.docs} separate reports`,
    })).sort((a, b) => d3.ascending(a.t.x0, b.t.x0));
    for (const n of notes) {
      const g = gLabels.append("g").attr("class", "src-note");
      const t1 = g.append("text").attr("class", "strong").text(n.strong);
      const t2 = g.append("text").text(n.rest);
      const w = Math.max(t1.node().getComputedTextLength(), t2.node().getComputedTextLength());
      const h = lineH * 2;
      const target = mostlyBig(n.t.b) ? n.t.sharedH / 2 : n.t.h * 0.6; // height above the baseline to aim for
      let best = null;
      for (const side of ["left", "right"]) {
        const xa = side === "left" ? n.t.x0 - 10 - w : n.t.x1 + 10, xb = xa + w;
        if (xa < 2 || xb > width - 2) continue;
        let yb = Math.max(6, target - h / 2); // bottom of the note, measured up from the baseline
        for (const t of towers) if (t !== n.t && t.x1 > xa - 6 && t.x0 < xb + 6) yb = Math.max(yb, t.h + (t.b.n >= minShown ? 22 : 8));
        for (let again = true, guard = 0; again && guard < 8; guard++) {
          again = false;
          for (const p of placed) if (p.xa < xb + 10 && p.xb > xa - 10 && p.yb < yb + h + 6 && p.yb + p.h + 6 > yb) { yb = p.yb + p.h + 8; again = true; }
        }
        if (yb + h > baseline - 2) continue;
        const cost = Math.abs(yb + h / 2 - target);
        if (!best || cost < best.cost) best = { side, xa, xb, yb, h, cost };
      }
      if (!best) { g.remove(); continue; }
      placed.push(best);
      const ax = best.side === "left" ? best.xb : best.xa;
      t1.attr("x", ax).attr("y", baseline - best.yb - lineH - 3);
      t2.attr("x", ax).attr("y", baseline - best.yb - 3);
      g.attr("text-anchor", best.side === "left" ? "end" : "start");
      fade(g);
    }
  }

  function drawWho(fade) {
    const { rows, labelW, narrow, s, k } = L;
    if (!narrow) gAxis.attr("transform", null).append("line").attr("x1", labelW - 8).attr("x2", labelW - 8)
      .attr("y1", rows[0].y0 - 2).attr("y2", rows[rows.length - 1].y0 + k * s + 2).attr("stroke", C.grid);
    for (const r of rows) {
      const label = gLabels.append("text")
        .attr("x", narrow ? 0 : labelW - 20).attr("y", narrow ? r.yLabel : r.y0 + (k * s) / 2 + 5)
        .attr("text-anchor", narrow ? "start" : "end");
      label.append("tspan").attr("class", "src-row-name").text(TYPE_LABEL[r.type] || r.type);
      label.append("tspan").attr("class", "src-row-count").attr("dx", 8).text(r.items.filter(visible).length);
      let lastEnd = -Infinity;
      for (const b of r.blocks) {
        const shown = b.items.filter(visible).length;
        if (!b.org || !shown || b.x < lastEnd + 10) continue;
        const t = gLabels.append("text").attr("class", "src-block-label").attr("x", b.x + 1).attr("y", r.y0 - 6);
        t.append("tspan").text(b.org);
        t.append("tspan").attr("class", "n").attr("dx", 5).text(shown);
        lastEnd = b.x + t.node().getComputedTextLength();
      }
    }
    fade(gAxis);
    fade(gLabels);
  }

  /* ---------- hover: the nearest dot answers, so small dots are easy to hit ---------- */
  function nearest(ev) {
    if (!finder || !hoverable.length) return null;
    const [mx, my] = d3.pointer(ev, svg.node());
    const d = hoverable[finder.find(mx, my)];
    const p = L.pos.get(d.id);
    return Math.hypot(p.x - mx, p.y - my) <= Math.max(14, L.s) ? d : null;
  }
  function clearHover() {
    ring.attr("opacity", 0);
    hoverTint.attr("opacity", 0);
    svg.style("cursor", null);
    App.tooltip.hide();
  }
  svg.on("pointermove", (ev) => {
    const d = nearest(ev);
    if (!d) return clearHover();
    const p = L.pos.get(d.id), n = docSize(d);
    ring.attr("cx", p.x).attr("cy", p.y).attr("r", Math.max(1.8, L.s * 0.4) + 3).attr("opacity", 1);
    const doc = n > 1 && shared.find((g) => g.key === docKey(d));
    if (doc) hoverTint.attr("d", tintPath(doc, L)).attr("stroke-width", L.s + 5).attr("opacity", 0.22);
    else hoverTint.attr("opacity", 0);
    svg.style("cursor", "pointer");
    App.tooltip.show(
      `<div class="tt-badges">${App.kindBadge(d.kind)}</div><strong>${e(d.title)}</strong>` +
      `<div class="tt-sub">First reported by <strong class="tt-by">${e(d.by)}</strong> &middot; ${e(fmtDay(parseDay(d.reported)))}</div>` +
      `<div class="tt-sub">${n > 1 ? `One of ${n} incidents in` : "In"} &ldquo;${e(trim(d.doc, 72))}&rdquo;</div>` +
      (d.self === true ? `<div class="tt-sub">Reported by the model's own developer${d.developer ? ` (${e(d.developer)})` : ""}.</div>` : "") +
      `<div class="tt-sub">Click to read the story.</div>`, ev);
  }).on("pointerleave", clearHover)
    .on("click", (ev) => { const d = nearest(ev); if (d) App.openIncident(d.id); });

  /* ---------- controls ---------- */
  const viewSeg = document.getElementById("src-view");
  const filterSeg = document.getElementById("src-filter");
  const press = (seg, attr, value) => seg.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset[attr] === value));
  App.segmented(viewSeg, "view", (v) => { state.view = v; render(); });
  App.segmented(filterSeg, "filter", (f) => { state.filter = f; render(); });

  /* ---------- guess first ---------- */
  const guess = document.getElementById("src-guess");
  if (guess) {
    const range = document.getElementById("src-guess-range");
    const out = document.getElementById("src-guess-out");
    const btn = document.getElementById("src-guess-btn");
    const result = document.getElementById("src-guess-result");
    guess.querySelectorAll("[data-src='public']").forEach((n) => (n.textContent = pub.length));
    range.max = pub.length;
    range.value = Math.round(pub.length / 2);
    const show = () => (out.textContent = `${range.value} of ${pub.length}`);
    range.addEventListener("input", show);
    show();
    btn.addEventListener("click", () => {
      const g = +range.value, answer = selfPub.length, off = g - answer;
      const verdict = Math.abs(off) <= 2 ? "Close." : off < 0 ? "More than you thought." : "Fewer than you thought.";
      const share = Math.round((answer / pub.length) * 100);
      result.innerHTML = `You guessed <strong>${g}</strong>. It's <strong>${answer}</strong> of ${pub.length}, about ${share}%. ${verdict} ` +
        `Most of what we know about AI misbehaving in real use comes from the labs' own reports.`;
      result.hidden = false;
      range.disabled = true;
      btn.disabled = true;
      state.view = "who";
      state.filter = "public";
      press(viewSeg, "view", "who");
      press(filterSeg, "filter", "public");
      render();
      head.title.scrollIntoView({ behavior: App.reducedMotion ? "auto" : "smooth", block: "nearest" });
    });
  }

  /* ---------- the same counts as a table ---------- */
  const tableEl = document.getElementById("src-table");
  if (tableEl) {
    const typeRows = d3.groups(inc, (d) => d.byType)
      .map(([type, items]) => ({ label: TYPE_LABEL[type] || type, pub: items.filter(isPublic).length, n: items.length }))
      .sort((a, b) => d3.descending(a.n, b.n) || d3.ascending(a.label, b.label));
    const row = (label, lab, real, all) => `<tr><th scope="row">${e(label)}</th><td>${lab}</td><td>${real}</td><td>${all}</td></tr>`;
    tableEl.innerHTML =
      `<table><thead><tr><th scope="col">First reported by</th><th scope="col">Lab tests</th><th scope="col">Real world</th><th scope="col">All</th></tr></thead>` +
      `<tbody>${typeRows.map((r) => row(r.label, r.n - r.pub, r.pub, r.n)).join("")}</tbody>` +
      `<tfoot>${row("All reporters", testing.length, pub.length, inc.length)}</tfoot></table>`;
  }

  render(false);
  App.onResize(() => { drawnView = null; render(false); });
});
