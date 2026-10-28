// Marketing overview charts. One hue, recessive axes, hover tooltip – same look as the portal HistoryChart.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { eur, pct } from "@/lib/engine";
import { clusterDe } from "@/lib/explain";
import { ECO_DE } from "@/config/internal";
import type { SegmentRow } from "@/lib/marketing";

const AXIS = "#5b6474";
const LINE = "#e1e4e9";
const NAVY = "#0b2a5b";
const tooltipStyle = { borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13, color: "#1a2233" };

/** Where is value at risk? One bubble per segment: x = Ø Abwanderung, y = Ø CLV, size = Kunden. */
export function SegmentScatter({ rows, onOpen }: { rows: SegmentRow[]; onOpen: (cluster: string, eco: number) => void }) {
  const data = rows.map((r) => ({ ...r, x: r.churn, y: r.clv, z: r.size }));
  return (
    <figure>
      <div className="h-72" role="img" aria-label={`Streudiagramm: ${rows.length} Segmente nach Ø Abwanderung und Ø CLV`}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 20, left: 0 }}>
            <CartesianGrid stroke={LINE} strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name="Ø Abwanderung" tickFormatter={(v: number) => pct(v)} tickLine={false} axisLine={{ stroke: LINE }} tick={{ fill: AXIS, fontSize: 12 }}
              label={{ value: "Ø Abwanderung (12 Monate)", position: "insideBottom", offset: -10, fill: AXIS, fontSize: 12 }} />
            <YAxis type="number" dataKey="y" name="Ø CLV" tickFormatter={(v: number) => eur(v)} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={64} />
            <ZAxis type="number" dataKey="z" name="Kunden" range={[60, 600]} />
            <Tooltip cursor={{ strokeDasharray: "3 3", stroke: LINE }} contentStyle={tooltipStyle}
              content={({ active, payload }) => {
                const d = active && payload?.[0]?.payload as (SegmentRow & { x: number }) | undefined;
                if (!d) return null;
                return (
                  <div className="rounded-lg border border-border bg-card p-2.5 text-xs shadow-sm">
                    <div className="font-semibold">{clusterDe(d.cluster)} · {d.eco} {ECO_DE[d.eco - 1]}</div>
                    <div className="mt-1 tabular-nums text-muted-foreground">{d.size} Kunden · Ø CLV {eur(d.clv)} · Abwanderung {pct(d.churn)}</div>
                  </div>
                );
              }} />
            <Scatter data={data} fill={NAVY} fillOpacity={0.45} stroke={NAVY} className="cursor-pointer"
              onClick={(d: { payload?: SegmentRow }) => d.payload && onOpen(d.payload.cluster, d.payload.eco)} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Preisgarantie-Ablauf: wie dringend ist es? Reihenfolge = Zeit, nicht Größe. */
export function PgBars({ d30, d60, d90 }: { d30: number; d60: number; d90: number }) {
  const data = [{ x: "≤ 30 Tage", v: d30 }, { x: "31–60 Tage", v: d60 }, { x: "61–90 Tage", v: d90 }];
  return (
    <figure>
      <div className="h-72" role="img" aria-label={`Preisgarantie endet: bis 30 Tage ${d30}, 31 bis 60 Tage ${d60}, 61 bis 90 Tage ${d90} Kunden`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 0, bottom: 0, left: -16 }}>
            <XAxis dataKey="x" tickLine={false} axisLine={{ stroke: LINE }} tick={{ fill: AXIS, fontSize: 12 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={44} />
            <Tooltip cursor={{ fill: "#eef0f3" }} contentStyle={tooltipStyle} formatter={(v: number) => [`${v} Kunden`, ""]} separator="" />
            <Bar dataKey="v" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={72} label={{ position: "top", fill: "#1a2233", fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
