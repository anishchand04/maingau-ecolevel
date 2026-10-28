// One guided self-service flow inside the chat: intro, facts, form, validation, confirmation.
import { useId, useState, type FormEvent } from "react";
import { FLOWS, SELF_SERVICE_TEXT, type Field, type FlowCtx, type FlowResult, type SelfServiceId, type Values } from "@/config/selfService";
import { PillButton } from "@/components/base/PillButton";
import { cn } from "@/lib/utils";

export function Facts({ rows }: { rows: [string, string][] }) {
  if (!rows.length) return null;
  return (
    <dl className="mt-3 divide-y divide-mg-line rounded-2xl bg-white px-4 type-small">
      {rows.map(([l, v]) => (
        <div key={l} className="flex justify-between gap-3 py-2">
          <dt className="text-mg-muted">{l}</dt><dd className="text-right font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FlowCard({ id, ctx, onDone, onCancel }: {
  id: SelfServiceId; ctx: FlowCtx; onDone: (r: FlowResult, v: Values) => void; onCancel: () => void;
}) {
  const flow = FLOWS[id];
  const fields = flow.fields(ctx);
  const [values, setValues] = useState<Values>(() => ({ ...Object.fromEntries(fields.map((f) => [f.id, ""])), ...(flow.defaults?.(ctx) ?? {}) }));
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const set = (k: string, v: string) => { setValues((x) => ({ ...x, [k]: v })); setError(null); };

  function submit(e: FormEvent) {
    e.preventDefault();
    const missing = fields.find((f) => !((f.kind === "text" || f.kind === "multi") && f.optional) && f.kind !== "multi" && !values[f.id]?.trim());
    if (missing) { setError(`${missing.label}: ${ctx.t(SELF_SERVICE_TEXT.required, SELF_SERVICE_TEXT.requiredSie)}`); return; }
    const err = flow.validate?.(values, ctx) ?? null;
    if (err) { setError(err); return; }
    onDone(flow.run(values, ctx), values);
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-[20px] bg-mg-surface p-4">
      <p>{flow.intro(ctx)}</p>
      <Facts rows={flow.facts?.(ctx) ?? []} />
      {fields.length > 0 && (
        <div className="mt-3 space-y-3">
          {fields.map((f) => <FieldInput key={f.id} f={f} id={`${uid}-${f.id}`} value={values[f.id] ?? ""} onChange={(v) => set(f.id, v)} />)}
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-xl border-2 border-mg-navy bg-white px-3 py-2 type-small font-semibold">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <PillButton type="submit" size="sm">{flow.confirm}</PillButton>
        <PillButton type="button" size="sm" variant="ghost" onClick={onCancel}>{SELF_SERVICE_TEXT.cancel}</PillButton>
      </div>
    </form>
  );
}

const inputCls = "min-h-12 w-full rounded-2xl border-2 border-mg-line bg-white px-4 text-[17px] text-mg-navy focus:border-mg-blue focus:outline-none";

function FieldInput({ f, id, value, onChange }: { f: Field; id: string; value: string; onChange: (v: string) => void }) {
  if (f.kind === "multi") {
    const sel = value ? value.split(",") : [];
    const toggle = (v: string) => onChange((sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]).join(","));
    return (
      <fieldset>
        <legend className="mb-1.5 type-small font-semibold">{f.label}</legend>
        <div className="flex flex-wrap gap-2">
          {f.options.map((o) => (
            <button key={o.value} type="button" role="checkbox" aria-checked={sel.includes(o.value)} onClick={() => toggle(o.value)}
              className={cn("min-h-11 cursor-pointer rounded-full border-2 px-4 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue",
                sel.includes(o.value) ? "border-mg-navy bg-mg-navy text-white" : "border-mg-line bg-white text-mg-navy hover:border-mg-navy")}>
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }
  if (f.kind === "choice") {
    return (
      <fieldset>
        <legend className="mb-1.5 type-small font-semibold">{f.label}</legend>
        <div className="flex flex-wrap gap-2">
          {f.options.map((o) => (
            <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
              className={cn("min-h-11 cursor-pointer rounded-full border-2 px-4 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mg-blue",
                value === o.value ? "border-mg-navy bg-mg-navy text-white" : "border-mg-line bg-white text-mg-navy hover:border-mg-navy")}>
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }
  const label = <label htmlFor={id} className="mb-1.5 block type-small font-semibold">{f.label}{f.kind === "text" && f.optional ? ` ${SELF_SERVICE_TEXT.optional}` : ""}</label>;
  if (f.kind === "text" && f.multiline) {
    return <div>{label}<textarea id={id} value={value} rows={3} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "py-3")} /></div>;
  }
  const type = f.kind === "number" ? "text" : f.kind === "date" ? "date" : f.kind === "email" ? "email" : f.kind === "tel" ? "tel" : "text";
  return (
    <div>
      {label}
      <div className="flex items-center gap-2">
        <input id={id} type={type} inputMode={f.kind === "number" ? "decimal" : undefined} value={value}
          placeholder={"placeholder" in f ? f.placeholder : undefined} autoComplete="off"
          onChange={(e) => onChange(e.target.value)} className={inputCls} />
        {f.kind === "number" && f.unit && <span className="shrink-0 type-small text-mg-muted">{f.unit}</span>}
      </div>
    </div>
  );
}
