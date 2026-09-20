'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRollDisclosureBoundary } = require('../roll-disclosure-boundary.js');

function harness() {
  const dom = [];
  const accessibility = [];
  const boundary = createRollDisclosureBoundary({
    createNode(result) {
      return Object.freeze({
        textContent: result.domain,
        href: result.url,
        ariaLabel: 'Visit ' + result.domain
      });
    },
    mountNode(node) {
      dom.push(node);
      accessibility.push(node.ariaLabel);
    }
  });
  return { boundary, dom, accessibility };
}

test('committed route does not create a DOM node before reveal', () => {
  const h=harness();
  h.boundary.commit(1,{url:'https://secret.example/path',domain:'secret.example'});
  assert.equal(h.dom.length,0);
});

test('committed route does not enter accessibility surface before reveal', () => {
  const h=harness();
  h.boundary.commit(1,{url:'https://secret.example/path',domain:'secret.example'});
  assert.deepEqual(h.accessibility,[]);
});

test('boundary stores no hidden placeholder node pre-reveal', () => {
  const h=harness();
  h.boundary.commit(1,{url:'https://secret.example/path',domain:'secret.example'});
  assert.equal(h.boundary.snapshot().hasPendingResult,true);
  assert.equal(h.dom.some(n=>n.hidden || n.ariaHidden || n.style),false);
});

test('matching machine reveal creates and mounts result exactly once', () => {
  const h=harness();
  h.boundary.commit(7,{url:'https://result.example',domain:'result.example'});
  assert.equal(h.boundary.reveal({transactionId:7}),true);
  assert.equal(h.dom.length,1);
  assert.equal(h.dom[0].textContent,'result.example');
  assert.equal(h.boundary.reveal({transactionId:7}),false);
  assert.equal(h.dom.length,1);
});

test('foreign reveal transaction cannot disclose pending result', () => {
  const h=harness();
  h.boundary.commit(7,{url:'https://result.example',domain:'result.example'});
  assert.equal(h.boundary.reveal({transactionId:8}),false);
  assert.equal(h.dom.length,0);
});

test('missing reveal event cannot disclose pending result', () => {
  const h=harness();
  h.boundary.commit(7,{url:'https://result.example',domain:'result.example'});
  assert.equal(h.boundary.reveal(),false);
  assert.equal(h.dom.length,0);
});

test('pre-reveal cancellation destroys pending disclosure eligibility', () => {
  const h=harness();
  h.boundary.commit(7,{url:'https://result.example',domain:'result.example'});
  assert.equal(h.boundary.cancel(7),true);
  assert.equal(h.boundary.reveal({transactionId:7}),false);
  assert.equal(h.dom.length,0);
});

test('foreign cancellation cannot destroy active pending result', () => {
  const h=harness();
  h.boundary.commit(7,{url:'https://result.example',domain:'result.example'});
  assert.equal(h.boundary.cancel(8),false);
  assert.equal(h.boundary.reveal({transactionId:7}),true);
});

test('route-specific text appears only in node created at reveal', () => {
  const h=harness();
  const route={url:'https://classified.example/a',domain:'classified.example'};
  h.boundary.commit(3,route);
  assert.equal(JSON.stringify(h.dom).includes('classified.example'),false);
  h.boundary.reveal({transactionId:3});
  assert.equal(JSON.stringify(h.dom).includes('classified.example'),true);
});

test('new transaction replaces stale pending disclosure without mounting it', () => {
  const h=harness();
  h.boundary.commit(1,{url:'https://old.example',domain:'old.example'});
  h.boundary.commit(2,{url:'https://new.example',domain:'new.example'});
  assert.equal(h.boundary.reveal({transactionId:1}),false);
  assert.equal(h.dom.length,0);
  assert.equal(h.boundary.reveal({transactionId:2}),true);
  assert.equal(h.dom[0].textContent,'new.example');
});
