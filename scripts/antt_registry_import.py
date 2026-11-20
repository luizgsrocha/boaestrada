#!/usr/bin/env python3
"""Gera SQL auditável da ANTT para o D1 de STAGING, sem atribuir Free Flow.

Uso:
 python scripts/antt_registry_import.py --input dados-antt.json --output antt_staging.sql
 python scripts/antt_registry_import.py --input https://dados.antt.gov.br/...csv --output antt_staging.sql

Exige a migração 0002_toll_registry_evidence.sql. Não modifica recursos remotos.
"""
import argparse
import csv
import hashlib
import io
import json
import re
import sys
import unicodedata
import urllib.request
from collections import Counter
from pathlib import Path

ANTT_DATASET = "https://dados.antt.gov.br/dataset/praca-de-pedagio"
SOURCE_ID = "antt_open_data"
REQUIRED = {"concessionaria", "praca_de_pedagio", "rodovia", "uf", "km_m", "sentido", "situacao"}
COLUMNS = (
    "id", "source_id", "source_row_key", "name", "road", "state", "municipality",
    "kilometer", "kilometer_raw", "direction", "concessionaire", "status_reported",
    "classification", "latitude", "longitude", "coordinate_quality", "source_url",
    "source_updated_at", "raw_json",
)


def sql_quote(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def read_data(path_or_url):
    if path_or_url.startswith(("https://", "http://")):
        if not path_or_url.startswith("https://dados.antt.gov.br/"):
            raise ValueError("URL externa rejeitada: somente dados.antt.gov.br é permitido")
        request = urllib.request.Request(path_or_url, headers={
            "Accept": "application/json,text/csv,text/plain",
            "User-Agent": "BoaEstrada-data-validation/0.1 (https://github.com/luizgsrocha/boaestrada)",
        })
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = response.read(5_000_001)
    else:
        payload = Path(path_or_url).read_bytes()
    if len(payload) > 5_000_000:
        raise ValueError("Fonte maior que 5 MB; revisar manualmente antes de importar")
    for codec in ("utf-8-sig", "cp1252"):
        try:
            return payload.decode(codec), payload
        except UnicodeDecodeError:
            continue
    raise ValueError("Codificação não reconhecida")


def record_list(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("data", "records", "result", "items", "features"):
            if key in data:
                found = record_list(data[key])
                if found is not None:
                    return found
    return None


def load_rows(text, source):
    if source.lower().split("?")[0].endswith(".json") or text.lstrip().startswith(("[", "{")):
        records = record_list(json.loads(text))
    else:
        reader = csv.DictReader(io.StringIO(text), delimiter=";" if text.splitlines()[0].count(";") > text.splitlines()[0].count(",") else ",")
        records = list(reader)
    if not isinstance(records, list) or not records or not all(isinstance(r, dict) for r in records):
        raise ValueError("Formato ANTT inesperado: não foi encontrada lista de objetos")
    normalized = []
    for original in records:
        row = original.get("properties", original)
        if not isinstance(row, dict):
            raise ValueError("Objeto com propriedades inválidas")
        normalized.append((original, {str(k).strip().lower(): v for k, v in row.items()}))
    missing = REQUIRED - set(normalized[0][1].keys())
    if missing:
        raise ValueError("Esquema ANTT mudou; campos ausentes: " + ", ".join(sorted(missing)))
    return normalized


def decimal(value):
    raw = str(value or "").strip()
    if not re.fullmatch(r"[0-9]+([.,][0-9]+)?", raw):
        return None
    return float(raw.replace(",", "."))


def coordinate(value, lo, hi):
    raw = str(value if value is not None else "").strip().replace(",", ".")
    try:
        num = float(raw)
    except ValueError:
        return None
    return num if lo <= num <= hi else None


def normalize_state(state):
    return unicodedata.normalize("NFKC", str(state or "")).strip().upper()


def make_sql(records, *, source_url, updated_at=None):
    source = "INSERT OR IGNORE INTO ff_sources(id,name,url,authority,license,last_checked_at) VALUES(" + ",".join(map(sql_quote, [
        SOURCE_ID, "ANTT: Cadastro de Praças de Pedágio (bruto)", ANTT_DATASET, "official", "CC BY", None,
    ])) + ");"
    statements = [source]
    duplicates = Counter()
    review = Counter()
    for original, item in records:
        road = normalize_state(item.get("rodovia"))
        uf = normalize_state(item.get("uf"))
        km_raw = str(item.get("km_m") or "").strip()
        km = decimal(km_raw)
        name = str(item.get("praca_de_pedagio") or "").strip()
        concession = str(item.get("concessionaria") or "").strip()
        direction = str(item.get("sentido") or "").strip()
        key = "|".join((concession, name, road, uf, km_raw, direction))
        duplicates[key] += 1
        if duplicates[key] > 1:
            key += "|duplicado-" + str(duplicates[key])
            review["duplicate_identity"] += 1
        lat = coordinate(item.get("latitude"), -35, 6)
        lon = coordinate(item.get("longitude"), -75, -30)
        quality = "reported" if lat is not None and lon is not None else "missing"
        if quality == "missing":
            review["missing_or_out_of_brazil_coordinates"] += 1
            lat = lon = None
        if km is None:
            review["unparseable_km"] += 1
        if str(item.get("data_da_inativacao") or "").strip() and "ativ" in str(item.get("situacao") or "").lower():
            review["active_with_inactivation_date"] += 1
        ident = SOURCE_ID + ":" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]
        values = [ident, SOURCE_ID, key, name, road, uf, item.get("municipal") or item.get("municipio"), km,
                  km_raw, direction, concession, item.get("situacao"), "unclassified", lat, lon, quality,
                  source_url, updated_at, json.dumps(original, ensure_ascii=False, sort_keys=True)]
        statements.append("INSERT INTO toll_registry_observations(" + ",".join(COLUMNS) + ") VALUES(" +
                          ",".join(map(sql_quote, values)) + ") ON CONFLICT(id) DO UPDATE SET " +
                          ",".join(f"{column}=excluded.{column}" for column in COLUMNS[3:]) + ";")
    statements.append("UPDATE ff_sources SET last_checked_at=CURRENT_TIMESTAMP WHERE id='antt_open_data';")
    statements.append(f"INSERT INTO ff_import_runs(source_id,rows_imported,success,finished_at) VALUES('antt_open_data',{len(records)},1,CURRENT_TIMESTAMP);")
    return "\n".join(statements) + "\n", dict(review)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="JSON/CSV baixado da ANTT ou URL direta oficial")
    parser.add_argument("--output", required=True, help="Arquivo SQL para revisão e execução no D1 de staging")
    parser.add_argument("--audit", help="Arquivo JSON de auditoria")
    parser.add_argument("--updated-at", help="Data publicada na origem (ISO); não inferir")
    parser.add_argument("--min-rows", type=int, default=50, help="Protege contra resposta parcial (padrão 50)")
    args = parser.parse_args(argv)
    text, raw = read_data(args.input)
    rows = load_rows(text, args.input)
    if len(rows) < args.min_rows:
        raise ValueError(f"Fonte com apenas {len(rows)} registros, mínimo esperado {args.min_rows}")
    sql, reviews = make_sql(rows, source_url=args.input if args.input.startswith("https://") else ANTT_DATASET, updated_at=args.updated_at)
    audit = {"source": ANTT_DATASET, "sha256": hashlib.sha256(raw).hexdigest(),
             "rows": len(rows), "classification": "unclassified", "issues": reviews,
             "remote_d1_modified": False, "verified_free_flow": 0}
    Path(args.output).write_text(sql, encoding="utf-8")
    if args.audit:
        Path(args.audit).write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False))
    return audit


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Falha segura na importação ANTT: {exc}", file=sys.stderr)
        sys.exit(1)
