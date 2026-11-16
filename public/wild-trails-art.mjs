// Original procedural art controls for the existing Three.js game.
// This module owns no gameplay state, collision objects, textures or assets.
export const BIOME_LIGHTING = Object.freeze({
  garden:  {sun:0xffe2b2,sunPower:2.1, sky:0xe5f2dc, ground:0x3d5140, ambient:1.55, exposure:1.12},
  street:  {sun:0xffe2c3,sunPower:1.85,sky:0xd8ebf1, ground:0x4d5551, ambient:1.42, exposure:1.08},
  station: {sun:0xe9edf0,sunPower:1.6, sky:0xd8e5e4, ground:0x50564e, ambient:1.32, exposure:1.09},
  home:    {sun:0xffc48d,sunPower:1.05,sky:0xffe4c5, ground:0x584337, ambient:1.15, exposure:1.09},
  kitchen: {sun:0xffd8a9,sunPower:1.20,sky:0xe4f1e4, ground:0x555d50, ambient:1.22, exposure:1.10},
  night:   {sun:0x9abbe5,sunPower:.48, sky:0x769ab9, ground:0x172b31, ambient:.68, exposure:.98}
});

export function applyBiomeLighting(scene, renderer, biome) {
  const p=BIOME_LIGHTING[biome] || BIOME_LIGHTING.garden;
  const sun=scene.children.find(o=>o.isDirectionalLight && o.castShadow);
  const ambient=scene.children.find(o=>o.isHemisphereLight);
  if(sun){sun.color.setHex(p.sun);sun.intensity=p.sunPower;}
  if(ambient){ambient.color.setHex(p.sky);ambient.groundColor.setHex(p.ground);ambient.intensity=p.ambient;}
  if(renderer)renderer.toneMappingExposure=p.exposure;
}

export function createMotionState(){return {phase:0,blend:0,lean:0};}
export function stepMotion(state, dt, speed, turnRate, species){
  dt=Math.min(.05,Math.max(0,Number.isFinite(dt)?dt:0));
  const target=Math.min(1,Math.max(0,(Number.isFinite(speed)?speed:0)/6));
  state.blend+=(target-state.blend)*(1-Math.exp(-dt*7));
  const turn=Math.max(-1,Math.min(1,(Number.isFinite(turnRate)?turnRate:0)/4));
  state.lean+=(-turn*state.blend-state.lean)*(1-Math.exp(-dt*8));
  const stride=species==='turtle'?.65:species==='rabbit'?1.2:species==='penguin'?.85:1;
  state.phase=(state.phase+dt*(2.2+state.blend*8)*stride)%(Math.PI*2);
  return state;
}

// Runs after the existing idle/bite rig: never moves the gameplay root or collider.
export function animateLocomotion(actor, dt, speed, turnRate){
  if(!actor?.userData?.rig)return;
  const data=actor.userData,rig=data.rig;
  const state=stepMotion(data.wtLocomotion||(data.wtLocomotion=createMotionState()),dt,speed,turnRate,data.kind);
  const phases=rig.limbs?.length===2?[0,Math.PI]:[0,Math.PI,Math.PI,0];
  for(let i=0;i<(rig.limbs?.length||0);i++){
    const amplitude=data.kind==='turtle'?.23:data.kind==='penguin'?.31:.42;
    rig.limbs[i].rotation.x=Math.sin(state.phase+phases[i%phases.length])*amplitude*state.blend;
  }
  for(const wing of rig.wings||[]){wing.group.rotation.z=wing.side*(.06+Math.sin(state.phase*1.3)*.24*state.blend);}
  const torso=actor.getObjectByName?.('Muscular torso')||actor.getObjectByName?.('Feathered body');
  if(torso){
    if(!Number.isFinite(state.baseTorsoRotationZ))state.baseTorsoRotationZ=torso.rotation.z||0;
    torso.rotation.z=state.baseTorsoRotationZ+state.lean*(data.kind==='penguin'?.09:.055);
    torso.scale.y=1+Math.sin(state.phase*.5)*(.008+.004*(1-state.blend));
  }
}


// ---------------------------------------------------------------------------
// PHASE 1 — premium snake foundation.
// Visual-only: these helpers never write gameplay position, collision, score,
// progression or save state. Geometry buffers are allocated once per rebuild.
// ---------------------------------------------------------------------------
const wtSnakeTextureCache = new Map();
const wtSnakeMaterialCache = new Map();

function wtSnakeHexRgb(hex) {
  return [(hex>>16)&255,(hex>>8)&255,hex&255];
}
function wtSnakeRgb(hex, scale) {
  const c=wtSnakeHexRgb(hex);
  return 'rgb('+Math.round(c[0]*scale)+','+Math.round(c[1]*scale)+','+Math.round(c[2]*scale)+')';
}
function wtSnakeScaleMaps(THREE, skin) {
  const key=String(skin.color)+':'+String(skin.accent);
  if(wtSnakeTextureCache.has(key)) return wtSnakeTextureCache.get(key);
  if(typeof document==='undefined') {
    const empty={map:null,bumpMap:null};
    wtSnakeTextureCache.set(key,empty);
    return empty;
  }
  const colorCanvas=document.createElement('canvas');
  colorCanvas.width=512;colorCanvas.height=256;
  const colorContext=colorCanvas.getContext('2d');
  const heightCanvas=document.createElement('canvas');
  heightCanvas.width=512;heightCanvas.height=256;
  const heightContext=heightCanvas.getContext('2d');
  const roughnessCanvas=document.createElement('canvas');
  roughnessCanvas.width=512;roughnessCanvas.height=256;
  const roughnessContext=roughnessCanvas.getContext('2d');
  if(!colorContext||!heightContext||!roughnessContext) {
    const empty={map:null,bumpMap:null,roughnessMap:null};
    wtSnakeTextureCache.set(key,empty);
    return empty;
  }
  colorContext.fillStyle=wtSnakeRgb(skin.color,.78);
  colorContext.fillRect(0,0,512,256);
  heightContext.fillStyle='rgb(112,112,112)';
  heightContext.fillRect(0,0,512,256);
  roughnessContext.fillStyle='rgb(178,178,178)';
  roughnessContext.fillRect(0,0,512,256);
  const cellW=16,cellH=16;
  for(let row=-1;row<=16;row++) {
    for(let col=-1;col<=32;col++) {
      const x=col*cellW+(row%2?cellW*.5:0),y=row*cellH;
      const variation=.84+(((row*17+col*11)%7+7)%7)*.045;
      colorContext.beginPath();
      colorContext.moveTo(x-cellW*.49,y-cellH*.18);
      colorContext.quadraticCurveTo(x,y-cellH*.72,x+cellW*.49,y-cellH*.18);
      colorContext.quadraticCurveTo(x+cellW*.47,y+cellH*.34,x,y+cellH*.49);
      colorContext.quadraticCurveTo(x-cellW*.47,y+cellH*.34,x-cellW*.49,y-cellH*.18);
      colorContext.fillStyle=wtSnakeRgb(skin.color,variation);
      colorContext.fill();
      colorContext.lineWidth=1.0;
      colorContext.strokeStyle=wtSnakeRgb(skin.accent,.72);
      colorContext.stroke();
      colorContext.beginPath();
      colorContext.moveTo(x-cellW*.34,y-cellH*.13);
      colorContext.quadraticCurveTo(x,y-cellH*.48,x+cellW*.34,y-cellH*.13);
      colorContext.strokeStyle='rgba(238,255,209,.27)';
      colorContext.lineWidth=.8;
      colorContext.stroke();

      heightContext.beginPath();
      heightContext.moveTo(x-cellW*.49,y-cellH*.18);
      heightContext.quadraticCurveTo(x,y-cellH*.72,x+cellW*.49,y-cellH*.18);
      heightContext.quadraticCurveTo(x+cellW*.47,y+cellH*.34,x,y+cellH*.49);
      heightContext.quadraticCurveTo(x-cellW*.47,y+cellH*.34,x-cellW*.49,y-cellH*.18);
      const relief=150+Math.round((variation-.84)*115);
      heightContext.fillStyle='rgb('+relief+','+relief+','+relief+')';
      heightContext.fill();
      heightContext.lineWidth=1.2;
      heightContext.strokeStyle='rgb(82,82,82)';
      heightContext.stroke();

      const roughness=Math.max(118,Math.min(218,190-Math.round((variation-.84)*105)));
      roughnessContext.beginPath();
      roughnessContext.moveTo(x-cellW*.49,y-cellH*.18);
      roughnessContext.quadraticCurveTo(x,y-cellH*.72,x+cellW*.49,y-cellH*.18);
      roughnessContext.quadraticCurveTo(x+cellW*.47,y+cellH*.34,x,y+cellH*.49);
      roughnessContext.quadraticCurveTo(x-cellW*.47,y+cellH*.34,x-cellW*.49,y-cellH*.18);
      roughnessContext.fillStyle='rgb('+roughness+','+roughness+','+roughness+')';
      roughnessContext.fill();
      roughnessContext.lineWidth=1;
      roughnessContext.strokeStyle='rgb(218,218,218)';
      roughnessContext.stroke();
    }
  }
  const map=new THREE.CanvasTexture(colorCanvas);
  const bumpMap=new THREE.CanvasTexture(heightCanvas);
  const roughnessMap=new THREE.CanvasTexture(roughnessCanvas);
  for(const texture of [map,bumpMap,roughnessMap]) {
    texture.wrapS=THREE.RepeatWrapping;
    texture.wrapT=THREE.RepeatWrapping;
    texture.generateMipmaps=true;
    texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.magFilter=THREE.LinearFilter;
    texture.needsUpdate=true;
  }
  if(THREE.SRGBColorSpace)map.colorSpace=THREE.SRGBColorSpace;
  const maps={map,bumpMap,roughnessMap};
  wtSnakeTextureCache.set(key,maps);
  return maps;
}

export function createSnakeSkinMaterial(THREE, skin) {
  const key=String(skin?.color??0x65c85d)+':'+String(skin?.accent??0x2f773b);
  if(wtSnakeMaterialCache.has(key)) return wtSnakeMaterialCache.get(key);
  const maps=wtSnakeScaleMaps(THREE,skin||{color:0x65c85d,accent:0x2f773b});
  const Material=THREE.MeshPhysicalMaterial||THREE.MeshStandardMaterial;
  const material=new Material({
    color:0xffffff,
    map:maps.map,
    bumpMap:maps.bumpMap,
    bumpScale:maps.bumpMap ? 0.028 : 0,
    roughnessMap:maps.roughnessMap,
    roughness:.47,
    metalness:.025,
    clearcoat:.16,
    clearcoatRoughness:.38,
    side:THREE.DoubleSide,
    vertexColors:false
  });
  material.name='Phase 1 procedural snake scales';
  material.userData={...(material.userData||{}),wtSnakeSkin:true};
  wtSnakeMaterialCache.set(key,material);
  return material;
}

export function snakeBodyRadius(progress) {
  const u=Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
  return .30-.275*Math.pow(u,1.35)+.018*Math.sin(u*Math.PI);
}

export function createSnakeBodyMesh(THREE, skin, requestedRings=56) {
  const ringCount=Math.max(18,Math.min(64,Math.round(requestedRings)||56));
  const radial=24;
  const positions=new Float32Array(ringCount*radial*3);
  const uvs=new Float32Array(ringCount*radial*2);
  const indices=[];
  for(let i=0;i<ringCount;i++) {
    const u=i/Math.max(1,ringCount-1);
    for(let j=0;j<radial;j++) {
      const k=i*radial+j;
      uvs[k*2]=u*4.8;
      uvs[k*2+1]=j/radial;
    }
  }
  for(let i=0;i<ringCount-1;i++) {
    for(let j=0;j<radial;j++) {
      const a=i*radial+j,b=i*radial+(j+1)%radial;
      indices.push(a,b,b+radial,a,b+radial,a+radial);
    }
  }
  const geometry=new THREE.BufferGeometry();
  const positionAttribute=new THREE.BufferAttribute(positions,3);
  if(positionAttribute.setUsage)positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',positionAttribute);
  geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  const material=createSnakeSkinMaterial(THREE,skin);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='Phase 1 continuous snake body';
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  mesh.frustumCulled=false;
  mesh.userData.wtSnakeBody={
    ringCount,
    radial,
    cumulative:new Float32Array(512),
    headOffset:.27,
    ringSpacing:.235,
    previousSideX:1,
    previousSideZ:0
  };
  return mesh;
}

export function updateSnakeBodyMesh(mesh, path, timeSeconds=0, speed=0) {
  const state=mesh?.userData?.wtSnakeBody;
  if(!state||!Array.isArray(path)||path.length<2)return;
  const count=Math.min(path.length,state.cumulative.length);
  const cumulative=state.cumulative;
  cumulative[0]=0;
  for(let i=1;i<count;i++) {
    const a=path[i-1],b=path[i];
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
    cumulative[i]=cumulative[i-1]+Math.hypot(dx,dy,dz);
  }
  const maxDistance=cumulative[count-1];
  const attr=mesh.geometry.attributes.position;
  const positions=attr.array;
  const radial=state.radial,ringCount=state.ringCount;
  const movement=Math.max(0,Math.min(1,(Number.isFinite(speed)?speed:0)/6.5));
  let cursor=1,previousSideX=state.previousSideX,previousSideZ=state.previousSideZ;
  for(let i=0;i<ringCount;i++) {
    const u=i/Math.max(1,ringCount-1);
    const wanted=Math.min(maxDistance,state.headOffset+i*state.ringSpacing);
    while(cursor<count-1&&cumulative[cursor]<wanted)cursor++;
    const lo=Math.max(0,cursor-1),hi=Math.min(count-1,cursor);
    const span=Math.max(.000001,cumulative[hi]-cumulative[lo]);
    const f=Math.max(0,Math.min(1,(wanted-cumulative[lo])/span));
    const a=path[lo],b=path[hi];
    let tx=b.x-a.x,ty=b.y-a.y,tz=b.z-a.z;
    let tl=Math.hypot(tx,ty,tz);
    if(tl<.00001) {
      const next=path[Math.min(count-1,hi+1)],prior=path[Math.max(0,lo-1)];
      tx=next.x-prior.x;ty=next.y-prior.y;tz=next.z-prior.z;
      tl=Math.hypot(tx,ty,tz);
    }
    if(tl<.00001){tx=0;ty=0;tz=1;tl=1}
    tx/=tl;ty/=tl;tz/=tl;
    let sx=-tz,sy=0,sz=tx;
    let sl=Math.hypot(sx,sz);
    if(sl<.00001) {
      sx=previousSideX-tx*(previousSideX*tx+previousSideZ*tz);
      sz=previousSideZ-tz*(previousSideX*tx+previousSideZ*tz);
      sl=Math.hypot(sx,sz);
    }
    if(sl<.00001){sx=1;sz=0;sl=1}
    sx/=sl;sz/=sl;
    if(sx*previousSideX+sz*previousSideZ<0){sx=-sx;sz=-sz}
    const nx=ty*sz;
    const ny=tz*sx-tx*sz;
    const nz=-ty*sx;
    const nl=Math.hypot(nx,ny,nz)||1;
    const nnx=nx/nl,nny=ny/nl,nnz=nz/nl;
    previousSideX=sx;previousSideZ=sz;

    const cx=a.x+(b.x-a.x)*f;
    const cy=a.y+(b.y-a.y)*f+.315+
      Math.sin(timeSeconds*2.6-u*4.5)*(.004+.008*movement);
    const cz=a.z+(b.z-a.z)*f;
    const wave=Math.sin(timeSeconds*3.4-u*8.8)*.036*movement*Math.sin(u*Math.PI);
    const centerX=cx+sx*wave,centerZ=cz+sz*wave;
    const radius=snakeBodyRadius(u);
    for(let j=0;j<radial;j++) {
      const angle=j/radial*Math.PI*2;
      const co=Math.cos(angle),si=Math.sin(angle);
      const crossX=sx*co+nnx*si*.84;
      const crossY=sy*co+nny*si*.84;
      const crossZ=sz*co+nnz*si*.84;
      const k=(i*radial+j)*3;
      positions[k]=centerX+crossX*radius;
      positions[k+1]=cy+crossY*radius;
      positions[k+2]=centerZ+crossZ*radius;
    }
  }
  state.previousSideX=previousSideX;
  state.previousSideZ=previousSideZ;
  attr.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
}

function wtSnakeHeadLoft(THREE, sections, radial=32) {
  const vertices=[],uvs=[],indices=[];
  for(let i=0;i<sections.length;i++) {
    const s=sections[i];
    for(let j=0;j<=radial;j++) {
      const angle=j/radial*Math.PI*2;
      vertices.push(s[1]+Math.cos(angle)*s[3],s[2]+Math.sin(angle)*s[4],s[0]);
      uvs.push(j/radial,i/Math.max(1,sections.length-1));
    }
  }
  const stride=radial+1;
  for(let i=0;i<sections.length-1;i++) {
    for(let j=0;j<radial;j++) {
      const a=i*stride+j,b=a+1;
      indices.push(a,a+stride,b+stride,a,b+stride,b);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}


const wtSnakeHeadMaterialCache = new Map();

export function createSnakeHeadMaterials(THREE, skin) {
  const key=String(skin?.color??0x65c85d)+':'+String(skin?.accent??0x2f773b);
  if(wtSnakeHeadMaterialCache.has(key))return wtSnakeHeadMaterialCache.get(key);
  const materials={
    bellyMaterial:new THREE.MeshStandardMaterial({color:0xc8d7a6,roughness:.72,metalness:0}),
    socketMaterial:new THREE.MeshStandardMaterial({color:0x29452f,roughness:.62}),
    eyeWhite:new THREE.MeshStandardMaterial({color:0xf5ecd5,roughness:.26}),
    irisMaterial:new THREE.MeshStandardMaterial({color:0xd18b3f,roughness:.3,metalness:.04}),
    pupilMaterial:new THREE.MeshStandardMaterial({color:0x10170f,roughness:.24}),
    glintMaterial:new THREE.MeshBasicMaterial({color:0xfff9e8}),
    tongueMaterial:new THREE.MeshStandardMaterial({color:0xc85e63,roughness:.45})
  };
  wtSnakeHeadMaterialCache.set(key,materials);
  return materials;
}

export function enhanceSnakeHead(THREE, actor, skin) {
  if(!THREE||!actor||actor.userData?.wtSnakeRig)return actor;
  const hiddenNames=new Set([
    'Snake neck','Snake head','Snake jaw','Raised eye ridge',
    'Eye surround','Eye','Eye glint','Nostril','Forked tongue'
  ]);
  actor.traverse(object=>{if(hiddenNames.has(object.name))object.visible=false;});
  if(actor.userData.wtCinematicRig) {
    actor.userData.wtCinematicRig.eyes=[];
    actor.userData.wtCinematicRig.head=null;
    actor.userData.wtCinematicRig.tail=null;
  }
  const skinMaterial=createSnakeSkinMaterial(THREE,skin);
  const {bellyMaterial,socketMaterial,eyeWhite,irisMaterial,pupilMaterial,glintMaterial,tongueMaterial}=createSnakeHeadMaterials(THREE,skin);
  const headRoot=new THREE.Group();
  headRoot.name='Phase 1 snake head pivot';
  actor.add(headRoot);
  const sphere=new THREE.SphereGeometry(1,36,24);
  const smallSphere=new THREE.SphereGeometry(1,16,12);
  const addEllipsoid=(name,material,x,y,z,sx,sy,sz,geometry=sphere)=>{
    const object=new THREE.Mesh(geometry,material);
    object.name=name;
    object.position.set(x,y,z);
    object.scale.set(sx,sy,sz);
    object.castShadow=true;
    object.receiveShadow=true;
    headRoot.add(object);
    return object;
  };
  const skullGeometry=wtSnakeHeadLoft(THREE,[
    [.18,0,.47,.20,.20],
    [-.08,0,.49,.34,.25],
    [-.38,0,.49,.45,.29],
    [-.68,0,.46,.40,.245],
    [-.92,0,.41,.29,.18],
    [-1.12,0,.365,.12,.09]
  ],36);
  const skull=new THREE.Mesh(skullGeometry,skinMaterial);
  skull.name='Phase 1 sculpted snake skull';
  skull.castShadow=true;skull.receiveShadow=true;headRoot.add(skull);
  addEllipsoid('Phase 1 snake cheek left',skinMaterial,-.29,.43,-.56,.18,.19,.27);
  addEllipsoid('Phase 1 snake cheek right',skinMaterial,.29,.43,-.56,.18,.19,.27);

  const jawPivot=new THREE.Group();
  jawPivot.name='Phase 1 articulated lower jaw';
  jawPivot.position.set(0,.345,-.77);
  headRoot.add(jawPivot);
  const jaw=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),bellyMaterial);
  jaw.name='Phase 1 lower jaw plate';
  jaw.position.set(0,-.035,-.15);
  jaw.scale.set(.325,.09,.34);
  jaw.castShadow=true;jaw.receiveShadow=true;jawPivot.add(jaw);
  const mouth=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),pupilMaterial);
  mouth.name='Phase 1 mouth shadow';
  mouth.position.set(0,-.012,-.13);
  mouth.scale.set(.26,.018,.23);
  jawPivot.add(mouth);

  const eyes=[];
  for(const side of [-1,1]) {
    const eyeGroup=new THREE.Group();
    eyeGroup.name=side<0?'Phase 1 left eye':'Phase 1 right eye';
    eyeGroup.position.set(side*.315,.645,-.665);
    eyeGroup.rotation.y=side*.18;
    headRoot.add(eyeGroup);
    const socket=new THREE.Mesh(new THREE.SphereGeometry(1,24,18),socketMaterial);
    socket.scale.set(.145,.132,.105);eyeGroup.add(socket);
    const white=new THREE.Mesh(new THREE.SphereGeometry(1,24,18),eyeWhite);
    white.position.set(0,.002,-.064);white.scale.set(.105,.103,.076);eyeGroup.add(white);
    const iris=new THREE.Mesh(new THREE.SphereGeometry(1,20,16),irisMaterial);
    iris.position.set(0,-.002,-.126);iris.scale.set(.062,.079,.035);eyeGroup.add(iris);
    const pupil=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),pupilMaterial);
    pupil.position.set(0,-.003,-.153);pupil.scale.set(.024,.065,.022);eyeGroup.add(pupil);
    const glint=new THREE.Mesh(smallSphere,glintMaterial);
    glint.position.set(-.025,.032,-.174);glint.scale.set(.018,.018,.012);eyeGroup.add(glint);
    eyes.push({group:eyeGroup,baseScaleY:eyeGroup.scale.y,baseRotationX:eyeGroup.rotation.x,baseRotationY:eyeGroup.rotation.y});
  }
  for(const side of [-1,1]) {
    addEllipsoid('Phase 1 nostril',pupilMaterial,side*.145,.405,-1.105,.034,.026,.022,smallSphere);
    const brow=addEllipsoid('Phase 1 brow ridge',skinMaterial,side*.29,.765,-.585,.18,.07,.17,smallSphere);
    brow.rotation.z=side*.11;
  }
  // Small raised crown scales supplement the seamless procedural scale map.
  for(let row=0;row<2;row++) {
    for(let col=0;col<5;col++) {
      const x=(col-2)*.085;
      const z=-.29-row*.17;
      const scale=addEllipsoid('Phase 1 crown scale',skinMaterial,x,.755-Math.abs(col-2)*.018,z,.047,.018,.065,smallSphere);
      scale.rotation.x=-.12;
    }
  }

  const tonguePivot=new THREE.Group();
  tonguePivot.name='Phase 1 forked tongue rig';
  tonguePivot.position.set(0,.36,-1.055);
  headRoot.add(tonguePivot);
  const addTongueTube=(points,radius)=>{
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],p[2])));
    const object=new THREE.Mesh(new THREE.TubeGeometry(curve,14,radius,7,false),tongueMaterial);
    object.castShadow=false;object.receiveShadow=false;tonguePivot.add(object);return object;
  };
  addTongueTube([[0,0,0],[0,-.012,-.11],[0,-.025,-.25]],.022);
  addTongueTube([[0,-.024,-.22],[-.045,-.03,-.31],[-.075,-.036,-.38]],.014);
  addTongueTube([[0,-.024,-.22],[.045,-.03,-.31],[.075,-.036,-.38]],.014);

  actor.userData.wtSnakeRig={
    headRoot,
    jawPivot,
    tonguePivot,
    eyes,
    phase:.73,
    baseHeadY:headRoot.position.y,
    baseHeadX:headRoot.rotation.x,
    baseHeadYRotation:headRoot.rotation.y,
    baseHeadZ:headRoot.rotation.z,
    baseJawRotation:jawPivot.rotation.x,
    baseTongueZ:tonguePivot.position.z
  };
  return actor;
}

export function animateSnakeHead(actor, dt, timeSeconds, speed, turnRate, feeding=false) {
  const rig=actor?.userData?.wtSnakeRig;
  if(!rig)return;
  const safeDt=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));
  const time=Number.isFinite(timeSeconds)?timeSeconds:0;
  const motion=Math.max(0,Math.min(1,(Number.isFinite(speed)?speed:0)/6.5));
  const turn=Math.max(-1,Math.min(1,(Number.isFinite(turnRate)?turnRate:0)/7.5));
  const breath=Math.sin(time*2.1+rig.phase);
  rig.headRoot.position.y=rig.baseHeadY+.012+breath*(.006+.008*motion);
  rig.headRoot.rotation.x=rig.baseHeadX+Math.sin(time*1.45+rig.phase)*(.012+.008*motion);
  rig.headRoot.rotation.y=rig.baseHeadYRotation+turn*.11;
  rig.headRoot.rotation.z=rig.baseHeadZ-turn*.075+Math.sin(time*1.2+rig.phase)*.012;
  const jawTarget=feeding ? -.30-.075*Math.sin(time*25) : -.018-.012*Math.sin(time*2.6);
  rig.jawPivot.rotation.x=rig.baseJawRotation+jawTarget;
  const blinkWave=Math.max(0,Math.sin(time*.72+rig.phase));
  const blink=Math.pow(blinkWave,40);
  rig.eyes.forEach((eye,index)=>{
    eye.group.scale.y=eye.baseScaleY*Math.max(.075,1-blink*.94);
    const gaze=Math.sin(time*.62+rig.phase+index*.47);
    eye.group.rotation.y=(eye.baseRotationY||0)+turn*.028+gaze*.022;
    eye.group.rotation.x=(eye.baseRotationX||0)+Math.cos(time*.51+rig.phase+index*.63)*.012;
  });
  const flickWave=Math.max(0,Math.sin(time*2.45+rig.phase));
  const flick=feeding?Math.max(.65,flickWave):Math.max(0,Math.min(1,(flickWave-.86)/.14));
  rig.tonguePivot.scale.z=.12+flick*.88;
  rig.tonguePivot.position.z=rig.baseTongueZ-flick*.11;
  void safeDt;
}


export function stepPreviewSpin(angle, dt, rate=.38) {
  const current=Number.isFinite(angle)?angle:0;
  const safeDt=Number.isFinite(dt)?Math.max(0,Math.min(.05,dt)):0;
  const safeRate=Number.isFinite(rate)?Math.max(-2,Math.min(2,rate)):.38;
  return current+safeDt*safeRate;
}
