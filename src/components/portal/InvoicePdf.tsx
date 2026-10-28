// A4 demo invoice in MAINGAU colours. Loaded on demand (dynamic import) – never part of the initial bundle.
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Invoice } from "@/lib/invoices";
import { INVOICE_TEXT as T } from "@/config/details";

const NAVY = "#0B2A5B", BLUE = "#2B63E8", YELLOW = "#F5DC3C", SURFACE = "#EEF3FA", LINE = "#D6DEEA", MUTED = "#4A5B78";
const eur = (v: number) => `${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: NAVY },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  word: { fontFamily: "Helvetica-Bold", fontSize: 18 },
  plus: { width: 18, height: 18, borderRadius: 9, backgroundColor: YELLOW, alignItems: "center", justifyContent: "center" },
  plusText: { fontFamily: "Helvetica-Bold", fontSize: 13, marginTop: -1 },
  demo: { borderWidth: 1.5, borderColor: NAVY, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, fontSize: 8, fontFamily: "Helvetica-Bold" },
  title: { marginTop: 28, fontFamily: "Helvetica-Bold", fontSize: 16 },
  hero: { marginTop: 14, backgroundColor: SURFACE, borderRadius: 16, padding: 18, flexDirection: "row", justifyContent: "space-between" },
  heroLabel: { fontSize: 9, color: MUTED },
  heroAmount: { fontFamily: "Helvetica-Bold", fontSize: 28, marginTop: 2 },
  heroMeta: { fontSize: 10, marginTop: 2 },
  section: { marginTop: 22 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 12, marginBottom: 8 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  barLabel: { width: 130, fontSize: 9 },
  barTrack: { flexGrow: 1, height: 8, backgroundColor: SURFACE, borderRadius: 4 },
  barFill: { height: 8, backgroundColor: BLUE, borderRadius: 4 },
  barValue: { width: 70, textAlign: "right", fontSize: 9 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: LINE },
  total: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, fontFamily: "Helvetica-Bold", fontSize: 12 },
  facts: { flexDirection: "row", gap: 24 },
  factLabel: { fontSize: 8, color: MUTED },
  foot: { position: "absolute", bottom: 28, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 },
});

export function InvoiceDoc({ inv }: { inv: Invoice }) {
  const max = Math.max(1, ...inv.bars.map((b) => b.value));
  const refund = inv.amount < 0;
  return (
    <Document title={inv.title} author="MAINGAU Energie (Demo)">
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <View style={s.brand}><Text style={s.word}>MAINGAU</Text><View style={s.plus}><Text style={s.plusText}>+</Text></View></View>
          <Text style={s.demo}>{T.demo}</Text>
        </View>
        <Text style={s.title}>{inv.title}</Text>
        <View style={s.hero}>
          <View>
            <Text style={s.heroLabel}>{refund ? T.refund : T.amount}</Text>
            <Text style={s.heroAmount}>{eur(Math.abs(inv.amount))}</Text>
          </View>
          <View>
            <Text style={s.heroLabel}>{T.period}</Text>
            <Text style={s.heroMeta}>{date(inv.periodFrom)} – {date(inv.periodTo)}</Text>
            <Text style={[s.heroLabel, { marginTop: 8 }]}>{T.due}</Text>
            <Text style={s.heroMeta}>{date(inv.due)}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>{T.usage}</Text>
          {inv.bars.map((b) => (
            <View key={b.label} style={s.barRow}>
              <Text style={s.barLabel}>{b.label}</Text>
              <View style={s.barTrack}><View style={[s.barFill, { width: `${(b.value / max) * 100}%` }]} /></View>
              <Text style={s.barValue}>{b.value.toLocaleString("de-DE")} {b.unit}</Text>
            </View>
          ))}
        </View>

        <View style={[s.section, s.facts]}>
          <View><Text style={s.factLabel}>{T.tariff}</Text><Text>{inv.tariff ?? "—"}</Text></View>
          {inv.pgUntil && <View><Text style={s.factLabel}>{T.guarantee}</Text><Text>{date(inv.pgUntil)}</Text></View>}
        </View>

        <View style={s.section}>
          <Text style={s.h2}>{T.items}</Text>
          {inv.lines.map((l) => (
            <View key={l.label} style={s.row}><Text>{l.label}</Text><Text>{eur(l.amount)}</Text></View>
          ))}
          <View style={s.total}><Text>{refund ? T.refund : T.total}</Text><Text>{eur(Math.abs(inv.amount))}</Text></View>
        </View>

        <View style={s.foot} fixed>
          <Text>{T.customer} {inv.customerId} · {inv.id}</Text>
          <Text>{T.demo}</Text>
        </View>
      </Page>
    </Document>
  );
}
