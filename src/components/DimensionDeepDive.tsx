import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { EngineerScores } from '../types'

type DimensionKey = 'shippingScope' | 'reviewInfluence' | 'mergeEfficiency' | 'collaborationReach' | 'consistency'

interface Props {
  dimension: DimensionKey
  allEngineers: EngineerScores[]
  top5: EngineerScores[]
}

const DIM_CONFIG: Record<DimensionKey, {
  label: string
  unit: string
  getValue: (e: EngineerScores) => number
  formatValue: (v: number) => string
}> = {
  shippingScope: {
    label: 'Shipping Scope',
    unit: 'weighted score',
    getValue: e => e.stats.weightedShippingScore,
    formatValue: v => v.toFixed(1),
  },
  reviewInfluence: {
    label: 'Review Influence',
    unit: 'review score',
    getValue: e => e.stats.weightedReviewScore,
    formatValue: v => v.toFixed(1),
  },
  mergeEfficiency: {
    label: 'Merge Efficiency',
    unit: 'efficiency',
    getValue: e => e.mergeEfficiency.raw,
    formatValue: v => `${(v * 100).toFixed(0)}%`,
  },
  collaborationReach: {
    label: 'Collaboration Reach',
    unit: 'collaborators',
    getValue: e => e.stats.uniqueCollaborators,
    formatValue: v => `${v}`,
  },
  consistency: {
    label: 'Consistency',
    unit: 'active ratio',
    getValue: e => e.consistency.raw,
    formatValue: v => `${(v * 100).toFixed(0)}%`,
  },
}

interface TooltipEntry {
  login: string
  value: number
  isTop5: boolean
  rank?: number
}

function CustomTooltip({ active, payload, dimKey }: { active?: boolean; payload?: { payload: TooltipEntry }[]; dimKey: DimensionKey }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const config = DIM_CONFIG[dimKey]
  return (
    <div className="bg-white border border-gray-200 rounded-md px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-gray-800">{d.login}</div>
      {d.rank ? <div className="text-indigo-600">#{d.rank} overall</div> : null}
      <div className="text-gray-500 mt-0.5">{config.formatValue(d.value)} {config.unit}</div>
    </div>
  )
}

export default function DimensionDeepDive({ dimension, allEngineers, top5 }: Props) {
  const config = DIM_CONFIG[dimension]
  const top5Logins = new Set(top5.map(e => e.login))

  const sorted = [...allEngineers].sort((a, b) => config.getValue(b) - config.getValue(a))
  const shown = sorted.slice(0, 20)

  for (const eng of top5) {
    if (!shown.find(e => e.login === eng.login)) {
      shown.push(eng)
    }
  }

  const chartData = shown.map(e => ({
    login: e.login,
    value: config.getValue(e),
    isTop5: top5Logins.has(e.login),
    rank: top5.findIndex(t => t.login === e.login) + 1 || undefined,
  })).sort((a, b) => b.value - a.value)

  const top5Stats = top5.map(e => ({
    login: e.login,
    value: config.getValue(e),
    percentile: e[dimension].percentile,
    label: e[dimension].label,
    overallRank: top5.findIndex(t => t.login === e.login) + 1,
  })).sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-4">
      {/* Top 5 comparison row */}
      <div className="grid grid-cols-5 gap-2">
        {top5Stats.map(s => (
          <div key={s.login} className="bg-gray-50 rounded-md p-2.5 text-center">
            <div className="text-xs text-gray-600 mb-1">#{s.overallRank}</div>
            <div className="text-xs font-medium text-gray-800 truncate">{s.login}</div>
            <div className="text-sm font-semibold text-gray-900 mt-1">{config.formatValue(s.value)}</div>
            <div className="text-[10px] text-indigo-500 mt-0.5">p{s.percentile}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="login"
              tick={{ fill: '#9ca3af', fontSize: 9 }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={44}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 9 }} width={32} />
            <Tooltip content={<CustomTooltip dimKey={dimension} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Bar dataKey="value" radius={[2, 2, 0, 0]} maxBarSize={24}>
              {chartData.map(entry => (
                <Cell
                  key={entry.login}
                  fill={entry.isTop5 ? '#6366f1' : '#e5e7eb'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-gray-600">
        Top 20 engineers by {config.label}. Top-5 highlighted in indigo.
      </p>
    </div>
  )
}
