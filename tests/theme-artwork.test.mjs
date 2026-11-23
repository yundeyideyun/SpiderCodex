import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,realpath,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {readPreparedGlass} from '../runtime/theme-artwork.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('prepared textures belong to the exact wallpaper and ignore corrupt cache files',async()=>{
  const temporary=await realpath(os.tmpdir());
  const folder=await mkdtemp(path.join(temporary,'spider-artwork-contract-'));
  try{
    const wallpaper=Buffer.from('bundled wallpaper');
    const webp=Buffer.from('RIFF0000WEBP0000','ascii');
    await writeFile(path.join(folder,'client-glass-textures.json'),JSON.stringify({
      version:1,sourceSha256:hash(wallpaper),frostSha256:hash(webp),clearSha256:hash(webp)
    }));
    await writeFile(path.join(folder,'client-glass-frost.webp'),webp);
    await writeFile(path.join(folder,'client-glass-clear.webp'),webp);
    const prepared=await readPreparedGlass(folder,wallpaper);
    assert.ok(prepared.frost.startsWith('data:image/webp;base64,'));
    assert.equal(await readPreparedGlass(folder,Buffer.from('custom wallpaper')),null);
    await writeFile(path.join(folder,'client-glass-clear.webp'),Buffer.from('RIFF0000WEBP0001','ascii'));
    assert.equal(await readPreparedGlass(folder,wallpaper),null);
  }finally{
    const resolved=await realpath(folder);
    if(path.dirname(resolved)===temporary&&path.basename(resolved).startsWith('spider-artwork-contract-'))
      await rm(resolved,{recursive:true});
  }
});
