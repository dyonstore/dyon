#!/usr/bin/env python3
"""DYON §3 — generate country defaults + timezone→country map.

Writes three files from one hand-curated table (CLDR ICU 77, read 2026-10-29)
plus the system tz database:

  data/countries.json     canonical; also seeds SQLite country_defaults in §4
  assets/countries.json   client copy (added to the service-worker CORE list)
  js/tz-country.js         export const TZ_COUNTRY = {...}  from /usr/share/zoneinfo

Rules honoured here:
  - suggest_islamic_mode is a *suggestion only*; the client never auto-enables it.
  - resource links were HTTP-200 checked on 2026-10-29 (see TASKS.md §3); links
    that returned 403/timeout to the checker are intentionally left out.
  - currencies use ISO 4217 minor units (R-G03); LYD=3, XOF=0.

Run:  python3 scripts/build-countries.py
"""
import json, os, re, sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECKED = "2026-10-29"

# findahelpline.com has a country page for every seeded country (emergency/crisis).
def helpline(cc):
    return {"label_en": "Find a helpline", "label_ar": "ابحث عن خط مساعدة",
            "label_fr": "Trouver une ligne d'écoute",
            "url": f"https://findahelpline.com/countries/{cc.lower()}"}

# Per-country debt-advice links verified 200 on 2026-10-29 (TASKS.md §3).
DEBT = {
    "BE": [{"label_en": "Médiation de dettes", "label_ar": "الوساطة في الديون",
            "label_fr": "Médiation de dettes", "url": "https://www.mediationdedettes.be"}],
    "CH": [{"label_en": "Dettes Conseils Suisse", "label_ar": "استشارات الديون سويسرا",
            "label_fr": "Dettes Conseils Suisse", "url": "https://www.dettes.ch"}],
    "DE": [{"label_en": "Meine Schulden", "label_ar": "ديوني",
            "label_fr": "Meine Schulden", "url": "https://www.meine-schulden.de"},
           {"label_en": "Verbraucherzentrale — debt", "label_ar": "مركز المستهلك — الديون",
            "label_fr": "Verbraucherzentrale — dettes",
            "url": "https://www.verbraucherzentrale.de/wissen/geld-versicherungen/kredit-schulden-insolvenz"}],
    "GB": [{"label_en": "StepChange", "label_ar": "StepChange",
            "label_fr": "StepChange", "url": "https://www.stepchange.org"},
           {"label_en": "Citizens Advice — debt & money", "label_ar": "Citizens Advice — الديون والمال",
            "label_fr": "Citizens Advice — dettes & argent",
            "url": "https://www.citizensadvice.org.uk/debt-and-money/"}],
    "US": [{"label_en": "NFCC", "label_ar": "NFCC",
            "label_fr": "NFCC", "url": "https://www.nfcc.org/"},
           {"label_en": "CFPB — debt collection", "label_ar": "CFPB — تحصيل الديون",
            "label_fr": "CFPB — recouvrement de dettes",
            "url": "https://www.consumerfinance.gov/consumer-tools/debt-collection/"}],
}

# Each tuple:
#  cc: [locales], currency, minor, digits, cal_primary, cal_secondary,
#      week_start, first_day(1=Mon..7=Sun), date_format, {decimal,group},
#      suggest_islamic, zakat_note(bool→generic note), legal_variant
# CLDR fields (week start / date pattern / separators / default digits)
# read from ICU 77 on 2026-10-29 (TASKS.md §3).
T = {
 "TN": (["ar","fr"],"TND",3,"latn","gregory","islamic-umalqura","mon",1,"dd/MM/yyyy",",",".",True,"mena"),
 "DZ": (["ar","fr"],"DZD",2,"latn","gregory","islamic-umalqura","sat",6,"dd/MM/yyyy",",",".",True,"mena"),
 "MA": (["ar","fr"],"MAD",2,"latn","gregory","islamic-umalqura","mon",1,"dd/MM/yyyy",",",".",True,"mena"),
 "LY": (["ar"],"LYD",3,"latn","gregory","islamic-umalqura","sat",6,"dd/MM/yyyy",",",".",True,"mena"),
 "EG": (["ar"],"EGP",2,"arab","gregory","islamic-umalqura","sat",6,"dd/MM/yyyy",".",",",True,"mena"),
 "SA": (["ar"],"SAR",2,"arab","islamic-umalqura","gregory","sun",7,"dd/MM/yyyy",".",",",True,"gulf"),
 "AE": (["ar","en"],"AED",2,"latn","gregory","islamic-umalqura","mon",1,"dd/MM/yyyy",".",",",True,"gulf"),
 "QA": (["ar"],"QAR",2,"arab","gregory","islamic-umalqura","sat",6,"dd/MM/yyyy",".",",",True,"gulf"),
 "KW": (["ar"],"KWD",3,"arab","gregory","islamic-umalqura","sat",6,"dd/MM/yyyy",".",",",True,"gulf"),
 "JO": (["ar"],"JOD",3,"arab","gregory","islamic-umalqura","sat",6,"dd/MM/yyyy",".",",",True,"mena"),
 "LB": (["ar","fr"],"LBP",2,"arab","gregory","islamic-umalqura","mon",1,"dd/MM/yyyy",",",".",True,"mena"),
 "FR": (["fr"],"EUR",2,"latn","gregory","none","mon",1,"dd/MM/yyyy",",","\u202f",False,"eu"),
 "BE": (["fr"],"EUR",2,"latn","gregory","none","mon",1,"dd/MM/yyyy",",","\u202f",False,"eu"),
 "CH": (["fr","de","it"],"CHF",2,"latn","gregory","none","mon",1,"dd.MM.yyyy",".","\u2019",False,"eu"),
 "CA": (["en","fr"],"CAD",2,"latn","gregory","none","sun",7,"yyyy-MM-dd",".",",",False,"na"),
 "DE": (["de"],"EUR",2,"latn","gregory","none","mon",1,"dd.MM.yyyy",",",".",False,"eu"),
 "IT": (["it"],"EUR",2,"latn","gregory","none","mon",1,"dd/MM/yyyy",",",".",False,"eu"),
 "GB": (["en"],"GBP",2,"latn","gregory","none","mon",1,"dd/MM/yyyy",".",",",False,"uk"),
 "US": (["en"],"USD",2,"latn","gregory","none","sun",7,"MM/dd/yyyy",".",",",False,"na"),
 "TR": (["tr"],"TRY",2,"latn","gregory","none","mon",1,"dd.MM.yyyy",",",".",True,"tr"),
 "ID": (["id"],"IDR",2,"latn","gregory","islamic-umalqura","sun",7,"dd/MM/yyyy",",",".",True,"sea"),
 "MY": (["ms","en"],"MYR",2,"latn","gregory","islamic-umalqura","mon",1,"dd/MM/yyyy",".",",",True,"sea"),
 "PK": (["ur","en"],"PKR",2,"latn","gregory","islamic-umalqura","sun",7,"dd/MM/yyyy",".",",",True,"sa"),
 "SN": (["fr"],"XOF",0,"latn","gregory","islamic-umalqura","mon",1,"dd/MM/yyyy",",","\u202f",True,"waf"),
 "NG": (["en"],"NGN",2,"latn","gregory","islamic-umalqura","mon",1,"dd/MM/yyyy",".",",",True,"waf"),
}

ZAKAT_NOTE = {True: {
    "en": "Zakat is typically due at ~85 g of gold (nisab) held for a lunar year. DYON only reminds you; it is not a fatwa — confirm the current nisab with a qualified scholar.",
    "ar": "تجب الزكاة عادةً عند بلوغ النصاب (نحو ٨٥ غرامًا من الذهب) وحولان الحول. يذكّرك ديون فقط، وهذا ليس فتوى — تحقّق من النصاب الحالي مع أهل العلم.",
    "fr": "La zakat est généralement due au nisab (≈ 85 g d'or) détenu pendant une année lunaire. DYON ne fait que vous le rappeler ; ce n'est pas une fatwa — confirmez le nisab actuel auprès d'un savant qualifié.",
}}

def build_countries():
    out = {}
    for cc, v in T.items():
        (locales, cur, minor, digits, calp, cals, wk, fd, datef, dec, grp,
         islamic, legal) = v
        rec = {
            "code": cc,
            "locales": locales,
            "currency": cur,
            "minor_units": minor,
            "digits": digits,
            "calendar_primary": calp,
            "calendar_secondary": cals,
            "week_start": wk,
            "first_day": fd,
            "date_format": datef,
            "number_format": {"decimal": dec, "group": grp},
            "suggest_islamic_mode": islamic,
            "zakat_note": ZAKAT_NOTE[True] if islamic else None,
            "legal_variant": legal,
            "resources": {
                "emergency": [helpline(cc)],
                "debt_advice": DEBT.get(cc, []),
            },
            "checked_at": CHECKED,
        }
        out[cc] = rec
    return out

def build_tz_country():
    """zone.tab + backward links → IANA zone → ISO country."""
    m = {}
    zt = "/usr/share/zoneinfo/zone.tab"
    if os.path.exists(zt):
        for line in open(zt, encoding="utf-8"):
            line = line.rstrip("\n")
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) < 3:
                continue
            cc, coord, zone = parts[0], parts[1], parts[2]
            m[zone] = cc
    # A few widely-used aliases not always in zone.tab
    alias = {
        "Africa/Tunis": "TN", "Europe/Paris": "FR", "Asia/Riyadh": "SA",
        "Asia/Dubai": "AE", "Africa/Cairo": "EG", "Europe/London": "GB",
        "America/New_York": "US", "Europe/Istanbul": "TR", "Asia/Karachi": "PK",
        "Asia/Jakarta": "ID", "Asia/Kuala_Lumpur": "MY", "Africa/Dakar": "SN",
        "Africa/Lagos": "NG", "Europe/Zurich": "CH", "Europe/Brussels": "BE",
        "America/Toronto": "CA", "Europe/Berlin": "DE", "Europe/Rome": "IT",
        "Africa/Algiers": "DZ", "Africa/Casablanca": "MA", "Africa/Tripoli": "LY",
        "Asia/Qatar": "QA", "Asia/Kuwait": "KW", "Asia/Amman": "JO", "Asia/Beirut": "LB",
    }
    for k, vcc in alias.items():
        m.setdefault(k, vcc)
    return dict(sorted(m.items()))

def main():
    countries = build_countries()
    tz = build_tz_country()

    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)

    canonical = {"version": 1, "checked_at": CHECKED, "countries": countries}
    with open(os.path.join(ROOT, "data", "countries.json"), "w", encoding="utf-8") as f:
        json.dump(canonical, f, ensure_ascii=False, indent=2)
        f.write("\n")
    # Client copy identical shape (admin overrides in SQLite take precedence at runtime, §4/§10).
    with open(os.path.join(ROOT, "assets", "countries.json"), "w", encoding="utf-8") as f:
        json.dump(canonical, f, ensure_ascii=False, indent=2)
        f.write("\n")

    header = (
        "/* GENERATED by scripts/build-countries.py — do not edit by hand.\n"
        f"   IANA tz database → ISO 3166 country. Built {date.today().isoformat()}. */\n"
    )
    body = "export const TZ_COUNTRY = " + json.dumps(tz, ensure_ascii=False, indent=2) + ";\n"
    with open(os.path.join(ROOT, "js", "tz-country.js"), "w", encoding="utf-8") as f:
        f.write(header + body)

    print(f"countries: {len(countries)}  tz zones: {len(tz)}")
    missing = [c for c in ["TN","DZ","MA","LY","EG","SA","AE","QA","KW","JO","LB",
                           "FR","BE","CH","CA","DE","IT","GB","US","TR","ID","MY",
                           "PK","SN","NG"] if c not in countries]
    if missing:
        print("MISSING required seeds:", missing, file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
