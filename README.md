# Engineering Impact Dashboard

Identifies the most impactful engineers on the [PostHog/posthog](https://github.com/PostHog/posthog) repository using 90 days of GitHub activity. Built with React, TypeScript, Vite, and Tailwind.

---

## Running the project

**Prerequisites:** Node.js 18+ and a GitHub personal access token (no scopes needed — public repo access only).

### 1. Install dependencies

```bash
npm install
```

### 2. Fetch GitHub data

```bash
GITHUB_TOKEN=<your_token> npm run fetch-data
```

This calls the GitHub GraphQL API and writes raw PR, review, and comment data to `src/data/github-data.json`.

### 3. Pre-compute impact scores

```bash
npm run precompute
```

Runs the scoring engine over the raw data and writes the results to `src/data/impact-scores.json`. This is what the dashboard actually reads.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Refresh data (steps 2 + 3 combined)

```bash
GITHUB_TOKEN=<your_token> npm run refresh
```


## How impact is measured

Each engineer is ranked on five dimensions. Every dimension is converted to a **percentile score (0–100)** within the active contributor cohort (engineers with at least 3 merged PRs in the window), so different types of contributors are compared fairly. The final **Impact Score** is a weighted average of those five percentiles.

| Dimension | Weight | What it measures |
|---|---|---|
| **Shipping Scope** | 30% | How much meaningful work someone ships. Each merged PR is weighted by how many files it touches and how many areas of the codebase it spans, so a complex cross-cutting change counts more than many small tweaks. |
| **Review Influence** | 25% | How much someone invests in their teammates' work. Substantive review comments score higher than rubber-stamp approvals, and reviewing a wide range of authors matters too. |
| **Merge Efficiency** | 15% | How well-prepared someone's contributions are. Measured by the share of PRs approved on the first review cycle without needing changes, and the share that actually make it to merge. |
| **Collaboration Reach** | 15% | How many unique teammates someone works closely with, either by reviewing their code or having their own code reviewed. Wide reach spreads context and reduces knowledge silos. |
| **Consistency** | 15% | How reliably someone shows up over time. The share of weeks in the 90-day window where they were actively contributing, whether shipping or reviewing. |

Bots and automation accounts are excluded from the cohort.
