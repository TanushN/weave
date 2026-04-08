// Raw GitHub API types
export interface GHUser {
  login: string
  avatarUrl: string
}

export interface GHReview {
  author: GHUser | null
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING'
  body: string
  submittedAt: string
}

export interface GHFile {
  path: string
  additions: number
  deletions: number
}

export interface GHComment {
  author: GHUser | null
  body: string
}

export interface GHPullRequest {
  number: number
  title: string
  createdAt: string
  mergedAt: string | null
  closedAt: string | null
  state: 'MERGED' | 'OPEN' | 'CLOSED'
  author: GHUser | null
  additions: number
  deletions: number
  changedFiles: number
  reviews: { nodes: GHReview[] }
  files: { nodes: GHFile[] }
  comments: { nodes: GHComment[] }
  labels: { nodes: { name: string }[] }
}

export interface GHData {
  fetchedAt: string
  since: string
  pullRequests: GHPullRequest[]
}

// Computed impact score types
export interface DimensionScore {
  raw: number       // The actual computed metric value
  percentile: number // 0-100 percentile within the cohort
  label: string     // Human-readable summary (e.g., "47 weighted PRs")
}

export interface EngineerScores {
  login: string
  avatarUrl: string
  shippingScope: DimensionScore
  reviewInfluence: DimensionScore
  mergeEfficiency: DimensionScore
  collaborationReach: DimensionScore
  consistency: DimensionScore
  impactScore: number   // Weighted composite, 0-100
  highlights: string[]  // 3 human-readable bullet points for the card
  // Raw stats for transparency
  stats: {
    prsAuthored: number
    prsMerged: number
    reviewsGiven: number
    uniqueAuthorsReviewed: number
    firstPassApprovals: number
    totalReviewedPRs: number
    uniqueCollaborators: number
    activeWeeks: number
    totalWeeks: number
    weightedShippingScore: number
    weightedReviewScore: number
  }
}
