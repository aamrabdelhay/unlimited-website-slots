import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIOME_LIGHTING, applyBiomeLighting, createMotionState, stepMotion, animateLocomotion, createSnakeBodyMesh, updateSnakeBodyMesh, snakeBodyRadius, animateSnakeHead, createSnakeHeadMaterials, stepPreviewSpin } from '../public/wild-trails-art.mjs';

test('six distinct biome lighting profiles with safe fallback',()=>{
  assert.deepEqual(Object.keys(BIOME_LIGHTING).sort(),['garden','home','kitchen','night','station','street']);
  const color=()=>({setHex(value){this.value=value}});
  const sun={isDirectionalLight:true,castShadow:true,color:color()},ambient={isHemisphereLight:true,color:color(),groundColor:color()};
  const scene={children:[sun,ambient]},renderer={};
  applyBiomeLighting(scene,renderer,'night');assert.equal(sun.intensity,.48);assert.equal(renderer.toneMappingExposure,.98);
  applyBiomeLighting(scene,renderer,'missing');assert.equal(sun.color.value,BIOME_LIGHTING.garden.sun);
});

test('locomotion blends actual speed and settles without unbounded lean',()=>{
  const state=createMotionState();
  for(let i=0;i<60;i++)stepMotion(state,1/60,6,4,'rabbit');
  assert.ok(state.blend>.99);assert.ok(state.lean<-.9&&state.lean>=-1);
  for(let i=0;i<120;i++)stepMotion(state,1/60,0,0,'rabbit');
  assert.ok(state.blend<.001);assert.ok(Math.abs(state.lean)<.001);
  stepMotion(state,NaN,NaN,NaN,'snake');assert.ok(Number.isFinite(state.phase));
});

test('animal gait uses diagonals and leaves the gameplay root unchanged',()=>{
  const limbs=Array.from({length:4},()=>({rotation:{x:0}}));
  const torso={rotation:{z:.04},scale:{y:1}};
  const actor={userData:{kind:'fox',rig:{limbs,wings:[]}},rotation:{z:0},position:{x:3,y:0,z:4},getObjectByName(name){return name==='Muscular torso'?torso:null}};
  for(let i=0;i<90;i++)animateLocomotion(actor,.05,6,4);
  assert.ok(Math.abs(limbs[0].rotation.x-limbs[3].rotation.x)<1e-10);
  assert.ok(Math.abs(limbs[0].rotation.x+limbs[1].rotation.x)<1e-10);
  assert.ok(Math.abs(torso.rotation.z)<.1,'torso lean must remain bounded');
  assert.equal(actor.rotation.z,0,'visual gait must not accumulate on the gameplay root');
  assert.deepEqual(actor.position,{x:3,y:0,z:4});
  for(let i=0;i<120;i++)animateLocomotion(actor,.05,0,0);
  assert.ok(Math.abs(torso.rotation.z-.04)<.001,'torso rotation must return to its authored rest angle');
});


test('snake body builder preallocates a finite tapered mesh and safely follows curved history',()=>{
  class Attribute {
    constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.needsUpdate=false;}
    setUsage(){return this;}
  }
  class Geometry {
    constructor(){this.attributes={};this.normalsComputed=0;}
    setAttribute(name,attribute){this.attributes[name]=attribute;return this;}
    setIndex(index){this.index=index;return this;}
    computeVertexNormals(){this.normalsComputed++;return this;}
  }
  class Material {constructor(options){Object.assign(this,options);this.userData={};}}
  class Mesh {
    constructor(geometry,material){this.geometry=geometry;this.material=material;this.userData={};}
  }
  const THREE={
    BufferGeometry:Geometry,
    BufferAttribute:Attribute,
    MeshStandardMaterial:Material,
    MeshPhysicalMaterial:Material,
    Mesh,
    DynamicDrawUsage:35048,
    DoubleSide:2
  };
  const skin={color:0x65c85d,accent:0x2f773b};
  const body=createSnakeBodyMesh(THREE,skin,56);
  const positionAttribute=body.geometry.attributes.position;
  const originalBuffer=positionAttribute.array;
  const path=[];
  for(let i=0;i<360;i++)path.push({x:Math.sin(i*.025)*2.2,y:0,z:i*.12});
  const before=path.map(point=>[point.x,point.y,point.z]);
  updateSnakeBodyMesh(body,path,2.4,6.2);
  assert.equal(positionAttribute.array,originalBuffer,'the dynamic vertex buffer must be reused');
  assert.equal(positionAttribute.array.length,56*24*3);
  assert.ok(positionAttribute.array.every(Number.isFinite),'all deformed vertices must remain finite');
  assert.ok(body.geometry.normalsComputed>0,'deformation must refresh surface normals');
  assert.ok(snakeBodyRadius(0)>snakeBodyRadius(1)*2,'the body must taper clearly toward the tail');
  assert.deepEqual(path.map(point=>[point.x,point.y,point.z]),before,'visual deformation must never mutate gameplay history');
  updateSnakeBodyMesh(body,path,2.6,0);
  assert.equal(positionAttribute.array,originalBuffer,'idle updates must not allocate a new vertex buffer');
  assert.ok(positionAttribute.array.every(Number.isFinite));
});

test('snake head animation stays bounded and never changes the gameplay root',()=>{
  const actor={
    position:{x:2,y:0,z:4},
    rotation:{x:0,y:0,z:0},
    userData:{wtSnakeRig:{
      headRoot:{position:{y:0},rotation:{x:0,y:0,z:0}},
      jawPivot:{rotation:{x:0}},
      tonguePivot:{scale:{z:.12},position:{z:-1.055}},
      eyes:[{group:{scale:{y:1},rotation:{x:0,y:0}},baseScaleY:1,baseRotationX:0,baseRotationY:0},{group:{scale:{y:1},rotation:{x:0,y:0}},baseScaleY:1,baseRotationX:0,baseRotationY:0}],
      phase:.73,baseHeadY:0,baseHeadX:0,baseHeadYRotation:0,baseHeadZ:0,baseJawRotation:0,baseTongueZ:-1.055
    }}
  };
  for(let i=0;i<120;i++)animateSnakeHead(actor,1/60,i/60,6,4,false);
  const rig=actor.userData.wtSnakeRig;
  assert.ok(rig.eyes.some(eye=>eye.group.rotation.y!==0 || eye.group.rotation.x!==0),'eyes should make subtle gaze movements');
  assert.ok(Math.abs(rig.headRoot.rotation.y)<.12);
  assert.ok(Math.abs(rig.headRoot.rotation.z)<.09);
  assert.ok(Math.abs(rig.jawPivot.rotation.x)<.06);
  assert.ok(Number.isFinite(rig.tonguePivot.scale.z));
  animateSnakeHead(actor,1/60,3,6,4,true);
  assert.ok(rig.jawPivot.rotation.x<-.25,'feeding must lower the visual jaw');
  assert.ok(rig.tonguePivot.scale.z>.6,'feeding must extend the tongue');
  assert.deepEqual(actor.position,{x:2,y:0,z:4});
  assert.deepEqual(actor.rotation,{x:0,y:0,z:0});
});


test('snake head materials are shared instead of reallocated on every respawn',()=>{
  class Material {constructor(options){this.options=options;}}
  const THREE={MeshStandardMaterial:Material,MeshBasicMaterial:Material};
  const skin={color:0x65c85d,accent:0x2f773b};
  const first=createSnakeHeadMaterials(THREE,skin);
  const second=createSnakeHeadMaterials(THREE,skin);
  assert.equal(first,second);
  assert.equal(first.bellyMaterial,second.bellyMaterial);
  assert.equal(first.tongueMaterial,second.tongueMaterial);
});


test('lobby preview spin is finite and clamps long or invalid frame deltas',()=>{
  assert.equal(stepPreviewSpin(1,.05,.38),1+.05*.38);
  assert.equal(stepPreviewSpin(1,10,.38),1+.05*.38);
  assert.equal(stepPreviewSpin(1,-1,.38),1);
  assert.equal(stepPreviewSpin(NaN,.02,.38),.02*.38);
  assert.ok(Number.isFinite(stepPreviewSpin(0,Infinity)));
});
