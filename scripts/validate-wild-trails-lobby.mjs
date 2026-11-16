import fs from 'node:fs';
import assert from 'node:assert/strict';

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
console.log('Wild Trails lobby validation passed: module syntax, three-step navigation, selection/confirmation flow, wallet and six maps.');
