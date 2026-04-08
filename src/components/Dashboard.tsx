import { useState } from 'react'
import impactData from '../data/impact-scores.json'
import type { EngineerScores } from '../types'
import EngineerCard from './EngineerCard'
import MethodologyPanel from './MethodologyPanel'
import DimensionDeepDive from './DimensionDeepDive'

const DIMENSIONS = [
  { key: 'shippingScope' as const, label: 'Shipping Scope' },
  { key: 'reviewInfluence' as const, label: 'Review Influence' },
  { key: 'mergeEfficiency' as const, label: 'Merge Efficiency' },
  { key: 'collaborationReach' as const, label: 'Collab Reach' },
  { key: 'consistency' as const, label: 'Consistency' },
]

export default function Dashboard() {
  const [activeDimension, setActiveDimension] = useState<typeof DIMENSIONS[0]['key'] | null>(null)

  const scores = impactData.scores as EngineerScores[]
  const top5 = scores.slice(0, 5)
  const top3 = top5.slice(0, 3)
  const bottom2 = top5.slice(3, 5)

  const since = new Date(impactData.since)
  const fetchedAt = new Date(impactData.fetchedAt)
  const dateRange = `${since.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${fetchedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Engineering Impact</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              <a
                href="https://github.com/PostHog/posthog"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                PostHog/posthog
              </a>
              {' '}· {dateRange} · {impactData.mergedPRs} merged PRs · {impactData.totalContributors} contributors
            </p>
          </div>
          <p className="text-xs text-gray-600">
            Ranked by weighted percentile score across 5 dimensions
          </p>
        </div>

        {/* Methodology */}
        <MethodologyPanel />

        {/* Top 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((eng, i) => (
            <EngineerCard key={eng.login} engineer={eng} rank={i + 1} />
          ))}
        </div>

        {/* #4 and #5 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bottom2.map((eng, i) => (
            <EngineerCard key={eng.login} engineer={eng} rank={i + 4} compact />
          ))}
        </div>

        {/* Dimension Explorer */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-medium text-gray-800">Dimension Explorer</h2>
              <p className="text-xs text-gray-600 mt-0.5">
                See how the top 5 compare to all {impactData.totalContributors} contributors on any single dimension
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DIMENSIONS.map(d => (
                <button
                  key={d.key}
                  onClick={() => setActiveDimension(prev => prev === d.key ? null : d.key)}
                  className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                    activeDimension === d.key
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {activeDimension ? (
            <DimensionDeepDive
              dimension={activeDimension}
              allEngineers={scores}
              top5={top5}
            />
          ) : (
            <div className="text-center py-8 text-gray-600 text-sm">
              Select a dimension above to explore
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-gray-600 text-xs pb-2">
          Data fetched {fetchedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · GitHub GraphQL API · Scores are percentile ranks within the active contributor cohort
        </div>
      </div>
    </div>
  )
}
