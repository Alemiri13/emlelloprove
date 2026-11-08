"""Genera l'SQL di seed per Supabase a partire dall'export dell'artifact originale.

Uso:  python3 scripts/seed_from_export.py <cartella cia-gestionale> > seed.sql

I dati contengono CF e nominativi reali: l'SQL generato NON va committato.
Prende un sottoinsieme ridotto di aziende (quelle con domande nel file di esempio
più alcune altre), le divide tra i tre uffici e aggiunge colture/superfici indicative.
"""
import json, sys, random, hashlib, datetime
from pathlib import Path
import openpyxl

base = Path(sys.argv[1])
aziende = json.load(open(base / "data/aziende.json"))
bandi = json.load(open(base / "data/bandi.json"))
dom_real = json.load(open(base / "data/domande.json"))

def q(v):
    if v is None or v == "":
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (datetime.date, datetime.datetime)):
        return "'" + v.strftime("%Y-%m-%d") + "'"
    return "'" + str(v).replace("'", "''") + "'"

def arr(lst):
    return "array[" + ",".join(q(x) for x in lst) + "]::text[]" if lst else "'{}'::text[]"

# ---- decodifica CF ----
OMO = {c: str(i) for i, c in enumerate("LMNPQRSTUV")}
MESI = "ABCDEHLMPRST"
def cf_info(cf):
    if len(cf) != 16:
        return None, None
    s = list(cf)
    for i in (6, 7, 9, 10, 12, 13, 14):
        if s[i] in OMO: s[i] = OMO[s[i]]
    cf = "".join(s)
    try:
        yy = int(cf[6:8]); mm = MESI.index(cf[8]) + 1; dd = int(cf[9:11])
    except Exception:
        return None, None
    sesso = "F" if dd > 40 else "M"
    if dd > 40: dd -= 40
    year = 1900 + yy if yy > 26 else 2000 + yy
    try:
        return datetime.date(year, mm, dd), sesso
    except ValueError:
        return None, sesso

BELFIORE = {"I520": "Scerni", "A485": "Atessa", "B865": "Casalbordino", "E372": "Vasto",
            "G799": "Pollutri", "E435": "Lanciano", "L961": "Villalfonsina", "L218": "Torino di Sangro",
            "D209": "Cupello", "E052": "Gissi", "D823": "Furci", "G237": "Paglieta",
            "C632": "Chieti", "D738": "Fossacesia", "I148": "San Salvo"}
UFFICIO_DA_CODICE = {
    "I520": "scerni", "L961": "scerni", "B865": "scerni", "L218": "scerni", "D738": "scerni", "G237": "scerni",
    "E372": "vasto", "G799": "vasto", "E435": "vasto", "C632": "vasto",
    "A485": "san-salvo", "D209": "san-salvo", "E052": "san-salvo", "D823": "san-salvo", "I148": "san-salvo",
}

# ---- domande dal file di esempio ----
wb = openpyxl.load_workbook(base / "data/excel/esempio_import_cia.xlsx", read_only=True)
rows = list(wb["Domande"].iter_rows(values_only=True))[1:]
rows = [r for r in rows if r[0] and r[0] in aziende]
sel = []
for r in rows:
    if r[0] not in sel: sel.append(r[0])
# aggiungo società e qualche altra azienda senza domande
extra = [k for k in aziende if len(k) == 11] + sorted(k for k in aziende if k not in sel)[::25]
for k in extra:
    if k not in sel: sel.append(k)

rnd = random.Random(42)
def ufficio(cf):
    u = UFFICIO_DA_CODICE.get(cf[11:15]) if len(cf) == 16 else None
    if not u:
        u = ["scerni", "san-salvo", "vasto"][int(hashlib.md5(cf.encode()).hexdigest(), 16) % 3]
    return u

out = []
out.append("begin;")
out.append("alter table public.domande disable trigger domande_storico;")
out.append("alter table public.aziende disable trigger aziende_storico;")
out.append("alter table public.azienda_colture disable trigger azienda_colture_storico;")

# ---- colture ----
COLTURE = [("Olivo", "Arboree", "#7A9A3A"), ("Vite da vino", "Arboree", "#8E3B5B"), ("Vite da tavola", "Arboree", "#B65E86"),
           ("Grano duro", "Seminativi", "#D9A93B"), ("Grano tenero", "Seminativi", "#E3BE62"), ("Orzo", "Seminativi", "#C99A4A"),
           ("Avena", "Seminativi", "#BFA06A"), ("Mais", "Seminativi", "#E8C33A"), ("Girasole", "Seminativi", "#F2B705"),
           ("Erba medica", "Foraggere", "#4E9A5B"), ("Prato pascolo", "Foraggere", "#6DB36F"),
           ("Pomodoro da industria", "Orticole", "#D9483B"), ("Ortive in pieno campo", "Orticole", "#E07A3F"),
           ("Ortive in serra", "Orticole", "#C9643A"), ("Pesco", "Arboree", "#EE8F6B"), ("Mandorlo", "Arboree", "#B79A7A"),
           ("Noce", "Arboree", "#8A6A4A"), ("Leguminose da granella", "Seminativi", "#9AAE4A"), ("Vivaio", "Vivai e fiori", "#3E8E7E")]
out.append("insert into public.colture (nome, categoria, colore) values " +
           ",".join(f"({q(n)},{q(c)},{q(col)})" for n, c, col in COLTURE) + ";")

# ---- pratiche ----
EXTRA = {"du2026": dict(scadenza="2026-05-15", quota=40, ordine=1), "uma2026": dict(scadenza=None, quota=25, ordine=2),
         "dichiarazioni-di-vendemmia": dict(scadenza="2026-12-15", quota=None, ordine=3),
         "rimborso-gasolio": dict(scadenza=None, quota=None, ordine=4),
         "sre01": dict(scadenza="2026-12-15", quota=150, ordine=5), "sra29": dict(scadenza="2027-01-31", quota=None, ordine=6)}
for pid, b in bandi.items():
    e = EXTRA.get(pid, {})
    crit = dict(b.get("criteri") or {}); crit["colture"] = []
    out.append("insert into public.pratiche (id,codice,nome,categoria,ente,campagna,unita,ha_contributo,apertura,scadenza,quota_default,motivi_tipici,criteri,esempio,attivo,note,ordine) values (" +
               ",".join([q(pid), q(b.get("codice")), q(b["nome"]), q(b.get("categoria", "annuale")), q(b.get("ente")), q(b.get("campagna")),
                         q(b.get("unita", "euro")), q(bool(b.get("haContributo", True))), q(b.get("apertura")),
                         q(b.get("scadenza") or e.get("scadenza")), q(e.get("quota")), arr(b.get("motiviTipici") or []),
                         q(json.dumps(crit)) + "::jsonb", q(bool(b.get("esempio"))), q(bool(b.get("attivo", True))), q(b.get("note")),
                         q(e.get("ordine", 9))]) + ");")

# ---- aziende ----
uma_set = {r[0] for r in rows if r[2] == "UMA2026"}
AZ, AC, DM = [], [], []
for cf in sel:
    nasc, sesso = cf_info(cf)
    comune = BELFIORE.get(cf[11:15]) if len(cf) == 16 else None
    r2 = random.Random(cf)
    sau = round(r2.uniform(1.2, 9) if len(cf) == 16 else r2.uniform(25, 120), 2)
    if r2.random() < 0.25: sau = round(sau * 2.5, 2)
    bio = r2.random() < 0.18
    iap = r2.random() < 0.45 or len(cf) == 11
    uma = cf in uma_set or r2.random() < 0.3
    AZ.append("(" + ",".join([q(ufficio(cf)), q(cf), q(aziende[cf]["denominazione"].strip()), q(nasc), q(sesso), q(comune),
                         q(sau), q(bio), q(iap), q(uma)]) + ")")
    # colture tipiche del territorio
    pool = ["Olivo"] * 6 + ["Vite da vino"] * 5 + ["Grano duro"] * 4 + ["Ortive in pieno campo"] * 2 + \
           ["Erba medica", "Orzo", "Pomodoro da industria", "Pesco", "Mandorlo", "Girasole", "Vite da tavola", "Leguminose da granella"]
    n = 1 + (r2.random() < 0.65) + (r2.random() < 0.35)
    scelte = []
    while len(scelte) < n:
        c = r2.choice(pool)
        if c not in scelte: scelte.append(c)
    pesi = [r2.uniform(0.5, 1.5) for _ in scelte]; tot = sum(pesi)
    for c, w in zip(scelte, pesi):
        AC.append(f"({q(cf)},{q(c)},{round(sau * w / tot, 2)})")

# ---- domande ----
ST = {"Rilasciata": "R", "Stampata": "S", "In compilazione": "C"}
ES = {"Ammessa": "A", "Ammessa in parte": "P", "Non ammessa": "X", "In istruttoria": "I", None: "I"}
for r in rows:
    cf, _, bando, stato, num, data, esito, motivo, desito, ric, amm, pag, dpag, litri, quota, qinc = r[:16]
    pid = bando.lower()
    if pid not in bandi: continue
    mot = [m.strip() for m in (motivo or "").split(";") if m.strip()]
    if ES.get(esito) == "X" and not mot:
        mot = [bandi[pid]["motiviTipici"][hash(cf) % 3]]
    DM.append("(" + ",".join([q(cf), q(pid), q(ST.get(stato, "C")), q(num), q(data) + "::date", q(ES.get(esito, "I")), arr(mot), q(desito) + "::date", q(ric) + "::numeric", q(amm) + "::numeric", q(pag) + "::numeric", q(dpag) + "::date",
                         q(litri) + "::int", q(quota) + "::numeric", q(str(qinc).upper() == "SI")]) + ")")
out.append("insert into public.aziende (ufficio_id,cuaa,denominazione,data_nascita,sesso,comune,sau_ha,biologico,iap,uma) values\n" + ",\n".join(AZ) + ";")
out.append("insert into public.azienda_colture (azienda_id,coltura_id,superficie_ha) select a.id,c.id,v.ha from (values\n" + ",\n".join(AC) + ") v(cuaa,coltura,ha) join public.aziende a on a.cuaa=v.cuaa join public.colture c on c.nome=v.coltura;")
out.append("insert into public.domande (azienda_id,pratica_id,stato,numero,data_presentazione,esito,motivi,data_esito,importo_richiesto,importo_ammesso,importo_pagato,data_pagamento,litri_assegnati,quota_importo,quota_incassata) select a.id,v.p,v.s,v.n,v.d,v.e,v.m,v.de,v.ir,v.ia,v.ip,v.dp,v.l,v.qi,v.qc from (values\n" + ",\n".join(DM) + ") v(cuaa,p,s,n,d,e,m,de,ir,ia,ip,dp,l,qi,qc) join public.aziende a on a.cuaa=v.cuaa on conflict (azienda_id,pratica_id) do nothing;")
for pid, d in dom_real.items():
    for cf, rec in d.get("stati", {}).items():
        out.append(f"insert into public.domande (azienda_id,pratica_id,stato) select a.id,{q(pid)},{q(rec.get('s','C'))} from public.aziende a where a.cuaa={q(cf)} on conflict (azienda_id,pratica_id) do update set stato=excluded.stato;")

# inclusioni manuali d'esempio: SRE01 per le aziende che hanno già domanda (restano comunque abbinate)
out.append("alter table public.domande enable trigger domande_storico;")
out.append("alter table public.aziende enable trigger aziende_storico;")
out.append("alter table public.azienda_colture enable trigger azienda_colture_storico;")
out.append("insert into public.storico (azienda_id, testo, utente, created_at) select id, 'Azienda importata dall''elenco del 29/10/2026', 'sistema', '2026-10-29 12:00' from public.aziende;")
out.append("commit;")
print("\n".join(out))
