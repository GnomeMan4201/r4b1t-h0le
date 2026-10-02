import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, Mock
from tools import maintain_corpus as m

NOW = datetime(2026, 10, 1, 11, tzinfo=timezone.utc)


def missing(at, url='https://example.com/a'):
    return dict(at=at.isoformat(), url=url, outcome='missing', status=404, method='GET')


class MaintenanceTests(unittest.TestCase):
    def test_three_distinct_days_and_48_hours_required(self):
        rows = [missing(NOW - timedelta(days=2)), missing(NOW - timedelta(days=1)), missing(NOW)]
        self.assertTrue(m.retirement_ready(rows, NOW))
        self.assertFalse(m.retirement_ready(rows[1:], NOW))
        self.assertFalse(m.retirement_ready([rows[0], rows[0], rows[2]], NOW))
        self.assertFalse(m.retirement_ready(rows, NOW + timedelta(days=2)))
        self.assertFalse(m.retirement_ready([missing(NOW - timedelta(hours=47)), rows[1], rows[2]], NOW))

    def test_transient_failure_and_success_break_streak(self):
        rows = [missing(NOW - timedelta(days=n)) for n in [3, 2, 1]]
        for outcome in ['indeterminate', 'reachable']:
            self.assertFalse(m.retirement_ready(rows + [dict(at=NOW.isoformat(), outcome=outcome)], NOW))
        head = {**missing(NOW), 'method': 'HEAD'}
        self.assertFalse(m.retirement_ready(rows[:2] + [head], NOW))

    def test_rerun_same_day_replaces_observation(self):
        row = missing(NOW)
        history = m.record([row], row, NOW + timedelta(hours=1))
        self.assertEqual(len(history), 1)

    def test_oldest_due_and_weekly_healthy_interval(self):
        health = {'a': [dict(at=(NOW-timedelta(days=3)).isoformat(), outcome='reachable')],
                  'b': [dict(at=(NOW-timedelta(days=2)).isoformat(), outcome='indeterminate')],
                  'c': [dict(at=(NOW-timedelta(days=1)).isoformat(), outcome='missing')]}
        self.assertEqual(m.due_urls(['a','b','c','d'], health, NOW, 2), ['d','b'])

    def test_host_missing_burst_is_quarantined(self):
        rows = [missing(NOW, 'https://example.com/'+str(n)) for n in range(3)]
        health = {r['url']: [missing(NOW-timedelta(days=2),r['url']), missing(NOW-timedelta(days=1),r['url']),r] for r in rows}
        retire, quarantine, blocked = m.proposals(health, rows, NOW)
        self.assertEqual(retire, [])
        self.assertEqual(len(quarantine), 3)
        self.assertEqual(blocked, ['example.com'])
        self.assertEqual(m.proposals(health, [], NOW), (retire, quarantine, blocked))

    @patch.object(m, 'request')
    def test_head_missing_requires_get_confirmation(self, request):
        head, get = Mock(status_code=404), Mock(status_code=200)
        request.side_effect = [(head, 'https://example.com/a'), (get, 'https://example.com/a')]
        row = m.probe('https://example.com/a', None, None)
        self.assertEqual(row['outcome'], 'reachable')
        self.assertEqual(request.call_args_list[1].args[0], 'GET')
        self.assertTrue(head.close.called and get.close.called)

    @patch.object(m, 'request')
    def test_rate_limited_is_indeterminate(self, request):
        request.return_value = Mock(status_code=429), 'https://example.com/a'
        self.assertEqual(m.probe('https://example.com/a', None, None)['outcome'], 'indeterminate')

    @patch.object(m, 'get_worker_session')
    def test_redirect_target_is_guarded_and_paced(self, session):
        first = Mock(status_code=302, headers={'Location': 'http://127.0.0.1/private'})
        session.return_value.request.return_value = first
        guard, limiter = Mock(), Mock()
        guard.ensure_allowed.side_effect = [None, m.TargetGuardError('private')]
        with self.assertRaises(m.TargetGuardError):
            m.request('HEAD', 'https://example.com/a', {}, guard, limiter)
        self.assertEqual(session.return_value.request.call_count, 1)
        self.assertTrue(first.close.called)

    @patch.object(m, 'request')
    def test_source_failure_preserves_prior_seen_links(self, request):
        source = {'identity':'id','allowed_hosts':['example.com'],'index': {'source_url':'https://example.com/', 'urls':['https://example.com/a'], 'extractor':'html-anchors-v1'}}
        old = {'identity':'id','urls':['https://example.com/a'], 'etag':'etag'}
        request.return_value = Mock(status_code=503), 'https://example.com/'
        cache, additions, status = m.discover(source, old, set(), {}, NOW, None, None)
        self.assertEqual(cache, old)
        self.assertEqual(additions, [])
        self.assertEqual(status['outcome'], 'indeterminate')

    @patch.object(m, 'request')
    def test_new_source_link_remains_unreviewed_and_304_reuses_cache(self, request):
        source = {'identity':'id','allowed_hosts':['example.com'],'index': {'source_url':'https://example.com/', 'urls':['https://example.com/a'], 'extractor':'html-anchors-v1'}}
        response = Mock(status_code=200, headers={'ETag':'new'})
        response.iter_content.return_value = [b'<a href="/a">old</a><a href="/b">new</a>']
        request.return_value = response, 'https://example.com/'
        cache, additions, status = m.discover(source, None, set(), {}, NOW, None, None)
        self.assertEqual(len(additions), 1)
        self.assertFalse(additions[0]['selection_authority'])
        request.return_value = Mock(status_code=304), 'https://example.com/'
        self.assertEqual(m.discover(source, cache, set(), {}, NOW, None, None)[0], cache)


class DiscoveryIsolationTests(unittest.TestCase):
    @patch.object(m, 'request')
    def test_policy_rejection_does_not_discard_valid_additions(self, request):
        source = {'identity':'id','allowed_hosts':['example.com'],'index': {'source_url':'https://example.com/', 'urls':[], 'extractor':'html-anchors-v1'}}
        response = Mock(status_code=200, headers={})
        response.iter_content.return_value = [b'<a href="/article">new</a><a href="http://example.onion/article">excluded</a>']
        request.return_value = response, 'https://example.com/'
        cache, additions, status = m.discover(source, None, set(), {}, NOW, None, None)
        self.assertEqual([r['url'] for r in additions], ['https://example.com/article'])
        self.assertEqual(status['outcome'], 'collected')
        self.assertEqual(len(status['rejected']), 1)
        self.assertIn('http://example.onion/article', cache['urls'])

    @patch.object(m, 'request')
    def test_malformed_feed_preserves_history(self, request):
        source = {'identity':'id','allowed_hosts':['example.com'],'index': {'source_url':'https://example.com/', 'urls':['https://example.com/a'], 'extractor':'feed-entries-v1'}}
        response = Mock(status_code=200, headers={})
        response.iter_content.return_value = [b'<rss><broken>']
        request.return_value = response, 'https://example.com/'
        old = {'identity':'id','urls':['https://example.com/a']}
        cache, additions, status = m.discover(source, old, set(), {}, NOW, None, None)
        self.assertEqual(cache, old)
        self.assertEqual(additions, [])
        self.assertEqual(status['outcome'], 'indeterminate')


class DiscoveryQualityTests(unittest.TestCase):
    @patch.object(m, 'request')
    def test_navigation_and_external_links_do_not_enter_queue(self, request):
        source = {'identity':'id','allowed_hosts':['example.com'], 'index': {
            'source_url':'https://example.com/archive', 'urls':[], 'extractor':'html-anchors-v1'}}
        response = Mock(status_code=200, headers={})
        response.iter_content.return_value = [b'<a href="/2026/research">article</a>'
            b'<a href="https://www.blogger.com/comment/delete/123">control</a>'
            b'<a href="/feeds/posts/default">feed</a><a href="/">root</a>'
            b'<a href="/search/injection">search</a><a href="/comment-injection-research">research</a>']
        request.return_value = response, 'https://example.com/archive'
        cache, additions, status = m.discover(source, None, set(), {}, NOW, None, None)
        self.assertEqual({r['url'] for r in additions}, {
            'https://example.com/2026/research','https://example.com/comment-injection-research'})
        self.assertEqual({r['reason'] for r in status['rejected']}, {
            'DESTINATION_HOST_UNREVIEWED','GENERIC_HOST_ROOT','NAVIGATION_ENDPOINT'})
        self.assertEqual(len(cache['urls']), 6)


if __name__ == '__main__':
    unittest.main()
