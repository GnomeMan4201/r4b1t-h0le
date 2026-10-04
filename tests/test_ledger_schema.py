import unittest

from corpus.ledger.schema.serialization import serialize, parse, digest, timestamp, sorted_collection
from corpus.ledger.schema.events import validate_event, EVENT_SCHEMA, GENESIS_PREV, event_hash

class LedgerSerializationTests(unittest.TestCase):
    def test_cj1_bytes_and_domains(self):
        self.assertEqual(serialize({'z': '☃\u2028', 'a': [1, True, None]}), '{"a":[1,true,null],"z":"☃\u2028"}')
        self.assertNotEqual(digest('event', {}), digest('projection', {}))
        self.assertEqual(sorted_collection(['z', 'a']), ['a', 'z'])
        with self.assertRaises(ValueError): sorted_collection(['a', 'a'])

    def test_noncanonical_and_profile_rejection(self):
        for raw in ['{"b":1,"a":2}', '{"a":1,"a":1}', '{"a":1.0}', '{"a":-0}', '{"a":1e0}', '{ "a":1}', '{"a":9007199254740992}']:
            with self.subTest(raw=raw), self.assertRaises(ValueError): parse(raw)
        for value in [1.5, {'a': float('inf')}, {'a': '\ud800'}, {'a-b': 1}]:
            with self.assertRaises(ValueError): serialize(value)

    def test_timestamp_fixed_precision_and_valid_date(self):
        self.assertEqual(timestamp('2024-02-29T23:59:59.123Z'), '2024-02-29T23:59:59.123Z')
        for value in ['2026-02-29T00:00:00.000Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000+00:00', '2026-01-01T00:00:60.000Z']:
            with self.assertRaises(ValueError): timestamp(value)

    def test_event_registry_fails_closed(self):
        event = dict(schema=EVENT_SCHEMA, seq=2, prev=GENESIS_PREV, timestamp='2026-10-04T00:00:00.000Z', type='RESOURCE_CREATED', resource_id='r4b1t:r:000000000000002', payload={'url':'https://example.org/','metadata':{}})
        event['hash'] = event_hash(event)
        validate_event(event)
        for key, value in [('type','UNKNOWN'), ('seq',1.5), ('hash','bad'), ('resource_id','r4b1t:r:2')]:
            bad = dict(event, **{key:value})
            with self.assertRaises(ValueError): validate_event(bad)
        with self.assertRaises(ValueError): validate_event(dict(event, payload={'url':'https://example.org/', 'discovered_at':'1900-01-01'}))

    def test_schema_review_negatives(self):
        from corpus.ledger.schema.events import validate_payload
        cases = [('unicode_timestamp',lambda: timestamp('٢٠٢٦-١٠-٠٤T٠٠:٠٠:٠٠.٠٠٠Z'))]
        for target in ['https://[/', 'https://example.org:99999/', 'https://user:pass@example.org/']:
            cases.append((target,lambda target=target:validate_payload('RESOURCE_CREATED', {'url':target,'metadata':{}})))
        for kind in ['POLICY_BOUND','RELEASE_BOUND']:
            for artifact in [{},[]]:
                cases.append((kind+str(artifact),lambda kind=kind,artifact=artifact:validate_payload(kind,{'artifact':artifact,'artifact_hash':digest('policy' if kind=='POLICY_BOUND' else 'manifest',artifact)})))
        for first,second,declared in [(1,2,3),(1,1,1),(1,2,2)]:
            cases.append(('merge'+str((first,second,declared)),lambda first=first,second=second,declared=declared:validate_payload('RESOURCE_MERGED',dict(first=f'r4b1t:r:{first:015d}',second=f'r4b1t:r:{second:015d}',survivor=f'r4b1t:r:{declared:015d}',evidence_digest=GENESIS_PREV))))
        for name,call in cases:
            with self.subTest(name=name),self.assertRaises(ValueError): call()

    def test_valid_ipv6_observation(self):
        from corpus.ledger.schema.events import validate_payload
        validate_payload('RESOURCE_CREATED', {'url':'https://[2001:db8::1]:443/','metadata':{}})
