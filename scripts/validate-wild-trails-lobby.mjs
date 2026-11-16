import fs from 'node:fs';
import assert from 'node:assert/strict';
import { BIOME_LIGHTING } from '../public/wild-trails-art.mjs';

const html = fs.readFileSync('public/snake-evolution.html', 'utf8');
const moduleOpen = '<script type="module">';
const moduleStart = html.indexOf(moduleOpen);
assert.notEqual(moduleStart, -1, 'Game module script must exist');
const codeStart = moduleStart + moduleOpen.length;
const moduleEnd = html.indexOf('</script>', codeStart);
assert.notEqual(moduleEnd, -1, 'Game module script must close');
new Function(html.slice(codeStart, moduleEnd));

const required = [
  ['three-step lobby navigation', '.wt-lobby-progress'],
  ['mode/map/character selection', 'wildTrailsLobbyExperience'],
  ['character selection before round start', 'انطلق إلى العالم'],
  ['selected 3D map preview', 'syncMapPreview'],
  ['responsive 3D map detail panel', '.wt-map-stage{display:grid'],
  ['selected character preview surface', '.wt-selected-companion{display:grid'],
  ['pixel map canvases', '#stepContent .wt-pixel-map'],
  ['energy system', 'wt-energy'],
  ['daily missions and profile progression', 'wtMissionsDef'],
  ['separate gold pickups', 'function wtMakeGoldCoin'],
  ['independent gold reward path', 'function wtRecordGold'],
  ['food reward path', 'window.wtRecordFood(type'],
  ['wildlife system', 'function wtUpdateWildlife'],
  ['safe map spawning', 'function wtChoosePlayerSpawn'],
  ['collision knockback and dizzy reaction', 'function wtHandleImpact'],
  ['indoor camera clipping protection', 'camPos.x=clamp(camPos.x,-32.5,32.5)'],
  ['station pedestrian crossing', 'const deck=new THREE.Mesh(new THREE.BoxGeometry(29,.16,5.2)'],
  ['snake dynamic body mesh', 'wtArt.createSnakeBodyMesh'],
  ['articulated snake head', 'wtArt.enhanceSnakeHead'],
  ['cinematic PBR shader pass', 'function wtInstallPBRShader'],
  ['procedural wind-driven grass', 'function wtMakeGrassBatch'],
  ['ambient biome particles', 'function wtAddAmbientParticles'],
  ['soft creature contact shadows', 'Soft creature contact shadow'],
  ['all six map boundaries', 'function addBoundaryMarkers'],
  ['low-power animated lobby previews', 'function renderLobbyPreviewFrame']
];
for (const [label, fragment] of required) {
  assert.ok(html.includes(fragment), 'Missing feature: ' + label);
}

for (const id of ['garden','street','station','home','night','kitchen']) {
  assert.ok(html.includes("id:'" + id + "'"), 'Missing map: ' + id);
  assert.ok(BIOME_LIGHTING[id], 'Missing biome lighting profile: ' + id);
}
assert.deepEqual(Object.keys(BIOME_LIGHTING).sort(), ['garden','home','kitchen','night','station','street']);

for (const forbidden of [
  'state.coins+=f.userData.value||1',
  'state.coins+=f.userData.value;',
  'state.score++;state.coins++;classic.food=',
  'state.score++;state.coins++;classic.power=null'
]) assert.ok(!html.includes(forbidden), 'Food must not award spendable gold directly: ' + forbidden);

assert.ok(html.includes('player.userData.wtVisualSpeed=dt>0?traveled/dt:0;'), 'Animation must use actual movement distance');
assert.ok(html.includes('const energyFactor=.34+.66*clamp((state.energy===undefined?100:state.energy)/100,0,1)'), '3D movement speed must account for energy');
assert.ok(html.includes('const worldEdgeHit=Math.abs(nextX)>105||Math.abs(nextZ)>105'), 'World bounds must use recoverable knockback');
assert.ok(html.includes("wss://snake-evolution-mp.aamrabdelhay.workers.dev"), 'Existing multiplayer endpoint must remain intact');

const artSource = fs.readFileSync('public/wild-trails-art.mjs', 'utf8');
for (const name of ['createSnakeBodyMesh','updateSnakeBodyMesh','enhanceSnakeHead','animateSnakeHead','animateLocomotion']) {
  assert.ok(artSource.includes('export function ' + name), 'Missing procedural art export: ' + name);
}
console.log('Wild Trails validation passed: game syntax, progression, economy, wildlife, knockback, art, animation, six maps and six lighting profiles.');
