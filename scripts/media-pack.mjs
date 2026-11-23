import path from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {lstat, open, readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';

const mediaFiles = Object.freeze([
  'city.mp4', 'client-brighter.png', 'spider-knot.ico',
  'v5/mask-base.png', 'v5/mask-eyes.png', 'v5/title-spiderman.png',
  'v5/title-workspace.png', 'v5/reference-ui.json', 'v5/web-screen.mp4',
  'v5/shot-screen.mp4', 'v5/rings.png', 'v5/rings-source.json',
  'v6/red-color.mp4', 'v6/red-collapse.mp4', 'v6/red-collapse.json',
]);
const manifestName = 'spider-media.json';
const schema = 'spidercodex-reference-scene-v1';
const foregroundSilk = 'v6/foreground-silk.mp4';

async function ordinary(root, relative) {
  let current = root;
  const base = await lstat(current);
  if (!base.isDirectory() || base.isSymbolicLink()) throw Error('Expected a regular asset directory.');
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw Error('Asset path is redirected: ' + relative);
  }
  const stat = await lstat(current);
  if (!stat.isFile() || !stat.size || stat.size > 192 * 1024 * 1024) throw Error('Invalid asset size: ' + relative);
  return {current, size: stat.size};
}

async function digest(file) {
  const hash = createHash('sha256');
  for await (const part of createReadStream(file)) hash.update(part);
  return hash.digest('hex');
}

function numbers(value, length) {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}
function box(value) {
  return numbers(value, 4) && value[0] >= 0 && value[1] >= 0 &&
    value[2] > 0 && value[3] > 0 && value[0] + value[2] <= 1920 &&
    value[1] + value[3] <= 1080;
}

async function checkGeometry(root) {
  async function json(relative) {
    const file = await ordinary(root, relative);
    if (file.size > 32768) throw Error('Geometry metadata is too large: ' + relative);
    return JSON.parse((await readFile(file.current, 'utf8')).replace(/^\uFEFF/, ''));
  }
  const mask = await json('v5/reference-ui.json');
  const rings = await json('v5/rings-source.json');
  const dissolve = await json('v6/red-collapse.json');
  if (mask.referenceWidth !== 1920 || mask.referenceHeight !== 1080 ||
      !numbers(mask.maskCenter, 2) || mask.maskCenter[0] !== 947 || mask.maskCenter[1] !== 518 ||
      !box(mask.maskBox) || !box(mask.titleBox) || !box(mask.workspaceBox) || !box(rings.box) ||
      !box(dissolve.box) || dissolve.colorMode !== 'rgb-video' ||
      dissolve.colorVideo !== 'v6/red-color.mp4' || !numbers(dissolve.colorRGB, 3) ||
      dissolve.colorRGB.some(c => c < 0 || c > 255) || ![30, 60].includes(dissolve.fps)) {
    throw Error('Scene geometry does not match the 1920×1080 renderer contract.');
  }
  if (Object.hasOwn(mask, 'foregroundSilkBox')) {
    if (!box(mask.foregroundSilkBox)) throw Error('The foreground silk crop is outside the scene.');
    return [...mediaFiles,foregroundSilk];
  }
  return mediaFiles;
}

async function verifyPngChunks(fd, size, name) {
  const chunk = Buffer.alloc(8);
  let imageBytes = 0;
  for (let offset = 8; offset + 12 <= size;) {
    const {bytesRead} = await fd.read(chunk, 0, chunk.length, offset);
    if (bytesRead !== chunk.length) break;
    const length = chunk.readUInt32BE(0);
    const type = chunk.toString('ascii', 4);
    const end = offset + length + 12;
    if (end > size || (offset === 8 && (type !== 'IHDR' || length !== 13))) break;
    if (type === 'IDAT') imageBytes += length;
    if (type === 'IEND') {
      if (length === 0 && end === size && imageBytes > 0) return;
      break;
    }
    offset = end;
  }
  throw Error('Incomplete PNG: ' + name);
}

async function verifyMp4Boxes(fd, size, name) {
  const header = Buffer.alloc(16);
  const required = new Set(['ftyp', 'moov', 'mdat']);
  for (let offset = 0; offset < size;) {
    const {bytesRead} = await fd.read(header, 0, header.length, offset);
    if (bytesRead < 8) throw Error('Truncated MP4 box: ' + name);
    const type = header.toString('ascii',4,8);
    let length = header.readUInt32BE(0);
    let headerLength = 8;
    if (length === 1) {
      if (bytesRead < 16) throw Error('Truncated MP4 box: ' + name);
      length = Number(header.readBigUInt64BE(8));
      headerLength = 16;
    } else if (length === 0) {
      length = size-offset;
    }
    if (length < headerLength || length > size-offset || (offset === 0 && type !== 'ftyp')) {
      throw Error('Invalid MP4 box: ' + name);
    }
    if (length > headerLength) required.delete(type);
    offset += length;
  }
  if (required.size) throw Error('Incomplete MP4: ' + name);
}

async function verifyIcoDirectory(fd, size, header, bytesRead, name) {
  if (bytesRead < 6 || header.readUInt32LE() !== 0x10000) throw Error('Invalid icon: ' + name);
  const count = header.readUInt16LE(4);
  const directoryEnd = 6 + count * 16;
  if (!count || directoryEnd > size) throw Error('Incomplete icon: ' + name);
  const entries = Buffer.alloc(directoryEnd-6);
  const result = await fd.read(entries, 0, entries.length, 6);
  if (result.bytesRead !== entries.length) throw Error('Truncated icon directory: ' + name);
  for (let record = 0; record < entries.length; record += 16) {
    const length = entries.readUInt32LE(record+8);
    const offset = entries.readUInt32LE(record+12);
    if (!length || offset < directoryEnd || offset + length > size) throw Error('Incomplete icon image: ' + name);
  }
}

async function inventory(root) {
  const files = [];
  for (const name of await checkGeometry(root)) {
    const entry = await ordinary(root, name);
    const fd = await open(entry.current, 'r');
    try {
      const header = Buffer.alloc(24);
      const {bytesRead} = await fd.read(header);
      if (name.endsWith('.png')) {
        if (bytesRead < 24 || header.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
          header.subarray(12,16).toString() !== 'IHDR') throw Error('Invalid PNG: ' + name);
        const width = header.readUInt32BE(16), height = header.readUInt32BE(20);
        if (!width || !height || width > 4096 || height > 4096 || width*height > 3840*2160) throw Error('PNG dimensions exceed limits: ' + name);
        await verifyPngChunks(fd, entry.size, name);
      }
      if (name.endsWith('.mp4')) await verifyMp4Boxes(fd, entry.size, name);
      if (name.endsWith('.ico')) await verifyIcoDirectory(fd, entry.size, header, bytesRead, name);
    } finally { await fd.close(); }
    files.push({path: name, length: entry.size, sha256: await digest(entry.current)});
  }
  return files;
}

async function copyMedia(origin, target, files) {
  await mkdir(path.dirname(path.resolve(target)), {recursive: true});
  await mkdir(target);
  for (const {path:name} of files) {
    const file = await ordinary(origin, name);
    const to = path.join(target, name);
    await mkdir(path.dirname(to), {recursive: true});
    await copyFile(file.current,to);
  }
}

async function verify(root) {
  const manifest = await ordinary(root, manifestName);
  if (manifest.size > 32768) throw Error('Media manifest is too large.');
  const spec = JSON.parse((await readFile(manifest.current, 'utf8')).replace(/^\uFEFF/, ''));
  const found = await inventory(root);
  const entries = new Map(spec.files?.map(entry => [entry.path, entry]));
  if (spec.schema !== schema || spec.files?.length !== found.length || entries.size !== found.length ||
      found.some(entry => entries.get(entry.path)?.length !== entry.length || entries.get(entry.path)?.sha256 !== entry.sha256)) {
    throw Error('Media manifest does not match its files.');
  }
  return found;
}

const [operation, from, to] = process.argv.slice(2);
if (!from || !['check','verify','pack','import'].includes(operation) || (['pack','import'].includes(operation) && !to)) {
  console.error('Usage: node scripts/media-pack.mjs check <assets> | verify <pack> | pack <assets> <new pack> | import <pack> <new directory>');
  process.exitCode = 2;
} else {
  try {
    let files;
    if (operation === 'check') {
      files = await inventory(from);
    } else if (operation === 'pack') {
      const original = await inventory(from);
      await copyMedia(from, to, original);
      files = await inventory(to);
      if (JSON.stringify(original) !== JSON.stringify(files)) throw Error('Assets changed while packing.');
      await writeFile(path.join(to,manifestName), JSON.stringify({schema, files},null,2)+'\n', {flag:'wx'});
    } else {
      files = await verify(from);
      if (operation === 'import') {
        await copyMedia(from, to, files);
        const copied = await inventory(to);
        if (JSON.stringify(files) !== JSON.stringify(copied)) throw Error('Assets changed while copying.');
      }
    }
    console.log(JSON.stringify({passed:true, files:files.length, schema, decodingTested:false}));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
