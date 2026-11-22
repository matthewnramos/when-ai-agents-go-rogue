// D3 chart building blocks shared by the scrollytelling story (story.js) and the Explore section.
//   App.shared  : colors, date helpers, story stats
//   App.charts  : makeHacking, makeBehaviors, makeHeatmap, stackLayout
// Explore-section instances are created at the bottom of this file.
App.ready.then((data) => {
  const css = getComputedStyle(document.documentElement);
  const C = {
    testing: css.getPropertyValue("--testing").trim(),
    public: css.getPropertyValue("--public").trim(),
    text: css.getPropertyValue("--text").trim(),
    muted: css.getPropertyValue("--muted").trim(),
    grid: css.getPropertyValue("--border").trim(),
    surface: css.getPropertyValue("--surface").trim(),
    bg: css.getPropertyValue("--bg").trim(),
    neutral: css.getPropertyValue("--neutral").trim(),
    heat: css.getPropertyValue("--heat").trim(),
  };
  const KINDS = ["public", "testing"]; // stacking order: real world on the bottom
  const HACK_TAGS = ["Unauthorized access", "Cybersecurity"];
  const START = "2025-01";
  const fmtMonth = d3.timeFormat("%b %Y");
  const parseMonth = d3.timeParse("%Y-%m");
  const monthName = (key) => (key === "pre" ? "Before 2025" : fmtMonth(parseMonth(key)));
  const lastMonth = d3.max(data.incidents, (d) => d.month);
  const lastReported = d3.timeParse("%Y-%m-%d")(data.lastReported);
  const partialNote = `${monthName(lastMonth)} is a partial month (data through ${d3.timeFormat("%b %-d, %Y")(lastReported)}).`;
  const T = App.reducedMotion ? 0 : 750;
  const binOf = (d) => (d.month < START ? "pre" : d.month);
  const monthKeys = ["pre", ...d3.timeMonth.range(parseMonth(START), d3.timeMonth.offset(parseMonth(lastMonth), 1)).map(d3.timeFormat("%Y-%m"))];
  const isHack = (d) => d.behaviors.some((b) => HACK_TAGS.includes(b));

  App.shared = { C, KINDS, HACK_TAGS, START, T, fmtMonth, parseMonth, monthName, lastMonth, partialNote, binOf, monthKeys, isHack };

  /** Stack dots in month columns. Returns Map(id -> {x, y}). */
  function stackLayout(list, x, s, cols, baseline) {
    const pos = new Map();
    for (const [bin, items] of d3.group(list, binOf)) {
      items.sort((a, b) => d3.ascending(KINDS.indexOf(a.kind), KINDS.indexOf(b.kind)) || d3.ascending(a.month, b.month) || d3.ascending(a.id, b.id));
      const x0 = x(bin) + (x.bandwidth() - cols * s) / 2;
      items.forEach((d, k) => pos.set(d.id, { x: x0 + (k % cols) * s + s / 2, y: baseline - Math.floor(k / cols) * s - s / 2 }));
    }
    return pos;
  }

  /** Month labels along a band scale; skips labels that would collide with "Earlier". */
  function monthAxis(g, x, width, y) {
    const every = width < 600 ? 6 : 3;
    const offset = width < 600 ? 3 : 0;
    const crowded = x.step() < 60; // first month label would touch "Earlier"
    g.selectAll("text").data(monthKeys.filter((k, i) => k === "pre" || ((i - 1) % every === offset && !(crowded && i === 1))), (k) => k).join("text")
      .attr("x", (k) => x(k) + x.bandwidth() / 2).attr("y", y).attr("text-anchor", "middle")
      .text((k) => (k === "pre" ? "Earlier" : d3.timeFormat(width < 600 ? "%b '%y" : "%b %Y")(parseMonth(k))));
  }

  /* =====================================================================
     AI HACKING: running total, stacked real world + lab
     ===================================================================== */
  function makeHacking(el, opts = {}) {
    const hack = data.incidents.filter(isHack);
    const start = parseMonth(START);
    const end = parseMonth(lastMonth);
    const months = d3.timeMonth.range(start, d3.timeMonth.offset(end, 1));
    const series = months.map((m) => {
      const key = d3.timeFormat("%Y-%m")(m);
      const upto = hack.filter((d) => d.month <= key);
      const p = upto.filter((d) => d.kind === "public").length;
      return { date: m, public: p, testing: upto.length - p, total: upto.length };
    });
    const last = series[series.length - 1];
    const stepData = [...series, { ...last, date: d3.timeMonth.offset(end, 1) }];
    const container = d3.select(el);
    let clip, plotW = 0, revealed = false;

    function draw() {
      const width = el.clientWidth;
      if (!width) return;
      const height = opts.height ? opts.height() : Math.max(260, Math.min(380, width * 0.45));
      const m = { top: 30, right: width < 600 ? 16 : 110, bottom: 32, left: 40 };
      plotW = width - m.left - m.right;
      container.selectAll("*").remove();
      const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height)
        .attr("role", "img").attr("aria-label", `Running total of AI hacking incidents, reaching ${last.total} by ${fmtMonth(last.date)}`);
      const x = d3.scaleTime().domain([start, d3.timeMonth.offset(end, 1)]).range([m.left, width - m.right]);
      const y = d3.scaleLinear().domain([0, last.total * 1.1]).nice().range([height - m.bottom, m.top]);

      svg.append("g").attr("class", "grid").attr("transform", `translate(${m.left},0)`)
        .call(d3.axisLeft(y).ticks(5).tickSize(-plotW).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8));
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - m.bottom})`)
        .call(d3.axisBottom(x).ticks(d3.timeMonth.every(width < 600 ? 6 : 3)).tickFormat(d3.timeFormat(width < 600 ? "%b '%y" : "%b %Y")).tickSizeOuter(0));

      const stack = d3.stack().keys(KINDS)(stepData);
      const area = d3.area().curve(d3.curveStepAfter).x((d) => x(d.data.date)).y0((d) => y(d[0])).y1((d) => y(d[1]));
      const id = "clip-" + Math.random().toString(36).slice(2);
      clip = svg.append("clipPath").attr("id", id).append("rect").attr("x", m.left).attr("y", 0).attr("height", height)
        .attr("width", revealed || !T ? plotW : 0);
      const plot = svg.append("g").attr("clip-path", `url(#${id})`);
      plot.selectAll("path").data(stack).join("path").attr("fill", (s) => C[s.key]).attr("opacity", 0.92).attr("d", area);

      if (width >= 600) {
        const xe = x(d3.timeMonth.offset(end, 1)) + 8;
        plot.append("text").attr("x", xe).attr("y", y(last.total) + 4).style("fill", C.text).attr("font-weight", 700).text(`${last.total} total`);
        plot.append("text").attr("x", xe).attr("y", y(last.public + last.testing / 2) + 4).style("fill", C.testing).text(`${last.testing} lab`);
        plot.append("text").attr("x", xe).attr("y", y(last.public / 2) + 4).style("fill", C.public).text(`${last.public} real world`);
        clip.attr("width", revealed || !T ? plotW + m.right : 0);
      }

      const rule = svg.append("line").attr("stroke", C.text).attr("stroke-dasharray", "3,3").attr("y1", m.top).attr("y2", height - m.bottom).attr("opacity", 0);
      svg.append("rect").attr("x", m.left).attr("y", m.top).attr("width", plotW).attr("height", height - m.top - m.bottom).attr("fill", "transparent")
        .on("pointermove", (ev) => {
          const [mx] = d3.pointer(ev);
          const i = Math.max(0, d3.bisectRight(series.map((d) => d.date), x.invert(mx)) - 1);
          const d = series[i];
          rule.attr("x1", x(d.date) + 0.5).attr("x2", x(d.date) + 0.5).attr("opacity", 0.6);
          App.tooltip.show(`<strong>Through ${fmtMonth(d.date)}</strong><div>${d.total} hacking incidents</div><div class="tt-sub"><span class="key public">${d.public} real world</span> &middot; <span class="key testing">${d.testing} lab</span></div>`, ev);
        })
        .on("pointerleave", () => { rule.attr("opacity", 0); App.tooltip.hide(); });
    }

    function reveal() {
      if (revealed) return;
      revealed = true;
      if (clip) clip.transition().duration(T * 2.2).ease(d3.easeCubicInOut).attr("width", plotW + 200);
    }

    if (opts.autoReveal) {
      new IntersectionObserver((entries, obs) => {
        if (entries[0].isIntersecting) { obs.disconnect(); reveal(); }
      }, { threshold: 0.4 }).observe(el);
    }
    return { draw, reveal, series, last };
  }

  /* =====================================================================
     BEHAVIORS: stacked bars, lab vs real world
     ===================================================================== */
  function makeBehaviors(el, opts = {}) {
    const rows = data.behaviors.map((name) => {
      const list = data.incidents.filter((d) => d.behaviors.includes(name));
      const t = list.filter((d) => d.kind === "testing").length;
      return { name, list, testing: t, public: list.length - t };
    });
    const state = { filter: "all", sort: "total", highlight: null };
    const listEl = opts.listEl;
    const container = d3.select(el);
    let svg, width, m, x, y, labelAbove;

    function draw() {
      width = el.clientWidth;
      if (!width) return;
      labelAbove = width < 560;
      m = { top: 10, right: 44, bottom: 30, left: labelAbove ? 4 : 190 };
      const step = labelAbove ? 56 : 46;
      const height = m.top + rows.length * step + m.bottom;
      container.selectAll("*").remove();
      svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height)
        .attr("role", "img").attr("aria-label", "Bar chart of AI misbehavior types, split into lab tests and real-world incidents");
      x = d3.scaleLinear().range([m.left, width - m.right]);
      y = d3.scaleBand().range([m.top, height - m.bottom]).paddingInner(0.2);
      svg.append("g").attr("class", "grid x-grid").attr("transform", `translate(0,${height - m.bottom})`);
      svg.append("g").attr("class", "axis x-axis").attr("transform", `translate(0,${height - m.bottom})`);
      svg.append("g").attr("class", "bars");
      svg.append("g").attr("class", "labels");
      svg.append("g").attr("class", "totals");
      update(false);
    }

    const value = (r) => (state.filter === "all" ? r.testing + r.public : r[state.filter]);
    const dim = (r) => (state.highlight && !state.highlight.includes(r.name) ? 0.22 : 1);

    function update(animate = true) {
      if (!svg) return;
      const sorted = rows.slice().sort((a, b) =>
        state.sort === "public"
          ? d3.descending(a.public / (a.testing + a.public), b.public / (b.testing + b.public))
          : d3.descending(value(a), value(b)));
      x.domain([0, d3.max(rows, value) || 1]).nice();
      y.domain(sorted.map((r) => r.name));
      const yOff = labelAbove ? 18 : 0;
      const bh = Math.min(26, y.bandwidth() - yOff);
      const t = svg.transition().duration(animate ? T : 0);
      const h = +svg.attr("height");

      svg.select(".x-grid").transition(t).call(d3.axisBottom(x).ticks(width < 560 ? 4 : 8).tickSize(-(h - m.top - m.bottom)).tickFormat(""));
      svg.select(".x-axis").transition(t).call(d3.axisBottom(x).ticks(width < 560 ? 4 : 8).tickSizeOuter(0));

      const segs = [];
      sorted.forEach((r) => {
        let x0 = 0;
        ["testing", "public"].forEach((k) => {
          const v = state.filter === "all" || state.filter === k ? r[k] : 0;
          segs.push({ row: r, kind: k, v, x0 });
          x0 += v;
        });
      });

      svg.select(".bars").selectAll("g.seg").data(segs, (d) => d.row.name + d.kind).join((enter) => {
        const g = enter.append("g").attr("class", "seg").style("cursor", listEl ? "pointer" : "default");
        g.append("rect").attr("fill", (d) => C[d.kind]).attr("rx", 3);
        g.append("text").attr("class", "seg-label").attr("dy", "0.35em").attr("text-anchor", "middle");
        return g;
      })
        .on("pointerenter", (ev, d) => {
          const total = d.row.testing + d.row.public;
          App.tooltip.show(`<strong>${d.row.name}</strong><div>${App.kindBadge(d.kind)} ${d.row[d.kind]} incidents</div><div class="tt-sub">${Math.round((d.row[d.kind] / total) * 100)}% of ${total}${listEl ? " &middot; click to list them" : ""}</div>`, ev);
        })
        .on("pointermove", (ev) => App.tooltip.move(ev))
        .on("pointerleave", () => App.tooltip.hide())
        .on("click", (ev, d) => listEl && App.renderIncidentList(listEl, `${d.row.name}: ${App.KIND_LABEL[d.kind].toLowerCase()}`, d.row.list.filter((i) => i.kind === d.kind)))
        .call((g) => {
          g.transition(t).attr("opacity", (d) => dim(d.row));
          g.select("rect").transition(t)
            .attr("x", (d) => x(d.x0)).attr("width", (d) => Math.max(0, x(d.x0 + d.v) - x(d.x0)))
            .attr("y", (d) => y(d.row.name) + yOff).attr("height", bh);
          g.select("text").transition(t)
            .attr("x", (d) => x(d.x0 + d.v / 2)).attr("y", (d) => y(d.row.name) + yOff + bh / 2)
            .style("fill", C.bg)
            .text((d) => (x(d.x0 + d.v) - x(d.x0) > 26 ? d.v : ""));
        });

      svg.select(".labels").selectAll("text").data(sorted, (r) => r.name).join("text")
        .attr("class", (r) => "row-label" + (r.public >= r.testing ? " highlight" : ""))
        .style("cursor", listEl ? "pointer" : "default")
        .on("click", (ev, r) => listEl && App.renderIncidentList(listEl, `${r.name}: all incidents`, r.list))
        .text((r) => r.name)
        .transition(t)
        .attr("opacity", dim)
        .attr("x", labelAbove ? m.left : m.left - 10)
        .attr("text-anchor", labelAbove ? "start" : "end")
        .attr("y", (r) => (labelAbove ? y(r.name) + 12 : y(r.name) + bh / 2 + 4));

      svg.select(".totals").selectAll("text").data(sorted, (r) => r.name).join("text")
        .attr("class", "total-label")
        .transition(t)
        .attr("opacity", dim)
        .attr("x", (r) => x(value(r)) + 6).attr("y", (r) => y(r.name) + yOff + bh / 2 + 4)
        .text((r) => value(r));
    }

    function set(patch, animate = true) {
      Object.assign(state, patch);
      update(animate);
    }
    return { draw, set, rows };
  }

  /* =====================================================================
     CO-OCCURRENCE HEATMAP
     ===================================================================== */
  function makeHeatmap(el, opts = {}) {
    const names = data.behaviors;
    const SHORT = {
      "Cheating / reward hacking": "Cheating",
      "Deception / scheming": "Deception",
      "Unauthorized access": "Unauth. access",
      "Cybersecurity": "Cybersecurity",
      "Sabotage": "Sabotage",
      "Self-preservation": "Self-preserv.",
    };
    const totals = new Map(names.map((n) => [n, data.incidents.filter((d) => d.behaviors.includes(n)).length]));
    const cells = [];
    names.forEach((a, i) => names.forEach((b, j) => {
      const list = data.incidents.filter((d) => d.behaviors.includes(a) && d.behaviors.includes(b));
      cells.push({ a, b, i, j, diag: i === j, n: list.length, list });
    }));
    const maxOff = d3.max(cells.filter((c) => !c.diag), (c) => c.n);
    const color = d3.scaleSequential(d3.interpolateRgb(C.surface, C.heat)).domain([0, maxOff]);
    const listEl = opts.listEl;
    const container = d3.select(el);

    function draw() {
      const width = el.clientWidth;
      if (!width) return;
      const narrow = width < 640;
      const m = { top: narrow ? 92 : 104, right: narrow ? 56 : 72, bottom: 8, left: narrow ? 104 : 210 };
      let size = Math.min(64, (width - m.left - m.right) / names.length);
      if (opts.maxHeight) size = Math.min(size, (opts.maxHeight() - m.top - m.bottom) / names.length);
      const gw = size * names.length;
      const height = m.top + gw + m.bottom;
      container.selectAll("*").remove();
      const svg = container.append("svg").attr("viewBox", `0 0 ${m.left + gw + m.right} ${height}`)
        .attr("width", m.left + gw + m.right).attr("height", height)
        .attr("role", "img").attr("aria-label", "Heatmap of how often pairs of AI misbehavior types occur in the same incident");

      const rowLabels = svg.append("g").selectAll("text").data(names).join("text")
        .attr("class", "hm-label").attr("x", m.left - 8).attr("y", (n, i) => m.top + i * size + size / 2 + 4).attr("text-anchor", "end")
        .text((n) => (narrow ? SHORT[n] : `${n} (${totals.get(n)})`));
      const colLabels = svg.append("g").selectAll("text").data(names).join("text")
        .attr("class", "hm-label")
        .attr("transform", (n, i) => `translate(${m.left + i * size + size / 2},${m.top - 8}) rotate(-40)`)
        .text((n) => SHORT[n]);

      const g = svg.append("g").selectAll("g").data(cells).join("g")
        .attr("transform", (c) => `translate(${m.left + c.j * size},${m.top + c.i * size})`)
        .style("cursor", (c) => (c.diag || !listEl ? "default" : "pointer"));
      g.append("rect").attr("width", size - 2).attr("height", size - 2).attr("rx", 4)
        .attr("fill", (c) => (c.diag ? "transparent" : color(c.n)))
        .attr("stroke", (c) => (c.diag ? C.grid : "none")).attr("stroke-dasharray", (c) => (c.diag ? "3,3" : null));
      g.append("text").attr("x", (size - 2) / 2).attr("y", (size - 2) / 2 + 4).attr("text-anchor", "middle")
        .attr("class", "hm-val")
        .style("fill", (c) => (c.diag ? C.muted : c.n > maxOff * 0.55 ? C.bg : C.text))
        .text((c) => (c.diag ? "—" : c.n));

      g.filter((c) => !c.diag)
        .on("pointerenter", function (ev, c) {
          d3.select(this).select("rect").attr("stroke", C.text).attr("stroke-width", 2);
          rowLabels.classed("hl", (n) => n === c.a);
          colLabels.classed("hl", (n) => n === c.b);
          App.tooltip.show(`<strong>${c.n} incident${c.n === 1 ? "" : "s"}</strong><div>tagged both <em>${c.a}</em> and <em>${c.b}</em></div>${c.n && listEl ? '<div class="tt-sub">click to list them</div>' : ""}`, ev);
        })
        .on("pointermove", (ev) => App.tooltip.move(ev))
        .on("pointerleave", function () {
          d3.select(this).select("rect").attr("stroke", "none");
          rowLabels.classed("hl", false);
          colLabels.classed("hl", false);
          App.tooltip.hide();
        })
        .on("click", (ev, c) => listEl && c.n && App.renderIncidentList(listEl, `${c.a} + ${c.b}`, c.list));
    }
    return { draw };
  }

  App.charts = { makeHacking, makeBehaviors, makeHeatmap, stackLayout, monthAxis };

  /* =====================================================================
     EXPLORE: dot timeline with month scrubber + live counters
     ===================================================================== */
  const exploreTimeline = (() => {
    const keys = monthKeys;
    const binIndex = new Map(keys.map((k, i) => [k, i]));
    const state = { filter: "all", upto: keys.length - 1 };
    const slider = document.getElementById("month-slider");
    const sliderLabel = document.getElementById("slider-label");
    const playBtn = document.getElementById("play");
    const counters = {
      total: document.getElementById("count-total"),
      testing: document.getElementById("count-testing"),
      public: document.getElementById("count-public"),
    };
    slider.max = keys.length - 1;
    slider.value = state.upto;
    document.getElementById("timeline-note").textContent =
      `${data.incidents.length} unique incidents from ${data.reportCount} reports. ` +
      `"Earlier" groups ${data.incidents.filter((d) => d.month < START).length} incidents from 2023–2024. ${partialNote}`;

    const el = document.getElementById("timeline-chart");
    const container = d3.select(el);
    let svg, dotsG, countsG, x, L;

    function computeLayout(width) {
      const cols = width < 600 ? 2 : 3;
      const visible = data.incidents.filter((d) => state.filter === "all" || d.kind === state.filter);
      const maxAll = d3.max(d3.rollup(data.incidents, (v) => v.length, binOf).values());
      const margin = { top: 24, right: 6, bottom: 34, left: 6 };
      x = d3.scaleBand().domain(keys).range([margin.left, width - margin.right]).paddingInner(0.18);
      const s = Math.min(14, x.bandwidth() / cols);
      const height = margin.top + Math.ceil(maxAll / cols) * s + margin.bottom;
      const baseline = height - margin.bottom;
      return { pos: stackLayout(visible, x, s, cols, baseline), byBin: d3.group(visible, binOf), s, cols, height, margin, baseline, width };
    }

    function draw() {
      const width = el.clientWidth;
      L = computeLayout(width);
      container.selectAll("*").remove();
      svg = container.append("svg").attr("viewBox", `0 0 ${width} ${L.height}`).attr("width", width).attr("height", L.height)
        .attr("role", "img").attr("aria-label", "Dot timeline of AI misalignment incidents by month");
      const axis = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${L.baseline + 6})`);
      axis.append("line").attr("x1", L.margin.left).attr("x2", width - L.margin.right).attr("stroke", C.grid);
      monthAxis(axis, x, width, 18);
      const sepX = x(keys[1]) - (x.step() * x.paddingInner()) / 2;
      svg.append("line").attr("x1", sepX).attr("x2", sepX).attr("y1", L.margin.top).attr("y2", L.baseline).attr("stroke", C.grid).attr("stroke-dasharray", "2,3");

      countsG = svg.append("g").attr("class", "col-counts");
      dotsG = svg.append("g");
      dotsG.selectAll("circle").data(data.incidents, (d) => d.id).join("circle")
        .attr("r", Math.max(1.5, L.s * 0.4))
        .attr("fill", (d) => C[d.kind])
        .style("cursor", "pointer")
        .on("pointerenter", function (ev, d) {
          d3.select(this).attr("stroke", C.text).attr("stroke-width", 2);
          App.tooltip.show(`<div class="tt-badges">${App.kindBadge(d.kind)}</div><strong>${App.esc(d.title)}</strong><div class="tt-sub">${App.esc(d.dates)} &middot; click to read</div>`, ev);
        })
        .on("pointermove", (ev) => App.tooltip.move(ev))
        .on("pointerleave", function () { d3.select(this).attr("stroke", null); App.tooltip.hide(); })
        .on("click", (ev, d) => App.openIncident(d.id));
      update(false);
    }

    function update(animate = true) {
      const next = computeLayout(L.width);
      L.pos = next.pos;
      L.byBin = next.byBin;
      const dots = dotsG.selectAll("circle");
      (animate ? dots.transition().duration(T) : dots)
        .attr("cx", (d) => L.pos.get(d.id)?.x ?? x(binOf(d)) + x.bandwidth() / 2)
        .attr("cy", (d) => L.pos.get(d.id)?.y ?? L.baseline)
        .attr("opacity", (d) => (!L.pos.has(d.id) ? 0 : binIndex.get(binOf(d)) <= state.upto ? 1 : 0.1));
      dots.style("pointer-events", (d) => (L.pos.has(d.id) && binIndex.get(binOf(d)) <= state.upto ? "all" : "none"));

      const labels = keys.filter((k) => (L.byBin.get(k)?.length ?? 0) >= 4 && binIndex.get(k) <= state.upto);
      countsG.selectAll("text").data(labels, (k) => k).join("text")
        .attr("x", (k) => x(k) + x.bandwidth() / 2).attr("text-anchor", "middle")
        .attr("y", (k) => L.baseline - Math.ceil(L.byBin.get(k).length / L.cols) * L.s - 6)
        .text((k) => L.byBin.get(k).length);

      const shown = data.incidents.filter((d) => binIndex.get(binOf(d)) <= state.upto);
      setCount(counters.total, shown.length);
      setCount(counters.testing, shown.filter((d) => d.kind === "testing").length);
      setCount(counters.public, shown.filter((d) => d.kind === "public").length);
      const key = keys[state.upto];
      sliderLabel.textContent = key === "pre" ? "through 2024" : `through ${monthName(key)}${key === lastMonth ? " (partial)" : ""}`;
    }

    function setCount(node, value) {
      const from = +node.dataset.value || 0;
      node.dataset.value = value;
      if (!T) { node.textContent = value; return; }
      d3.select(node).transition().duration(400).tween("text", () => {
        const i = d3.interpolateRound(from, value);
        return (t) => (node.textContent = i(t));
      });
    }

    slider.addEventListener("input", () => { stop(); state.upto = +slider.value; update(); });
    App.segmented(document.querySelector('[data-filter-group="timeline"]'), "filter", (f) => { state.filter = f; update(); });

    let timer = null;
    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      playBtn.innerHTML = "&#9654;&#xFE0E;";
      playBtn.setAttribute("aria-label", "Play timeline");
    }
    playBtn.addEventListener("click", () => {
      if (timer) return stop();
      if (state.upto >= keys.length - 1) state.upto = -1;
      playBtn.innerHTML = "&#10074;&#10074;";
      playBtn.setAttribute("aria-label", "Pause timeline");
      timer = setInterval(() => {
        state.upto++;
        slider.value = state.upto;
        update();
        if (state.upto >= keys.length - 1) stop();
      }, 380);
    });
    return { draw };
  })();

  const exploreBehaviors = makeBehaviors(document.getElementById("behavior-chart"), { listEl: document.getElementById("behavior-list") });
  App.segmented(document.querySelector('[data-filter-group="behaviors"]'), "filter", (f) => exploreBehaviors.set({ filter: f }));
  App.segmented(document.getElementById("behavior-sort"), "sort", (s) => exploreBehaviors.set({ sort: s }));
  const exploreHeatmap = makeHeatmap(document.getElementById("heatmap-chart"), { listEl: document.getElementById("heatmap-list") });

  const explore = [exploreTimeline, exploreBehaviors, exploreHeatmap];
  explore.forEach((c) => c.draw());
  App.onResize(() => explore.forEach((c) => c.draw()));
});
