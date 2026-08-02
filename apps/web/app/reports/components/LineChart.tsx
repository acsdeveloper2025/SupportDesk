import React from "react";

export interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  title?: string;
  data: DataPoint[];
  color?: string;
  height?: number;
}

export const LineChart: React.FC<LineChartProps> = ({
  title,
  data,
  color = "#3b82f6",
  height = 200,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        No data available
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const padding = 30;
  const chartWidth = 500;
  const chartHeight = height;
  const usableWidth = chartWidth - padding * 2;
  const usableHeight = chartHeight - padding * 2;

  const points = data
    .map((d, idx) => {
      const x = padding + (idx / Math.max(1, data.length - 1)) * usableWidth;
      const y = chartHeight - padding - (d.value / maxVal) * usableHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {title && (
        <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      )}
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-full w-full overflow-visible">
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = chartHeight - padding - pct * usableHeight;
          const val = Math.round(pct * maxVal);
          return (
            <g key={pct}>
              <line
                x1={padding}
                y1={y}
                x2={chartWidth - padding}
                y2={y}
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="1"
              />
              <text
                x={padding - 5}
                y={y + 4}
                textAnchor="end"
                className="fill-slate-400 text-[10px]"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Polylines & Markers */}
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />

        {data.map((d, idx) => {
          const x = padding + (idx / Math.max(1, data.length - 1)) * usableWidth;
          const y = chartHeight - padding - (d.value / maxVal) * usableHeight;
          return (
            <g key={idx} className="group">
              <circle cx={x} cy={y} r="4" fill={color} className="group-hover:r-6 transition-all" />
              <text
                x={x}
                y={chartHeight - 10}
                textAnchor="middle"
                className="fill-slate-400 text-[10px]"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
