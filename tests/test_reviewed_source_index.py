from __future__ import annotations

import unittest
from unittest.mock import patch

from tools.reviewed_source_index import collect_index, compile_review, index_bytes
from tools.compile_eligibility import sha256_identifier
from tools.corpus_provenance import compile_provenance


class ReviewedSourceIndexTests(unittest.TestCase):
    def test_collection_is_non_authoritative_and_resolves_only_anchor_links(self):
        index = collect_index(
            b'<a href="/research/a">A</a><a href="/research/a">Again</a>'
            b'<a href="mailto:x@example.org">Mail</a>'
            b'<a href="https://user:secret@example.org/x">Credentials</a>'
            b'<img src="/logo.svg"><script>"https://example.org/not-a-link"</script>',
            source_url="https://example.org/archive", final_url="https://example.org/archive",
            extractor="html-anchors-v1",
        )
        self.assertFalse(index["selection_authority"])
        self.assertEqual(index["urls"], ["https://example.org/research/a"])

    def test_feed_reads_entry_links_and_never_guids_or_content_links(self):
        raw = b'''<rss><channel><link>https://example.org/</link><item>
          <link>https://example.org/research/one</link><guid>https://evil.org/guid</guid>
          <description>&lt;a href="https://evil.org/ad"&gt;Ad&lt;/a&gt;</description>
          </item></channel></rss>'''
        index = collect_index(raw, source_url="https://example.org/feed", final_url="https://example.org/feed", extractor="feed-entries-v1")
        self.assertEqual(index["urls"], ["https://example.org/research/one"])
        atom = b'''<feed xmlns="http://www.w3.org/2005/Atom"><entry>
          <link rel="self" href="https://example.org/api/1"/>
          <link rel="alternate" type="text/html" href="https://example.org/research/two"/>
          </entry></feed>'''
        index = collect_index(atom, source_url="https://example.org/feed", final_url="https://example.org/feed", extractor="feed-entries-v1")
        self.assertEqual(index["urls"], ["https://example.org/research/two"])

    def test_sitemap_index_is_not_a_resource_catalog(self):
        raw = b'<sitemapindex><sitemap><loc>https://example.org/posts.xml</loc></sitemap></sitemapindex>'
        with self.assertRaisesRegex(ValueError, "sitemap index"):
            collect_index(raw, source_url="https://example.org/sitemap.xml", final_url="https://example.org/sitemap.xml", extractor="sitemap-urls-v1")

    def review_fixture(self):
        index = collect_index(b'<a href="/research/a">A</a><a href="/about">About</a>',
                              source_url="https://example.org/archive", final_url="https://example.org/archive", extractor="html-anchors-v1")
        snapshot = index_bytes(index)
        review = {
            "schema": "r4b1t-reviewed-source-index-v1", "source_id": "example-research-v1",
            "corpus": "r4b1t-cybersecurity-v1", "snapshot_path": "corpus/indexes/example.json",
            "snapshot_digest": sha256_identifier(snapshot), "scope": "cybersecurity",
            "family": "independent_research", "rationale": "Reviewed security research archive entries.",
            "admissions": [{"url": "https://example.org/research/a", "resource_type": "research"}],
        }
        return review, snapshot

    def test_only_exact_reviewed_members_enter_provenance(self):
        review, snapshot = self.review_fixture()
        compiled = compile_review(review, snapshot)
        verified = compile_provenance(compiled["provenance"])
        self.assertEqual([r["url"] for r in verified["records"]], ["https://example.org/research/a"])
        self.assertEqual(compiled["counts"], {"collected": 2, "admitted": 1, "unreviewed": 1})
        self.assertEqual(verified["sources"][0]["kind"], "manual_review")
        self.assertEqual(verified["sources"][0]["sha256"], review["snapshot_digest"])

    def test_snapshot_tampering_fails_before_admission(self):
        review, snapshot = self.review_fixture()
        with self.assertRaisesRegex(ValueError, "digest mismatch"):
            compile_review(review, snapshot + b' ')

    def test_unobserved_url_and_duplicate_admission_fail_closed(self):
        review, snapshot = self.review_fixture()
        review["admissions"][0]["url"] = "https://example.org/invented"
        with self.assertRaisesRegex(ValueError, "not in collected index"):
            compile_review(review, snapshot)
        review, snapshot = self.review_fixture()
        review["admissions"].append(dict(review["admissions"][0]))
        with self.assertRaisesRegex(ValueError, "duplicate admission"):
            compile_review(review, snapshot)

    def test_unknown_fields_cannot_smuggle_weight_or_scope(self):
        review, snapshot = self.review_fixture()
        review["admissions"][0]["weight"] = 10
        with self.assertRaisesRegex(ValueError, "unsupported or missing fields"):
            compile_review(review, snapshot)

    def test_compilation_never_fetches_sources(self):
        review, snapshot = self.review_fixture()
        with patch("urllib.request.urlopen", side_effect=AssertionError("network used")):
            self.assertEqual(compile_review(review, snapshot)["counts"]["admitted"], 1)

    def test_xml_rejects_entity_declarations_and_html_masquerading_as_feed(self):
        for raw in [b'<!DOCTYPE feed [<!ENTITY x "expanded">]><feed>&x;</feed>', b'<html><body>Not a feed</body></html>']:
            with self.assertRaises(ValueError):
                collect_index(raw, source_url="https://example.org/feed", final_url="https://example.org/feed", extractor="feed-entries-v1")

    def test_namespaced_sitemap_collects_only_absolute_locations(self):
        raw = b'''<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.org/a</loc></url><url><loc>/invented-relative</loc></url>
          </urlset>'''
        index = collect_index(raw, source_url="https://example.org/sitemap.xml", final_url="https://example.org/sitemap.xml", extractor="sitemap-urls-v1")
        self.assertEqual(index["urls"], ["https://example.org/a"])

    def test_html_base_is_respected_after_source_redirect(self):
        index = collect_index(b'<base href="https://publisher.org/docs/"><a href="one">One</a>',
                              source_url="https://example.org/old", final_url="https://publisher.org/archive/", extractor="html-anchors-v1")
        self.assertEqual(index["urls"], ["https://publisher.org/docs/one"])

    def test_utf16_cannot_bypass_dtd_rejection(self):
        xml = '<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE rss [<!ENTITY route "https://example.org/research/a">]><rss><channel><item><link>&route;</link></item></channel></rss>'
        with self.assertRaisesRegex(ValueError, "XML declarations"):
            collect_index(xml.encode("utf-16"), source_url="https://example.org/feed", final_url="https://example.org/feed", extractor="feed-entries-v1")


if __name__ == "__main__":
    unittest.main()
