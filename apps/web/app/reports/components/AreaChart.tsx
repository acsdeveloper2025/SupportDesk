import type { FC } from "react";
import React from "react";

interface AreaChartProps {
  title: string;
  data: Array<{ label: string; value: number }>;
  color?: string;
}

export const AreaChart: FC<AreaChartProps> = ({ title, data, color = "#10b981" }) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const width = 500;
  const height = 180;

  const points = data.map((d, idx) => {
    const x = (idx / Math.max(data.length - 1, 1)) * width;
    const y = height - (d.value / maxValue) * (height - 20) - 10;
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `M 0,${height} L ${points.join(" L ")} L ${width},${height} Z`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <div className="relative mt-4 h-48 w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id={`area-grad-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#area-grad-${color})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" />
        </svg>
      </div>
    </div>
  );
};
