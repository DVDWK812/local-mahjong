import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const generator = path.join(scriptDirectory, 'generateVoicePackIndex.mjs');
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-pack-index-'));

try {
  const pack = path.join(temporaryRoot, 'female_01');
  await fs.mkdir(path.join(pack, 'audio'), { recursive: true });
  await fs.writeFile(path.join(pack, 'pack.json'), JSON.stringify({
    id: 'female_01', name: '测试角色', locale: 'zh-CN', voiceId: 'voice-test', modelId: 'model-test',
  }), 'utf8');
  await fs.writeFile(path.join(pack, 'manifest.json'), JSON.stringify({
    character: 'female_01', voiceId: 'voice-test', voices: { 'action.riichi': { file: 'audio/action_riichi.mp3' } },
  }), 'utf8');
  await fs.writeFile(path.join(pack, 'voice_lines.csv'), 'key,category,action,line,tts_text,locale,character,emotion\naction.riichi,action,riichi,立直,立直,zh-CN,female_01,firm\n', 'utf8');
  await fs.mkdir(path.join(temporaryRoot, 'broken_pack'));
  await fs.writeFile(path.join(temporaryRoot, 'broken_pack', 'pack.json'), '{}', 'utf8');

  execFileSync(process.execPath, [generator], {
    env: { ...process.env, VOICE_PACKS_ROOT: temporaryRoot },
    stdio: 'pipe',
  });
  const index = JSON.parse(await fs.readFile(path.join(temporaryRoot, 'voice_packs.json'), 'utf8'));
  const lines = JSON.parse(await fs.readFile(path.join(pack, 'voice_lines.json'), 'utf8'));
  assert.deepEqual(index.packs, [{ id: 'female_01', name: '测试角色', locale: 'zh-CN', path: 'female_01' }]);
  assert.equal(index.diagnostics.length, 1);
  assert.equal(lines[0].key, 'action.riichi');
  console.log('Voice Pack index lifecycle test passed.');
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
