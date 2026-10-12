// Capture authentic mobile-shell visual evidence for the opt-in Machine skin.
// Only run against localhost staged at the exact PR head. This never publishes the site.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.env.BASE_URL || 'http://127.0.0.1:8080/r4b1t-h0le/';
if (!/^http:\/\/127\.0\.0\.1:[0-9]+\/r4b1t-h0le\/$/.test(root)) {
  throw new Error('Refusing non-local preview target');
}
const folder = resolve('machine-visual-evidence');
await mkdir(folder, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { mode:'visual-evidence-only', baseURL:root, viewport:'390x844', screenshots:[], noIOSSafariClaim:true };
const issues = [];
async function makePage(q, height=844) {
  const context = await browser.newContext({
    viewport:{width:390,height}, deviceScaleFactor:3, isMobile:true,
    hasTouch:true, reducedMotion:'no-preference', serviceWorkers:'block'
  });
  const page = await context.newPage();
  page.on('pageerror', error => issues.push(error.message));
  await page.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (['127.0.0.1','localhost'].includes(u.hostname) || ['blob:','data:'].includes(u.protocol)) return route.continue();
    return route.abort('blockedbyclient');
  });
  await page.goto(root+q, {waitUntil:'domcontentloaded'});
  await page.locator('#r4mRoll').waitFor({state:'visible',timeout:20000});
  await page.waitForFunction(() => typeof window.getTrailManifest === 'function');
  return {page,context};
}
async function capture(page, label) {
  const data=await page.evaluate(()=>{
    const rect=id=>{
      const e=document.querySelector(id);
      if (!e)return null;
      const r=e.getBoundingClientRect();
      return {top:Math.round(r.top),bottom:Math.round(r.bottom),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),height:Math.round(r.height)};
    };
    const h=document.querySelector('.r4m-header');
    return {
      machine:document.documentElement.getAttribute('data-r4b1t-machine'),
      phase:document.documentElement.getAttribute('data-r4m-presentation'),
      stage:document.documentElement.className,
      viewport:innerWidth, viewportHeight:innerHeight,
      scrollWidth:document.documentElement.scrollWidth,
      headerBackground:h?getComputedStyle(h).backgroundImage:null,
      roll:rect('#r4mRoll'),hero:rect('#r4mHero h1'),mark:rect('#r4mProductionMark'),
      svgMark:rect('#r4mProductionMark svg'),
      reel:rect('#r4mRollReel'),route:rect('#r4mRoute'),
      menu:rect('#r4mMenuSheet'),nav:rect('.r4m-nav')
    };
  });
  await page.screenshot({path:resolve(folder,label+'.png'),fullPage:true,animations:'disabled'});
  report.screenshots.push({label,...data});
  if(data.scrollWidth>data.viewport) issues.push(label+' horizontal overflow '+data.scrollWidth+' > '+data.viewport);
  return data;
}
try {
  const {page:plain,context:plainCtx}=await makePage('');
  const a=await capture(plain,'01-default-original');
  if (a.machine!==null) throw new Error('Default site unexpectedly opted into Machine');
  await plainCtx.close();

  const {page,context}=await makePage('?machine=1');
  const b=await capture(page,'02-machine-invitation');
  if (b.machine!=='1') throw new Error('Machine query opt-in missing');
  if (!b.headerBackground?.includes('linear-gradient')) throw new Error('Machine header skin not computed');
  if (!b.hero?.height || b.roll.bottom>b.nav.top) throw new Error('Machine hero hidden or first ROLL not above nav');
  await page.locator('#r4mRoll').click();
  await page.waitForFunction(()=>document.documentElement.getAttribute('data-r4m-presentation')==='revealed',{timeout:15000});
  await page.locator('#r4mRoute').waitFor({state:'visible'});
  if (await page.locator('#r4mHero').isVisible()) throw new Error('Invitation hero leaked into result stage');
  await capture(page,'03-machine-result');
  await page.locator('#r4mNavMenu').click();
  await page.waitForFunction(()=>document.getElementById('r4mMenuSheet')?.getAttribute('aria-hidden')==='false');
  await capture(page,'04-machine-menu');
  const trail=await page.evaluate(async()=> (await window.getTrailManifest()).manifest.steps.length);
  report.trailStepsAfterOneRoll=trail;
  if (trail!==1) issues.push('Expected exactly one recorded Trail step after first ROLL, got '+trail);
  await context.close();


  // Short mobile browser chrome takes vertical room on physical iPhones.
  // This separate 390x680 emulation is NOT physical Safari or a smoothness test.
  const {page:compact,context:compactCtx}=await makePage('?machine=1',680);
  const compactIdle=await capture(compact,'05-machine-compact-invitation');
  if (!compactIdle.hero?.height) throw new Error('Compact Machine invitation headline hidden');
  if (compactIdle.roll.bottom>compactIdle.nav.top-4) throw new Error('Compact ROLL button occluded by bottom navigation');
  await compact.locator('#r4mRoll').click();
  await compact.waitForFunction(()=>document.documentElement.getAttribute('data-r4m-presentation')==='revealed',{timeout:15000});
  await compact.locator('#r4mRoute').waitFor({state:'visible'});
  if (await compact.locator('#r4mHero').isVisible()) throw new Error('Compact invitation hero leaked after reveal');
  const compactResult=await capture(compact,'06-machine-compact-result');

  // Stress genuine selected route projection with unusually long descriptive
  // metadata. This is presentation-only; the selection and Trail stay intact.
  const originalUrl=await compact.locator('#r4mUrl').textContent();
  const trailBeforeScroll=await compact.evaluate(async()=> (await window.getTrailManifest()).manifest.steps.length);
  const longText=Array.from({length:30},(_,i)=>'Source context segment '+(i+1)+' about this resource.')
    .join(' ')+' END_OF_MACHINE_SOURCE_DESCRIPTION';
  await compact.evaluate(text=>{
    document.getElementById('ogTitle').textContent='A detailed source-provided resource title requiring readable wrapping';
    document.getElementById('ogDesc').textContent=text;
    window.__r4b1tSyncMobileRoute();
  },longText);
  await compact.locator('#r4mDescription').filter({hasText:'END_OF_MACHINE_SOURCE_DESCRIPTION'}).waitFor();
  if (await compact.locator('#r4mUrl').textContent()!==originalUrl)
    throw new Error('Post-reveal metadata stress unexpectedly changed selected URL');
  await compact.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await compact.waitForFunction(()=>scrollY>0);
  const longScrolled=await capture(compact,'07-machine-compact-long-result-scrolled');
  const clearance=await compact.evaluate(()=>{
    const rect=s=>document.querySelector(s).getBoundingClientRect();
    return {
      descriptionBottom:rect('#r4mDescription').bottom,
      urlTop:rect('#r4mUrl').top,
      urlBottom:rect('#r4mUrl').bottom,
      railTop:rect('#r4mRoute .r4m-route-actions').top,
      scrollY,scrollMax:document.documentElement.scrollHeight-innerHeight,
    };
  });
  report.compactLongResultClearance=clearance;
  if(clearance.urlTop<0||clearance.urlBottom>=clearance.railTop||
    clearance.descriptionBottom>=clearance.railTop||
    clearance.scrollY<clearance.scrollMax-2)
    throw new Error('Long result cannot be scrolled completely above fixed action rail: '+JSON.stringify(clearance));
  if((await compact.evaluate(async()=> (await window.getTrailManifest()).manifest.steps.length))!==trailBeforeScroll)
    throw new Error('Metadata-only stress changed authoritative Trail count');

  if (Math.abs(compactResult.mark.height-compactIdle.mark.height)>1)
    throw new Error('Compact production mark frame jumped between invite and reveal');
  if (Math.abs(compactResult.svgMark.height-compactIdle.svgMark.height)>1)
    throw new Error('Compact production SVG display size jumped between invite and reveal');
  await compactCtx.close();

  report.issues=issues;
  await writeFile(resolve(folder,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('MACHINE_VISUAL_EVIDENCE '+JSON.stringify({screens:report.screenshots.map(x=>x.label),trail,issues}));
  if(issues.length) process.exitCode=1;
} finally {
  await browser.close();
}
