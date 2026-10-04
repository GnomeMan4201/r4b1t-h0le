'use strict';
// Explicit namespace fence; the behavioral regression also exercises the real loader/pools.
const fs = require('node:fs');
const path = require('node:path');
function checkSource(source) {
  if (/corpus[\\/]ledger|ledger[\\/]shadow/.test(source)) throw new Error('SHADOW_AUTHORITY_IN_PRODUCTION');
}
function checkProduction(root) {
  const entries=fs.readdirSync(root).filter(name => /\.(?:js|html)$/.test(name));
  for(const name of entries) checkSource(fs.readFileSync(path.join(root,name),'utf8'));
  const promotion=JSON.parse(fs.readFileSync(path.join(root,'corpus/runtime/active-v1.json'),'utf8'));
  checkSource(JSON.stringify(promotion));
  return entries.length;
}
module.exports={checkSource,checkProduction};
if(require.main===module) console.log('SHADOW/PUBLIC BOUNDARY VERIFIED:',checkProduction(process.cwd()),'production files');
