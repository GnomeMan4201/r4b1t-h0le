'use strict';

const { test, expect } = require('@playwright/test');

test('candidate shadow loads while production ROLL remains on active legacy bytes', async ({ page }) => {
  const legacy = [
    'https://legacy.example/a',
    'https://legacy.example/b',
  ];
  const candidate = [
    'https://candidate.example/tool',
    'https://candidate.example/research',
  ];

  await page.addInitScript(() => localStorage.clear());

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
    window.R4b1tCorpusAuthority &&
    typeof window.R4b1tCorpusAuthority.loadActive === 'function' &&
    typeof window.__r4b1tCommitRoll === 'function'
  );

  const evidence = await page.evaluate(async () => {
    const activeBefore = await window.R4b1tCorpusAuthority.loadActive();
    const shadow = await window.R4b1tCorpusAuthority.loadCandidateShadow();
    const activeAfter = await window.R4b1tCorpusAuthority.loadActive();
    const committed = window.__r4b1tCommitRoll(() => 0);

    return {
      activeBefore: {
        source: activeBefore.source.id,
        revision: activeBefore.revision,
        urls: activeBefore.urls.slice(),
      },
      activeAfter: {
        source: activeAfter.source.id,
        revision: activeAfter.revision,
        urls: activeAfter.urls.slice(),
      },
      shadow: {
        source: shadow.source.id,
        revision: shadow.revision,
        urls: shadow.urls.slice(),
      },
      candidateAuthority:
        window.R4b1tCorpusAuthority.candidate().selectionAuthority,
      committedUrl: committed && committed.url,
    };
  });

  expect(evidence.activeBefore).toEqual(evidence.activeAfter);
  expect(evidence.activeBefore.source).toBe('legacy-urls-v1');
  expect(evidence.activeBefore.urls).toEqual(legacy);
  expect(evidence.shadow.source).toBe('typed-candidate-v0.1');
  expect(evidence.shadow.urls).toEqual(candidate);
  expect(evidence.candidateAuthority).toBe(false);
  expect(legacy).toContain(evidence.committedUrl);
  expect(candidate).not.toContain(evidence.committedUrl);
});
