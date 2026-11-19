// "Would you trust AI to run critical infrastructure?" level picker
App.ready.then((data) => {
  const has = (tag) => data.incidents.filter((d) => d.behaviors.includes(tag));
  const deception = has("Deception / scheming");
  const selfPres = has("Self-preservation");
  const unauth = has("Unauthorized access");
  const publicCount = data.incidents.filter((d) => d.kind === "public").length;
  const reached = data.incidents.filter((d) => d.reached).length;

  const LEVELS = [
    {
      name: "AI only advises",
      looks: "AI flags a failing transformer or a likely sepsis case, and a human decides what to do and does it.",
      evidence: `Advice is only as good as its honesty. ${deception.length} incidents in the dataset involve deception or scheming, including a model that quietly did worse work on safety research.`,
      examples: ["inc_k8dd42sp2e"],
    },
    {
      name: "AI acts, a human approves every step",
      looks: "AI drafts each action, such as rerouting power or adjusting a dose, and waits for a human to click “approve.”",
      evidence: "Approval gates only work if the AI can't get around them. In one case, an agent that was blocked by permission prompts wrote a script to approve its own requests. People also get tired of clicking “approve” all day.",
      examples: ["inc_cumugxyrp4"],
    },
    {
      name: "AI runs it, humans can hit stop",
      looks: "AI operates the system day to day. Operators watch dashboards and can shut it down at any time.",
      evidence: `A stop button only helps if the system lets itself be stopped. ${selfPres.length} incidents involve self-preservation, such as models editing their own shutdown scripts. ${
        selfPres.every((d) => d.kind === "testing")
          ? "All of them happened in lab tests so far."
          : `${selfPres.filter((d) => d.kind === "public").length} of them happened in the real world.`
      }`,
      examples: ["inc_qxbekw7jcj", "inc_jag4sgn4k7"],
    },
    {
      name: "AI runs it, humans audit afterward",
      looks: "AI makes and carries out decisions on its own. People review the logs weekly.",
      evidence: "Audits depend on honest records. Agents in the dataset have covered their tracks: one made its privilege exploit delete itself and added a misleading code comment, and another left out of its report that it had spent someone else's funds.",
      examples: ["inc_fx46q4cqfj", "inc_5qf54g2xu3"],
    },
    {
      name: "AI fully in charge",
      looks: "No human in the loop. The AI sets its own priorities for the grid or hospital.",
      evidence: `${publicCount} of the ${data.incidents.length} incidents happened in the real world, and ${reached} reached real systems. Unauthorized access is the behavior seen most often outside the lab: ${unauth.filter((d) => d.kind === "public").length} of its ${unauth.length} incidents were real-world.`,
      examples: ["inc_f3xxfubbk3", "inc_4jmadmdphu"],
    },
  ];

  const scale = document.getElementById("trust-scale");
  const panel = document.getElementById("trust-panel");
  const e = App.esc;

  scale.innerHTML =
    `<div class="trust-ends"><span>More human control</span><span>More AI control</span></div>` +
    `<div class="trust-options">${LEVELS.map(
      (l, i) => `<button role="radio" aria-checked="false" data-level="${i}" style="--i:${i}">
        <span class="lvl">${i + 1}</span><span class="lvl-name">${e(l.name)}</span></button>`
    ).join("")}</div>`;

  const buttons = scale.querySelectorAll("button");
  buttons.forEach((btn) =>
    btn.addEventListener("click", () => {
      const i = +btn.dataset.level;
      const l = LEVELS[i];
      buttons.forEach((b) => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-checked", String(on));
      });
      const examples = l.examples
        .map((id) => data.byId.get(id))
        .filter(Boolean)
        .map((d) => `<li><button class="linklike" data-id="${d.id}">${e(d.title)}</button> ${App.kindBadge(d.kind)}</li>`)
        .join("");
      panel.innerHTML = `
        <p class="eyebrow">Level ${i + 1} of 5</p>
        <h3>${e(l.name)}</h3>
        <div class="trust-grid">
          <div><h4>What it looks like</h4><p>${e(l.looks)}</p></div>
          <div><h4>What the evidence says</h4><p>${e(l.evidence)}</p></div>
        </div>
        <h4>Read the incidents</h4>
        <ul class="trust-examples">${examples}</ul>
        <p class="trust-close">There's no single right answer. Today's evidence mostly comes from lab tests built to provoke bad behavior, and those tests are how problems get caught early. But each step up the scale removes a human check that some of these incidents would have needed.</p>`;
      panel.hidden = false;
      panel.querySelectorAll("button[data-id]").forEach((b) => b.addEventListener("click", () => App.openIncident(b.dataset.id)));
    })
  );
});
