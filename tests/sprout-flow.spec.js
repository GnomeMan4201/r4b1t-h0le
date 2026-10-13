'use strict';
const {test, expect} = require('@playwright/test');

async function ready(page, flow = true) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
  });
  await page.goto(flow ? './?flow=sprout' : './');
  await page.waitForFunction(() => window.__r4b1tCommitRoll?.__r4b1tAuthority && typeof window.getSproutTargets === 'function');
  await page.evaluate(async () => {
    await window.R4b1tCorpusAuthority.loadActive();
    await new Promise(resolve => setTimeout(resolve, 75));
  });
}
async function first(page) {
  await ready(page);
  await page.locator('.sprout-start').click();
  await expect(page.locator('.sprout-card')).toHaveCount(1);
  return page.locator('.sprout-stage').first();
}
async function manifest(page) { return page.evaluate(() => window.getTrailManifest()); }

test('roll -> roots -> recursive branches retain exact v0.3 authority', async ({page}) => {
  const parent = await first(page);
  const before = await manifest(page);
  expect(before.manifest.steps[0].kind).toBe('ROLL');
  const tx = before.manifest.steps[0].transaction;
  await parent.locator(':scope > .sprout-card .sprout-control').last().click();
  await expect(parent.locator(':scope > .sprout-roots')).toHaveCount(1);
  await expect(parent.locator(':scope > .sprout-targets button')).toHaveText(['/02_ALTERNATIVE', '/01_DEEPER', '/03_OPPOSITE']);
  await parent.locator(':scope > .sprout-targets button').nth(0).click();
  await expect(page.locator('.sprout-card')).toHaveCount(1);
  const child = parent.locator(':scope > .sprout-children > .sprout-stage').first();
  await expect(child.locator(':scope > .sprout-roots')).toHaveCount(1);
  await expect(child.locator(':scope > .sprout-junction .sprout-route')).toHaveAttribute('href', /https?:/);
  await child.locator(':scope > .sprout-targets button').nth(2).click();
  await expect(page.locator('.sprout-card')).toHaveCount(1);
  await expect(page.locator('.sprout-stage')).toHaveCount(3);
  await expect(page.locator('.sprout-roots')).toHaveCount(3);
  expect(await child.locator(':scope > .sprout-roots path').first().getAttribute('d')).toMatch(/^M100 0/);
  const after = await manifest(page);
  expect(after.manifest.steps.map(x => x.kind)).toEqual(['ROLL','BRANCH','BRANCH']);
  expect(after.manifest.steps[0].transaction).toEqual(tx);
  expect(after.manifest.steps[1].navigation).toEqual({from_step:1,branch_label:'sideways'});
  expect(after.manifest.steps[2].navigation).toEqual({from_step:2,branch_label:'opposite'});
  expect(after.manifest.steps[1]).not.toHaveProperty('transaction');
  expect(await page.evaluate(a=>window.R4b1tTrailV03.verify(a).then(r=>r.trail_id),after)).toBe(after.trail_id);
  await parent.locator(':scope > .sprout-targets button').first().click();
  await expect(page.locator('.sprout-card')).toHaveCount(1);
  expect((await manifest(page)).trail_id).toBe(after.trail_id);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('historical duplicate URL binds the chosen step, not latest URL match', async ({page}) => {
  await first(page);
  const origin = await page.locator('.sprout-url').first().textContent();
  await page.locator('.sprout-card .sprout-control').last().click();
  await page.evaluate(url=>window.selectUrl(url),origin); // Same URL again at step 2.
  await page.locator('.sprout-targets button').nth(1).click();
  const a=await manifest(page);
  expect(a.manifest.steps).toHaveLength(3);
  expect(a.manifest.steps[2].navigation.from_step).toBe(1);
});

test('failed persistence, stale parent and invalid targets produce no ghost cards', async ({page}) => {
  const parent=await first(page);
  await parent.locator(':scope > .sprout-card .sprout-control').last().click();
  const initial=await manifest(page);
  await page.evaluate(()=>{
    window.__savedStorageSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(){throw new Error('simulated quota');};
  });
  await parent.locator(':scope > .sprout-targets button').nth(1).click();
  await expect(page.locator('.sprout-status')).toContainText('recording failed');
  await expect(page.locator('.sprout-stage')).toHaveCount(1);
  await expect(page.locator('.sprout-card')).toHaveCount(1);
  expect((await manifest(page)).trail_id).toBe(initial.trail_id);
  await page.evaluate(()=>{Storage.prototype.setItem=window.__savedStorageSet;});
  const rejected=await page.evaluate(()=>window.commitSproutNavigation({url:'https://example.test/',from_url:'https://wrong.test/',from_step:1,branch_label:'deeper',epoch:window.getSproutRecordedSteps().epoch}));
  expect(rejected).toBeNull();
  expect(await page.evaluate(()=>window.selectSproutBranch({originUrl:window.getSproutRecordedSteps().steps[0].url,url:'javascript:alert(1)',fromStep:1,type:'deeper',epoch:window.getSproutRecordedSteps().epoch}))).toBeNull();
  expect((await manifest(page)).trail_id).toBe(initial.trail_id);
  await parent.locator(':scope > .sprout-targets button').nth(1).click();
  await expect(page.locator('.sprout-card')).toHaveCount(1);
});

test('empty targets and metadata text never manufacture navigation', async ({page}) => {
  await first(page);
  const before=await manifest(page);
  await page.evaluate(()=>{
    document.getElementById('ogTitle').textContent='<img src=x onerror=alert(1)>';
    window.getSproutTargets=()=>[];
  });
  await expect(page.locator('.sprout-title')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.sprout-title img')).toHaveCount(0);
  await page.locator('.sprout-card .sprout-control').last().click();
  for(const b of await page.locator('.sprout-targets button').all()) await expect(b).toBeDisabled();
  expect((await manifest(page)).trail_id).toBe(before.trail_id);
});

test('reset clears the view only after ledger persistence succeeds', async ({page})=>{
  await first(page);
  await page.evaluate(()=>{
    window.__savedStorageSet=Storage.prototype.setItem;
    Storage.prototype.setItem=function(){throw new Error('simulated quota');};
    window.resetReproducibleTrail();
  });
  await expect(page.locator('.sprout-card')).toHaveCount(1);
  await page.evaluate(()=>{Storage.prototype.setItem=window.__savedStorageSet;window.resetReproducibleTrail();});
  await expect(page.locator('.sprout-card')).toHaveCount(0);
  await expect(page.locator('.sprout-start')).toBeVisible();
  expect((await manifest(page)).manifest.steps).toHaveLength(0);
});

test('gate off preserves the current shell and no root controls are mounted',async ({page})=>{
  await ready(page,false);
  await expect(page.locator('#sproutFlow')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/r4-sprout-flow/);
});

test('small screen, reduced motion and keyboard keep the flow accessible',async({page})=>{
  await page.setViewportSize({width:320,height:680});
  await page.emulateMedia({reducedMotion:'reduce'});
  await first(page);
  await expect(page.locator('.sprout-card .sprout-control').last()).toBeEnabled();
  await page.locator('.sprout-card .sprout-control').last().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.sprout-roots')).toHaveCount(1);
  expect(await page.locator('.sprout-roots path').first().evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
  await page.locator('.sprout-targets button').nth(1).focus();await page.keyboard.press('Enter');
  await expect(page.locator('.sprout-card')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});


test('repeat clicks and cancelled machine commits cannot double-land cards', async ({page}) => {
  const parent=await first(page);
  await parent.locator(':scope > .sprout-card .sprout-control').last().click();
  await parent.locator(':scope > .sprout-targets button').nth(1).evaluate(b=>{b.click();b.click();});
  await expect(page.locator('.sprout-card')).toHaveCount(1);
  expect((await manifest(page)).manifest.steps).toHaveLength(2);
  if (!await page.evaluate(()=>document.documentElement.classList.contains('r4-mobile-active'))) return;
  const roll=page.locator('.sprout-card .sprout-control').filter({hasText:'ROLL AGAIN'}).last();
  await roll.click();
  await page.waitForFunction(()=>window.R4B1TRollProduction.snapshot()?.committedTransactionId!=null && !window.R4B1TRollProduction.snapshot()?.revealFired);
  await page.evaluate(()=>window.R4B1TRollProduction.cancel('test-cancel'));
  await expect(roll).toBeEnabled();
  await expect(page.locator('.sprout-card')).toHaveCount(1);
});


test('existing keyboard and mobile branch entry stay in the continuous flow',async({page})=>{
  await first(page);
  await expect(page.locator('.sprout-card .sprout-control').last()).toBeEnabled();
  await page.locator('body').press('p');
  await expect(page.locator('.sprout-roots')).toHaveCount(1);
  if(await page.evaluate(()=>document.documentElement.classList.contains('r4-mobile-active'))){
    await page.locator('[data-mobile-action=menu]').click();
    await page.locator('#r4mMenuSheet [data-mobile-action=branch]').click();
    await expect(page.locator('#r4mBranchSheet')).not.toHaveClass(/open/);
    await expect(page.locator('#r4mBranchSheet')).not.toBeVisible();
    await expect(page.locator('#r4mMenuSheet')).not.toBeVisible();
    await expect(page.locator('.sprout-roots')).toHaveCount(1);
    await expect(page.locator('#r4mRollAgain')).not.toBeVisible();
  }
  await page.evaluate(()=>document.activeElement.blur());
  await page.locator('body').press('Space');
  await expect(page.locator('.sprout-stage')).toHaveCount(2);
  await expect(page.locator('.sprout-card')).toHaveCount(1);
  expect((await manifest(page)).manifest.steps.map(s=>s.kind)).toEqual(['ROLL','ROLL']);
});


test('mobile footer has only MENU while the card keeps SPROUT', async ({page}, info) => {
  test.skip(info.project.name !== 'mobile-chromium');
  await first(page);
  const nav = page.locator('#r4mNavRoll');
  await expect(nav).not.toBeVisible();
  await expect(page.locator('#r4mNavMenu')).toBeVisible();
  const before = await manifest(page);
  await page.locator('.sprout-card .sprout-control').last().click();
  await expect(page.locator('.sprout-roots')).toHaveCount(1);
  expect((await manifest(page)).trail_id).toBe(before.trail_id);
  await page.locator('.sprout-targets button').nth(1).click();
  await expect(page.locator('.sprout-roots')).toHaveCount(2);
  await expect(nav).not.toBeVisible();
  await page.locator('#r4mNavMenu').click();
  await expect(page.locator('#r4mMenuSheet')).toBeVisible();
  await page.evaluate(()=>document.documentElement.classList.add('r4m-stage-blind'));
  await expect(nav).toBeVisible();
  await expect(nav).toHaveAttribute('data-mobile-action', 'nav-roll');
});
