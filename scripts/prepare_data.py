"""Builds src/data/maingau.json from the MAINGAU Build Days mock dataset (synthetic).
Usage: python3 scripts/prepare_data.py [path/to/maingau_nba_mockdata.xlsx] [path/to/event_stream.jsonl]
Defaults: data/raw/. Needs pandas + openpyxl (e.g. .venv/bin/python scripts/prepare_data.py).
"""
import json, re, sys
import pandas as pd

xlsx = sys.argv[1] if len(sys.argv) > 1 else "data/raw/maingau_nba_mockdata.xlsx"
events_path = sys.argv[2] if len(sys.argv) > 2 else "data/raw/event_stream_2026-10-01.jsonl"
x = pd.read_excel(xlsx, sheet_name=None)
SNAP = pd.Timestamp("2026-09-30 23:59")

def ts(s): return pd.to_datetime(s, errors="coerce")
def n(v, d=None):
    if v is None or (isinstance(v, float) and pd.isna(v)): return d
    try:
        if pd.isna(v): return d
    except Exception: pass
    if hasattr(v, "item"): v = v.item()
    return v

cm = x["customer_master"].set_index("customer_id")
cv = x["customer_value"].set_index("customer_id")
en = x["energy_contracts"]; mo = x["mobile_contracts"]; au = x["autostrom_contracts"]
cs = x["charge_sessions"]; cs["started_at"] = ts(cs["started_at"])
so = x["shop_orders"]; hd = x["hems_devices"]; ht = x["hems_telemetry_daily"]
co = x["consent_status"]; si = x["service_interactions"]; si["created_at"] = ts(si["created_at"])
nb = x["nba_action_history"]; nb["decided_at"] = ts(nb["decided_at"])
ps = x["portal_sessions"]; ps["session_start"] = ts(ps["session_start"])
npf = x["newsletter_performance"]
ct = x["call_transcripts"]; ct["call_started_at"] = ts(ct["call_started_at"])
ht["date"] = ts(ht["date"])
cs["month"] = cs["started_at"].dt.strftime("%Y-%m")
# Tageszeit des Ladestarts: morgens 6–10, mittags 10–16, abends 16–22, nachts 22–6
cs["daytime"] = pd.cut(cs["started_at"].dt.hour, bins=[-1, 5, 9, 15, 21, 23], labels=["nachts", "morgens", "mittags", "abends", "nachts2"]).astype(str).replace("nachts2", "nachts")
so["order_created_at"] = ts(so["order_created_at"])

# ---------- Kommunikationsstil (Master-Prompt §6) ----------
# Rule-based, computed once here, never in the browser. Changes only HOW we write, never WHAT we offer.
# Du/Sie markers are the same regexes as deriveTone() in src/lib/engine.ts.
DU_RE = re.compile(r"\b(du|dir|dich|dein\w*|euch|habt|könnt)\b|\b(Hi|Hey|Hallo)\b|danke dir|tschüss", re.I)
SIE_RE = re.compile(r"\b(Sie|Ihnen|Ihr\w*)\b|Sehr geehrte|Mit freundlichen Grüßen|Guten Tag")
WARM_RE = re.compile(r"\b(Hi|Hey|Hallo|LG|VG|Super|danke dir|danke euch|tschüss)\b|!|[\U0001F300-\U0001FAFF]", re.I)
FORMAL_RE = re.compile(r"Sehr geehrte|Mit freundlichen Grüßen|Freundliche Grüße|Vielen Dank im Voraus|auf Wiederhören", re.I)
TECH_TERMS = ["kWh", "AC", "DC", "PV", "HEMS", "dynamisch", "Netzgebiet", "Netzbetreiber", "Wallbox", "Wärmepumpe",
              "Smart Meter", "Zählerausbau", "Einspeis", "Schlussrechnung", "Datenvolumen", "Roaming"]
TECH_RE = re.compile(r"\b(" + "|".join(re.escape(t) for t in TECH_TERMS) + r")", re.I)
ANGER_RE = re.compile(r"nervig|ärgerlich|unzumutbar|inakzeptabel|enttäuscht|bereits zweimal|schon wieder|seit zwei Wochen|ich erwarte|verärgert|dritte Mal", re.I)
# Grußformeln zählen nicht zur Länge – sonst wirkt jede förmliche Mail "ausführlich".
FORMULA_RE = re.compile(r"Sehr geehrte Damen und Herren,?|Mit freundlichen Grü(ß|ss)en|Freundliche Grü(ß|ss)e|Vielen Dank im Voraus\.?|"
                        r"Guten Tag[,.]?|\b(Hi|Hey|Hallo)( zusammen)?[,!]?|\b(LG|VG)\b|Danke( dir| euch)?[,!.]*( LG)?$", re.I)
SHORT_WORDS = 15          # Ø Wörter pro eigener Nachricht (ohne Grußformeln) darunter → "kurz"
TECH_MIN_HITS = 2         # ab so vielen Fachwörtern → "fachlich"
QUOTE_MAX = 160

def customer_lines(transcript):
    return [l.split(":", 1)[1].strip() for l in str(transcript).splitlines() if l.startswith("Kunde:")]

def style_of(texts, transcript_units, notes, open_complaint, recent_complaint, last_csat, profiling_ok, upset_flag=False):
    if not profiling_ok:
        return {"anrede": "sie", "laenge": "kurz", "ton": "sachlich", "fachwissen": "einfach", "stimmung": "neutral",
                "belege": [], "quelle": "Keine Analyse – keine Einwilligung zur Profilbildung", "status": "standard"}
    units = texts + transcript_units
    own = " ".join(units)
    du, sie = len(DU_RE.findall(own)), len(SIE_RE.findall(own))
    words = [len([w for w in FORMULA_RE.sub(" ", u).split() if re.search(r"\w", w)]) for u in units if u]
    avg = sum(words) / len(words) if words else 0
    warm, formal = len(WARM_RE.findall(own)), len(FORMAL_RE.findall(own))
    tech = len(TECH_RE.findall(own))
    angry = open_complaint or recent_complaint or upset_flag or (last_csat is not None and last_csat <= 2) \
        or bool(ANGER_RE.search(own)) or any(ANGER_RE.search(nt) for nt in notes)
    stimmung = "verärgert" if angry else "zufrieden" if (last_csat is not None and last_csat >= 4) else "neutral"
    quotes = []
    for u in reversed(units):  # newest first
        q = u if len(u) <= QUOTE_MAX else u[:QUOTE_MAX - 1].rstrip() + "…"
        if q and q not in quotes: quotes.append(q)
        if len(quotes) == 2: break
    parts = []
    if texts: parts.append(f"{len(texts)} {'Nachricht' if len(texts) == 1 else 'Nachrichten'}")
    if transcript_units: parts.append(f"{len(transcript_units)} {'Gesprächsprotokoll' if len(transcript_units) == 1 else 'Gesprächsprotokolle'}")
    if notes: parts.append(f"{len(notes)} {'Anrufnotiz' if len(notes) == 1 else 'Anrufnotizen'}")
    return {"anrede": "du" if du > sie else "sie",
            "laenge": "kurz" if (not words or avg < SHORT_WORDS) else "ausführlich",
            "ton": "herzlich" if warm > formal else "sachlich",
            "fachwissen": "fachlich" if tech >= TECH_MIN_HITS else "einfach",
            "stimmung": stimmung, "belege": quotes,
            "quelle": ", ".join(parts) if parts else "Keine eigenen Texte – neutrale Standardwerte",
            "status": "abgeleitet"}

events = [json.loads(l) for l in open(events_path)]
seen = set(); ev_by = {}
for e in events:
    if e["event_id"] in seen: continue
    seen.add(e["event_id"])
    ev_by.setdefault(e["customer_id"], []).append({"type": e["event_type"], "at": e["occurred_at"], "payload": e.get("payload", {})})
# call transcripts + agent feedback that arrive with today's stream
ev_transcripts, upset = {}, set()
for e in events:
    if e["event_type"] == "call_transcript_ready" and e["payload"].get("transcript"):
        ev_transcripts.setdefault(e["customer_id"], {})[e["payload"].get("ticket_id")] = e
    if e["event_type"] == "agent_nba_feedback" and e["payload"].get("dismiss_reason") == "customer_upset":
        upset.add(e["customer_id"])
# consent as of today (snapshot + event stream) – gates style + portal pages, like the engine's event replay
consent_today = {}
for e in sorted((e for e in events if e["event_type"] == "consent_changed"), key=lambda e: e["occurred_at"]):
    consent_today.setdefault(e["customer_id"], {})[e["payload"]["consent_type"]] = e["payload"]["new_status"]

customers = []
for cid, m in cm.iterrows():
    v = cv.loc[cid]
    e = en[en.customer_id == cid]
    elec = e[e.commodity == "electricity"].head(1)
    gas = e[e.commodity == "gas"].head(1)
    def energy(r):
        if r.empty: return None
        r = r.iloc[0]
        return {"tariff": r.tariff, "status": r.status, "kwh": n(r.annual_consumption_kwh, 0),
                "price": n(r.energy_price_eur_kwh, 0), "base": n(r.base_price_eur_month, 0),
                "installment": n(r.monthly_installment_eur, 0), "pgUntil": str(r.price_guarantee_until)[:10] if n(r.price_guarantee_until) else None,
                "meter": r.meter_type, "feedIn": bool(r.feed_in_meter), "dunning": int(n(r.dunning_level, 0)),
                "cancelled": n(r.cancellation_received_at) is not None,
                "noticeWeeks": n(r.notice_period_weeks), "paymentMethod": n(r.payment_method),
                "startDate": str(r.start_date)[:10] if n(r.start_date) else None,
                "lastMeterReadingAt": str(r.last_meter_reading_at)[:10] if n(r.last_meter_reading_at) else None}
    m_r = mo[(mo.customer_id == cid) & (mo.status == "active")].head(1)
    mobile = None if m_r.empty else {"plan": m_r.iloc[0].plan, "gb": int(m_r.iloc[0].data_volume_gb), "used": float(m_r.iloc[0].avg_data_used_gb_3m),
              "limitHits": int(m_r.iloc[0].data_limit_reached_3m), "sims": int(m_r.iloc[0].sim_count), "fee": float(m_r.iloc[0].monthly_fee_eur),
              "roamingDays3m": int(n(m_r.iloc[0].roaming_days_3m, 0)), "minTermEnd": str(m_r.iloc[0].min_term_end)[:10] if n(m_r.iloc[0].min_term_end) else None}
    a_r = au[(au.customer_id == cid) & (au.status == "active")].head(1)
    auto = None if a_r.empty else {"car": f"{a_r.iloc[0].car_brand} {a_r.iloc[0].car_model}", "battery": int(a_r.iloc[0].battery_kwh)}
    c = cs[cs.customer_id == cid]
    c30 = c[c.started_at >= SNAP - pd.Timedelta(days=30)]
    charging = None if c.empty else {"sessions": int(len(c)), "kwh": round(float(c.energy_kwh.sum()), 1),
        "spend": round(float(c.amount_eur.sum()), 2), "failed30d": int((c30.session_status == "failed").sum()),
        "failedTotal": int((c.session_status == "failed").sum()), "dcShare": round(float((c.charge_type == "DC").mean()), 2),
        "acCount": int((c.charge_type == "AC").sum()), "dcCount": int((c.charge_type == "DC").sum()),
        "byDaytime": {k: int((c.daytime == k).sum()) for k in ["morgens", "mittags", "abends", "nachts"]},
        "failedSessions": [{"at": str(r.started_at)[:16], "status": r.session_status, "reason": n(r.failure_reason), "city": n(r.location_city),
                            "type": r.charge_type} for r in c[c.session_status != "completed"].sort_values("started_at").tail(5).itertuples()]}
    devs = hd[hd.customer_id == cid]
    t = ht[ht.customer_id == cid]
    hems = None if devs.empty else {"devices": sorted(devs.device_type.unique().tolist()),
        "offline": bool((devs.connection_status != "online").any()),
        "pvDaily": round(float(t.pv_generation_kwh.mean()), 1) if not t.empty and t.pv_generation_kwh.notna().any() else 0,
        "selfConsumption": round(float(t.self_consumption_rate.mean()), 2) if not t.empty and t.self_consumption_rate.notna().any() else None,
        "heatPumpDaily": round(float(t.heat_pump_kwh.mean()), 1) if not t.empty and t.heat_pump_kwh.notna().any() else 0,
        "deviceList": [{"type": r.device_type, "manufacturer": n(r.manufacturer), "status": r.connection_status,
                        "lastSeen": str(r.last_seen_at)[:16] if n(r.last_seen_at) else None} for r in devs.itertuples()]}
    shop = so[(so.customer_id == cid) & (so.order_status != "returned")].product_name.unique().tolist()
    shop_orders = [{"id": r.order_id, "at": str(r.order_created_at)[:10], "product": r.product_name, "category": n(r.product_category),
                    "quantity": int(n(r.quantity, 1)), "valueEur": n(r.line_value_eur), "status": r.order_status}
                   for r in so[so.customer_id == cid].sort_values("order_created_at").itertuples()]
    cons = {r.consent_type: r.status for r in co[co.customer_id == cid].itertuples()}
    tk = si[si.customer_id == cid].sort_values("created_at")
    tk12 = tk[tk.created_at >= SNAP - pd.Timedelta(days=365)]
    open_t = tk[tk.status == "open"]
    last_csat = tk.csat_1to5.dropna()
    tickets = [{"id": r.ticket_id, "at": str(r.created_at)[:10], "channel": r.channel, "category": r.category, "status": r.status,
                "text": (n(r.message_text) or n(r.call_note) or "")[:220], "csat": n(r.csat_1to5),
                "callNote": n(r.call_note), "handlingCostEur": n(r.handling_cost_eur),
                "firstContactResolution": None if n(r.first_contact_resolution) is None else bool(r.first_contact_resolution),
                "resolutionCode": n(r.resolution_code), "goodwillEur": n(r.goodwill_eur), "repeatOf": n(r.repeat_of_ticket_id),
                "resolvedAt": str(r.resolved_at)[:16] if n(r.resolved_at) else None} for r in tk.tail(5).itertuples()]
    tr_c = ct[ct.customer_id == cid].sort_values("call_started_at")
    transcripts = [{"id": r.transcript_id, "ticketId": r.ticket_id, "at": str(r.call_started_at)[:16],
                    "durationS": int(r.duration_s), "text": r.transcript} for r in tr_c.itertuples()]
    known = {t["ticketId"] for t in transcripts}
    for tid, e in ev_transcripts.get(cid, {}).items():
        if tid in known: continue
        transcripts.append({"id": f"EV-{e['event_id'][:8]}", "ticketId": tid, "at": e["occurred_at"][:16],
                            "durationS": e["payload"].get("duration_s"), "text": e["payload"]["transcript"]})
    t_daily = ht[ht.customer_id == cid].sort_values("date")
    daily = [{"date": str(r.date)[:10], "household": n(r.household_consumption_kwh), "pv": n(r.pv_generation_kwh),
              "gridImport": n(r.grid_import_kwh), "gridExport": n(r.grid_export_kwh), "ev": n(r.ev_charging_kwh),
              "heatPump": n(r.heat_pump_kwh)} for r in t_daily.itertuples()]
    monthly = [{"month": mth, "kwh": round(float(g.energy_kwh.sum()), 1), "sessions": int(len(g)),
                "failed": int((g.session_status == "failed").sum()), "eur": round(float(g.amount_eur.sum()), 2)} for mth, g in c.groupby("month")] if not c.empty else []
    consumption = {"daily": daily, "chargingMonthly": monthly} if (daily or monthly) else None
    cons_now = {**cons, **consent_today.get(cid, {})}
    profiling_ok = cons_now.get("profiling_analytics") == "granted"
    pages = {}
    if profiling_ok:
        for pv in ps[ps.customer_id == cid].pages_viewed.dropna():
            for pg in str(pv).split("|"): pages[pg] = pages.get(pg, 0) + 1
    portal_pages = [{"page": k, "count": v} for k, v in sorted(pages.items(), key=lambda kv: -kv[1])[:5]]
    own_texts = [str(t) for t in tk.message_text.dropna()]
    transcript_units = [" ".join(customer_lines(t["text"])) for t in transcripts if customer_lines(t["text"])]
    notes = [str(t) for t in tk.call_note.dropna()]
    recent_complaint = bool(((tk.category == "complaint") & (tk.created_at >= SNAP - pd.Timedelta(days=90))).any())
    style = style_of(own_texts, transcript_units, notes, bool((open_t.category == "complaint").any()), recent_complaint,
                     n(last_csat.iloc[-1]) if len(last_csat) else None, profiling_ok, cid in upset)
    h = nb[nb.customer_id == cid]
    contacts30 = int((h.decided_at >= SNAP - pd.Timedelta(days=30)).sum())
    history = [{"at": str(r.decided_at)[:10], "offer": r.offer_id, "channel": r.channel, "response": r.response, "converted": bool(r.converted_within_14d)}
               for r in h.sort_values("decided_at").tail(6).itertuples()]
    p = ps[(ps.customer_id == cid) & (ps.session_start >= SNAP - pd.Timedelta(days=90))]
    customers.append({
        "id": cid, "since": str(m.customer_since)[:10], "birthYear": int(m.birth_year), "city": m.city,
        "household": int(m.household_size), "portal": bool(m.portal_account), "app": bool(m.app_installed),
        "clv": float(v.clv_eur), "margin": float(v.annual_margin_eur), "cts": float(v.cost_to_serve_12m_eur),
        "churn": float(v.churn_prob_12m), "churnDrivers": n(v.churn_drivers, ""), "serviceImpact": float(v.clv_service_impact_eur),
        "lines": int(v.active_business_lines),
        "electricity": energy(elec), "gas": energy(gas), "mobile": mobile, "autostrom": auto, "charging": charging,
        "hems": hems, "shop": shop, "consent": cons,
        "tickets12m": int(len(tk12)), "openTickets": int(len(open_t)), "openComplaint": bool((open_t.category == "complaint").any()),
        "lastCsat": n(last_csat.iloc[-1]) if len(last_csat) else None, "tickets": tickets,
        "contacts30d": contacts30, "history": history, "portalSessions90d": int(len(p)),
        "events": ev_by.get(cid, [])[:12],
        "transcripts": transcripts, "consumption": consumption, "portalPages": portal_pages, "style": style,
        "region": {"city": m.city, "postalPrefix": int(m.postal_code_prefix)}, "shopOrders": shop_orders,
    })

# acceptance priors: conversion rate per offer x channel (treatment group only)
tr = nb[~nb.control_group]
acc = {}
for (o, ch), g in tr.groupby(["offer_id", "channel"]):
    acc.setdefault(o, {})[ch] = round(float(g.converted_within_14d.mean()), 4)
offer_rate = {o: round(float(g.converted_within_14d.mean()), 4) for o, g in tr.groupby("offer_id")}
control_rate = round(float(nb[nb.control_group].converted_within_14d.mean()), 4)

camps = []
for r in x["newsletter_campaigns"].itertuples():
    g = npf[npf.campaign_id == r.campaign_id]
    camps.append({"id": r.campaign_id, "sent": str(r.sent_at)[:10], "subject": r.subject_line, "focus": r.product_focus,
                  "tone": r.tonality, "recipients": int(r.recipients), "opens": int(g.opened_at.notna().sum()),
                  "clicks": int(g.clicked_at.notna().sum()), "conversions": int(g.converted_within_7d.fillna(False).astype(bool).sum()),
                  "delivered": int(g.delivered.fillna(False).astype(bool).sum()), "unsubscribes": int(g.unsubscribed.fillna(False).astype(bool).sum()),
                  "channel": "newsletter_email"})

catalog = [{k: n(v) for k, v in r.items()} for r in x["product_catalog"].to_dict("records")]
assumptions = {r["parameter"]: float(r["value"]) for r in x["value_assumptions"].to_dict("records")}

# Reaktionen auf frühere Empfehlungen (nba_action_history) + Kontrollgruppe – beobachtet, kein kausaler Nachweis.
def reaction(g):
    return {"n": int(len(g)), "converted": int(g.converted_within_14d.fillna(False).astype(bool).sum()),
            "dismissed": int((g.response == "dismissed").sum()), "ignored": int((g.response == "ignored").sum()),
            "engaged": int(g.response.isin(["viewed", "clicked"]).sum())}
nba_stats = {"byChannel": {ch: reaction(g) for ch, g in nb[~nb.control_group].groupby("channel")},
             "treated": reaction(nb[~nb.control_group]), "control": reaction(nb[nb.control_group]),
             "clvMethod": str(cv.model_version.iloc[0])}

# Basis jeder Entlastungs-Schätzung im Service-Cockpit – nur Werte aus dem Datensatz.
service_stats = {"tickets": int(len(si)),
                 "firstContactResolutionRate": round(float(si.first_contact_resolution.astype(float).mean()), 4),
                 "avgHandlingCostEur": round(float(si.handling_cost_eur.mean()), 2),
                 "byCategory": {cat: {"tickets": int(len(g)), "avgHandlingCostEur": round(float(g.handling_cost_eur.mean()), 2),
                                      "firstContactResolutionRate": round(float(g.first_contact_resolution.astype(float).mean()), 4)}
                                for cat, g in si.groupby("category")}}

out = {"snapshot": "2026-09-30", "customers": customers, "catalog": catalog, "assumptions": assumptions,
       "acceptance": acc, "offerRate": offer_rate, "controlRate": control_rate, "campaigns": camps,
       "serviceStats": service_stats, "nbaStats": nba_stats}
json.dump(out, open("src/data/maingau.json", "w"), ensure_ascii=False, separators=(",", ":"), default=str)
print("customers", len(customers))
