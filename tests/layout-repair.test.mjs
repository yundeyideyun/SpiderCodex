import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLayoutRepair} from '../runtime/layout-repair.mjs';

test('a saved layout repair is usable only for the exact observed version and safe attributes',()=>{
  const version='26.1120.5083.0';
  const preset={version,mainAttribute:'data-new-main',composerAttribute:'data-new-composer'};
  assert.deepEqual(parseLayoutRepair(preset,version),{mainAttribute:preset.mainAttribute,composerAttribute:preset.composerAttribute});
  assert.equal(parseLayoutRepair(preset,'26.1120.5084.0'),null);
  for(const value of ['data-new-main]','data-x,[role=button]', ['data-new-main'], 'data-new-composer']){
    assert.equal(parseLayoutRepair({...preset,mainAttribute:value},version),null);
  }
});
