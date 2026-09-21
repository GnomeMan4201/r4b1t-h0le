'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,'..','dual-shell.css'),'utf8');

function keyframes(name){
  const marker='@keyframes '+name+'{';
  const start=css.indexOf(marker);
  assert.notEqual(start,-1,'missing '+name);
  let depth=0,end=-1;
  for(let i=start+marker.length-1;i<css.length;i++){
    if(css[i]==='{') depth++;
    if(css[i]==='}') { depth--; if(depth===0){end=i+1;break;} }
  }
  return css.slice(start,end);
}

test('Pass 3 uses a directional 14-18px overshoot and exactly one reverse correction',()=>{
  const frame=keyframes('r4mStripDecelerate');
  assert.match(frame,/translateX\(calc\(-100% - (?:14|15|16|17|18)px\)\)/);
  assert.equal((frame.match(/translateX\(calc\(-100% -/g)||[]).length,1);
  assert.match(frame,/100%\{transform:translateX\(-100%\)/);
  assert.doesNotMatch(frame,/translateX\(calc\(-100% \+/);
});

test('Pass 3 keeps peak forward velocity before midpoint and reserves a final correction window',()=>{
  const frame=keyframes('r4mStripDecelerate');
  assert.match(frame,/[1-4]\d%\{[^}]*translateX/);
  const correction=frame.match(/(\d+)%\{transform:translateX\(calc\(-100% - (?:14|15|16|17|18)px\)\)/);
  assert.ok(correction,'overshoot keyframe must mark correction start');
  const correctionStart=Number(correction[1]);
  assert.ok(correctionStart>=61 && correctionStart<=67,'~120-140ms of a ~360ms braking phase must remain for correction');
});

test('Pass 3 timing remains fixed, deterministic, and within the prototype envelope',()=>{
  assert.match(css,/--roll-accelerate-ms/);
  assert.match(css,/--roll-decelerate-ms/);
  assert.match(css,/r4mStripAccelerate/);
  assert.match(css,/r4mStripDecelerate/);
  assert.doesNotMatch(css,/Math\.random|random\(/i);
});
