# When AI Agents Go Rogue

**DSC 106 Final Project** by Matthew Ramos, Mayur Nookala and Ethan Cai

An interactive D3 site about real, documented cases of AI systems acting in ways their developers didn't intend.

**Live site:** https://matthewnramos.github.io/when-ai-agents-go-rogue/

## What's on the page

1. **Chapter 1, Human or AI?**: a quiz game with five real, sourced stories. Readers guess whether a human hacker or an AI agent did it.
2. **Chapters 2–4, scrollytelling** (Scrollama): the chart stays pinned while text steps scroll past. The 183 incident dots move from a grid to a lab vs. real-world split, then a monthly timeline, the 2026 surge, real-world only, and hacking highlighted. The story then crossfades to the AI-hacking running total, the behavior bars (lab vs. real world) and the co-occurrence heatmap.
3. **Explore**: free-form versions of the charts. Scrub the timeline, filter lab tests vs. the real world, sort, and click any dot, bar or cell to read the incidents.
4. **Who told us?**: the same dots sorted by who reported each incident first. Readers guess how many real-world incidents were disclosed by the model's own developer, then switch between "when it happened" and "who reported it first". Dots that were published together in one report sit on a shaded backdrop.
5. **Chapter 5, Would you trust it?**: readers pick how much control AI should have over critical infrastructure and see the evidence for each level.

## Data

[AI Misalignment Watch](https://misalignmentwatch.com/data): `data/reports.csv` and `data/incidents.csv`.
`scripts/prepare_data.py` groups the reports into unique incidents and writes `data/site-data.json`, which the page loads.

To refresh the data:

```
curl -L -o data/reports.csv https://misalignmentwatch.com/data/reports.csv
curl -L -o data/incidents.csv https://misalignmentwatch.com/data/incidents.csv
python scripts/prepare_data.py
```

All counts on the page are computed from the JSON at load time, so they update with the data.
Quiz stories are in `js/quiz-data.js`. AI rounds reference incident ids from the dataset, and human rounds cite Wikipedia.

## Running locally

The page loads JSON, so serve the folder instead of opening the file directly:

```
python -m http.server 8000
```

Then visit http://localhost:8000.

## Structure

```
index.html              page markup
css/style.css           styles
js/main.js              data loading, nav, progress rail, tooltip, incident drawer
js/quiz.js, quiz-data.js  Human or AI? game
js/charts.js            reusable D3 charts + Explore section
js/story.js             scrollytelling scenes (Scrollama)
js/trust.js             trust-level picker
scripts/prepare_data.py CSV -> site-data.json
```
