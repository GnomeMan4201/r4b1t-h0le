'use strict';
// Only changes CI-staged website source, not the committed application.
const fs = require('node:fs');
const path = 'test-site/r4b1t-h0le/dual-shell.js';
const mode = process.argv[2];
if (!['control','candidate'].includes(mode)) throw new Error('Specify control or candidate');
let source = fs.readFileSync(path,'utf8');
if (source.includes('__R4B1T_TEST__')) throw new Error('Test hook leaked into production JS');
const a = source.indexOf('  function startProductionMarkRoll() {');
const b = source.indexOf('  function syncProductionMarkState() {',a);
if(a<0||b<=a)throw new Error('Missing mark function section');
let block = source.slice(a,b);
if(mode==='control'){
  // Control ablation restores the ORIGINAL no-start decision precisely:
  // without animationstart, remove .rolling immediately, even before paint.
  // Keep every other file and selection path identical to the release SHA.
  const start=block.indexOf('    function runNoStartFallbackCheck() {');
  const end=block.indexOf('    markRollFrame = window.requestAnimationFrame',start);
  if(start<0||end<=start)throw new Error('Candidate decision helper absent');
  const exactOriginal=[
    '    function runNoStartFallbackCheck() {',
    '      if (!animationStarted) finishProductionMarkRoll();',
    '    }',
    ''
  ].join('\n');
  block=block.slice(0,start)+exactOriginal+block.slice(end);
}else{
  if(!block.includes('function runNoStartFallbackCheck()')||
     !block.includes('!firstFrameObserved'))throw new Error('Candidate first-frame guard absent');
}
const last='    return true;\n  }\n\n';
if(block.split(last).length!==2)throw new Error('Expected one start return');
const hook = [
  '    // TEST ONLY: invoke the actual no-start fallback in same task as rolling.',
  '    if (window.__R4B1T_TEST__ && window.__R4B1T_TEST__.fallbackNow === true &&',
  '        !window.__r4b1tSyncFallbackUsed) {',
  '      window.__r4b1tSyncFallbackUsed = true;',
  '      window.__r4b1tSyncFallbackRecord = {',
  '        wasRolling: root.classList.contains("rolling"),',
  '        hadFrame: '+(mode==='control'?'false':'firstFrameObserved')+',',
  '        runId: '+(mode==='control'?'null':'runId')+',',
  '        at: performance.now()',
  '      };',
  '      runNoStartFallbackCheck();',
  '      window.__r4b1tSyncFallbackRecord.rollingAfter = root.classList.contains("rolling");',
  '    }',
  ''
].join('\n');
block=block.replace(last,hook+last);
source=source.slice(0,a)+block+source.slice(b);
fs.writeFileSync(path,source);
console.log('Prepared test-only synchronous fallback fixture:',mode);
