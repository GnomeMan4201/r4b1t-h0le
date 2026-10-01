"""T1-01 / T1-14 (Python): terrain-index-v1 builder determinism, input gates, and registry classification."""
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
TOOL = ROOT / 'tools' / 'terrain_index.py'
RELEASE = ROOT / 'corpus' / 'releases' / 'diverse-candidate-v0.2'
INDEX = ROOT / 'corpus' / 'terrains' / 'diverse-candidate-v0.2' / 'terrain-index-v1.json'
REGISTRY = ROOT / 'corpus' / 'runtime' / 'eligibility-profiles-v1.json'
URLS_DIGEST = 'sha256:ba52be7e2fc9120f3bd1ac2a6bacbc61fc937764e6d4637df8711ec2212bf75c'
INDEX_DIGEST = 'sha256:a9bbe4fc56020314a11195c9339fa3a04a14082d6b2f6c259c78be6ee38af5fd'
COUNTS = {'advisory': 43, 'article': 11, 'dataset': 22, 'documentation': 1408, 'lab': 282,
          'paper': 895, 'reference': 871, 'repository': 470, 'research': 1584, 'security_tool': 206,
          'threat_feed': 6, 'training_resource': 12, 'writeup': 1049}


def run(*args):
    return subprocess.run([sys.executable, str(TOOL), *args], capture_output=True, text=True)


def sha(path):
    return 'sha256:' + hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()


class TerrainIndexBuild(unittest.TestCase):
    def test_t1_01_committed_index_regenerates_byte_identically(self):
        self.assertTrue(TOOL.exists(), 'tools/terrain_index.py is missing')
        result = run('check', '--release', str(RELEASE), '--index', str(INDEX))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_t1_01_pinned_digest_and_counts(self):
        self.assertEqual(sha(INDEX), INDEX_DIGEST)
        doc = json.loads(INDEX.read_text('utf-8'))
        self.assertEqual({t['id']: t['count'] for t in doc['terrains']}, COUNTS)
        self.assertEqual([t['id'] for t in doc['terrains']], sorted(COUNTS))
        self.assertEqual(sum(t['count'] for t in doc['terrains']), 6859)

    def test_t1_01_counts_equal_release_manifest_and_no_route_is_all_only(self):
        doc = json.loads(INDEX.read_text('utf-8'))
        manifest = json.loads((RELEASE / 'manifest.json').read_text('utf-8'))
        self.assertEqual({t['id']: t['count'] for t in doc['terrains']}, manifest['counts']['resource_types'])
        self.assertTrue(all(t['count'] >= 1 for t in doc['terrains']), 'every terrain has a nonzero population')
        members = sorted(i for t in doc['terrains'] for i in t['members'])
        self.assertEqual(members, list(range(manifest['counts']['resources'])),
                         'every route belongs to exactly one terrain; none is reachable only under ALL')

    def test_t1_01_build_output_is_deterministic(self):
        with tempfile.TemporaryDirectory() as tmp:
            a, b = pathlib.Path(tmp) / 'a.json', pathlib.Path(tmp) / 'b.json'
            for out in (a, b):
                result = run('build', '--release', str(RELEASE), '--out', str(out))
                self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(a.read_bytes(), b.read_bytes())
            self.assertEqual(a.read_bytes(), INDEX.read_bytes())

    def _release_copy(self, tmp):
        dest = pathlib.Path(tmp) / 'release'
        shutil.copytree(RELEASE, dest)
        return dest

    def _rewrite_manifest(self, release):
        manifest = json.loads((release / 'manifest.json').read_text())
        manifest['urls_digest'] = sha(release / 'urls.txt')
        manifest['resources_digest'] = sha(release / 'resources.json')
        (release / 'manifest.json').write_text(json.dumps(manifest))

    def test_rejects_release_digest_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            release = self._release_copy(tmp)
            (release / 'urls.txt').write_bytes((release / 'urls.txt').read_bytes() + b'https://example.org/x\n')
            result = run('build', '--release', str(release), '--out', str(pathlib.Path(tmp) / 'o.json'))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('RELEASE_DIGEST_MISMATCH', result.stderr)

    def test_rejects_non_canonical_urls(self):
        with tempfile.TemporaryDirectory() as tmp:
            release = self._release_copy(tmp)
            text = (release / 'urls.txt').read_text()
            (release / 'urls.txt').write_text(text.replace('\n', '\r\n', 1))
            self._rewrite_manifest(release)
            result = run('build', '--release', str(release), '--out', str(pathlib.Path(tmp) / 'o.json'))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('RELEASE_NOT_CANONICAL', result.stderr)

    def test_rejects_resource_order_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp:
            release = self._release_copy(tmp)
            doc = json.loads((release / 'resources.json').read_text())
            doc['resources'][0], doc['resources'][1] = doc['resources'][1], doc['resources'][0]
            (release / 'resources.json').write_text(json.dumps(doc))
            self._rewrite_manifest(release)
            result = run('build', '--release', str(release), '--out', str(pathlib.Path(tmp) / 'o.json'))
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('RESOURCE_ORDER_MISMATCH', result.stderr)

    def test_check_detects_tampered_index(self):
        with tempfile.TemporaryDirectory() as tmp:
            tampered = pathlib.Path(tmp) / 'index.json'
            doc = json.loads(INDEX.read_text())
            doc['terrains'][0]['members'] = doc['terrains'][0]['members'][1:]
            doc['terrains'][0]['count'] -= 1
            tampered.write_text(json.dumps(doc, separators=(',', ':'), sort_keys=True) + '\n')
            result = run('check', '--release', str(RELEASE), '--index', str(tampered))
            self.assertNotEqual(result.returncode, 0)


class RegistryClassification(unittest.TestCase):
    """T1-14: a digest declared in a trail is evidence of use; only the registry establishes authority.
    Classification binds the complete release: release_id + urls_digest + resources_digest."""

    RELEASE_ID = 'diverse-candidate-v0.2'
    RESOURCES_DIGEST = 'sha256:529a3bcf10b0933ce92428932035750ae0fe93f1490aaa1a40c1384d7ec57aca'

    def classify(self, index_digest, registry=REGISTRY, release_id=None, urls_digest=URLS_DIGEST, resources_digest=None):
        result = run('classify', '--registry', str(registry),
                     '--release-id', release_id or self.RELEASE_ID,
                     '--urls-digest', urls_digest,
                     '--resources-digest', resources_digest or self.RESOURCES_DIGEST,
                     '--index-digest', index_digest)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def test_t1_14_active_profile_is_authoritative(self):
        self.assertEqual(self.classify(INDEX_DIGEST), 'AUTHORITATIVE_ACTIVE')

    def test_t1_14_reproducible_but_unregistered_map_is_not_authoritative(self):
        self.assertEqual(self.classify('sha256:' + 'f' * 64), 'UNREGISTERED_MAP')

    def test_t1_14_unknown_release(self):
        self.assertEqual(self.classify(INDEX_DIGEST, urls_digest='sha256:' + '0' * 64), 'UNREGISTERED_RELEASE')

    def test_t1_14_same_urls_different_resources_is_a_different_release(self):
        self.assertEqual(self.classify(INDEX_DIGEST, resources_digest='sha256:' + '9' * 64), 'UNREGISTERED_RELEASE')

    def test_t1_14_same_digests_different_release_id_is_a_different_release(self):
        self.assertEqual(self.classify(INDEX_DIGEST, release_id='typed-candidate-v0.2'), 'UNREGISTERED_RELEASE')

    def test_t1_14_incomplete_binding_is_rejected(self):
        result = run('classify', '--registry', str(REGISTRY), '--release-id', self.RELEASE_ID,
                     '--urls-digest', URLS_DIGEST, '--resources-digest', 'not-a-digest', '--index-digest', INDEX_DIGEST)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('RELEASE_BINDING_INCOMPLETE', result.stderr)

    def test_t1_14_superseded_profile(self):
        registry = json.loads(REGISTRY.read_text())
        old = json.loads(json.dumps(registry['profiles'][0]))
        old['profile_id'] = 'diverse-candidate-v0.2/historical'
        old['status'] = 'superseded'
        old['terrain_index']['digest'] = 'sha256:' + 'e' * 64
        registry['profiles'].insert(0, old)
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp) / 'registry.json'
            path.write_text(json.dumps(registry))
            self.assertEqual(self.classify('sha256:' + 'e' * 64, path), 'AUTHORITATIVE_SUPERSEDED')
            self.assertEqual(self.classify(INDEX_DIGEST, path), 'AUTHORITATIVE_ACTIVE')

    def test_registry_record_invariants(self):
        registry = json.loads(REGISTRY.read_text())
        self.assertEqual(registry['schema'], 'r4b1t-eligibility-profiles-v1')
        ids = [p['profile_id'] for p in registry['profiles']]
        self.assertEqual(len(ids), len(set(ids)), 'profile_id must be unique')
        active_per_release = {}
        for p in registry['profiles']:
            self.assertEqual(set(p), {'profile_id', 'status', 'release', 'promotion_id', 'mapping', 'terrain_index'})
            self.assertIn(p['status'], ('active', 'superseded'))
            self.assertEqual(set(p['release']), {'release_id', 'urls_digest', 'resources_digest'})
            self.assertEqual(set(p['terrain_index']), {'path', 'schema', 'digest'})
            if p['status'] == 'active':
                key = (p['release']['release_id'], p['release']['urls_digest'], p['release']['resources_digest'])
                active_per_release[key] = active_per_release.get(key, 0) + 1
        self.assertTrue(all(n == 1 for n in active_per_release.values()), 'at most one active profile per release')

    def test_registry_binds_the_active_promotion(self):
        registry = json.loads(REGISTRY.read_text())
        promotion = json.loads((ROOT / 'corpus' / 'runtime' / 'active-v1.json').read_text())
        active = [p for p in registry['profiles'] if p['status'] == 'active' and p['release']['release_id'] == promotion['active']['release_id']]
        self.assertEqual(len(active), 1)
        self.assertEqual(active[0]['release']['urls_digest'], promotion['active']['expected_digest'])
        self.assertEqual(active[0]['promotion_id'], promotion['promotion_id'])
        self.assertEqual(active[0]['terrain_index']['digest'], sha(ROOT / active[0]['terrain_index']['path']))


if __name__ == '__main__':
    unittest.main()
