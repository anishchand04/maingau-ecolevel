import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { NEED_DE, eur, pct, profileById, type Profile } from "@/lib/engine";
import { useProfiles } from "@/lib/live";
import { actions, useStore } from "@/lib/store";
import { isHoldout } from "@/lib/learning";
import { styleOf, styleSummary } from "@/lib/style";
import { clusterDe, policyDe, productDe, reasonDe } from "@/lib/explain";
import { placeholderName } from "@/config/names";
import { CHANNEL_DE, CONSENT_CHANNELS, ECO_DE, NEED_EVIDENCE_DE } from "@/config/internal";
import { PORTAL } from "@/config/portal";
import { DataBadge, DecisionBadge } from "@/components/base/StatusBadge";
import { PageTitle, Section, TabBar, td, th } from "@/components/internal/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type S = { id?: string; cluster?: string; eco?: number };
export const Route = createFileRoute("/marketing/customers")({
  validateSearch: (s: Record<string, unknown>): S => ({
    id: typeof s.id === "string" ? s.id : undefined,
    cluster: typeof s.cluster === "string" ? s.cluster : undefined,
    eco: typeof s.eco === "number" ? s.eco : typeof s.eco === "string" && s.eco ? Number(s.eco) : undefined,
  }),
  head: () => ({ meta: [{ title: "Kunden · Marketing" }] }),
  component: Customers,
});

function Customers() {
  const { id, cluster, eco } = Route.useSearch();
  const [q, setQ] = useState("");
  const profiles = useProfiles();
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return profiles.filter((p) => (!cluster || p.cluster === cluster) && (!eco || p.ecoLevel === eco))
      .filter((p) => !t || p.id.toLowerCase().includes(t) || placeholderName(p.id).toLowerCase().includes(t) || p.raw.city.toLowerCase().includes(t) || p.products.join(" ").toLowerCase().includes(t))
      .slice(0, 150);
  }, [q, profiles, cluster, eco]);
  const sel = profiles.find((p) => p.id === id) ?? list[0];
  const filterLabel = [cluster && clusterDe(cluster), eco && `EcoLevel ${eco}`].filter(Boolean).join(" · ");

  return (
    <div>
      <PageTitle title="Kunden" sub="Suche nach Name, Kundennummer, Ort oder Produkt. Details stehen in den Tabs der Kundenakte." />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-border bg-card lg:sticky lg:top-20 lg:self-start">
          <div className="border-b border-border p-3">
            <label className="relative block">
              <span className="sr-only">Kunden suchen</span>
              <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" strokeWidth={1.75} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, MG-…, Ort, Produkt"
                className="h-9 w-full rounded-md border border-input bg-card pr-3 pl-8 text-sm focus:border-ring focus:outline-none" />
            </label>
            {filterLabel && <p className="mt-2 flex items-center justify-between text-xs text-muted-foreground">Filter: {filterLabel}<Link to="/marketing/customers" search={{}} className="underline">aufheben</Link></p>}
          </div>
          <ul className="max-h-[70vh] overflow-y-auto p-1">
            {list.map((p) => (
              <li key={p.id}>
                <Link to="/marketing/customers" search={{ id: p.id, cluster, eco }}
                  className={cn("flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted", sel?.id === p.id && "bg-muted")}>
                  <span className="min-w-0"><span className="block font-medium">{placeholderName(p.id)}</span><span className="block truncate text-xs text-muted-foreground">{p.id} · {p.raw.city}</span></span>
                  <DecisionBadge status={p.nba.action} />
                </Link>
              </li>
            ))}
            {!list.length && <li className="p-3 text-sm text-muted-foreground">Keine Kunden gefunden.</li>}
          </ul>
        </div>
        {sel ? <CustomerFile p={sel} /> : null}
      </div>
    </div>
  );
}

type Tab = "profil" | "beduerfnisse" | "twins" | "verlauf";

function CustomerFile({ p }: { p: Profile }) {
  const [tab, setTab] = useState<Tab>("profil");
  const override = useStore((s) => s.styleOverride[p.id]);
  const top3 = p.needs.filter((n) => n.id !== "N08").slice().sort((a, b) => b.score - a.score).slice(0, 3);
  const c = p.raw;
  return (
    <div className="min-w-0 space-y-6">
      <Section title={<span className="flex flex-wrap items-center gap-2 text-base">{placeholderName(p.id)} <span className="font-normal text-muted-foreground">{p.id}</span></span>}
        sub={`${c.city} · Kunde seit ${c.since.slice(0, 4)} · EcoLevel ${p.ecoLevel} ${ECO_DE[p.ecoLevel - 1]}`}>
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">Produkte</h3>
            <ul className="mt-2 space-y-1 text-sm">{p.products.map((x) => <li key={x}>{x}</li>)}{!p.products.length && <li className="text-muted-foreground">keine</li>}</ul>
          </div>
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">Top-3-Bedürfnisse</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {top3.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-2">
                  <span>{NEED_DE[n.id]} <span className="tabular-nums text-muted-foreground">{n.score}</span></span>
                  <span className={cn("rounded border px-1.5 text-xs", n.kind === "confirmed" ? "border-foreground/40" : "border-dashed border-foreground/30 text-muted-foreground")}>{NEED_EVIDENCE_DE[n.kind]}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-medium text-muted-foreground">Next Best Action</h3>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold"><DecisionBadge status={p.nba.action} />{productDe(p.nba)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{reasonDe(p)}</p>
            <ForwardNba p={p} />
          </div>
        </div>
      </Section>

      <div>
        <TabBar label="Kundenakte" value={tab} onChange={setTab} tabs={[{ id: "profil", label: "Profil" }, { id: "beduerfnisse", label: "Bedürfnisse" }, { id: "twins", label: "Twins" }, { id: "verlauf", label: "Verlauf" }]} />
        {tab === "profil" && <ProfileTab p={p} styleText={styleSummary(styleOf(c, override))} />}
        {tab === "beduerfnisse" && <NeedsTab p={p} />}
        {tab === "twins" && <TwinsTab p={p} />}
        {tab === "verlauf" && <HistoryTab p={p} />}
      </div>
    </div>
  );
}

function ForwardNba({ p }: { p: Profile }) {
  const n = p.nba;
  const done = useStore((s) => s.decisions[`${p.id}:${n.productId}`]);
  const holdoutPct = useStore((s) => s.learning.holdoutPct);
  if (n.action !== "SELL") return <p className="mt-3 text-xs text-muted-foreground">Keine Weiterleitung: Das ist keine Verkaufs-Empfehlung.</p>;
  if (done?.status === "approved") return <p className="mt-3 flex items-center gap-1.5 text-sm"><Check className="size-4" strokeWidth={1.75} />An Kunden weitergeleitet · {new Date(done.at).toLocaleString("de-DE")}</p>;
  if (done?.status === "held_out") return <p className="mt-3 text-sm text-muted-foreground">Kontrollgruppe: bewusst nicht weitergeleitet (Holdout). Das Ergebnis fließt in die Wirkungsmessung ein.</p>;
  const held = isHoldout(p, holdoutPct);
  const forward = () => {
    if (held) {
      // random control group: recorded as "would have received it", nothing is sent
      actions.decide(p.id, n.productId, "held_out", productDe(n));
      actions.recordOutcome({ customerId: p.id, offer: n.productId, channel: n.channel ?? "newsletter_email", group: "control" });
      toast("Kontrollgruppe", { description: "Dieser Kunde zählt zum zufälligen Holdout und bekommt die Empfehlung bewusst nicht." });
      return;
    }
    actions.recordOutcome({ customerId: p.id, offer: n.productId, channel: n.channel ?? "newsletter_email", group: "treated" });
    actions.forwardNba({ customerId: p.id, productId: n.productId, channel: n.channel ?? undefined, dClv: +n.dClv.toFixed(2), pAccept: +n.pAccept.toFixed(4), reason: reasonDe(p) }, productDe(n));
    toast("NBA weitergeleitet", { description: "Im Portal sichtbar, Eintrag im Engine-Log gespeichert. Simuliert – es wird nichts verschickt." });
  };
  return <Button size="sm" className="mt-3" onClick={forward}><Send className="size-4" strokeWidth={1.75} />{held ? "Zurückhalten (Kontrollgruppe)" : "An Kunden weiterleiten"}</Button>;
}

function ProfileTab({ p, styleText }: { p: Profile; styleText: string }) {
  const c = p.raw;
  const s = styleOf(c);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Section title="Werte">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="flex items-center gap-1 text-xs text-muted-foreground">CLV <DataBadge status="berechnet" /></dt><dd className="mt-1 text-lg font-semibold tabular-nums">{eur(p.clvModel)}</dd></div>
          <div><dt className="flex items-center gap-1 text-xs text-muted-foreground">Abwanderung 12 M <DataBadge status="geschaetzt" /></dt><dd className="mt-1 text-lg font-semibold tabular-nums">{pct(c.churn)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Bedarfsabdeckung</dt><dd className="mt-1 tabular-nums">{pct(p.coverage)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Cluster</dt><dd className="mt-1">{clusterDe(p.cluster)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Kontakte 30 Tage</dt><dd className="mt-1 tabular-nums">{c.contacts30d}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Kommunikationsstil</dt><dd className="mt-1">{styleText}</dd></div>
        </dl>
        {s.belege[0] && <blockquote className="mt-4 border-l-2 border-border pl-3 text-sm text-muted-foreground">„{s.belege[0]}“</blockquote>}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {CONSENT_CHANNELS.map((k) => <ConsentDot key={k.key} label={k.label} status={c.consent[k.key]} />)}
          <ConsentDot label="Profiling" status={c.consent.profiling_analytics} />
        </div>
      </Section>
      <Section title="Alle Kandidaten" sub="Nach erwartetem Wert; blockierte mit Grund">
        <div className="relative overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b border-border"><th className={th}>Aktion</th><th className={th}>Status</th><th className={`${th} text-right`}>ΔCLV <DataBadge status="simuliert" /></th><th className={`${th} text-right`}>p <DataBadge status="geschaetzt" /></th></tr></thead>
          <tbody>
            {p.recs.slice(0, 8).map((r) => (
              <tr key={r.productId} className="border-b border-border last:border-0">
                <td className={td}><span className="flex items-center gap-2"><DecisionBadge status={r.action} />{productDe(r)}</span></td>
                <td className={cn(td, r.policy !== "eligible" && "text-muted-foreground")}>{policyDe(r)}</td>
                <td className={`${td} text-right tabular-nums`}>{eur(r.dClv)}</td>
                <td className={`${td} text-right tabular-nums`}>{pct(r.pAccept, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {!p.recs.length && <p className="text-sm text-muted-foreground">Keine Kandidaten.</p>}
      </Section>
    </div>
  );
}

function ConsentDot({ label, status }: { label: string; status?: string }) {
  const on = status === "granted", off = status === "withdrawn";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs">
      <span aria-hidden className={cn("size-2 rounded-full", on ? "bg-success" : off ? "bg-status-care" : "bg-status-wait/50")} />
      {label}: {on ? "ja" : off ? "widerrufen" : "nein"}
    </span>
  );
}

function NeedsTab({ p }: { p: Profile }) {
  return (
    <Section title="Bedarfsanalyse" sub={p.profiling ? "Relevanz 0–100 · bestätigt / abgeleitet / Hypothese · transparente Heuristik" : "Nur Vertragsdaten – keine Profiling-Einwilligung"}>
      <ul className="space-y-3">
        {p.needs.slice().sort((a, b) => b.score - a.score).map((n) => (
          <li key={n.id} className="grid grid-cols-[minmax(0,14rem)_1fr_auto_auto] items-center gap-3 text-sm">
            <span>{NEED_DE[n.id]}</span>
            <span className="h-2 rounded-sm bg-muted"><span className={cn("block h-full rounded-sm", n.fulfilled ? "bg-foreground/40" : "bg-primary")} style={{ width: `${n.score}%` }} /></span>
            <span className="w-8 text-right tabular-nums">{n.score}</span>
            <span className="w-40 text-xs text-muted-foreground">{n.fulfilled ? `abgedeckt${n.existing ? `: ${n.existing}` : ""}` : n.solution ? `Lücke → ${n.solution}` : "Lücke"} · {NEED_EVIDENCE_DE[n.kind]}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TwinsTab({ p }: { p: Profile }) {
  if (!p.profiling) return <Section title="Twins"><p className="text-sm text-muted-foreground">Twin-Suche aus: keine Profiling-Einwilligung.</p></Section>;
  return (
    <Section title="Ähnliche Kunden" sub="Kosinus-Ähnlichkeit auf Bedarfs- und Besitzvektor · Hinweis, kein Kaufbeleg">
      <ul className="divide-y divide-border">
        {p.twins.slice(0, 5).map((t) => {
          const tp = profileById(t.id)!;
          const shared = p.needs.filter((n, i) => n.score >= 40 && tp.needs[i].score >= 40).map((n) => NEED_DE[n.id]);
          const unmet = tp.needs.filter((n, i) => n.fulfilled && !p.needs[i].fulfilled && p.needs[i].score >= 30).map((n) => NEED_DE[n.id]);
          return (
            <li key={t.id} className="py-3 text-sm">
              <div className="flex justify-between"><Link to="/marketing/customers" search={{ id: t.id }} className="font-semibold hover:underline">{placeholderName(t.id)} <span className="font-normal text-muted-foreground">{t.id}</span></Link><span className="tabular-nums">{pct(t.similarity)} ähnlich</span></div>
              {shared.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Gemeinsam: {shared.join(", ")}</p>}
              {unmet.length > 0 && <p className="text-xs">Beim Twin abgedeckt, hier offen: {unmet.join(", ")}</p>}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

const RESPONSE_DE: Record<string, string> = { ignored: "ignoriert", dismissed: "abgelehnt", viewed: "angesehen", clicked: "geklickt", held_out: "Kontrollgruppe" };

function HistoryTab({ p }: { p: Profile }) {
  const c = p.raw;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Section title="Anliegen">
        <ul className="divide-y divide-border text-sm">
          {c.tickets.slice().reverse().map((t) => (
            <li key={t.id} className="py-2">
              <div className="flex justify-between gap-2"><span className="font-medium">{PORTAL.categories[t.category] ?? t.category}</span><span className="text-muted-foreground tabular-nums">{t.at} · {t.status === "open" ? "offen" : "erledigt"}</span></div>
              {t.text && <p className="text-xs text-muted-foreground">{t.text}</p>}
            </li>
          ))}
          {!c.tickets.length && <li className="py-2 text-muted-foreground">Keine Anliegen.</li>}
        </ul>
      </Section>
      <Section title="Frühere Ansprachen">
        <ul className="divide-y divide-border text-sm">
          {c.history.slice().reverse().map((h, i) => (
            <li key={i} className="flex justify-between gap-2 py-2"><span>{h.offer} · {CHANNEL_DE[h.channel] ?? h.channel}</span><span className="text-muted-foreground">{h.at} · {RESPONSE_DE[h.response] ?? h.response}{h.converted ? " · abgeschlossen" : ""}</span></li>
          ))}
          {!c.history.length && <li className="py-2 text-muted-foreground">Keine früheren Ansprachen.</li>}
        </ul>
      </Section>
    </div>
  );
}
