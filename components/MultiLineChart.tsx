"use client";

const PALETTE = [
  "#00c2a8", // teal
  "#ffb300", // amber
  "#ff5a5a", // red
  "#7c9eff",
  "#c792ea",
  "#66d9ef",
  "#f78c6c",
  "#a3e635",
  "#f472b6",
  "#38bdf8",
  "#fb923c",
  "#4ade80",
];

export type ChartSeries = {
  label: string;
  values: number[]; // must be same length as `months` passed to the chart
};

function formatMonthLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function MultiLineChart({
  months,
  series,
  height = 280,
}: {
  months: string[];
  series: ChartSeries[];
  height?: number;
}) {
  const width = 800;
  const padding = { top: 16, right: 16, bottom: 36, left: 34 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  if (series.length === 0 || months.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-textSecondary text-sm"
        style={{ height }}
      >
        No data for this range.
      </div>
    );
  }

  const maxY = Math.max(1, ...series.flatMap((s) => s.values));
  const stepX = months.length > 1 ? innerW / (months.length - 1) : 0;

  const xFor = (i: number) => padding.left + i * stepX;
  const yFor = (v: number) => padding.top + innerH - (v / maxY) * innerH;

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((maxY / yTicks) * i)
  );

  // Cap the number of x-axis labels shown so they don't overlap.
  const labelEvery = Math.max(1, Math.ceil(months.length / 8));

  return (
    <div className="w-full">
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 480 }}>
          {yTickValues.map((v, i) => {
            const y = yFor(v);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#23262c"
                  strokeWidth={1}
                />
                <text x={padding.left - 8} y={y + 3} textAnchor="end" fontSize={10} fill="#838a94">
                  {v}
                </text>
              </g>
            );
          })}

          {months.map((m, i) =>
            i % labelEvery === 0 ? (
              <text
                key={m}
                x={xFor(i)}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                fontSize={10}
                fill="#838a94"
              >
                {formatMonthLabel(m)}
              </text>
            ) : null
          )}

          {series.map((s, si) => {
            const color = PALETTE[si % PALETTE.length];
            const points = s.values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
            return (
              <g key={s.label}>
                <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
                {s.values.map((v, i) => (
                  <circle key={i} cx={xFor(i)} cy={yFor(v)} r={2.5} fill={color} />
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {series.map((s, si) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs text-textSecondary">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: PALETTE[si % PALETTE.length] }}
            />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}