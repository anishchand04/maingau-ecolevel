"""Fetches yearly weather per customer city from Open-Meteo (free, no API key) → src/data/weather.json.
Runs once, locally, with internet. The app never loads weather at runtime – the demo stays offline.

Per city, over the 12 months before the snapshot:
- global radiation (kWh/m²·a) – basis of the sun class; relevant for PV yield
- sunshine hours – raw value only: ERA5-based sunshine_duration is known to run high (≈ 3.000 h vs. ~1.700 h DWD)
- heating degree days (Gradtagzahl G20/15: Σ (20 °C − Tagesmittel) über alle Tage mit Tagesmittel < 15 °C)

Usage: python3 scripts/fetch_weather.py [path/to/maingau_nba_mockdata.xlsx]
"""
import json, sys, time, urllib.parse, urllib.request
import pandas as pd

xlsx = sys.argv[1] if len(sys.argv) > 1 else "data/raw/maingau_nba_mockdata.xlsx"
START, END = "2025-10-01", "2026-09-30"  # 12 months up to the data snapshot (30.09.2026)
GEO = "https://geocoding-api.open-meteo.com/v1/search"
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"


def get(url, params):
    q = f"{url}?{urllib.parse.urlencode(params)}"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(q, timeout=30) as r:
                return json.load(r)
        except Exception as e:  # network hiccup → retry, then give up loudly
            if attempt == 2:
                raise RuntimeError(f"Open-Meteo request failed: {q}") from e
            time.sleep(2)


def locate(city, prefix):
    """Geocode in Germany; prefer the hit whose postcodes start with the customer's postal prefix."""
    res = get(GEO, {"name": city, "count": 10, "language": "de", "countryCode": "DE"}).get("results", [])
    if not res:
        raise RuntimeError(f"city not found: {city}")
    match = [r for r in res if any(str(p).startswith(str(prefix)) for p in r.get("postcodes", []))]
    return (match or res)[0]


cm = pd.read_excel(xlsx, sheet_name="customer_master")
cities = cm.groupby("city").postal_code_prefix.agg(lambda s: s.mode().iloc[0]).to_dict()

out = {"period": {"from": START, "to": END}, "source": "Open-Meteo Historical Weather API (ERA5)",
       "heatingDegreeDays": "G20/15", "cities": {}}
for city, prefix in sorted(cities.items()):
    g = locate(city, prefix)
    d = get(ARCHIVE, {"latitude": g["latitude"], "longitude": g["longitude"], "start_date": START, "end_date": END,
                      "daily": "sunshine_duration,shortwave_radiation_sum,temperature_2m_mean", "timezone": "Europe/Berlin"})["daily"]
    sun = sum(s for s in d["sunshine_duration"] if s is not None) / 3600
    rad = sum(x for x in d["shortwave_radiation_sum"] if x is not None) / 3.6  # MJ/m² → kWh/m²
    temps = [t for t in d["temperature_2m_mean"] if t is not None]
    hdd = sum(20 - t for t in temps if t < 15)
    out["cities"][city] = {"lat": round(g["latitude"], 3), "lon": round(g["longitude"], 3), "geocoded": g.get("name"),
                           "radiationKwhM2": round(rad), "sunshineHoursRaw": round(sun), "heatingDegreeDays": round(hdd), "days": len(temps)}
    print(f"{city:14s} rad {rad:6.0f} kWh/m²  sun(raw) {sun:5.0f} h  HDD {hdd:6.0f}")
    time.sleep(0.5)

json.dump(out, open("src/data/weather.json", "w"), ensure_ascii=False, indent=1)
print("cities", len(out["cities"]))
