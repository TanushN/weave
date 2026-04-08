/**
 * Impact scoring engine.
 *
 * Five dimensions, each scored as a 0-100 percentile within the active engineer cohort:
 *
 * 1. Shipping Scope (30%)  — complexity-weighted PR output
 * 2. Review Influence (25%) — quality + breadth of code reviews given
 * 3. Merge Efficiency (15%) — first-pass approval rate + merge rate
 * 4. Collaboration Reach (15%) — unique engineers collaborated with
 * 5. Consistency (15%)     — steady contribution across the 90-day window
 *
 * Final Impact Score = weighted average of the five percentiles.
 */

import type { GHData, GHPullRequest, EngineerScores, DimensionScore } from '../types'

// Bot logins to exclude from analysis
const BOT_LOGINS = new Set([
  'github-actions',
  'posthog-bot',
  'dependabot',
  'dependabot[bot]',
  'github-actions[bot]',
  'renovate',
  'renovate[bot]',
  'posthog-contributions-bot',
  'semantic-release-bot',
  'netlify',
  'vercel',
  'snyk-bot',
  'codecov',
  'stale',
])

const WEIGHTS = {
  shippingScope: 0.30,
  reviewInfluence: 0.25,
  mergeEfficiency: 0.15,
  collaborationReach: 0.15,
  consistency: 0.15,
}

// Minimum merged PRs authored to be included in the ranked cohort
const MIN_MERGED_PRS = 3

function isBot(login: string): boolean {
  return BOT_LOGINS.has(login) || login.includes('[bot]') || login.includes('-bot')
}

/**
 * Returns the top-level "area" of the codebase from a file path.
 * e.g. "frontend/src/queries/..." -> "frontend"
 */
function fileArea(path: string): string {
  return path.split('/')[0] ?? 'root'
}

/**
 * Shipping Scope raw score for a single PR.
 * = log2(changedFiles + 2) * areaCount
 * Rewards PRs that touch many files AND span multiple codebase areas.
 * Using log so massive PRs don't dominate; areaCount captures breadth of change.
 */
function prShippingWeight(pr: GHPullRequest): number {
  const areas = new Set(pr.files.nodes.map(f => fileArea(f.path)))
  return Math.log2(pr.changedFiles + 2) * areas.size
}

/**
 * Review Influence raw score for a single review.
 * Weighted by comment length (proxy for substantive feedback) + baseline for any review.
 */
function reviewWeight(body: string): number {
  const baseline = 1
  const commentBonus = Math.log2(body.trim().length + 2) * 0.5
  return baseline + commentBonus
}

interface PerAuthorRaw {
  login: string
  avatarUrl: string
  // Shipping
  prsAuthored: number
  prsMerged: number
  weightedShipping: number
  // Review
  reviewsGiven: number
  weightedReview: number
  uniqueAuthorsReviewed: Set<string>
  // Merge efficiency
  totalReviewedPRs: number   // PRs with at least one review
  firstPassApprovals: number // approved without prior CHANGES_REQUESTED
  // Collaboration
  collaborators: Set<string>
  // Consistency
  activeWeeks: Set<number>   // week index within the 90-day window
}

function weekIndex(dateStr: string, sinceMs: number): number {
  const ms = new Date(dateStr).getTime() - sinceMs
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000))
}

export function computeImpactScores(data: GHData): EngineerScores[] {
  const sinceMs = new Date(data.since).getTime()
  const totalWeeks = Math.ceil(
    (new Date(data.fetchedAt).getTime() - sinceMs) / (7 * 24 * 60 * 60 * 1000)
  )

  const authorMap = new Map<string, PerAuthorRaw>()

  function getOrCreate(login: string, avatarUrl: string): PerAuthorRaw {
    if (!authorMap.has(login)) {
      authorMap.set(login, {
        login,
        avatarUrl,
        prsAuthored: 0,
        prsMerged: 0,
        weightedShipping: 0,
        reviewsGiven: 0,
        weightedReview: 0,
        uniqueAuthorsReviewed: new Set(),
        totalReviewedPRs: 0,
        firstPassApprovals: 0,
        collaborators: new Set(),
        activeWeeks: new Set(),
      })
    }
    return authorMap.get(login)!
  }

  for (const pr of data.pullRequests) {
    const authorLogin = pr.author?.login
    if (!authorLogin || isBot(authorLogin)) continue

    const author = getOrCreate(authorLogin, pr.author?.avatarUrl ?? '')
    author.prsAuthored++

    if (pr.state === 'MERGED' && pr.mergedAt) {
      author.prsMerged++
      author.weightedShipping += prShippingWeight(pr)
      author.activeWeeks.add(weekIndex(pr.mergedAt, sinceMs))
    }

    // Merge efficiency: was this PR approved without a prior CHANGES_REQUESTED?
    if (pr.reviews.nodes.length > 0) {
      author.totalReviewedPRs++
      let hadChangesRequested = false
      let gotFirstPassApproval = false
      for (const review of pr.reviews.nodes) {
        if (review.state === 'CHANGES_REQUESTED') {
          hadChangesRequested = true
          break
        }
        if (review.state === 'APPROVED') {
          gotFirstPassApproval = true
          break
        }
      }
      if (gotFirstPassApproval && !hadChangesRequested) {
        author.firstPassApprovals++
      }
    }

    // Process reviews given by others
    for (const review of pr.reviews.nodes) {
      const reviewerLogin = review.author?.login
      if (!reviewerLogin || isBot(reviewerLogin) || reviewerLogin === authorLogin) continue

      const reviewer = getOrCreate(reviewerLogin, review.author?.avatarUrl ?? '')
      reviewer.reviewsGiven++
      reviewer.weightedReview += reviewWeight(review.body)
      reviewer.uniqueAuthorsReviewed.add(authorLogin)

      // Collaboration: both parties are collaborators of each other
      reviewer.collaborators.add(authorLogin)
      author.collaborators.add(reviewerLogin)

      // Reviewer activity weeks (based on review submission)
      if (review.submittedAt) {
        reviewer.activeWeeks.add(weekIndex(review.submittedAt, sinceMs))
      }
    }

    // PR comments also count as collaboration
    for (const comment of pr.comments.nodes) {
      const commenterLogin = comment.author?.login
      if (!commenterLogin || isBot(commenterLogin) || commenterLogin === authorLogin) continue
      const commenter = getOrCreate(commenterLogin, '' )
      commenter.collaborators.add(authorLogin)
      author.collaborators.add(commenterLogin)
    }
  }

  // Filter to meaningful contributors (min merged PRs)
  const cohort = Array.from(authorMap.values()).filter(
    a => !isBot(a.login) && a.prsMerged >= MIN_MERGED_PRS
  )

  // --- Compute raw dimension values for the cohort ---

  const shippingRaws = cohort.map(a => a.weightedShipping)
  const reviewRaws = cohort.map(a => a.weightedReview + a.uniqueAuthorsReviewed.size * 2)
  const mergeEffRaws = cohort.map(a => {
    if (a.totalReviewedPRs === 0) return 0.5 // neutral if never reviewed
    const firstPass = a.firstPassApprovals / a.totalReviewedPRs
    const mergeRate = a.prsMerged / Math.max(a.prsAuthored, 1)
    return (firstPass * 0.6) + (mergeRate * 0.4)
  })
  const collabRaws = cohort.map(a => a.collaborators.size)
  const consistencyRaws = cohort.map(a => a.activeWeeks.size / Math.max(totalWeeks, 1))

  function toPercentile(values: number[], idx: number): number {
    const val = values[idx]
    const below = values.filter(v => v < val).length
    const equal = values.filter(v => v === val).length
    // Percentile rank: (below + 0.5 * equal) / n * 100
    return Math.round(((below + 0.5 * equal) / values.length) * 100)
  }

  function makeDimension(raw: number, percentile: number, label: string): DimensionScore {
    return { raw, percentile, label }
  }

  const results: EngineerScores[] = cohort.map((a, i) => {
    const shippingPct = toPercentile(shippingRaws, i)
    const reviewPct = toPercentile(reviewRaws, i)
    const mergePct = toPercentile(mergeEffRaws, i)
    const collabPct = toPercentile(collabRaws, i)
    const consistencyPct = toPercentile(consistencyRaws, i)

    const impactScore = Math.round(
      shippingPct * WEIGHTS.shippingScope +
      reviewPct * WEIGHTS.reviewInfluence +
      mergePct * WEIGHTS.mergeEfficiency +
      collabPct * WEIGHTS.collaborationReach +
      consistencyPct * WEIGHTS.consistency
    )

    const mergeEffRaw = mergeEffRaws[i]
    const firstPassPct = a.totalReviewedPRs > 0
      ? Math.round((a.firstPassApprovals / a.totalReviewedPRs) * 100)
      : 0
    const mergeRatePct = Math.round((a.prsMerged / Math.max(a.prsAuthored, 1)) * 100)

    const highlights: string[] = [
      `Shipped ${a.prsMerged} merged PRs (weighted complexity score: ${shippingRaws[i].toFixed(1)})`,
      `Reviewed ${a.uniqueAuthorsReviewed.size} unique engineers' work (${a.reviewsGiven} reviews total)`,
      `${firstPassPct}% first-pass approval rate · ${mergeRatePct}% merge rate`,
      `Collaborated with ${a.collaborators.size} teammates`,
      `Active ${a.activeWeeks.size}/${totalWeeks} weeks`,
    ]

    return {
      login: a.login,
      avatarUrl: a.avatarUrl,
      shippingScope: makeDimension(
        shippingRaws[i],
        shippingPct,
        `${a.prsMerged} merged PRs, weighted score ${shippingRaws[i].toFixed(1)}`
      ),
      reviewInfluence: makeDimension(
        reviewRaws[i],
        reviewPct,
        `${a.reviewsGiven} reviews given to ${a.uniqueAuthorsReviewed.size} engineers`
      ),
      mergeEfficiency: makeDimension(
        mergeEffRaw,
        mergePct,
        `${firstPassPct}% first-pass approvals, ${mergeRatePct}% merge rate`
      ),
      collaborationReach: makeDimension(
        a.collaborators.size,
        collabPct,
        `${a.collaborators.size} unique collaborators`
      ),
      consistency: makeDimension(
        a.activeWeeks.size / Math.max(totalWeeks, 1),
        consistencyPct,
        `Active ${a.activeWeeks.size} of ${totalWeeks} weeks`
      ),
      impactScore,
      highlights,
      stats: {
        prsAuthored: a.prsAuthored,
        prsMerged: a.prsMerged,
        reviewsGiven: a.reviewsGiven,
        uniqueAuthorsReviewed: a.uniqueAuthorsReviewed.size,
        firstPassApprovals: a.firstPassApprovals,
        totalReviewedPRs: a.totalReviewedPRs,
        uniqueCollaborators: a.collaborators.size,
        activeWeeks: a.activeWeeks.size,
        totalWeeks,
        weightedShippingScore: shippingRaws[i],
        weightedReviewScore: reviewRaws[i],
      },
    }
  })

  return results.sort((a, b) => b.impactScore - a.impactScore)
}
