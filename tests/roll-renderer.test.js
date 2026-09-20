'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {FULL,REDUCED,profile,createRollRenderer}=require('../roll-renderer.js');

function el(){
  const set=new Set(),attrs={};
  return {classList:{add:(...x)=>x.forEach(v=>set.add(v)),remove:(...x)=>x.forEach(v=>set.delete(v)),contains:x=>set.has(x)},setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],_classes:set,_attrs:attrs};
}
function make(reduced=false){
  const button=el(),strip=el(),routeHost=el();
  const renderer=createRollRenderer({button,strip,routeHost,matchMedia:()=>({matches:reduced})});
  return {button,strip,routeHost,renderer};
}
test('full profile is deterministic and route-independent',()=>{
  assert.deepEqual(profile(false),profile(false));
  assert.equal(profile(false).timing,FULL);
  assert.equal(profile(false).totalAfterRelease,682);
});
test('reduced profile removes travel phases',()=>{
  const p=profile(true); assert.equal(p.timing,REDUCED); assert.equal(p.timing.accelerate,0); assert.equal(p.timing.decelerate,0);
});
test('press applies physical compression and busy state',()=>{
  const h=make(); assert.equal(h.renderer.press(),true); assert.equal(h.button.classList.contains('roll-press'),true); assert.equal(h.button._attrs['aria-busy'],'true');
});
test('repeated press while active is ignored',()=>{
  const h=make(); assert.equal(h.renderer.press(),true); assert.equal(h.renderer.press(),false);
});
test('release cannot begin without an active press',()=>{
  const h=make(); assert.equal(h.renderer.release(),false);
});
test('cancel clears presentation state without returning application data',()=>{
  const h=make(); h.renderer.press(); assert.equal(h.renderer.cancel(),true); assert.equal(h.renderer.isActive(),false); assert.equal(h.button._attrs['aria-busy'],undefined);
});
test('renderer public surface contains no selection, trail, commit, reveal, or route authority',()=>{
  const h=make();
  for(const name of ['select','commit','commitAck','trail','reveal','route','result','transaction']) assert.equal(name in h.renderer,false);
});
test('renderer accepts no route identity or result payload',()=>{
  const h=make(); assert.equal(h.renderer.press.length,0); assert.equal(h.renderer.release.length,0); assert.equal(h.renderer.cancel.length,0);
});
test('reduced mode uses causal press without strip travel',()=>{
  const h=make(true); h.renderer.press(); assert.equal(h.button.classList.contains('roll-reduced'),true); assert.equal(h.strip.classList.contains('roll-strip-accelerate'),false);
});
