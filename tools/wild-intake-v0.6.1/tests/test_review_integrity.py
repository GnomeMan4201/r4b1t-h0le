import csv
import importlib.util
import tempfile
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOOL = HERE.parent / "wild1000.py"
spec = importlib.util.spec_from_file_location("wild_v061", TOOL)
w = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = w
spec.loader.exec_module(w)


class DummyClassification:
    sha256 = "sha256:" + "2" * 64
    version = "resource-classification-v2.0-test"

    def problems(self, row):
        return []


def campaign(tmp):
    c = object.__new__(w.Campaign)
    c.dir = Path(tmp)
    c.sha256 = "sha256:" + "1" * 64
    c.classification = DummyClassification()
    return c


def row(c, **overrides):
    d = {k: "" for k in w.REVIEW_COLS}
    d.update({
        "site_key": "one.example",
        "campaign_manifest_sha256": c.sha256,
        "classification_sha256": c.classification.sha256,
        "classification_version": c.classification.version,
        "resource_type": "experiment",
        "primary_subject": "visual_art",
        "subjects": "visual_art",
        "reason": "long enough human reason for review",
    })
    d.update(overrides)
    return d


def write(path, rows):
    with open(path, "w", newline="") as fh:
        wr = csv.DictWriter(fh, fieldnames=w.REVIEW_COLS)
        wr.writeheader()
        wr.writerows(rows)


def expect_exit(fn, contains):
    try:
        fn()
    except SystemExit as e:
        assert contains in str(e), (contains, str(e))
        return
    raise AssertionError(f"expected SystemExit containing {contains!r}")


def test_duplicate_site_key_fails_closed():
    with tempfile.TemporaryDirectory() as td:
        c = campaign(td)
        write(c.path("review.csv"), [row(c), row(c, verdict="y")])
        expect_exit(c.load_review, "duplicate site_key")


def test_empty_site_key_fails_closed():
    with tempfile.TemporaryDirectory() as td:
        c = campaign(td)
        write(c.path("review.csv"), [row(c, site_key="")])
        expect_exit(c.load_review, "empty site_key")


def test_explicit_reject_verdicts():
    with tempfile.TemporaryDirectory() as td:
        c = campaign(td)
        for verdict in ("n", "no", "reject", "rejected", "0"):
            state, probs = w.review_state(row(c, verdict=verdict), DummyClassification())
            assert state == "REVIEW_REJECTED"
            assert probs == []


def test_explicit_accept_verdicts():
    with tempfile.TemporaryDirectory() as td:
        c = campaign(td)
        for verdict in ("y", "yes", "accept", "accepted", "1"):
            state, probs = w.review_state(row(c, verdict=verdict), DummyClassification())
            assert state == "CAMPAIGN_ACCEPTED"
            assert probs == []


def test_unknown_verdict_is_invalid():
    with tempfile.TemporaryDirectory() as td:
        c = campaign(td)
        for verdict in ("accpet", "maybe", "YESS"):
            state, probs = w.review_state(row(c, verdict=verdict), DummyClassification())
            assert state == "REVIEW_INVALID"
            assert probs == []


def test_blank_verdict_is_unreviewed():
    with tempfile.TemporaryDirectory() as td:
        c = campaign(td)
        state, probs = w.review_state(row(c, verdict=""), DummyClassification())
        assert state == "UNREVIEWED"
        assert probs == []


def test_invalid_verdict_is_accounted_in_source_ledger():
    with tempfile.TemporaryDirectory() as td:
        c = campaign(td)
        obs = {
            "one.example": {
                "status": w.LIVE,
                "site_key": "one.example",
                "lead_source_key": "source.example",
            }
        }
        ledger = w.source_ledger(obs, [row(c, verdict="accpet")], DummyClassification())
        assert ledger["source.example"]["review_invalid"] == 1
