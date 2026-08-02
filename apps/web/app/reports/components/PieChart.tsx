import type { FC } from "react";
import React from "react";

interface PieChartProps {
  title: string;
  data: Array<{ label: string; value: number }>;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export const PieChart: FC<PieChartProps> = ({ title, data }) => {
  const total = data.reduce((acc, d) => acc + d.value, 0);

  const slices = data.reduce<
    Array<{
      label: string;
      value: number;
      percentage: string;
      startAngle: number;
      angle: number;
      color: string;
    }>
  >((acc, d, i) => {
    const angle = total > 0 ? (d.value / total) * 360 : 0;
    const lastSlice = acc[acc.length - 1];
    const startAngle = lastSlice ? lastSlice.startAngle + lastSlice.angle : 0;
    acc.push({
      label: d.label,
      value: d.value,
      percentage: total > 0 ? ((d.value / total) * 100).toFixed(1) : "0.0",
      startAngle,
      angle,
      color: COLORS[i % COLORS.length] || "#3b82f6",
    });
    return acc;
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>

      {total === 0 ? (
        <div className="mt-6 flex h-48 items-center justify-center text-xs text-slate-400">
          No data available for selected filter range
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative h-44 w-44 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 transform">
              {slices.map((slice, idx) => {
                const x1 = 50 + 40 * Math.cos((Math.PI * slice.startAngle) / 180);
                const y1 = 50 + 40 * Math.sin((Math.PI * slice.startAngle) / 180);
                const endAngle = slice.startAngle + slice.angle;
                const x2 = 50 + 40 * Math.cos((Math.PI * endAngle) / 180);
                const y2 = 50 + 40 * Math.sin((Math.PI * endAngle) / 180);
                const largeArc = slice.angle > 180 ? 1 : 0;

                const pathData = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
                return (
                  <path
                    key={idx}
                    d={pathData}
                    fill={slice.color}
                    className="transition-all hover:opacity-80"
                  />
                );
              })}
              <circle cx="50" cy="50" r="22" className="fill-white dark:fill-slate-900" />
            </svg>
          </div>

          <div className="flex flex-1 flex-col gap-2">
            {slices.map((slice, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {slice.label}
                  </span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {slice.value} ({slice.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
