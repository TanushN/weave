/**
 * Pre-computes impact scores from the fetched GitHub data and writes
 * a slim results JSON that the dashboard imports directly.
 *
 * Usage:
 *   npx tsx scripts/precompute-scores.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Re-use the same analysis logic via a local import isn't possible here
// (tsconfig includes only src/), so we inline a minimal version.

const BOT_LOGINS = new Set([
  'github-actions', 'posthog-bot', 'dependabot', 'dependabot[bot]',
  'github-actions[bot]', 'renovate', 'renovate[bot]', 'posthog-contributions-bot',
  'semantic-release-bot', 'netlify', 'vercel', 'snyk-bot', 'codecov', 'stale',
])
const MIN_MERGED_PRS = 3

function isBot(login: string) {
  return BOT_LOGINS.has(login) || login.includes('[bot]') || login.includes('-bot')
}
function fileArea(path: string) { return path.split('/')[0] ?? 'root' }
function prWeight(pr: { changedFiles: number; files: { nodes: { path: string }[] } }) {
  const areas = new Set(pr.files.nodes.map((f: { path: string }) => fileArea(f.path)))
  return Math.log2(pr.changedFiles + 2) * areas.size
}
function reviewWeight(body: string) {
  return 1 + Math.log2(body.trim().length + 2) * 0.5
}
function weekIndex(dateStr: string, sinceMs: number) {
  return Math.floor((new Date(dateStr).getTime() - sinceMs) / (7 * 24 * 60 * 60 * 1000))
}
function toPercentile(values: number[], idx: number) {
  const val = values[idx]
  const below = values.filter(v => v < val).length
  const equal = values.filter(v => v === val).length
  return Math.round(((below + 0.5 * equal) / values.length) * 100)
}

const dataPath = join(__dirname, '..', 'src', 'data', 'github-data.json')
const raw = JSON.parse(readFileSync(dataPath, 'utf-8'))
const { pullRequests, since, fetchedAt } = raw

const sinceMs = new Date(since).getTime()
const totalWeeks = Math.ceil((new Date(fetchedAt).getTime() - sinceMs) / (7 * 24 * 60 * 60 * 1000))

interface AuthorData {
  login: string; avatarUrl: string
  prsAuthored: number; prsMerged: number; weightedShipping: number
  reviewsGiven: number; weightedReview: number; uniqueAuthorsReviewed: Set<string>
  totalReviewedPRs: number; firstPassApprovals: number
  collaborators: Set<string>; activeWeeks: Set<number>
}

const authorMap = new Map<string, AuthorData>()
function getOrCreate(login: string, avatarUrl: string): AuthorData {
  if (!authorMap.has(login)) {
    authorMap.set(login, {
      login, avatarUrl,
      prsAuthored: 0, prsMerged: 0, weightedShipping: 0,
      reviewsGiven: 0, weightedReview: 0, uniqueAuthorsReviewed: new Set(),
      totalReviewedPRs: 0, firstPassApprovals: 0,
      collaborators: new Set(), activeWeeks: new Set(),
    })
  }
  return authorMap.get(login)!
}

for (const pr of pullRequests) {
  const authorLogin = pr.author?.login
  if (!authorLogin || isBot(authorLogin)) continue
  const author = getOrCreate(authorLogin, pr.author?.avatarUrl ?? '')
  author.prsAuthored++
  if (pr.state === 'MERGED' && pr.mergedAt) {
    author.prsMerged++
    author.weightedShipping += prWeight(pr)
    author.activeWeeks.add(weekIndex(pr.mergedAt, sinceMs))
  }
  if (pr.reviews.nodes.length > 0) {
    author.totalReviewedPRs++
    let hadCR = false, gotFP = false
    for (const r of pr.reviews.nodes) {
      if (r.state === 'CHANGES_REQUESTED') { hadCR = true; break }
      if (r.state === 'APPROVED') { gotFP = true; break }
    }
    if (gotFP && !hadCR) author.firstPassApprovals++
  }
  for (const review of pr.reviews.nodes) {
    const rl = review.author?.login
    if (!rl || isBot(rl) || rl === authorLogin) continue
    const reviewer = getOrCreate(rl, review.author?.avatarUrl ?? '')
    reviewer.reviewsGiven++
    reviewer.weightedReview += reviewWeight(review.body)
    reviewer.uniqueAuthorsReviewed.add(authorLogin)
    reviewer.collaborators.add(authorLogin)
    author.collaborators.add(rl)
    if (review.submittedAt) reviewer.activeWeeks.add(weekIndex(review.submittedAt, sinceMs))
  }
  for (const comment of pr.comments.nodes) {
    const cl = comment.author?.login
    if (!cl || isBot(cl) || cl === authorLogin) continue
    const commenter = getOrCreate(cl, '')
    commenter.collaborators.add(authorLogin)
    author.collaborators.add(cl)
  }
}

const cohort = Array.from(authorMap.values()).filter(a => !isBot(a.login) && a.prsMerged >= MIN_MERGED_PRS)

const shippingRaws = cohort.map(a => a.weightedShipping)
const reviewRaws = cohort.map(a => a.weightedReview + a.uniqueAuthorsReviewed.size * 2)
const mergeEffRaws = cohort.map(a => {
  if (a.totalReviewedPRs === 0) return 0.5
  return (a.firstPassApprovals / a.totalReviewedPRs) * 0.6 + (a.prsMerged / Math.max(a.prsAuthored, 1)) * 0.4
})
const collabRaws = cohort.map(a => a.collaborators.size)
const consistencyRaws = cohort.map(a => a.activeWeeks.size / Math.max(totalWeeks, 1))

const WEIGHTS = { shippingScope: 0.30, reviewInfluence: 0.25, mergeEfficiency: 0.15, collaborationReach: 0.15, consistency: 0.15 }

const results = cohort.map((a, i) => {
  const sp = toPercentile(shippingRaws, i)
  const rp = toPercentile(reviewRaws, i)
  const mp = toPercentile(mergeEffRaws, i)
  const cp = toPercentile(collabRaws, i)
  const conp = toPercentile(consistencyRaws, i)
  const impact = Math.round(sp * WEIGHTS.shippingScope + rp * WEIGHTS.reviewInfluence + mp * WEIGHTS.mergeEfficiency + cp * WEIGHTS.collaborationReach + conp * WEIGHTS.consistency)
  const fpPct = a.totalReviewedPRs > 0 ? Math.round(a.firstPassApprovals / a.totalReviewedPRs * 100) : 0
  const mrPct = Math.round(a.prsMerged / Math.max(a.prsAuthored, 1) * 100)
  return {
    login: a.login, avatarUrl: a.avatarUrl,
    impactScore: impact,
    shippingScope: { raw: shippingRaws[i], percentile: sp, label: `${a.prsMerged} merged PRs, weighted score ${shippingRaws[i].toFixed(1)}` },
    reviewInfluence: { raw: reviewRaws[i], percentile: rp, label: `${a.reviewsGiven} reviews given to ${a.uniqueAuthorsReviewed.size} engineers` },
    mergeEfficiency: { raw: mergeEffRaws[i], percentile: mp, label: `${fpPct}% first-pass approvals, ${mrPct}% merge rate` },
    collaborationReach: { raw: a.collaborators.size, percentile: cp, label: `${a.collaborators.size} unique collaborators` },
    consistency: { raw: a.activeWeeks.size / Math.max(totalWeeks, 1), percentile: conp, label: `Active ${a.activeWeeks.size} of ${totalWeeks} weeks` },
    highlights: [
      `Shipped ${a.prsMerged} merged PRs (complexity-weighted score: ${shippingRaws[i].toFixed(1)})`,
      `Reviewed ${a.uniqueAuthorsReviewed.size} unique engineers' work (${a.reviewsGiven} reviews total)`,
      `${fpPct}% first-pass approval rate · ${mrPct}% merge rate`,
      `Collaborated with ${a.collaborators.size} teammates`,
      `Active ${a.activeWeeks.size}/${totalWeeks} weeks`,
    ],
    stats: {
      prsAuthored: a.prsAuthored, prsMerged: a.prsMerged,
      reviewsGiven: a.reviewsGiven, uniqueAuthorsReviewed: a.uniqueAuthorsReviewed.size,
      firstPassApprovals: a.firstPassApprovals, totalReviewedPRs: a.totalReviewedPRs,
      uniqueCollaborators: a.collaborators.size, activeWeeks: a.activeWeeks.size,
      totalWeeks, weightedShippingScore: shippingRaws[i], weightedReviewScore: reviewRaws[i],
    },
  }
}).sort((a, b) => b.impactScore - a.impactScore)

const mergedCount = pullRequests.filter((p: { state: string }) => p.state === 'MERGED').length

const output = {
  computedAt: new Date().toISOString(),
  since,
  fetchedAt,
  totalContributors: cohort.length,
  totalPRs: pullRequests.length,
  mergedPRs: mergedCount,
  scores: results,
}

const outPath = join(__dirname, '..', 'src', 'data', 'impact-scores.json')
writeFileSync(outPath, JSON.stringify(output))
console.log(`Wrote ${results.length} engineer scores to ${outPath}`)
console.log(`Top 5:`)
results.slice(0, 5).forEach((e, i) => console.log(`  #${i+1} ${e.login} — ${e.impactScore}`))
