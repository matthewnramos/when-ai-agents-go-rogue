// Peek bots: three small robots that play peekaboo around the page. They hide behind
// an element and peek out over one of its edges (top, right, bottom or left), hands
// gripping it, then duck back and pop out somewhere new, one after another.
//  - In the scrollytelling they follow the steps: the active card, the pinned chart
//    (always outside it) and chapter labels. Going rogue spreads: the first turns at
//    "Breaking in", the second at the hacking running total, the third at Chapter 4.
//    story.js dispatches "story:step" whenever a step becomes active.
//  - Everywhere else they are calmer: at most two, only around static things (headings,
//    cards, the footer), never around buttons or controls, and only after the reader
//    has settled on a section for a moment.
// They are decorative and click-through (pointer-events: none).
//
// How "behind" works: each bot is drawn pointing up out of a horizontal edge line,
// then rotated to match the side. Its head is clipped at the edge line, so it looks
// like it is behind the element; its hands are not clipped, so they sit on the edge.
(() => {
  const section = document.getElementById("story");
  const stage = document.getElementById("g-stage");
  if (!section || !stage) return;
  const RM = App.reducedMotion;
  const steps = [...section.querySelectorAll(".step")];
  const cardSteps = steps.filter((s) => s.querySelector(".step-card"));
  const firstStep = (scene) => steps.findIndex((s) => s.dataset.scene === scene);
  const ROGUE_AT = [firstStep("real"), firstStep("hackarea"), firstStep("bars")]; // step index where each bot turns

  const ROTATE = { top: 0, right: 90, bottom: 180, left: -90 };
  const OPPOSITE = { top: "bottom", bottom: "top", left: "right", right: "left" };
  const EDGE = 60; // y of the edge line inside the 80x80 drawing
  const SIDE_DEPTH = 30; // px a side peek sticks out (shallow: eyes and antenna only)
  // per-step edges for the cards and for the chart, cycled through as the story goes on
  const CARD = [["top", 0.72], ["right", 0.35], ["left", 0.6], ["bottom", 0.3], ["right", 0.7], ["top", 0.28], ["left", 0.35], ["bottom", 0.7]];
  const CHART = [["top", 0.88], ["left", 0.45], ["bottom", 0.45], ["right", 0.35]];
  // phones: cards span the width, so only top/bottom; top peeks stay right of the chart legend
  const PHONE = [["top", 0.8], ["bottom", 0.3], ["top", 0.88], ["bottom", 0.7]];

  const phone = () => window.innerWidth <= 900;
  const now = () => performance.now() / 1000;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- where the bots go ---------- */
  // allowed range along each edge, so a bot never covers the chart title, legend or hint
  function range(s) {
    if (s.host === stage) return s.side === "top" ? [0.72, 0.94] : s.side === "bottom" ? [0.3, 0.55] : [0.25, 0.75];
    if (phone() && s.side === "top") return [0.8, 0.9];
    return [0.15, 0.85];
  }

  // Side peeks need a little room: the chart has the page margin on its left and the
  // cards on its right; the cards have the chart on their left and the chapter rail on their right.
  function fit(s) {
    if (!s) return s;
    if (s.side === "left" || s.side === "right") {
      const r = s.host.getBoundingClientRect();
      const rail = document.getElementById("rail");
      const railLeft = rail && getComputedStyle(rail).display !== "none" ? rail.getBoundingClientRect().left : window.innerWidth;
      const stepsLeft = section.querySelector(".scrolly-steps").getBoundingClientRect().left;
      const graphicRight = section.querySelector(".scrolly-graphic").getBoundingClientRect().right;
      const onChart = s.host === stage;
      const inStory = section.contains(s.host);
      const room = onChart ? (s.side === "right" ? stepsLeft - r.right : r.left)
        : !inStory ? (s.side === "right" ? railLeft - r.right : r.left)
        : s.side === "right" ? railLeft - r.right : r.left - graphicRight;
      if (room < SIDE_DEPTH - 4) {
        if (!inStory) { s.f = s.fallback ? 0.8 : s.side === "right" ? 0.9 : 0.12; s.side = s.fallback || "top"; }
        else s.side = onChart ? "top" : s.side === "right" ? "bottom" : "top";
      }
    }
    if (s.free) return s;
    const [lo, hi] = range(s);
    s.f = clamp(s.f, lo, hi);
    return s;
  }

  // Rough on-screen box a peeking bot takes up (viewport px), to keep bots from overlapping.
  function spotBox(s) {
    const r = s.host.getBoundingClientRect();
    const ax = r.left + (s.side === "left" ? 0 : s.side === "right" ? r.width : r.width * s.f);
    const ay = r.top + (s.side === "top" ? 0 : s.side === "bottom" ? r.height : r.height * s.f);
    const out = s.side === "left" || s.side === "right" ? 38 : 62, half = 42, inset = 10;
    return s.side === "top" ? [ax - half, ay - out, ax + half, ay + inset]
      : s.side === "bottom" ? [ax - half, ay - inset, ax + half, ay + out]
      : s.side === "left" ? [ax - out, ay - half, ax + inset, ay + half]
      : [ax - inset, ay - half, ax + out, ay + half];
  }
  const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  // the card's left edge and the chart's right edge share one narrow gap; the card scrolls past the
  // pinned chart, so bots there would collide even if they don't right now
  const sharedGap = (a, b) => [a, b].some((x, i) => x.host === stage && x.side === "right" && [a, b][1 - i].side === "left" && [a, b][1 - i].host !== stage);

  // Bots must not overlap: slide a later bot to the far end of its edge, or drop it.
  function separate(list) {
    list.forEach((s, i) => {
      if (!s) return;
      const clash = () => list.slice(0, i).some((o) => o && (overlaps(spotBox(o), spotBox(s)) || sharedGap(o, s)));
      if (!clash()) return;
      const [lo, hi] = s.free ? [0.1, 0.9] : range(s);
      const orig = s.f;
      for (const f of [hi, lo, (lo + hi) / 2]) { s.f = f; if (!clash()) return; }
      s.f = orig;
      list[i] = null;
    });
    return list;
  }

  function spotsFor(stepEl) {
    const card = stepEl.querySelector(".step-card");
    const label = stepEl.querySelector(".eyebrow");
    if (!card && !label) return null;
    const at = (host, [side, f]) => ({ host, side, f });
    if (!card) {
      // chapter steps: one over the "Chapter N" label, one around the chart, one hiding
      return phone() ? [at(label, ["top", 0.5]), null] : separate([at(label, ["top", 0.5]), fit(at(stage, ["top", 0.9])), null]);
    }
    const ci = cardSteps.indexOf(stepEl);
    if (phone()) {
      const [side, f] = PHONE[ci % PHONE.length];
      return separate([fit(at(card, [side, f])), fit(at(card, [OPPOSITE[side], 1 - f]))]);
    }
    // alternate which one leads: the card or the chart; the third peeks from the leader's opposite edge
    const cardLeads = ci % 2 === 0;
    const a = cardLeads ? at(card, CARD[(ci >> 1) % CARD.length]) : at(stage, CHART[(ci >> 1) % CHART.length]);
    const b = cardLeads ? at(stage, CHART[(ci + 1) % CHART.length]) : at(card, CARD[(ci + 3) % CARD.length]);
    const c = ci % 3 === 2 ? null : at(a.host, [OPPOSITE[a.side], 1 - a.f]);
    return separate([fit(a), fit(b), fit(c)]);
  }

  // Outside the story: spots per section. Only static things, never buttons or controls.
  const $ = (sel) => document.querySelector(sel);
  const site = (host, side, f, extra) => host && fit({ host, side, f, free: true, calm: true, ...extra });
  const label = (sel) => { const h = $(sel); return h && site(h, "top", Math.min(0.5, 70 / (h.offsetWidth || 1))); };
  const REGIONS = [
    { el: $(".hero"), rogue: false, spots: () => [site($(".hero .glitch"), "top", 0.5)] },
    { el: $("#quiz"), rogue: false, spots: () => [label("#quiz .eyebrow"), site($("#quiz-card"), "right", 0.2)] },
    { el: section, story: true },
    { el: $("#explore"), rogue: true, spots: () => [label("#explore .eyebrow"), site($("#explore .counter-row .counter:last-child"), "right", 0.5)] },
    { el: $(".caveat-wrap"), rogue: true, spots: () => [site($(".caveat"), "right", 0.4)] },
    { el: $("#trust"), rogue: true, spots: () => { const panel = $("#trust-panel"); return [label("#trust .eyebrow"), panel && !panel.hidden ? site(panel, "right", 0.3, { fallback: "bottom" }) : null]; } }, // never above it: the level buttons are there
    { el: $("#writeup"), rogue: false, spots: () => [label("#writeup .eyebrow")] },
    { el: $("#about"), rogue: false, spots: () => [site($("#about h2"), "left", 0.5)] },
    { el: $(".site-footer"), rogue: false, spots: () => [site($(".site-footer"), "top", 0.82, { wave: true })] },
  ].filter((r) => r.el);
  const siteSpots = (r) => separate(r.spots().filter(Boolean).slice(0, 2));

  /* ---------- one bot ---------- */
  // Each bot looks different and has its own gaze habit:
  //  content: mostly reads the card it's peeking from; reader: keeps looking out at you;
  //  restless: glances everywhere, quickly. All of them check on each other now and then.
  const VARIANTS = [
    { name: "classic", scale: 1, rx: 14, antennas: [[40, 0]], eye: { w: 10, h: 13, rx: 3.5 }, gaze: "content" },
    { name: "round", scale: 0.84, rx: 21, antennas: [[32, -22], [48, 22]], ears: true, eye: { w: 10, h: 12, rx: 5 }, gaze: "reader" },
    { name: "visor", scale: 0.72, rx: 8, antennas: [], nubs: true, visor: true, eye: { w: 30, h: 9, rx: 4.5 }, gaze: "restless" },
  ];

  function svgFor(v) {
    const antennas = v.antennas.map(([x, a]) =>
      `<g transform="rotate(${a} ${x} 14)"><line class="bot-stalk" x1="${x}" y1="14" x2="${x}" y2="7"/><circle class="bot-light bot-tip" cx="${x}" cy="5.5" r="2.8"/></g>`).join("");
    const { w, h, rx } = v.eye;
    const ey = 32.5 - h / 2;
    const ears = v.ears ? `<circle class="bot-shell" cx="13" cy="36" r="5"/><circle class="bot-shell" cx="67" cy="36" r="5"/><circle class="bot-bolt" cx="13" cy="36" r="1.6"/><circle class="bot-bolt" cx="67" cy="36" r="1.6"/>` : "";
    const nubs = v.nubs ? `<rect class="bot-shell" x="22" y="8" width="7" height="8" rx="2.5"/><rect class="bot-shell" x="51" y="8" width="7" height="8" rx="2.5"/><rect class="bot-light" x="35" y="10.5" width="10" height="2.6" rx="1.3"/>` : "";
    const eyesSvg = v.visor
      ? `<rect class="bot-eye" x="${40 - w / 2}" y="${ey}" width="${w}" height="${h}" rx="${rx}"/>
         <path class="bot-brow" d="M23 ${ey - 7} L57 ${ey - 7} L57 ${ey - 3} L40 ${ey + 2} L23 ${ey - 3} Z"/>`
      : `<rect class="bot-eye" x="${37 - w}" y="${ey}" width="${w}" height="${h}" rx="${rx}"/>
         <rect class="bot-eye" x="43" y="${ey}" width="${w}" height="${h}" rx="${rx}"/>
         <path class="bot-brow" d="M25 ${ey - 3} L39 ${ey + 3} L39 ${ey - 3} Z M55 ${ey - 3} L41 ${ey + 3} L41 ${ey - 3} Z"/>`;
    const happy = v.visor ? "M27 36 Q40 25 53 36" : "M27 36 L32 30 L37 36 M43 36 L48 30 L53 36";
    return `
      <svg class="peek-body" viewBox="0 0 80 80" width="80" height="80">
        <g class="peek-slide">
          <g class="peek-head">
            ${antennas}${nubs}${ears}
            <rect class="bot-shell" x="14" y="13" width="52" height="44" rx="${v.rx}"/>
            <rect class="bot-screen" x="19.5" y="18.5" width="41" height="32" rx="${Math.max(4, v.rx - 5)}"/>
            <ellipse class="bot-blush" cx="25" cy="44" rx="3.4" ry="1.8"/>
            <ellipse class="bot-blush" cx="55" cy="44" rx="3.4" ry="1.8"/>
            <g class="bot-eyes">
              <g class="bot-open">${eyesSvg}</g>
              <path class="bot-happy" d="${happy}"/>
            </g>
          </g>
        </g>
      </svg>
      <svg class="peek-hands" viewBox="0 0 80 80" width="80" height="80">
        <g class="peek-hand"><rect class="bot-shell" x="17" y="55" width="14" height="10" rx="5"/><path class="bot-finger" d="M22 55.5 v3 M26 55.5 v3"/></g>
        <g class="peek-hand"><rect class="bot-shell" x="49" y="55" width="14" height="10" rx="5"/><path class="bot-finger" d="M54 55.5 v3 M58 55.5 v3"/></g>
      </svg>`;
  }

  function makeBot(v) {
    const el = document.createElement("div");
    el.className = `peek peek-${v.name}`;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = svgFor(v);
    const q = (s) => el.querySelector(s);
    const slide = q(".peek-slide"), headG = q(".peek-head"), eyes = q(".bot-eyes"), handsSvg = q(".peek-hands");
    const hands = [...el.querySelectorAll(".peek-hand")];

    let spot = null, pending = undefined, pendingAt = 0; // pending: next spot, null = hide, undefined = nothing queued
    let p = 0, pv = 0; // peek amount: 0 hidden behind the edge, 1 peeking out (springy)
    let rogue = false, lean = 0;
    let look = { x: 0, y: 0 }, lookAt = { x: 0, y: 0 }, nextGlance = 0;
    let blinkUntil = 0, nextBlink = 1 + Math.random() * 2;
    let happyUntil = 0, duckUntil = 0, nextDuck = 0, waveUntil = 0, nextWave = 0;
    let glitchUntil = 0, nextGlitch = 0;

    const same = (a, b) => a && b && a.host === b.host && a.side === b.side && Math.abs(a.f - b.f) < 0.01;

    function attach(s) {
      spot = s;
      if (getComputedStyle(s.host).position === "static") s.host.style.position = "relative";
      s.host.appendChild(el);
      lean = ({ content: -1, reader: 1, restless: 0 }[v.gaze] * 6) + (Math.random() - 0.5) * 10; // tilt the head, like peeking around a corner
      lookAt = { x: (Math.random() - 0.5) * 4, y: -1 };
      if (!rogue) happyUntil = now() + 0.9;
      nextDuck = now() + (s.calm ? 14 : 6) + Math.random() * 6;
      nextWave = now() + (s.wave ? 0.8 : (s.calm ? 10 : 3) + Math.random() * 5);
      nextGlitch = now() + (s.calm ? 4 : 1);
      if (RM) p = 1;
    }

    // Turn a screen direction into this bot's own (rotated) eye coordinates.
    function lookToward(dx, dy) {
      const a = (ROTATE[spot.side] * Math.PI) / 180;
      const lx = dx * Math.cos(a) + dy * Math.sin(a), ly = -dx * Math.sin(a) + dy * Math.cos(a);
      const n = Math.hypot(lx, ly) || 1;
      return { x: (lx / n) * 4, y: (ly / n) * 3 };
    }
    function pickGlance(t) {
      const r = Math.random();
      const friend = bots.find((b) => b !== self && b.visibleBox());
      if (friend && r < 0.22) { // check on the other bot
        const a = spotBox(spot), b = friend.visibleBox();
        return lookToward((b[0] + b[2]) / 2 - (a[0] + a[2]) / 2, (b[1] + b[3]) / 2 - (a[1] + a[3]) / 2);
      }
      const random = { x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 4 };
      if (v.gaze === "content") return r < 0.65 ? { x: (Math.random() - 0.5) * 3, y: 3 } : random; // reads the card
      if (v.gaze === "reader") return r < 0.65 ? { x: (Math.random() - 0.5) * 1.5, y: -1.5 } : random; // looks out at you
      return random; // restless
    }

    const self = {
      near(s) { return spot && pending === undefined && s.host === spot.host && s.side === spot.side && Math.abs(s.f - spot.f) < 0.3; },
      visibleBox() { return spot && p > 0.08 ? spotBox(spot) : null; },
      current() { return spot; },
      go(s, delay) {
        if (s ? same(s, spot) && pending === undefined : !spot) return;
        pending = s;
        pendingAt = now() + (RM ? 0 : delay);
      },
      setRogue(on) {
        if (on && !rogue && !RM) glitchUntil = now() + 0.6;
        rogue = on;
        el.classList.toggle("rogue", on);
      },
      frame(t, dt) {
        // move on: duck behind the current spot, then pop out of the next one (or stay hidden)
        const leaving = pending !== undefined && t >= pendingAt;
        const blocked = leaving && pending && bots.some((b) => b !== self && b.visibleBox() && overlaps(b.visibleBox(), spotBox(pending)));
        if (leaving && !blocked && (p < 0.04 || !spot)) {
          const n = pending;
          pending = undefined;
          if (n) attach(n);
          else { spot = null; el.remove(); }
        }
        if (!spot) return;
        const hr = spot.host.getBoundingClientRect();
        if (hr.bottom < -150 || hr.top > window.innerHeight + 150) { if (leaving) { p = 0; pv = 0; } return; }

        // place the drawing so its edge line sits on the chosen side of the host
        const w = spot.host.offsetWidth, h = spot.host.offsetHeight;
        const ax = spot.side === "left" ? 0 : spot.side === "right" ? w : w * spot.f;
        const ay = spot.side === "top" ? 0 : spot.side === "bottom" ? h : h * spot.f;
        const sidePeek = spot.side === "left" || spot.side === "right";
        el.style.left = `${ax - 40}px`;
        el.style.top = `${ay - EDGE}px`;
        el.style.transform = `rotate(${ROTATE[spot.side]}deg) scale(${(phone() ? 0.8 : sidePeek ? 0.85 : 1) * v.scale})`;

        // idle behaviors while peeking
        if (!RM && !leaving && p > 0.9) {
          const calm = spot.calm ? 2 : 1; // outside the story: fidget about half as often
          if (t > nextDuck) { duckUntil = t + 0.7; nextDuck = t + (7 + Math.random() * 7) * calm; }
          if (!rogue && t > nextWave && t > duckUntil) { waveUntil = t + 1.1; nextWave = t + (7 + Math.random() * 7) * calm; }
          if (rogue && t > nextGlitch) { glitchUntil = t + 0.18; nextGlitch = t + (3 + Math.random() * 4) * calm; }
        }
        const ducking = t < duckUntil;
        if (ducking && duckUntil - t < 0.05 && !rogue) happyUntil = t + 0.8; // peekaboo!

        // spring toward the goal (a little overshoot makes the pop feel bouncy)
        const g = leaving ? 0 : ducking ? 0.35 : 1;
        if (RM) p = g;
        else { pv += ((g - p) * 140 - pv * 15) * dt; p += pv * dt; }

        // how far the head comes out: side peeks show just the eyes; rogue stares out further
        const outY = sidePeek ? (rogue ? 19 : 21) : rogue ? 9 : 16;
        const ty = 60 + (outY - 60) * p;
        const glitching = rogue && t < glitchUntil;
        const sway = RM ? 0 : Math.sin(t * 1.3 + v.scale * 7) * 3;
        slide.setAttribute("transform", `translate(${glitching ? ((Math.random() - 0.5) * 6).toFixed(1) : 0} ${ty.toFixed(2)})`);
        headG.setAttribute("transform", `rotate(${(lean + sway).toFixed(2)} 40 ${(EDGE - ty).toFixed(2)})`);

        // eyes: glance around, blink
        if (!RM && t > nextGlance) {
          lookAt = pickGlance(t);
          nextGlance = t + (v.gaze === "restless" ? 0.8 + Math.random() * 1.2 : 1.6 + Math.random() * 2.4);
        }
        look.x += (lookAt.x - look.x) * Math.min(1, dt * 9);
        look.y += (lookAt.y - look.y) * Math.min(1, dt * 9);
        if (!RM && t > nextBlink) { blinkUntil = t + 0.13; nextBlink = t + 2 + Math.random() * 4; }
        const blink = t < blinkUntil ? 0.12 : 1;
        eyes.setAttribute("transform", `translate(${(look.x + (glitching ? (Math.random() - 0.5) * 5 : 0)).toFixed(2)} ${look.y.toFixed(2)}) translate(40 32.5) scale(1 ${blink}) translate(-40 -32.5)`);
        el.classList.toggle("happy", !rogue && t < happyUntil);

        // hands grab the edge once the head is out; one waves now and then
        const hp = clamp((p - 0.45) * 2.2, 0, 1);
        handsSvg.style.opacity = hp.toFixed(2);
        hands.forEach((hand, i) => {
          const waving = i === 1 && t < waveUntil;
          const wy = waving ? -9 - Math.abs(Math.sin(t * 14)) * 3 : 0;
          const wr = waving ? Math.sin(t * 14) * 18 : 0;
          hand.setAttribute("transform", `translate(0 ${((1 - hp) * 6 + wy).toFixed(2)}) rotate(${wr.toFixed(1)} ${i ? 56 : 24} 60)`);
        });
      },
    };
    return self;
  }

  const bots = VARIANTS.map(makeBot);

  /* ---------- director ---------- */
  let region = null, lastStep = null;

  // Hand out spots: a bot already at (about) a wanted spot keeps it, so bots never swap places
  // through each other; the rest go to the other bots in a rotating order so different bots show up.
  function assign(spots, rot, gap) {
    const wanted = spots.filter(Boolean);
    const plan = new Array(bots.length).fill(null);
    const free = bots.map((_, k) => k);
    wanted.slice().forEach((s) => {
      const k = free.find((k) => bots[k].near(s));
      if (k === undefined) return;
      plan[k] = bots[k].current(); // stay exactly where it is
      free.splice(free.indexOf(k), 1);
      wanted.splice(wanted.indexOf(s), 1);
    });
    const order = free.map((_, i) => free[(i + rot) % free.length]);
    wanted.forEach((s, i) => (plan[order[i]] = s));
    let n = 0;
    bots.forEach((bot, k) => bot.go(plan[k], plan[k] ? gap * n++ + Math.random() * 0.1 : 0));
  }

  function story(detail) {
    const spots = spotsFor(detail.element);
    if (!spots) return;
    bots.forEach((bot, k) => bot.setRogue(ROGUE_AT[k] >= 0 && detail.index >= ROGUE_AT[k]));
    assign(spots, detail.index, 0.22); // staggered, one after another
  }

  function apply(r) {
    if (r.story) { if (lastStep) story(lastStep); return; }
    bots.forEach((bot) => bot.setRogue(r.rogue));
    assign(siteSpots(r), REGIONS.indexOf(r), 0.3);
  }

  document.addEventListener("story:step", (e) => {
    lastStep = e.detail;
    if (region && region.story) story(lastStep);
  });

  // which section is the reader on? (the one crossing 45% down the screen; the footer at the very bottom)
  function current() {
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (atBottom) return REGIONS[REGIONS.length - 1];
    const y = window.innerHeight * 0.45;
    return REGIONS.find((r) => { const b = r.el.getBoundingClientRect(); return b.top <= y && b.bottom > y; }) || region;
  }
  let candidate = null, since = 0;
  function check(t) {
    const r = current();
    if (r !== candidate) { candidate = r; since = t; }
    const settle = r && r.story ? 0 : 0.5; // outside the story, wait until the reader settles
    if (r && t - since >= settle) {
      if (r !== region) { region = r; apply(r); }
      else if (!r.story && t - lastRefresh > 1) { lastRefresh = t; apply(r); } // e.g. the trust panel just opened
    }
  }
  let lastRefresh = 0;

  let last = 0;
  function frame(ms) {
    const t = ms / 1000;
    const dt = Math.min(0.05, t - (last || t));
    last = t;
    if (!document.hidden) {
      check(t);
      bots.forEach((b) => b.frame(t, dt));
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
