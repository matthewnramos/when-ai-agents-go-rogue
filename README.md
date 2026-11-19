# When AI Agents Go Rogue

**DSC 106 Final Project** by Matthew Ramos, Mayur Nookala and Ethan Cai

An interactive D3 site about real, documented cases of AI systems acting in ways their developers didn't intend.

**Live site:** https://matthewnramos.github.io/when-ai-agents-go-rogue/

## What's on the page

1. **Human or AI?**: a quiz game with nine real, sourced stories. Readers guess whether a human hacker or an AI agent did it.
2. **Timeline**: one dot per unique incident by month. Readers can scrub through time, filter lab tests vs. the real world, and click a dot to read the story.
3. **The rise of AI hacking**: running total of incidents tagged unauthorized access or cybersecurity.
4. **Behaviors**: stacked bars comparing lab tests and the real world (filter, sort, click to list incidents), plus a co-occurrence heatmap.
5. **Would you trust it?**: readers pick how much control AI should have over critical infrastructure and see the evidence for each level.

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
js/main.js              data loading, nav, tooltip, incident drawer
js/quiz.js, quiz-data.js  Human or AI? game
js/charts.js            D3 charts (timeline, hacking, behaviors, heatmap)
js/trust.js             trust-level picker
scripts/prepare_data.py CSV -> site-data.json
```
