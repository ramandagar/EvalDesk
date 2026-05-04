"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function PassRateChart({ passRates, labels }: { passRates: number[]; labels: string[] }) {
  const data = passRates.map((rate, i) => ({
    name: labels[i] || `Run ${i + 1}`,
    rate,
  }));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-semibold text-[#0a0a0a] dark:text-[#f7f8f8]" style={{ letterSpacing: "-0.02em" }}>
            Pass Rate Trend
          </h3>
          <p className="text-[12px] text-[#8a8f98] dark:text-[#62666d]" style={{ letterSpacing: "-0.01em" }}>
            Last {passRates.length} evaluation runs
          </p>
        </div>
        {passRates.length > 1 && (
          <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${
            passRates[passRates.length - 1] > passRates[0]
              ? "bg-[#4E9363]/10 text-[#4E9363]"
              : passRates[passRates.length - 1] < passRates[0]
                ? "bg-red-500/10 text-red-500"
                : "bg-black/[0.04] dark:bg-white/[0.04] text-[#8a8f98]"
          }`}>
            {passRates[passRates.length - 1] > passRates[0] ? "+" : ""}
            {passRates[passRates.length - 1] - passRates[0]}% overall
          </span>
        )}
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
            <defs>
              <linearGradient id="passRateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ABC83A" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ABC83A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8a8f98", letterSpacing: "-0.01em" }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#8a8f98" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              contentStyle={{
                background: "#0f1011",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#f7f8f8",
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
              formatter={(value: number) => [`${value}%`, "Pass Rate"]}
            />
            <Area
              type="monotone"
              dataKey="rate"
              stroke="#ABC83A"
              strokeWidth={2}
              fill="url(#passRateGradient)"
              dot={{ r: 3, fill: "#ABC83A", stroke: "#09090b", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "#ABC83A", stroke: "#09090b", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
