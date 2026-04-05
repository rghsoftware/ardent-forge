import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Icon } from '@/components/icon'
import type { OneRepMaxHistory } from '@/domain/types'

interface OneRmChartProps {
  data: OneRepMaxHistory[]
  unit?: 'lb' | 'kg'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface ChartDataPoint {
  date: string
  weight: number
  rawDate: string
  estimated: boolean
}

export function OneRmChart({ data, unit = 'lb' }: OneRmChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 bg-surface-iron p-8 text-center">
        <Icon name="show_chart" size={48} className="text-warm-ash/30" />
        <p className="text-sm font-heading text-warm-ash">No 1RM history</p>
        <p className="text-xs text-warm-ash/50">Record a max to start tracking progression.</p>
      </div>
    )
  }

  const chartData: ChartDataPoint[] = data.map((entry) => ({
    date: formatDate(entry.recordedAt),
    weight: entry.weight.value,
    rawDate: entry.recordedAt,
    estimated: entry.estimated,
  }))

  return (
    <div className="bg-surface-iron p-4">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <XAxis
            dataKey="date"
            tick={{ fill: '#e4beb4', fontSize: 10, fontFamily: 'Inter Variable' }}
            axisLine={{ stroke: 'rgba(91, 64, 57, 0.15)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#e4beb4', fontSize: 10, fontFamily: 'Inter Variable' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => `${value}${unit}`}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#201f1f',
              border: '1px solid rgba(91, 64, 57, 0.15)',
              borderRadius: 0,
              fontFamily: 'Space Grotesk Variable',
              fontSize: 12,
              color: '#e5e2e1',
            }}
            labelStyle={{ color: '#e4beb4' }}
            formatter={(value) => [`${value} ${unit}`, '1RM']}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#86cfff"
            strokeWidth={2}
            dot={{ fill: '#86cfff', r: 4, strokeWidth: 0 }}
            activeDot={{ fill: '#86cfff', r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
