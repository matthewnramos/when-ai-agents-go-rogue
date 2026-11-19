// D3 charts: incident timeline, AI-hacking running total, behavior bars, co-occurrence heatmap.
App.ready.then((data) => {
  const css = getComputedStyle(document.documentElement);
  const C = {
    testing: css.getPropertyValue("--testing").trim(),
    public: css.getPropertyValue("--public").trim(),
    text: css.getPropertyValue("--text").trim(),
    muted: css.getPropertyValue("--muted").trim(),
    grid: css.getPropertyValue("--border").trim(),
    surface: css.getPropertyValue("--surface").trim(),
  };
  const KINDS = ["public", "testing"]; // stacking order: real world on the bottom
  const fmtMonth = d3.timeFormat("%b %Y");
  const parseMonth = d3.timeParse("%Y-%m");
  const monthName = (key) => (key === "pre" ? "Before 2025" : fmtMonth(parseMonth(key)));
  const lastMonth = d3.max(data.incidents, (d) => d.month);
  const lastReported = d3.timeParse("%Y-%m-%d")(data.lastReported);
  const partialNote = `${monthName(lastMonth)} is a partial month (data through ${d3.timeFormat("%b %-d, %Y")(lastReported)}).`;
  const T = App.reducedMotion ? 0 : 600;

  /* =====================================================================
     1. TIMELINE: unit/dot chart with month scrubber + live counter
     ===================================================================== */
  const timeline = (() => {
    const START = "2025-01";
    const keys = ["pre", ...d3.timeMonth.range(parseMonth(START), d3.timeMonth.offset(parseMonth(lastMonth), 1)).map(d3.timeFormat("%Y-%m"))];
    const binOf = (d) => (d.month < START ? "pre" : d.month);
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
      `"Before 2025" groups ${data.incidents.filter((d) => d.month < START).length} incidents from 2023–2024. ${partialNote}`;

    const container = d3.select("#timeline-chart");
    let svg, dotsG, countsG, x, layout;

    function computeLayout(width) {
      const cols = width < 600 ? 2 : 3;
      const visible = data.incidents.filter((d) => state.filter === "all" || d.kind === state.filter);
      const byBin = d3.group(visible, binOf);
      const maxAll = d3.max(d3.rollup(data.incidents, (v) => v.length, binOf).values());
      const margin = { top: 24, right: 6, bottom: 34, left: 6 };
      x = d3.scaleBand().domain(keys).range([margin.left, width - margin.right]).paddingInner(0.18);
      const s = Math.min(14, x.bandwidth() / cols);
      const rows = Math.ceil(maxAll / cols);
      const height = margin.top + rows * s + margin.bottom;
      const pos = new Map();
      for (const [bin, list] of byBin) {
        list.sort((a, b) => d3.ascending(KINDS.indexOf(a.kind), KINDS.indexOf(b.kind)) || d3.ascending(a.month, b.month));
        const x0 = x(bin) + (x.bandwidth() - cols * s) / 2;
        list.forEach((d, k) => {
          pos.set(d.id, { x: x0 + (k % cols) * s + s / 2, y: height - margin.bottom - Math.floor(k / cols) * s - s / 2 });
        });
      }
      return { pos, s, height, margin, byBin, width };
    }

    function draw() {
      const width = container.node().clientWidth;
      layout = computeLayout(width);
      container.selectAll("*").remove();
      svg = container.append("svg").attr("viewBox", `0 0 ${width} ${layout.height}`).attr("width", width).attr("height", layout.height)
        .attr("role", "img").attr("aria-label", "Dot timeline of AI misalignment incidents by month");

      // x-axis labels
      // label every 3rd month (every 6th on phones), starting far enough from "Earlier" not to collide
      const every = width < 600 ? 6 : 3;
      const offset = width < 600 ? 3 : 0;
      const axis = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${layout.height - layout.margin.bottom + 6})`);
      axis.append("line").attr("x1", layout.margin.left).attr("x2", width - layout.margin.right).attr("stroke", C.grid);
      axis.selectAll("text").data(keys.filter((k, i) => k === "pre" || (i - 1) % every === offset)).join("text")
        .attr("x", (k) => x(k) + x.bandwidth() / 2).attr("y", 18).attr("text-anchor", "middle")
        .text((k) => (k === "pre" ? "Earlier" : d3.timeFormat(width < 600 ? "%b '%y" : "%b %Y")(parseMonth(k))));
      // separator after "Earlier"
      svg.append("line").attr("class", "sep")
        .attr("x1", x(keys[1]) - x.step() * x.paddingInner() / 2).attr("x2", x(keys[1]) - x.step() * x.paddingInner() / 2)
        .attr("y1", layout.margin.top).attr("y2", layout.height - layout.margin.bottom).attr("stroke", C.grid).attr("stroke-dasharray", "2,3");

      countsG = svg.append("g").attr("class", "col-counts");
      dotsG = svg.append("g");
      dotsG.selectAll("circle").data(data.incidents, (d) => d.id).join("circle")
        .attr("r", Math.max(1.5, layout.s * 0.4))
        .attr("fill", (d) => C[d.kind])
        .attr("cx", (d) => layout.pos.get(d.id)?.x ?? x(binOf(d)) + x.bandwidth() / 2)
        .attr("cy", (d) => layout.pos.get(d.id)?.y ?? layout.height - layout.margin.bottom)
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
      const newLayout = computeLayout(layout.width);
      layout.pos = newLayout.pos;
      layout.byBin = newLayout.byBin;
      const t = animate ? svg.transition().duration(T) : null;
      const dots = dotsG.selectAll("circle");
      (t ? dots.transition(t) : dots)
        .attr("cx", (d) => layout.pos.get(d.id)?.x ?? x(binOf(d)) + x.bandwidth() / 2)
        .attr("cy", (d) => layout.pos.get(d.id)?.y ?? layout.height - layout.margin.bottom)
        .attr("opacity", (d) => (!layout.pos.has(d.id) ? 0 : binIndex.get(binOf(d)) <= state.upto ? 1 : 0.1));
      dots.style("pointer-events", (d) => (layout.pos.has(d.id) && binIndex.get(binOf(d)) <= state.upto ? "all" : "none"));

      // column counts above stacks for the months shown
      const cols = layout.width < 600 ? 2 : 3;
      const labels = keys.filter((k) => layout.byBin.get(k)?.length && binIndex.get(k) <= state.upto && layout.byBin.get(k).length >= 4);
      countsG.selectAll("text").data(labels, (k) => k).join("text")
        .attr("x", (k) => x(k) + x.bandwidth() / 2).attr("text-anchor", "middle")
        .attr("y", (k) => layout.height - layout.margin.bottom - Math.ceil(layout.byBin.get(k).length / cols) * layout.s - 6)
        .text((k) => layout.byBin.get(k).length);

      // counters (always count both kinds so readers can compare)
      const shown = data.incidents.filter((d) => binIndex.get(binOf(d)) <= state.upto);
      setCount(counters.total, shown.length);
      setCount(counters.testing, shown.filter((d) => d.kind === "testing").length);
      setCount(counters.public, shown.filter((d) => d.kind === "public").length);
      const key = keys[state.upto];
      sliderLabel.textContent = key === "pre" ? "through 2024" : `through ${monthName(key)}${key === lastMonth ? " (partial)" : ""}`;
    }

    function setCount(el, value) {
      const from = +el.dataset.value || 0;
      el.dataset.value = value;
      if (App.reducedMotion) { el.textContent = value; return; }
      d3.select(el).transition().duration(400).tween("text", () => {
        const i = d3.interpolateRound(from, value);
        return (t) => (el.textContent = i(t));
      });
    }

    slider.addEventListener("input", () => { stop(); state.upto = +slider.value; update(); });
    App.segmented(document.querySelector('[data-filter-group="timeline"]'), "filter", (f) => { state.filter = f; update(); });

    let timer = null;
    function stop() { if (timer) { clearInterval(timer); timer = null; playBtn.innerHTML = "&#9654;"; playBtn.setAttribute("aria-label", "Play timeline"); } }
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

    // Start from an empty timeline and auto-play once when scrolled into view.
    let played = false;
    new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting && !played && !App.reducedMotion) {
        played = true;
        obs.disconnect();
        state.upto = 0; slider.value = 0; update(false);
        playBtn.click();
      }
    }, { threshold: 0.4 }).observe(document.getElementById("timeline-chart"));

    return { draw };
  })();

  /* =====================================================================
     2. AI HACKING: running total, stacked real world + lab
     ===================================================================== */
  const hacking = (() => {
    const TAGS = ["Unauthorized access", "Cybersecurity"];
    const hack = data.incidents.filter((d) => d.behaviors.some((b) => TAGS.includes(b)));
    const start = parseMonth("2025-01");
    const end = parseMonth(lastMonth);
    const months = d3.timeMonth.range(start, d3.timeMonth.offset(end, 1));
    const series = months.map((m) => {
      const key = d3.timeFormat("%Y-%m")(m);
      const upto = hack.filter((d) => d.month <= key);
      return { date: m, public: upto.filter((d) => d.kind === "public").length, testing: upto.filter((d) => d.kind === "testing").length };
    });
    series.forEach((d) => (d.total = d.public + d.testing));
    const last = series[series.length - 1];
    // extend the final step to the end of the partial month
    const stepData = [...series, { ...last, date: d3.timeMonth.offset(end, 1) }];
    const firstNonZero = series.find((d) => d.total > 0);
    document.getElementById("hacking-lede").innerHTML +=
      ` It climbs from <strong>${firstNonZero.total}</strong> in ${fmtMonth(firstNonZero.date)} to <strong>${last.total}</strong> by ${fmtMonth(last.date)}, and <strong>${last.public}</strong> of those reached the real world.`;

    const container = d3.select("#hacking-chart");

    function draw() {
      const width = container.node().clientWidth;
      const height = Math.max(260, Math.min(380, width * 0.45));
      const m = { top: 28, right: width < 600 ? 16 : 120, bottom: 32, left: 40 };
      container.selectAll("*").remove();
      const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", width).attr("height", height)
        .attr("role", "img").attr("aria-label", `Running total of AI hacking incidents, reaching ${last.total} by ${fmtMonth(last.date)}`);
      const x = d3.scaleTime().domain([start, d3.timeMonth.offset(end, 1)]).range([m.left, width - m.right]);
      const y = d3.scaleLinear().domain([0, last.total * 1.1]).nice().range([height - m.bottom, m.top]);

      svg.append("g").attr("class", "grid").attr("transform", `translate(${m.left},0)`)
        .call(d3.axisLeft(y).ticks(5).tickSize(-(width - m.left - m.right)).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", `translate(${m.left},0)`).call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8));
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - m.bottom})`)
        .call(d3.axisBottom(x).ticks(d3.timeMonth.every(width < 600 ? 6 : 3)).tickFormat(d3.timeFormat(width < 600 ? "%b '%y" : "%b %Y")).tickSizeOuter(0));

      const stack = d3.stack().keys(KINDS)(stepData);
      const area = d3.area().curve(d3.curveStepAfter).x((d) => x(d.data.date)).y0((d) => y(d[0])).y1((d) => y(d[1]));
      const paths = svg.append("g").selectAll("path").data(stack).join("path")
        .attr("fill", (s) => C[s.key]).attr("opacity", 0.9).attr("d", area);

      // reveal animation
      if (T) {
        const clip = svg.append("clipPath").attr("id", "hack-clip").append("rect")
          .attr("x", m.left).attr("y", 0).attr("height", height).attr("width", 0);
        paths.attr("clip-path", "url(#hack-clip)");
        new IntersectionObserver((entries, obs) => {
          if (entries[0].isIntersecting) { obs.disconnect(); clip.transition().duration(1600).ease(d3.easeCubicInOut).attr("width", width - m.left - m.right); }
        }, { threshold: 0.4 }).observe(container.node());
      }

      // end labels
      if (width >= 600) {
        const xe = x(d3.timeMonth.offset(end, 1)) + 8;
        svg.append("text").attr("class", "end-label").attr("x", xe).attr("y", y(last.total) + 4).style("fill", C.text).attr("font-weight", 700).text(`${last.total} total`);
        svg.append("text").attr("class", "end-label").attr("x", xe).attr("y", y(last.public + last.testing / 2) + 4).style("fill", C.testing).text(`${last.testing} lab`);
        svg.append("text").attr("class", "end-label").attr("x", xe).attr("y", y(last.public / 2) + 4).style("fill", C.public).text(`${last.public} real world`);
      }

      // legend
      const lg = svg.append("g").attr("class", "legend").attr("transform", `translate(${m.left + 8},${m.top - 12})`);
      [["public", "Real world"], ["testing", "Lab test"]].forEach(([k, label], i) => {
        const g = lg.append("g").attr("transform", `translate(${i * 110},0)`);
        g.append("rect").attr("width", 12).attr("height", 12).attr("y", -10).attr("rx", 2).attr("fill", C[k]);
        g.append("text").attr("x", 18).text(label);
      });

      // hover rule
      const rule = svg.append("line").attr("stroke", C.text).attr("stroke-dasharray", "3,3").attr("y1", m.top).attr("y2", height - m.bottom).attr("opacity", 0);
      svg.append("rect").attr("x", m.left).attr("y", m.top).attr("width", width - m.left - m.right).attr("height", height - m.top - m.bottom)
        .attr("fill", "transparent")
        .on("pointermove", (ev) => {
          const [mx] = d3.pointer(ev);
          const i = Math.max(0, d3.bisectRight(series.map((d) => d.date), x.invert(mx)) - 1);
          const d = series[i];
          rule.attr("x1", x(d.date) + 0.5).attr("x2", x(d.date) + 0.5).attr("opacity", 0.6);
          App.tooltip.show(`<strong>Through ${fmtMonth(d.date)}</strong><div>${d.total} hacking incidents</div><div class="tt-sub"><span class="key public">${d.public} real world</span> &middot; <span class="key testing">${d.testing} lab</span></div>`, ev);
        })
        .on("pointerleave", () => { rule.attr("opacity", 0); App.tooltip.hide(); });
    }
    return { draw };
  })();

  /* =====================================================================
     3. BEHAVIORS: stacked bars, lab vs real world (main interactive view)
     ===================================================================== */
  const behaviors = (() => {
    const rows = data.behaviors.map((name) => {
      const list = data.incidents.filter((d) => d.behaviors.includes(name));
      return { name, list, testing: list.filter((d) => d.kind === "testing").length, public: list.filter((d) => d.kind === "public").length };
    });
    const state = { filter: "all", sort: "total" };
    const listEl = document.getElementById("behavior-list");
    const container = d3.select("#behavior-chart");
    let svg, width, m, x, y, labelAbove, barH;

    function draw() {
      width = container.node().clientWidth;
      labelAbove = width < 560;
      m = { top: 10, right: 44, bottom: 30, left: labelAbove ? 4 : 190 };
      barH = 26;
      const step = labelAbove ? 56 : 44;
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

    function value(r) {
      return state.filter === "all" ? r.testing + r.public : r[state.filter];
    }

    function update(animate = true) {
      const sorted = rows.slice().sort((a, b) =>
        state.sort === "public"
          ? d3.descending(a.public / (a.testing + a.public), b.public / (b.testing + b.public))
          : d3.descending(value(a), value(b)));
      x.domain([0, d3.max(rows, value) || 1]).nice();
      y.domain(sorted.map((r) => r.name));
      const yOff = labelAbove ? 18 : 0;
      const bh = Math.min(barH, y.bandwidth() - yOff);
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

      svg.select(".bars").selectAll("g.seg").data(segs, (d) => d.row.name + d.kind).join(
        (enter) => {
          const g = enter.append("g").attr("class", "seg").style("cursor", "pointer");
          g.append("rect").attr("fill", (d) => C[d.kind]).attr("rx", 3);
          g.append("text").attr("class", "seg-label").attr("dy", "0.35em").attr("text-anchor", "middle");
          return g;
        })
        .on("pointerenter", (ev, d) => {
          const total = d.row.testing + d.row.public;
          App.tooltip.show(`<strong>${d.row.name}</strong><div>${App.kindBadge(d.kind)} ${d.row[d.kind]} incidents</div><div class="tt-sub">${Math.round((d.row[d.kind] / total) * 100)}% of ${total} &middot; click to list them</div>`, ev);
        })
        .on("pointermove", (ev) => App.tooltip.move(ev))
        .on("pointerleave", () => App.tooltip.hide())
        .on("click", (ev, d) => App.renderIncidentList(listEl, `${d.row.name}: ${App.KIND_LABEL[d.kind].toLowerCase()}`, d.row.list.filter((i) => i.kind === d.kind)))
        .call((g) => {
          g.select("rect").transition(t)
            .attr("x", (d) => x(d.x0)).attr("width", (d) => Math.max(0, x(d.x0 + d.v) - x(d.x0)))
            .attr("y", (d) => y(d.row.name) + yOff).attr("height", bh);
          g.select("text").transition(t)
            .attr("x", (d) => x(d.x0 + d.v / 2)).attr("y", (d) => y(d.row.name) + yOff + bh / 2)
            .style("fill", "#0b0d12")
            .text((d) => (x(d.x0 + d.v) - x(d.x0) > 26 ? d.v : ""));
        });

      svg.select(".labels").selectAll("text").data(sorted, (r) => r.name).join("text")
        .attr("class", (r) => "row-label" + (r.public >= r.testing ? " highlight" : ""))
        .style("cursor", "pointer")
        .on("click", (ev, r) => App.renderIncidentList(listEl, `${r.name}: all incidents`, r.list))
        .text((r) => r.name)
        .transition(t)
        .attr("x", labelAbove ? m.left : m.left - 10)
        .attr("text-anchor", labelAbove ? "start" : "end")
        .attr("y", (r) => (labelAbove ? y(r.name) + 12 : y(r.name) + bh / 2 + 4));

      svg.select(".totals").selectAll("text").data(sorted, (r) => r.name).join("text")
        .attr("class", "total-label")
        .transition(t)
        .attr("x", (r) => x(value(r)) + 6).attr("y", (r) => y(r.name) + yOff + bh / 2 + 4)
        .text((r) => value(r));
    }

    App.segmented(document.querySelector('[data-filter-group="behaviors"]'), "filter", (f) => { state.filter = f; update(); });
    App.segmented(document.getElementById("behavior-sort"), "sort", (s) => { state.sort = s; update(); });
    return { draw };
  })();

  /* =====================================================================
     4. CO-OCCURRENCE HEATMAP
     ===================================================================== */
  const heatmap = (() => {
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
    const color = d3.scaleSequential(d3.interpolateRgb(C.surface, C.testing)).domain([0, maxOff]);
    const listEl = document.getElementById("heatmap-list");
    const container = d3.select("#heatmap-chart");

    function draw() {
      const width = container.node().clientWidth;
      const narrow = width < 640;
      // right margin leaves room for the last rotated column label
      const m = { top: narrow ? 92 : 104, right: narrow ? 56 : 72, bottom: 8, left: narrow ? 104 : 210 };
      const size = Math.min(64, (width - m.left - m.right) / names.length);
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
        .style("cursor", (c) => (c.diag ? "default" : "pointer"));
      g.append("rect").attr("width", size - 2).attr("height", size - 2).attr("rx", 4)
        .attr("fill", (c) => (c.diag ? "transparent" : color(c.n)))
        .attr("stroke", (c) => (c.diag ? C.grid : "none")).attr("stroke-dasharray", (c) => (c.diag ? "3,3" : null));
      g.append("text").attr("x", (size - 2) / 2).attr("y", (size - 2) / 2 + 4).attr("text-anchor", "middle")
        .attr("class", "hm-val")
        .style("fill", (c) => (c.diag ? C.muted : c.n > maxOff * 0.55 ? "#0b0d12" : C.text))
        .text((c) => (c.diag ? "—" : c.n));

      g.filter((c) => !c.diag)
        .on("pointerenter", function (ev, c) {
          d3.select(this).select("rect").attr("stroke", C.text).attr("stroke-width", 2);
          rowLabels.classed("hl", (n) => n === c.a);
          colLabels.classed("hl", (n) => n === c.b);
          App.tooltip.show(`<strong>${c.n} incident${c.n === 1 ? "" : "s"}</strong><div>tagged both <em>${c.a}</em> and <em>${c.b}</em></div>${c.n ? '<div class="tt-sub">click to list them</div>' : ""}`, ev);
        })
        .on("pointermove", (ev) => App.tooltip.move(ev))
        .on("pointerleave", function () {
          d3.select(this).select("rect").attr("stroke", "none");
          rowLabels.classed("hl", false);
          colLabels.classed("hl", false);
          App.tooltip.hide();
        })
        .on("click", (ev, c) => c.n && App.renderIncidentList(listEl, `${c.a} + ${c.b}`, c.list));
    }
    return { draw };
  })();

  /* ---------- draw + responsive redraw ---------- */
  const all = [timeline, hacking, behaviors, heatmap];
  all.forEach((c) => c.draw());
  let lastW = window.innerWidth, rt;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(rt);
    rt = setTimeout(() => all.forEach((c) => c.draw()), 150);
  });
});
