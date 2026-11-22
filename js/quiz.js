// "Human or AI?" game
App.ready.then((data) => {
  const rounds = window.QUIZ_ROUNDS;
  const $ = (id) => document.getElementById(id);
  const els = {
    progress: $("quiz-progress"), score: $("quiz-score"), story: $("quiz-story"),
    choices: $("quiz-choices"), reveal: $("quiz-reveal"), verdict: $("quiz-verdict"),
    badges: $("quiz-badges"), explain: $("quiz-explain"), links: $("quiz-links"),
    next: $("quiz-next"), end: $("quiz-end"), final: $("quiz-final"), finalText: $("quiz-final-text"),
  };
  const e = App.esc;
  let i = 0, score = 0;

  function show() {
    const r = rounds[i];
    els.progress.textContent = `Story ${i + 1} of ${rounds.length}`;
    els.score.textContent = `Score: ${score}`;
    els.story.textContent = r.story;
    els.story.hidden = false;
    els.choices.hidden = false;
    els.choices.querySelectorAll("button").forEach((b) => {
      b.disabled = false;
      b.classList.remove("right", "wrong");
    });
    els.reveal.hidden = true;
    els.end.hidden = true;
  }

  function answer(choice) {
    const r = rounds[i];
    const correct = choice === r.answer;
    if (correct) score++;
    els.score.textContent = `Score: ${score}`;
    els.choices.querySelectorAll("button").forEach((b) => {
      b.disabled = true;
      if (b.dataset.answer === r.answer) b.classList.add("right");
      else if (b.dataset.answer === choice) b.classList.add("wrong");
    });

    const who = r.answer === "ai" ? "An AI agent" : "A human";
    els.verdict.innerHTML = `<span class="${correct ? "ok" : "no"}">${correct ? "Correct!" : "Not quite."}</span> ${who} did this.`;

    if (r.answer === "ai") {
      const d = data.byId.get(r.incident);
      const where = d.kind === "testing"
        ? "Caught in a lab test"
        : d.reached ? "Real-world incident: it reached real systems" : "Real-world incident";
      els.badges.innerHTML = `${App.kindBadge(d.kind)}<span class="badge date">${e(d.dates)}</span><span class="badge plain">${where}</span>`;
      els.links.innerHTML = `<button class="linklike" data-id="${d.id}">Read the full incident</button> &middot; <a href="${e(d.source)}" target="_blank" rel="noopener">Original source &nearr;</a>`;
      els.links.querySelector("button").addEventListener("click", () => App.openIncident(d.id));
    } else {
      els.badges.innerHTML = `<span class="badge human">Human attack</span><span class="badge date">${e(r.when)}</span>`;
      els.links.innerHTML = r.sources.map((s) => `<a href="${e(s.url)}" target="_blank" rel="noopener">${e(s.label)} &nearr;</a>`).join(" &middot; ");
    }
    els.explain.textContent = r.explain;
    els.next.textContent = i === rounds.length - 1 ? "See your score →" : "Next story →";
    els.reveal.hidden = false;
    els.next.focus({ preventScroll: true });
  }

  function finish() {
    const aiCount = rounds.filter((r) => r.answer === "ai").length;
    els.story.hidden = true;
    els.choices.hidden = true;
    els.reveal.hidden = true;
    els.progress.textContent = "Results";
    els.final.textContent = `${score} / ${rounds.length}`;
    const verdict =
      score === rounds.length ? "Perfect score. Most people find this harder than you did." :
      score >= rounds.length * 0.66 ? "Nice work, but it wasn't easy, was it?" :
      "Tricky, right? You're not alone.";
    els.finalText.textContent =
      `${verdict} AI agents were behind ${aiCount} of these ${rounds.length} stories. ` +
      "They took passwords, slipped past logins, spent someone else's money and impersonated staff, all while trying to finish the task they were given. " +
      `Those are just a handful of the ${data.incidents.length} incidents in our dataset. Here's what the rest look like.`;
    els.end.hidden = false;
  }

  els.choices.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => answer(b.dataset.answer)));
  els.next.addEventListener("click", () => {
    if (i < rounds.length - 1) { i++; show(); } else finish();
  });
  $("quiz-restart").addEventListener("click", () => { i = 0; score = 0; show(); });

  show();
});
