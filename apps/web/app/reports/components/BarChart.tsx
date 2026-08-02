import type { FC } from "react";
import React from "react";

interface BarChartProps {
  title: string;
  data: Array<{ label: string; value: number }>;
  color?: string;
}

export const BarChart: FC<BarChartProps> = ({ title, data, color = "#3b82f6" }) => {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <div className="mt-6 flex flex-col gap-3">
        {data.map((item, idx) => {
          const widthPercent = Math.round((item.value / maxValue) * 100);
          return (
            <div key={idx} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                <span>{item.label}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {item.value}
                </span>
              </div>
              <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${widthPercent}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
