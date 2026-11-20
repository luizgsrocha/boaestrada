import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from antt_registry_import import load_rows, make_sql, main


class ImportTests(unittest.TestCase):
    def sample(self):
        return (
            "concessionaria;praca_de_pedagio;rodovia;uf;km_m;municipal;sentido;situacao;data_da_inativacao;latitude;longitude\n"
            "Elovias;SIMÃO PEREIRA;BR-040;MG;831,000;Simão Pereira;Crescente;Ativo;2026-11-16;-22,0085;-43,2688\n"
        )

    def test_csv_schema_coordinates_and_status(self):
        rows = load_rows(self.sample(), "anttteste.csv")
        sql, issues = make_sql(rows, source_url="https://dados.antt.gov.br/dataset/praca-de-pedagio")
        self.assertIn("831.0", sql)
        self.assertIn("'unclassified'", sql)
        self.assertIn("-22.0085", sql)
        self.assertEqual(issues["active_with_inactivation_date"], 1)

    def test_json_wrapped(self):
        obj = {"result": {"records": [
            dict(concessionaria="X", praca_de_pedagio="P", rodovia="BR-040",
                 uf="MG", km_m=831, sentido="Crescente", situacao="Ativo",
                 latitude=-22, longitude=-43)
        ]}}
        self.assertEqual(len(load_rows(json.dumps(obj), "a.json")), 1)

    def test_unknown_schema_is_rejected(self):
        with self.assertRaises(ValueError):
            load_rows("praca,latitude\nx,-23\n", "a.csv")

    def test_cli_emits_valid_sql(self):
        migration = ROOT / "migrations" / "0001_freeflow_sources.sql"
        migration2 = ROOT / "migrations" / "0002_toll_registry_evidence.sql"
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            source = p / "source.csv"
            source.write_text(self.sample(), encoding="utf-8")
            result = main(["--input", str(source), "--output", str(p / "import.sql"), "--min-rows", "1"])
            self.assertEqual(result["rows"], 1)
            con = sqlite3.connect(":memory:")
            con.executescript(migration.read_text(encoding="utf-8"))
            con.executescript(migration2.read_text(encoding="utf-8"))
            contents = (p / "import.sql").read_text(encoding="utf-8")
            con.executescript(contents)
            self.assertEqual(con.execute(
                "SELECT classification FROM toll_registry_observations"
            ).fetchone()[0], "unclassified")
            con.executescript(contents)
            self.assertEqual(con.execute(
                "SELECT COUNT(*) FROM toll_registry_observations"
            ).fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main()
