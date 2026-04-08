import { useState } from 'react'

const DIMENSIONS = [
  {
    name: 'Shipping Scope',
    weight: '30%',
    description:
      'How much meaningful work someone ships. Each merged PR is weighted by how many files it touches and how many areas of the codebase it spans, so a complex cross-cutting change counts more than ten small tweaks.',
    formula: 'Σ log₂(changedFiles + 2) × areaDiversity per merged PR',
  },
  {
    name: 'Review Influence',
    weight: '25%',
    description:
      'How much someone invests in their teammates\' work. Reviews with substantive comments score higher than rubber-stamp approvals, and reviewing a wide range of authors matters too.',
    formula: 'Σ (1 + log₂(commentLength + 2) × 0.5) + uniqueAuthors × 2',
  },
  {
    name: 'Merge Efficiency',
    weight: '15%',
    description:
      'How well-prepared someone\'s contributions are. We look at what share of their PRs get approved on the first review cycle without needing changes, and what share actually make it to merge.',
    formula: '(firstPassApprovals / reviewedPRs) × 0.6 + (mergedPRs / openedPRs) × 0.4',
  },
  {
    name: 'Collaboration Reach',
    weight: '15%',
    description:
      'How many unique teammates someone works closely with, either by reviewing their code or having their own code reviewed. Engineers with wide reach spread context and reduce knowledge silos.',
    formula: '|{ engineers who reviewed your PRs } ∪ { engineers whose PRs you reviewed }|',
  },
  {
    name: 'Consistency',
    weight: '15%',
    description:
      'How reliably someone shows up over time. This is the share of weeks in the 90-day window where they were actively contributing, whether shipping or reviewing.',
    formula: 'activeWeeks / totalWeeks (~13 weeks in window)',
  },
]

export default function MethodologyPanel() {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">How impact is measured</span>
          <span className="text-xs text-gray-600">5 dimensions · percentile-ranked</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <p className="text-gray-500 text-xs mt-3 mb-4 leading-relaxed max-w-3xl">
            Each engineer is scored on 5 dimensions. Rather than using raw counts, every dimension is converted
            to a <strong className="text-gray-700">percentile rank</strong> within the active contributor cohort
            (anyone with at least 3 merged PRs in the window), so a prolific reviewer is compared fairly against
            a prolific shipper. The final <strong className="text-gray-700">Impact Score</strong> is a weighted
            average of those five percentiles. Every raw number behind the score is visible in each card.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {DIMENSIONS.map(d => (
              <div key={d.name} className="bg-gray-50 rounded-md p-3">
                <div className="flex items-baseline gap-1.5 mb-1.5">
                  <span className="font-medium text-gray-800 text-xs">{d.name}</span>
                  <span className="text-[10px] text-gray-600">{d.weight}</span>
                </div>
                <p className="text-gray-500 text-[11px] leading-relaxed mb-2">{d.description}</p>
                <code className="text-gray-600 text-[10px] leading-relaxed break-words">{d.formula}</code>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-[11px] mt-3">
            Bots and automation accounts are excluded. Data covers the last 90 days from PostHog/posthog.
          </p>
        </div>
      )}
    </div>
  )
}
