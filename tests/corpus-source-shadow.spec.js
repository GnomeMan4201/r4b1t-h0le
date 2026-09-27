const { test, expect } = require('@playwright/test');

test('typed candidate shadow loads without influencing production ROLL authority', async ({ page }) => {
  const legacy = [
    'https://legacy.example/a',
    'https://legacy.example/b',
  ];
  const candidate = [
    'https://candidate.example/tool',
    'https://candidate.example/research',
  ];

  await page.addInitScript(() => {
    localStorage.clear();
  });

  await page.route('**/urls.txt?*', route => route.fulfill({
    status: 200,
    contentType: 'text/plain; charset=utf-8',
    body: legacy.join('\n') + '\n',
  }));

  await page.route('**/corpus/releases/typed-candidate-v0.1/urls.txt?*', route =>
    route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: candidate.join('\n') + '\n',
    })
  );

  await page.goto('./', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() =>
    window.R4b1tCorpusSource &&
    typeof window.R4b1tCorpusSource.loadAuthority === 'function' &&
    typeof window.__r4b1tCommitRoll === 'function'
  );

  const evidence = await page.evaluate(async () => {
    const authorityBefore = await window.R4b1tCorpusSource.loadAuthority();
    const shadow = await window.R4b1tCorpusSource.loadShadow();
    const authorityAfter = await window.R4b1tCorpusSource.loadAuthority();
    const committed = window.__r4b1tCommitRoll(() => 0);

    return {
      policyAuthority: window.R4b1tCorpusSource.policy.selectionAuthority,
      shadowSelectionAuthority:
        window.R4b1tCorpusSource.policy.shadow.selectionAuthority,
      authorityBefore: {
        source: authorityBefore.source.id,
        revision: authorityBefore.revision,
        urls: authorityBefore.urls.slice(),
      },
      authorityAfter: {
        source: authorityAfter.source.id,
        revision: authorityAfter.revision,
        urls: authorityAfter.urls.slice(),
      },
      shadow: {
        source: shadow.source.id,
        revision: shadow.revision,
        urls: shadow.urls.slice(),
      },
      committedUrl: committed && committed.url,
    };
  });

  expect(evidence.policyAuthority).toBe('legacy-urls-v1');
  expect(evidence.shadowSelectionAuthority).toBe(false);
  expect(evidence.authorityBefore).toEqual(evidence.authorityAfter);
  expect(evidence.authorityBefore.source).toBe('legacy-urls-v1');
  expect(evidence.authorityBefore.urls).toEqual(legacy);
  expect(evidence.shadow.source).toBe('typed-candidate-v0.1');
  expect(evidence.shadow.urls).toEqual(candidate);
  expect(legacy).toContain(evidence.committedUrl);
  expect(candidate).not.toContain(evidence.committedUrl);
});
