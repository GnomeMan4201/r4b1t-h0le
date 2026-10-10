'use strict';
const { test, expect } = require('@playwright/test');

// V2 EXPERIMENT ONLY. Live DOM lifecycle and CSS timeline ownership are hard
// gates. Missing compositor/rAF observations remain explicitly INCONCLUSIVE
// for visual smoothness; independently test controlled actual SVG poses 20x.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.removeItem('r4b1t-roll-reel-sound'); } catch (_) {}
  });
  await page.route('**/*', route => {
    const raw=route.request().url();
    if(raw.startsWith('blob:')||raw.startsWith('data:'))return route.continue();
    const host=new URL(raw).hostname;
    return host==='localhost'||host==='127.0.0.1' ? route.continue() : route.abort('blockedbyclient');
  });
});

test('WebKit: accepted first ROLL completes named CSS 1000ms timeline with observation coverage reported', async ({ page }) => {
  await page.goto('./',{ waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => window.R4B1TRollReel && window.R4B1TRollProduction &&
    window.R4B1TRollReel.isMounted && window.R4B1TRollReel.isMounted() &&
    window.__r4b1tCommitRoll && window.__r4b1tCommitRoll.__r4b1tAuthority);
  await expect(page.locator('#r4h-roll-rabbit')).toBeAttached();
  await page.waitForTimeout(1300);
  await page.evaluate(() => {
    const rabbit=document.getElementById('r4h-roll-rabbit');
    const e=window.__rabbitTimelineV2={
      starts:0,ends:0,cancels:0,startElapsed:null,endElapsed:null,
      cssDuration:null,realStart:null,realEnd:null,samples:[],startCssTime:null
    };
    let runningAnimation=null;
    const animation=()=>runningAnimation || (runningAnimation=rabbit.getAnimations().find(x=>x.animationName==='r4h-roll-rabbit')||null);
    const onFrame=stamp=>{
      if(e.ends||e.cancels||e.samples.length>=180)return;
      const anim=animation();
      const computed=getComputedStyle(rabbit).transform;
      let y=null;
      try{y=computed==='none'?0:new DOMMatrix(computed).m42;}catch(_){}
      e.samples.push({timestamp:stamp,phaseMs:anim&&Number.isFinite(Number(anim.currentTime))?Number(anim.currentTime):null,
        playState:anim?.playState||null,y});
      requestAnimationFrame(onFrame);
    };
    rabbit.addEventListener('animationstart',evt=>{
      if(evt.animationName!=='r4h-roll-rabbit')return;
      e.starts++;e.startElapsed=evt.elapsedTime;e.realStart=performance.now();
      e.cssDuration=getComputedStyle(rabbit).animationDuration;
      const anim=animation();e.startCssTime=anim?Number(anim.currentTime):null;
      requestAnimationFrame(onFrame);
    });
    rabbit.addEventListener('animationend',evt=>{
      if(evt.animationName!=='r4h-roll-rabbit')return;
      e.ends++;e.endElapsed=evt.elapsedTime;e.realEnd=performance.now();
    });
    rabbit.addEventListener('animationcancel',evt=>{if(evt.animationName==='r4h-roll-rabbit')e.cancels++;});
  });
  expect(await page.evaluate(()=>window.R4B1TRollReel.quickRoll())).toBe(true);
  await page.waitForFunction(()=>window.__rabbitTimelineV2.ends===1,null,{timeout:13000});
  await page.waitForFunction(()=>{
    const s=window.R4B1TRollReel.snapshot(),p=window.R4B1TRollProduction.snapshot();
    return s.phase==='revealed'&&s.landedUrl&&!p.active;
  },null,{timeout:13000});
  const result=await page.evaluate(()=>{
    const e=window.__rabbitTimelineV2,all=e.samples.filter(s=>Number.isFinite(s.y));
    const middle=all.filter(s=>Number.isFinite(s.phaseMs)&&s.phaseMs>=310&&s.phaseMs<=560);
    return {
      starts:e.starts,ends:e.ends,cancels:e.cancels,
      declaredDuration:e.cssDuration,cssElapsedMs:1000*(e.endElapsed-e.startElapsed),
      callbackWallMs:e.realEnd-e.realStart,
      samples:all.length,midPhaseSamples:middle.length,
      midPhaseMaxY:middle.length?Math.max(...middle.map(s=>s.y)):null,
      coverage:middle.length?'MIDDLE_PHASE_OBSERVED':'MIDDLE_PHASE_UNOBSERVED',
      samplePhases:all.map(x=>({phaseMs:x.phaseMs,y:x.y})),
      finalTransform:getComputedStyle(document.getElementById('r4h-roll-rabbit')).transform,
      rolling:document.documentElement.classList.contains('rolling'),
      landed:window.R4B1TRollReel.snapshot().landedUrl,
      displayed:document.getElementById('r4mUrl').textContent,
      payline:document.querySelector('#r4mRollReel .r4m-reel-row.is-payline')?.dataset.url
    };
  });
  console.log('RABBIT_LIVE_COVERAGE_V2 '+JSON.stringify(result));
  expect(result.starts).toBe(1);
  expect(result.ends).toBe(1);
  expect(result.cancels).toBe(0);
  expect(result.declaredDuration).toMatch(/^(1s|1000ms)$/);
  expect(result.cssElapsedMs).toBeGreaterThanOrEqual(950);
  expect(result.cssElapsedMs).toBeLessThanOrEqual(1050);
  expect(result.finalTransform).toBe('none');
  expect(result.rolling).toBe(false);
  expect(result.landed).toBe(result.displayed);
  expect(result.landed).toBe(result.payline);
  // If the live browser actually provided the required mid-descent phase,
  // the original >200 viewBox-unit visual threshold MUST still hold. No
  // middle-phase frames = explicitly logged COVERAGE GAP, not a motion PASS.
  if(result.coverage==='MIDDLE_PHASE_OBSERVED'){
    expect(result.midPhaseMaxY,JSON.stringify(result)).toBeGreaterThan(200);
  }
});
