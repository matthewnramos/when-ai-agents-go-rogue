// Scrollytelling: a sticky graphic whose scene changes as Scrollama steps enter.
// Scenes with the dot layer move the same 183 incident dots between layouts;
// later scenes crossfade to the hacking, behavior and heatmap charts.
App.ready.then((data) => {
  const { C, T, binOf, monthKeys, isHack, monthName, lastMonth, START } = App.shared;
  const { makeHacking, makeBehaviors, makeHeatmap, stackLayout, monthAxis } = App.charts;
  const fmtN = d3.format(",");

  /* ---------- stats used in step text and headers ---------- */
  const inc = data.incidents;
  const byMonth = d3.rollups(inc, (v) => v.length, (d) => d.month);
  const [peakKey, peakCount] = byMonth.reduce((a, b) => (b[1] > a[1] ? b : a));
  const hackList = inc.filter(isHack);
  const stage = document.getElementById("g-stage");
  const hacking = makeHacking(document.getElementById("g-hacking"), { height: () => Math.min(460, stage.clientHeight) });
  const bars = makeBehaviors(document.getElementById("g-bars"));
  const heat = makeHeatmap(document.getElementById("g-heat"), { maxHeight: () => stage.clientHeight });
  const firstHack = hacking.series.find((d) => d.total > 0);
  const realHeavy = bars.rows.filter((r) => r.public >= r.testing).map((r) => r.name);
  const realHeavyText = realHeavy.map((n, i) => (i ? n.toLowerCase() : n));
  const unauth = bars.rows.find((r) => r.name === "Unauthorized access");
  const listPhrase = (arr) => (arr.length < 2 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`);

  const stats = {
    total: inc.length,
    testing: inc.filter((d) => d.kind === "testing").length,
    public: inc.filter((d) => d.kind === "public").length,
    pre2026: inc.filter((d) => d.month < "2026").length,
    y2026: inc.filter((d) => d.month >= "2026").length,
    peakMonth: monthName(peakKey),
    peakCount,
    hackTotal: hackList.length,
    hackPublic: hackList.filter((d) => d.kind === "public").length,
    hackFirst: firstHack.total,
    hackFirstMonth: d3.timeFormat("%B %Y")(firstHack.date),
    lastMonth: d3.timeFormat("%B %Y")(App.shared.parseMonth(lastMonth)),
    cheatTotal: bars.rows.find((r) => r.name.startsWith("Cheating")).list.length,
    unauthPublic: unauth.public,
    unauthTotal: unauth.list.length,
    realHeavyNames: listPhrase(realHeavyText),
  };
  document.querySelectorAll("[data-stat]").forEach((el) => {
    const v = stats[el.dataset.stat];
    el.textContent = typeof v === "number" ? fmtN(v) : v;
  });

  /* ---------- scenes ---------- */
  const SCENES = {
    grid:       { layer: "dots", layout: "grid", color: false, head: ["AI Misalignment Watch", `${stats.total} incidents`, "Each dot is one unique incident"] },
    "grid-kind":{ layer: "dots", layout: "grid", color: true,  head: ["Where they were caught", `${stats.testing} lab · ${stats.public} real world`, "Lab tests vs. real-world incidents"] },
    timeline:   { layer: "dots", layout: "timeline", color: true, head: ["When they happened", "Incidents by month", `Only ${stats.pre2026} before 2026`] },
    surge:      { layer: "dots", layout: "timeline", color: true, annot: "surge", head: ["2026", `${stats.y2026} incidents in 2026`, `Peak: ${stats.peakMonth} (${stats.peakCount})`] },
    real:       { layer: "dots", layout: "real", color: true, head: ["Outside the lab", `${stats.public} real-world incidents`, "Lab tests faded out"] },
    hackdots:   { layer: "dots", layout: "timeline", color: true, highlight: isHack, head: ["Breaking in", `${stats.hackTotal} hacking incidents`, "Unauthorized access or cybersecurity"] },
    hackarea:   { layer: "hacking", head: ["Breaking in", "AI hacking, running total", `${stats.hackTotal} by ${monthName(lastMonth)}, ${stats.hackPublic} real world`] },
    bars:       { layer: "bars", bars: { highlight: null, sort: "total" }, head: ["Behaviors", "What kind of misbehavior?", "Unique incidents per behavior (tags overlap)"] },
    "bars-hl":  { layer: "bars", bars: { highlight: realHeavy, sort: "public" }, head: ["Behaviors", "Where hacking shows up", "Sorted by real-world share"] },
    heat:       { layer: "heat", head: ["Behaviors", "Which behaviors appear together?", "Incidents tagged with both"] },
  };
  const HINTS = {
    dots: "Hover over a dot for details. Click to read the story.",
    hacking: "Hover to see the monthly totals.",
    bars: "Hover over a bar for details.",
    heat: "Hover over a cell for details.",
  };

  /* ---------- dot layer ---------- */
  const svg = d3.select("#g-dots");
  const annot = svg.append("g").attr("class", "g-annot");
  const axisG = svg.append("g").attr("class", "axis g-axis");
  const dotsG = svg.append("g");
  let W = 0, H = 0, current = null;

  const gridOrder = inc.slice().sort((a, b) => d3.ascending(a.kind === "public" ? 0 : 1, b.kind === "public" ? 0 : 1) || d3.ascending(a.month, b.month) || d3.ascending(a.id, b.id));

  function gridLayout() {
    const n = gridOrder.length;
    const cols = Math.ceil(Math.sqrt((n * W) / H));
    const rows = Math.ceil(n / cols);
    const s = Math.min(W / cols, H / rows, 30) * 0.92;
    const x0 = (W - cols * s) / 2, y0 = (H - rows * s) / 2;
    const pos = new Map();
    gridOrder.forEach((d, i) => pos.set(d.id, { x: x0 + (i % cols) * s + s / 2, y: y0 + Math.floor(i / cols) * s + s / 2 }));
    return { pos, r: s * 0.38 };
  }

  function timeScale() {
    const m = { top: 34, right: 8, bottom: 30, left: 8 };
    const x = d3.scaleBand().domain(monthKeys).range([m.left, W - m.right]).paddingInner(0.18);
    const maxAll = d3.max(d3.rollup(inc, (v) => v.length, binOf).values());
    // pick the dots-per-row that gives the biggest dots for this stage shape
    const fit = (c) => Math.min(x.bandwidth() / c, (H - m.top - m.bottom) / Math.ceil(maxAll / c), 18);
    const cols = d3.range(1, 6).reduce((best, c) => (fit(c) > fit(best) ? c : best), 1);
    return { x, s: fit(cols), cols, baseline: H - m.bottom, m };
  }

  function layoutFor(scene) {
    if (scene.layout === "grid") return gridLayout();
    const ts = timeScale();
    const all = stackLayout(inc, ts.x, ts.s, ts.cols, ts.baseline);
    if (scene.layout === "real") {
      const pub = stackLayout(inc.filter((d) => d.kind === "public"), ts.x, ts.s, ts.cols, ts.baseline);
      for (const [id, p] of pub) all.set(id, p);
    }
    return { pos: all, r: ts.s * 0.4, ts };
  }

  function opacityFor(scene, d) {
    if (scene.layout === "real") return d.kind === "public" ? 1 : 0.06;
    if (scene.highlight) return scene.highlight(d) ? 1 : 0.12;
    return 1;
  }

  function drawDots(scene, animate) {
    const L = layoutFor(scene);
    const dots = dotsG.selectAll("circle").data(inc, (d) => d.id).join((enter) =>
      enter.append("circle")
        .attr("cx", W / 2).attr("cy", H / 2).attr("r", 0)
        .style("cursor", "pointer")
        .on("pointerenter", function (ev, d) {
          if (+d3.select(this).attr("data-op") < 0.5) return;
          d3.select(this).attr("stroke", C.text).attr("stroke-width", 2);
          App.tooltip.show(`<div class="tt-badges">${App.kindBadge(d.kind)}</div><strong>${App.esc(d.title)}</strong><div class="tt-sub">${App.esc(d.dates)} &middot; click to read</div>`, ev);
        })
        .on("pointermove", (ev) => App.tooltip.move(ev))
        .on("pointerleave", function () { d3.select(this).attr("stroke", null); App.tooltip.hide(); })
        .on("click", function (ev, d) { if (+d3.select(this).attr("data-op") >= 0.5) App.openIncident(d.id); })
    );
    const t = d3.transition().duration(animate ? T * 1.3 : 0).ease(d3.easeCubicInOut);
    dots.attr("data-op", (d) => opacityFor(scene, d))
      .style("pointer-events", (d) => (opacityFor(scene, d) >= 0.5 ? "all" : "none"))
      .transition(t)
      .delay((d, i) => (animate && T ? (i % 40) * 6 : 0))
      .attr("cx", (d) => L.pos.get(d.id).x)
      .attr("cy", (d) => L.pos.get(d.id).y)
      .attr("r", Math.max(1.6, L.r))
      .attr("fill", (d) => (scene.color ? C[d.kind] : C.neutral))
      .attr("opacity", (d) => opacityFor(scene, d));

    // month axis (timeline layouts only)
    const isTime = scene.layout !== "grid";
    axisG.selectAll("*").remove();
    if (isTime) {
      const { x, baseline } = L.ts;
      axisG.append("line").attr("x1", x.range()[0]).attr("x2", x.range()[1]).attr("y1", baseline + 4).attr("y2", baseline + 4).attr("stroke", C.grid);
      monthAxis(axisG, x, W, baseline + 20);
    }
    axisG.attr("opacity", 0).transition(t).attr("opacity", isTime ? 1 : 0);

    // annotations
    annot.selectAll("*").remove();
    if (scene.annot === "surge") {
      const { x, baseline, s, cols, m } = L.ts;
      const x0 = x("2026-01") - (x.step() * x.paddingInner()) / 2;
      const x1 = x.range()[1];
      annot.append("rect").attr("x", x0).attr("y", m.top - 24).attr("width", x1 - x0).attr("height", baseline - m.top + 28)
        .attr("fill", C.public).attr("opacity", 0).transition(t).attr("opacity", 0.06);
      annot.append("text").attr("class", "g-annot-label").attr("x", x0 + 8).attr("y", m.top - 8).text("2026").attr("opacity", 0).transition(t).attr("opacity", 1);
      const peakRows = Math.ceil(peakCount / cols);
      annot.append("text").attr("class", "g-annot-label strong").attr("text-anchor", "middle")
        .attr("x", x(peakKey) + x.bandwidth() / 2).attr("y", baseline - peakRows * s - 8)
        .text(peakCount).attr("opacity", 0).transition(t).attr("opacity", 1);
    }
  }

  /* ---------- scene switching ---------- */
  const layers = {
    dots: document.getElementById("g-dots"),
    hacking: document.getElementById("g-hacking"),
    bars: document.getElementById("g-bars"),
    heat: document.getElementById("g-heat"),
  };
  const head = { kicker: document.getElementById("g-kicker"), title: document.getElementById("g-title"), sub: document.getElementById("g-sub") };
  const legend = document.getElementById("g-legend");

  function render(name, animate = true) {
    const scene = SCENES[name];
    if (!scene) return;
    const prev = current;
    current = name;
    App.tooltip.hide();
    Object.entries(layers).forEach(([k, el]) => el.classList.toggle("active", k === scene.layer));
    [head.kicker.textContent, head.title.textContent, head.sub.textContent] = scene.head;
    legend.classList.toggle("muted-legend", scene.layer === "heat" || (scene.layer === "dots" && !scene.color));
    legend.querySelector(".g-hint").textContent = HINTS[scene.layer];

    if (scene.layer === "dots") drawDots(scene, animate && prev !== null);
    if (scene.layer === "hacking") hacking.reveal();
    if (scene.layer === "bars") bars.set(scene.bars, animate && SCENES[prev]?.layer === "bars");
  }

  function size() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    svg.attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
  }

  size();
  hacking.draw();
  bars.draw();
  heat.draw();
  render("grid", false);

  /* ---------- Scrollama ---------- */
  const steps = [...document.querySelectorAll("#story .step")];
  const scroller = scrollama();
  scroller
    .setup({ step: "#story .step", offset: 0.62 })
    .onStepEnter(({ element, index }) => {
      steps.forEach((s, i) => {
        s.classList.toggle("is-active", s === element);
        s.classList.toggle("is-past", i < index); // on phones, passed cards fade so they don't cover the chart
      });
      if (element.dataset.scene !== current) render(element.dataset.scene);
      document.dispatchEvent(new CustomEvent("story:step", { detail: { index, element } }));
    });

  App.onResize(() => {
    size();
    hacking.draw();
    bars.draw();
    heat.draw();
    const c = current;
    current = null;
    render(c, false);
    scroller.resize();
  });
});
