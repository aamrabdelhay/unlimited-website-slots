import fs from 'node:fs';
import assert from 'node:assert/strict';
import {BIOME_LIGHTING,applyBiomeLighting} from '../public/wild-trails-biome-lighting.mjs';

const html=fs.readFileSync('public/snake-evolution.html','utf8');
const moduleMatch=html.match(/<script type="module">([\s\S]*?)<\/script>/);
assert.ok(moduleMatch,'Game module script must exist');
new Function(moduleMatch[1]);

for(const [label,fragment] of [
  ['lobby progress navigation','.wt-lobby-progress'],
  ['three lobby steps',"const labels=['المود','الخريطة','الشخصية']"],
  ['choice summary','lobbyChoiceSummary'],
  ['selected map summary','الخريطة:'],
  ['wallet summary','الرصيد:'],
  ['character selection capture','event.stopImmediatePropagation()'],
  ['explicit round start','انطلق إلى العالم'],
  ['start only from confirmation','if(state.step!==2)return'],
  ['shop return path','state.shopOnly=false'],
  ['persisted wallet update','updateHud()']
]){
  assert.ok(html.includes(fragment),'Missing lobby requirement: '+label);
}
for(const id of ['garden','street','station','home','night','kitchen']){
  assert.ok(html.includes("id:'"+id+"'"),'Missing map: '+id);
}
assert.ok(html.includes("$('continueBtn').onclick=()=>{"),'Primary action must have an explicit handler');

assert.deepEqual(Object.keys(BIOME_LIGHTING).sort(),['garden','home','kitchen','night','station','street']);
const makeColor=()=>({value:null,setHex(value){this.value=value}});
const sun={isDirectionalLight:true,castShadow:true,color:makeColor()};
const ambient={isHemisphereLight:true,color:makeColor(),groundColor:makeColor()};
const renderer={};
const applied=applyBiomeLighting({children:[sun,ambient]},renderer,'night');
assert.equal(applied,BIOME_LIGHTING.night);
assert.equal(sun.intensity,.48);
assert.equal(ambient.intensity,.68);
assert.equal(renderer.toneMappingExposure,.98);
applyBiomeLighting({children:[sun,ambient]},renderer,'unknown');
assert.equal(sun.color.value,BIOME_LIGHTING.garden.sun);
assert.ok(html.includes('wildTrailsBiomeLightingIntegration'),'Biome lighting must be connected to world construction');
assert.ok(html.includes("import('./wild-trails-biome-lighting.mjs')"),'Biome lighting must lazy-load locally');
console.log('Wild Trails validation passed: module syntax, lobby flow, six maps, six biome-lighting profiles and safe fallback.');

