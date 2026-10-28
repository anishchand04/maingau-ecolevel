import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { createElement } from "react";
import { invoicesOf, type Invoice } from "@/lib/invoices";
import { fmtDate, fmtNum } from "@/lib/portal";
import { INVOICE_TEXT as T } from "@/config/details";
import { EmptyState } from "@/components/base/EmptyState";
import { STROKE } from "./icons";
import { usePortal } from "./use-portal";

async function download(inv: Invoice) {
  const [{ pdf }, { InvoiceDoc }] = await Promise.all([import("@react-pdf/renderer"), import("./InvoicePdf")]);
  const blob = await pdf(createElement(InvoiceDoc, { inv }) as Parameters<typeof pdf>[0]).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${inv.id}.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Meine Rechnungen" – optionally only one contract (energy detail sheet). */
export function InvoiceList({ contract, limit }: { contract?: Invoice["contract"]; limit?: number }) {
  const { p } = usePortal();
  const [busy, setBusy] = useState<string | null>(null);
  const list = useMemo(() => (p ? invoicesOf(p.raw).filter((i) => !contract || i.contract === contract) : []), [p, contract]);
  if (!p) return null;
  if (!list.length) return <EmptyState title={T.empty.title} text={T.empty.text} className="rounded-[24px] bg-mg-surface" />;
  const get = async (inv: Invoice) => {
    setBusy(inv.id);
    try { await download(inv); } catch { toast.error(T.error); }
    setBusy(null);
  };
  return (
    <ul className="divide-y divide-mg-line border-y border-mg-line">
      {list.slice(0, limit).map((inv) => (
        <li key={inv.id} className="flex flex-wrap items-center gap-3 py-3">
          <FileText className="size-6 shrink-0 text-mg-navy" strokeWidth={STROKE} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{inv.title}</p>
            <p className="type-small text-mg-muted">{fmtDate(inv.periodFrom)} – {fmtDate(inv.periodTo)} · {inv.amount < 0 ? T.refund : T.amount} <span className="tabular-nums">{fmtNum(Math.abs(inv.amount), 2)} €</span></p>
          </div>
          <button type="button" onClick={() => get(inv)} disabled={busy === inv.id} aria-label={`${T.download}: ${inv.title}`}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 border-mg-navy px-4 text-[15px] font-semibold text-mg-navy hover:bg-mg-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue">
            <Download className="size-4" strokeWidth={STROKE} />{busy === inv.id ? T.preparing : T.download}
          </button>
        </li>
      ))}
    </ul>
  );
}
