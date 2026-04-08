/**
 * Fetches 90 days of merged PR data from PostHog/posthog via GitHub GraphQL API
 * and writes the result to src/data/github-data.json.
 *
 * Usage:
 *   GITHUB_TOKEN=<your_token> npx tsx scripts/fetch-data.ts
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const TOKEN = process.env.GITHUB_TOKEN
if (!TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable is required.')
  process.exit(1)
}

const GQL_ENDPOINT = 'https://api.github.com/graphql'

const SINCE = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
console.log(`Fetching PRs merged since: ${SINCE}`)

interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

interface ReviewNode {
  author: { login: string; avatarUrl: string } | null
  state: string
  body: string
  submittedAt: string
}

interface FileNode {
  path: string
  additions: number
  deletions: number
}

interface CommentNode {
  author: { login: string; avatarUrl: string } | null
  body: string
}

interface PRNode {
  number: number
  title: string
  createdAt: string
  mergedAt: string | null
  closedAt: string | null
  state: string
  author: { login: string; avatarUrl: string } | null
  additions: number
  deletions: number
  changedFiles: number
  reviews: { nodes: ReviewNode[] }
  files: { nodes: FileNode[] }
  comments: { nodes: CommentNode[] }
  labels: { nodes: { name: string }[] }
}

interface QueryResponse {
  data: {
    repository: {
      pullRequests: {
        pageInfo: PageInfo
        nodes: PRNode[]
      }
    }
  }
  errors?: { message: string }[]
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function gqlFetch(query: string, variables: Record<string, unknown>, retries = 5): Promise<QueryResponse> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(GQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
          'User-Agent': 'weave-impact-dashboard',
        },
        body: JSON.stringify({ query, variables }),
      })
      if (!res.ok) {
        throw new Error(`GitHub API error ${res.status}: ${await res.text()}`)
      }
      return res.json() as Promise<QueryResponse>
    } catch (err) {
      if (attempt === retries) throw err
      const wait = attempt * 2000
      console.log(`  Request failed (attempt ${attempt}/${retries}), retrying in ${wait}ms... [${(err as Error).message}]`)
      await sleep(wait)
    }
  }
  throw new Error('Unreachable')
}

const PR_QUERY = `
query($cursor: String) {
  repository(owner: "PostHog", name: "posthog") {
    pullRequests(
      first: 100
      after: $cursor
      states: [MERGED, CLOSED]
      orderBy: { field: UPDATED_AT, direction: DESC }
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        number
        title
        createdAt
        mergedAt
        closedAt
        state
        author {
          login
          avatarUrl
        }
        additions
        deletions
        changedFiles
        reviews(first: 50) {
          nodes {
            author { login avatarUrl }
            state
            body
            submittedAt
          }
        }
        files(first: 100) {
          nodes {
            path
            additions
            deletions
          }
        }
        comments(first: 30) {
          nodes {
            author { login avatarUrl }
            body
          }
        }
        labels(first: 10) {
          nodes {
            name
          }
        }
      }
    }
  }
}
`

async function fetchAllPRs(): Promise<PRNode[]> {
  const allPRs: PRNode[] = []
  let cursor: string | null = null
  let page = 0
  let reachedCutoff = false

  while (!reachedCutoff) {
    page++
    console.log(`  Fetching page ${page} (cursor: ${cursor ?? 'start'})...`)

    const result = await gqlFetch(PR_QUERY, { cursor })

    if (result.errors?.length) {
      throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`)
    }

    const { nodes, pageInfo } = result.data.repository.pullRequests

    for (const pr of nodes) {
      const prDate = pr.mergedAt ?? pr.closedAt ?? pr.createdAt
      if (prDate < SINCE) {
        reachedCutoff = true
        break
      }
      allPRs.push(pr)
    }

    if (!pageInfo.hasNextPage || reachedCutoff) break
    cursor = pageInfo.endCursor
  }

  console.log(`  Total PRs fetched: ${allPRs.length}`)
  return allPRs
}

async function main() {
  console.log('Starting GitHub data fetch...')

  const pullRequests = await fetchAllPRs()

  const output = {
    fetchedAt: new Date().toISOString(),
    since: SINCE,
    pullRequests,
  }

  const outPath = join(__dirname, '..', 'src', 'data', 'github-data.json')
  writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`\nData written to ${outPath}`)
  console.log(`  ${pullRequests.length} PRs`)
  console.log(`  Date range: ${SINCE} to now`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
