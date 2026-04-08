import { useState } from 'react'
import type { EngineerScores } from '../types'

interface Props {
  engineer: EngineerScores
  rank: number
  compact?: boolean
}

const DIMENSIONS = [
  { key: 'shippingScope' as const, label: 'Shipping Scope' },
  { key: 'reviewInfluence' as const, label: 'Review Influence' },
  { key: 'mergeEfficiency' as const, label: 'Merge Efficiency' },
  { key: 'collaborationReach' as const, label: 'Collab Reach' },
  { key: 'consistency' as const, label: 'Consistency' },
]

function ScoreBar({ percentile }: { percentile: number }) {
  return (
    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-indigo-500 rounded-full"
        style={{ width: `${percentile}%` }}
      />
    </div>
  )
}

export default function EngineerCard({ engineer, rank, compact = false }: Props) {
  const [showRaw, setShowRaw] = useState(false)

  const avatarUrl = engineer.avatarUrl
    ? `${engineer.avatarUrl}&s=80`
    : `https://github.com/${engineer.login}.png?size=80`

  const fpPct = engineer.stats.totalReviewedPRs > 0
    ? Math.round(engineer.stats.firstPassApprovals / engineer.stats.totalReviewedPRs * 100)
    : 0
  const mergeRatePct = Math.round(engineer.stats.prsMerged / Math.max(engineer.stats.prsAuthored, 1) * 100)

  if (compact) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-4">
        <span className="text-2xl font-light text-gray-600 w-6 shrink-0 text-center">{rank}</span>
        <img
          src={avatarUrl}
          alt={engineer.login}
          className="w-10 h-10 rounded-full border border-gray-200 shrink-0"
          onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${engineer.login}&background=e5e7eb&color=6b7280&size=80` }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <a
              href={`https://github.com/${engineer.login}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors text-sm truncate"
            >
              {engineer.login}
            </a>
            <span className="text-xs text-gray-600 shrink-0">
              {engineer.stats.prsMerged} PRs · {engineer.stats.reviewsGiven} reviews
            </span>
          </div>
          <div className="space-y-1">
            {DIMENSIONS.map(d => (
              <div key={d.key} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-600 w-20 shrink-0 truncate">{d.label}</span>
                <ScoreBar percentile={engineer[d.key].percentile} />
                <span className="text-[10px] text-gray-600 w-5 text-right shrink-0">
                  {engineer[d.key].percentile}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-semibold text-gray-800">{engineer.impactScore}</div>
          <div className="text-[10px] text-gray-600">impact</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-3xl font-light text-gray-600 w-7 shrink-0 leading-none mt-1">{rank}</span>
        <img
          src={avatarUrl}
          alt={engineer.login}
          className="w-12 h-12 rounded-full border border-gray-200 shrink-0"
          onError={e => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${engineer.login}&background=e5e7eb&color=6b7280&size=80` }}
        />
        <div className="flex-1 min-w-0">
          <a
            href={`https://github.com/${engineer.login}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors block text-sm truncate"
          >
            {engineer.login}
          </a>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-semibold text-gray-800">{engineer.impactScore}</span>
            <span className="text-xs text-gray-600">/ 100</span>
          </div>
        </div>
      </div>

      {/* Key stats row */}
      <div className="grid grid-cols-3 gap-2 text-center border-y border-gray-100 py-3">
        <div>
          <div className="text-base font-semibold text-gray-800">{engineer.stats.prsMerged}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">PRs merged</div>
        </div>
        <div>
          <div className="text-base font-semibold text-gray-800">{engineer.stats.reviewsGiven}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">reviews given</div>
        </div>
        <div>
          <div className="text-base font-semibold text-gray-800">{engineer.stats.uniqueCollaborators}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">collaborators</div>
        </div>
      </div>

      {/* Dimension breakdown */}
      <div className="space-y-2.5">
        {DIMENSIONS.map(d => (
          <div key={d.key} className="group relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">{d.label}</span>
              <span className="text-xs text-gray-500">
                {engineer[d.key].percentile}
                <span className="text-gray-300">th</span>
              </span>
            </div>
            <ScoreBar percentile={engineer[d.key].percentile} />
            {/* Tooltip */}
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 bg-gray-900 text-white rounded-md px-2.5 py-2 text-xs w-56 shadow-lg pointer-events-none">
              <div className="font-medium mb-0.5">{d.label}</div>
              <div className="text-gray-300">{engineer[d.key].label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Efficiency callout */}
      <div className="flex gap-2 text-xs text-gray-500">
        <span className="bg-gray-50 border border-gray-100 rounded px-2 py-1">
          {fpPct}% first-pass approvals
        </span>
        <span className="bg-gray-50 border border-gray-100 rounded px-2 py-1">
          {mergeRatePct}% merge rate
        </span>
        <span className="bg-gray-50 border border-gray-100 rounded px-2 py-1">
          {engineer.stats.activeWeeks}/{engineer.stats.totalWeeks} wks active
        </span>
      </div>

      {/* Raw stats toggle */}
      <button
        onClick={() => setShowRaw(v => !v)}
        className="text-xs text-gray-600 hover:text-gray-600 transition-colors text-left"
      >
        {showRaw ? 'Hide raw numbers ↑' : 'Show raw numbers ↓'}
      </button>

      {showRaw && (
        <div className="bg-gray-50 rounded-md p-3 text-xs space-y-0.5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-500">
            <span>PRs authored</span><span className="text-gray-800 font-medium">{engineer.stats.prsAuthored}</span>
            <span>PRs merged</span><span className="text-gray-800 font-medium">{engineer.stats.prsMerged}</span>
            <span>Reviews given</span><span className="text-gray-800 font-medium">{engineer.stats.reviewsGiven}</span>
            <span>Authors reviewed</span><span className="text-gray-800 font-medium">{engineer.stats.uniqueAuthorsReviewed}</span>
            <span>First-pass approvals</span><span className="text-gray-800 font-medium">{engineer.stats.firstPassApprovals} / {engineer.stats.totalReviewedPRs}</span>
            <span>Collaborators</span><span className="text-gray-800 font-medium">{engineer.stats.uniqueCollaborators}</span>
            <span>Active weeks</span><span className="text-gray-800 font-medium">{engineer.stats.activeWeeks} / {engineer.stats.totalWeeks}</span>
            <span>Weighted shipping</span><span className="text-gray-800 font-medium">{engineer.stats.weightedShippingScore.toFixed(1)}</span>
            <span>Weighted review</span><span className="text-gray-800 font-medium">{engineer.stats.weightedReviewScore.toFixed(1)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
