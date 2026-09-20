'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createRollRenderer}=require('../roll-renderer.js');

const TIMING=Object.freeze({accelerate:150,decelerate:260,lockHold:40,cardEnter:110});
function el(){
  const set=new Set(),attrs={},props={};
  return {
    classList:{add:(...x)=>x.forEach(v=>set.add(v)),remove:(...x)=>x.forEach(v=>set.delete(v)),contains:x=>set.has(x)},
    style:{setProperty:(k,v)=>{props[k]=v}},
    setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>delete attrs[k],
    _classes:set,_attrs:attrs,_props:props
  };
}
function make(reduced=false){
  const button=el(),strip=el(),routeHost=el();
  const renderer=createRollRenderer({button,strip,routeHost,timing:TIMING,matchMedia:()=>({matches:reduced})});
  return {button,strip,routeHost,renderer};
}
test('machine timing is projected once as CSS custom properties',()=>{
  const h=make();
  assert.deepEqual(h.renderer.timing(),TIMING);
  assert.equal(h.strip._props['--roll-accelerate-ms'],'150ms');
  assert.equal(h.strip._props['--roll-decelerate-ms'],'260ms');
  assert.equal(h.button._props['--roll-lock-hold-ms'],'40ms');
  assert.equal(h.routeHost._props['--roll-card-enter-ms'],'110ms');
});
test('renderer is state-driven and contains no lifecycle timers',()=>{
  const h=make();
  assert.equal(h.renderer.renderState('PRESSED'),true);
  assert.equal(h.button.classList.contains('roll-press'),true);
  assert.equal(h.renderer.renderState('STRIP_ACCELERATING'),true);
  assert.equal(h.strip.classList.contains('roll-strip-accelerate'),true);
  assert.equal(h.renderer.renderState('STRIP_DECELERATING'),true);
  assert.equal(h.strip.classList.contains('roll-strip-accelerate'),false);
  assert.equal(h.strip.classList.contains('roll-strip-decelerate'),true);
  assert.equal(h.renderer.renderState('LOCKED'),true);
  assert.equal(h.strip.classList.contains('roll-strip-seat'),true);
  assert.equal(h.renderer.renderState('CARD_ENTERING'),true);
  assert.equal(h.routeHost.classList.contains('roll-card-enter'),true);
});
test('repeated visual state notifications do not create application authority',()=>{
  const h=make();
  h.renderer.renderState('PRESSED');
  h.renderer.renderState('PRESSED');
  assert.equal(h.renderer.isActive(),true);
  for(const name of ['select','commit','commitAck','trail','reveal','route','result','transaction']) assert.equal(name in h.renderer,false);
});
test('cancel clears presentation state without returning application data',()=>{
  const h=make(); h.renderer.renderState('PRESSED'); h.renderer.renderState('STRIP_ACCELERATING');
  assert.equal(h.renderer.cancel(),true); assert.equal(h.renderer.isActive(),false);
  assert.equal(h.button._attrs['aria-busy'],undefined);
  assert.equal(h.strip.classList.contains('roll-strip-accelerate'),false);
});
test('renderer accepts no route identity or result payload',()=>{
  const h=make();
  assert.equal(h.renderer.cancel.length,0);
  assert.equal('route' in h.renderer,false);
  assert.equal('result' in h.renderer,false);
});
test('reduced mode preserves causal states without strip travel',()=>{
  const h=make(true);
  h.renderer.renderState('PRESSED');
  h.renderer.renderState('RELEASED');
  h.renderer.renderState('STRIP_ACCELERATING');
  assert.equal(h.button.classList.contains('roll-reduced'),true);
  assert.equal(h.strip.classList.contains('roll-strip-accelerate'),false);
});
