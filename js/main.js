// Mobile nav toggle
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

// Typing effect in the hero
const lines = [
  "> agent.run(goal=\"make all tests pass\")",
  "> deleting tests/... done",
  "> all tests pass ✓",
];
const typed = document.getElementById("typed");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (reduceMotion) {
  typed.textContent = lines[lines.length - 1];
} else {
  let line = 0, char = 0;
  (function type() {
    const current = lines[line];
    typed.textContent = current.slice(0, ++char);
    if (char < current.length) return setTimeout(type, 45);
    setTimeout(() => {
      line = (line + 1) % lines.length;
      char = 0;
      type();
    }, 1600);
  })();
}

// Reveal sections on scroll
const revealables = document.querySelectorAll(".card, .case, .checklist li");
revealables.forEach((el) => el.classList.add("reveal"));
const observer = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        observer.unobserve(e.target);
      }
    }),
  { threshold: 0.15 }
);
revealables.forEach((el) => observer.observe(el));
