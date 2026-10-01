import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODE = ROOT / "experiments" / "verifiable-chance" / "public-roll.mjs"
PY_VERIFY = ROOT / "experiments" / "verifiable-chance" / "verify_public_roll.py"
BEACON = ROOT / "experiments" / "verifiable-chance" / "fixtures" / "quicknet-round-1000.json"


def run(*args: str, ok: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        list(args),
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if ok and result.returncode != 0:
        raise AssertionError(result.stderr or result.stdout)
    return result


class VerifiableChanceTests(unittest.TestCase):
    def test_quicknet_round_1000_signature_verifies_offline(self) -> None:
        result = run(sys.executable, str(PY_VERIFY), "self-test")
        report = json.loads(result.stdout)
        self.assertEqual(report["status"], "QUICKNET_VECTOR_VERIFIED")
        self.assertEqual(report["round"], 1000)
        self.assertEqual(
            report["scheme_id"],
            "bls-unchained-g1-rfc9380",
        )

    def test_python_full_verifier_accepts_node_generated_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            declaration = Path(tmp) / "declaration.json"
            receipt = Path(tmp) / "receipt.json"
            run(
                "node",
                str(NODE),
                "declare",
                "--round",
                "1000",
                "--terrain",
                "ALL",
                "--out",
                str(declaration),
            )
            run(
                "node",
                str(NODE),
                "receipt",
                "--declaration",
                str(declaration),
                "--beacon",
                str(BEACON),
                "--out",
                str(receipt),
            )
            result = run(sys.executable, str(PY_VERIFY), "verify", str(receipt))
            report = json.loads(result.stdout)
            artifact = json.loads(receipt.read_text(encoding="utf-8"))
            self.assertEqual(report["status"], "PUBLIC_ROLL_VERIFIED")
            self.assertEqual(report["claims"]["beacon_signature"], "PROVEN")
            self.assertEqual(report["claims"]["route_derivation"], "PROVEN")
            self.assertEqual(report["claims"]["non_cherry_picked"], "NOT_ESTABLISHED")
            self.assertEqual(report["route"], artifact["selection"]["route"])

    def test_bls_tamper_is_rejected_even_when_randomness_hash_is_recomputed(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            declaration = Path(tmp) / "declaration.json"
            receipt = Path(tmp) / "receipt.json"
            run("node", str(NODE), "declare", "--round", "1000", "--out", str(declaration))
            run(
                "node",
                str(NODE),
                "receipt",
                "--declaration",
                str(declaration),
                "--beacon",
                str(BEACON),
                "--out",
                str(receipt),
            )
            artifact = json.loads(receipt.read_text(encoding="utf-8"))
            signature = bytearray.fromhex(artifact["beacon"]["signature"])
            signature[-1] ^= 1
            artifact["beacon"]["signature"] = bytes(signature).hex()
            artifact["beacon"]["randomness"] = hashlib.sha256(bytes(signature)).hexdigest()
            receipt.write_text(json.dumps(artifact) + "\n", encoding="utf-8")

            result = run(
                sys.executable,
                str(PY_VERIFY),
                "verify",
                str(receipt),
                ok=False,
            )
            self.assertEqual(result.returncode, 1)
            failure = json.loads(result.stdout)
            self.assertEqual(failure["code"], "BEACON_SIGNATURE_INVALID")


if __name__ == "__main__":
    unittest.main()
