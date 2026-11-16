// Original Wild Trails anime rendering helpers for Three.js 0.180.0.
// This module is deliberately renderer-light: no post-processing composer,
// no external shader packages, and no changes to gameplay or collision state.

const SKY_PALETTES = Object.freeze({
  garden:  { top: 0x427fc0, horizon: 0xd8c9a3, lower: 0x8eae83, fog: 0xb9cdb1, rim: 0xa9e6df },
  street:  { top: 0x557fa7, horizon: 0xe0c6a5, lower: 0x9caaa0, fog: 0xb9c4bd, rim: 0xaad9ed },
  station: { top: 0x547fa0, horizon: 0xe6cdb0, lower: 0xabb8ad, fog: 0xbcc8bf, rim: 0xd5e5e7 },
  home:    { top: 0x8a7797, horizon: 0xe9c49a, lower: 0xc09b79, fog: 0xc8b49d, rim: 0xffd4a2 },
  kitchen: { top: 0x638ca2, horizon: 0xe9d6b6, lower: 0xb9c4b1, fog: 0xc4cfc6, rim: 0xd6e9db },
  night:   { top: 0x101b42, horizon: 0x4b6387, lower: 0x234b4c, fog: 0x344c62, rim: 0x6be1d2 }
});

const QUALITY = Object.freeze({
  low:    { desktopPixelRatio: 1.0, mobilePixelRatio: 0.9, shadowMapSize: 512, shadows: false, rim: 0.09, outline: 0.0 },
  medium: { desktopPixelRatio: 1.35, mobilePixelRatio: 1.15, shadowMapSize: 1024, shadows: true, rim: 0.16, outline: 0.025 },
  high:   { desktopPixelRatio: 1.6, mobilePixelRatio: 1.35, shadowMapSize: 1536, shadows: true, rim: 0.24, outline: 0.055 }
});

export function getAnimeQualityPreset(value = 'medium', mobile = false) {
  const key = Object.prototype.hasOwnProperty.call(QUALITY, value) ? value : 'medium';
  const preset = QUALITY[key];
  return Object.freeze({
    name: key,
    pixelRatio: mobile ? preset.mobilePixelRatio : preset.desktopPixelRatio,
    shadowMapSize: preset.shadowMapSize,
    shadows: preset.shadows,
    rim: preset.rim,
    outline: preset.outline
  });
}

export function getAnimeSkyPalette(map = 'garden') {
  const palette = SKY_PALETTES[map] || SKY_PALETTES.garden;
  return Object.freeze({ ...palette });
}

export function quantizeAnimeLight(luminance) {
  const value = Number.isFinite(luminance) ? Math.max(0, Math.min(1.5, luminance)) : 0;
  if (value < 0.22) return 0.68;
  if (value < 0.58) return 0.88;
  return 1.06;
}

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

const ANIME_WIND_STATE = new WeakMap();

export function applyAnimeMaterial(THREE, material, options = {}) {
  if (!THREE || !material || material.userData?.wtAnimeToon || material.isMeshBasicMaterial || material.isShaderMaterial) {
    return false;
  }
  if (!material.isMeshStandardMaterial && !material.isMeshPhysicalMaterial && !material.isMeshToonMaterial) {
    return false;
  }

  const state = {
    rimColor: new THREE.Color(options.rimColor ?? 0xa9e6df),
    rimStrength: Number.isFinite(options.rimStrength) ? options.rimStrength : 0.16,
    outlineStrength: Number.isFinite(options.outlineStrength) ? options.outlineStrength : 0.025,
    windStrength: Number.isFinite(options.windStrength) ? options.windStrength : 0,
    shader: null
  };
  const previousCompile = material.onBeforeCompile;
  const previousKey = typeof material.customProgramCacheKey === 'function'
    ? material.customProgramCacheKey.bind(material)
    : null;

  material.onBeforeCompile = function(shader, renderer) {
    if (typeof previousCompile === 'function') previousCompile.call(this, shader, renderer);
    shader.uniforms.wtAnimeRimColor = { value: state.rimColor };
    shader.uniforms.wtAnimeRimStrength = { value: state.rimStrength };
    shader.uniforms.wtAnimeOutlineStrength = { value: state.outlineStrength };
    shader.uniforms.wtAnimeTime = { value: 0 };
    shader.uniforms.wtAnimeWindStrength = { value: state.windStrength };

    const vertexUniforms = `
      uniform float wtAnimeTime;
      uniform float wtAnimeWindStrength;
    `;
    const vertexCommon = '#include <common>';
    if (shader.vertexShader.includes(vertexCommon)) {
      shader.vertexShader = shader.vertexShader.replace(vertexCommon, vertexCommon + '\\n' + vertexUniforms);
    }
    const beginMarker = '#include <begin_vertex>';
    const wind = `
      #include <begin_vertex>
      float wtAnimeWindWeight = smoothstep(0.05, 1.25, position.y);
      float wtAnimeWindWave = sin(wtAnimeTime * 1.45 + position.x * 1.7 + position.z * 1.25);
      transformed.x += wtAnimeWindWave * wtAnimeWindStrength * wtAnimeWindWeight;
      transformed.z += cos(wtAnimeTime * 1.12 + position.x * 1.05) * wtAnimeWindStrength * 0.38 * wtAnimeWindWeight;
    `;
    if (shader.vertexShader.includes(beginMarker) && state.windStrength > 0) {
      shader.vertexShader = shader.vertexShader.replace(beginMarker, wind);
    }

    const insertion = `
      uniform vec3 wtAnimeRimColor;
      uniform float wtAnimeRimStrength;
      uniform float wtAnimeOutlineStrength;
      float wtAnimeNdotV = max(dot(normalize(normal), normalize(vViewPosition)), 0.0);
      float wtAnimeRim = pow(1.0 - wtAnimeNdotV, 3.1);
      float wtAnimeLuma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
      float wtAnimeBand = wtAnimeLuma < 0.22 ? 0.68 : (wtAnimeLuma < 0.58 ? 0.88 : 1.06);
      float wtAnimeCrease = smoothstep(0.30, 0.82, length(fwidth(normalize(normal))));
      outgoingLight *= wtAnimeBand * (1.0 - wtAnimeCrease * wtAnimeOutlineStrength);
      outgoingLight += wtAnimeRimColor * (wtAnimeRim * wtAnimeRimStrength);
    `;
    const marker = '#include <opaque_fragment>';
    if (shader.fragmentShader.includes(marker)) {
      shader.fragmentShader = shader.fragmentShader.replace(marker, insertion + '\\n' + marker);
    }
    state.shader = shader;
  };

  material.customProgramCacheKey = () => `${previousKey ? previousKey() : ''}|wild-trails-anime-toon-v1`;
  material.userData = material.userData || {};
  material.userData.wtAnimeToon = state;
  material.needsUpdate = true;
  return true;
}

export function applyAnimeScene(THREE, root, quality = 'medium', palette = null) {
  if (!THREE || !root) return { materials: 0, meshes: 0 };
  const preset = getAnimeQualityPreset(quality, false);
  const sky = palette || getAnimeSkyPalette('garden');
  let materials = 0;
  let meshes = 0;
  const windMaterials = new Set();

  root.traverse(object => {
    if (!object.isMesh || !object.material) return;
    meshes++;
    for (const material of materialList(object.material)) {
      const foliage = object.userData?.wtWindFoliage === true || /leaf|foliage|grass|plant|crown/i.test(object.name || '');
      if (applyAnimeMaterial(THREE, material, {
        rimColor: sky.rim,
        rimStrength: preset.rim,
        outlineStrength: preset.outline,
        windStrength: foliage ? (quality === 'low' ? 0.045 : 0.085) : 0
      })) materials++;
      const state = material?.userData?.wtAnimeToon;
      if (state?.windStrength > 0) windMaterials.add(state);
    }
  });

  ANIME_WIND_STATE.set(root, [...windMaterials]);
  return { materials, meshes };
}

export function updateAnimeQuality(root, quality = 'medium', palette = null) {
  if (!root) return 0;
  const preset = getAnimeQualityPreset(quality, false);
  const sky = palette || getAnimeSkyPalette('garden');
  let updated = 0;
  root.traverse(object => {
    if (!object.isMesh || !object.material) return;
    for (const material of materialList(object.material)) {
      const state = material?.userData?.wtAnimeToon;
      if (!state) continue;
      state.rimColor.set(sky.rim);
      state.rimStrength = preset.rim;
      state.outlineStrength = preset.outline;
      if (state.shader) {
        state.shader.uniforms.wtAnimeRimColor.value.copy(state.rimColor);
        state.shader.uniforms.wtAnimeRimStrength.value = state.rimStrength;
        state.shader.uniforms.wtAnimeOutlineStrength.value = state.outlineStrength;
      }
      updated++;
    }
  });
  return updated;
}

export function applyRendererQuality(renderer, quality = 'medium', mobile = false) {
  const preset = getAnimeQualityPreset(quality, mobile);
  if (!renderer) return preset;
  renderer.setPixelRatio(preset.pixelRatio);
  renderer.shadowMap.enabled = preset.shadows;
  return preset;
}

export function updateAnimeWind(root, timeSeconds = 0) {
  if (!root) return 0;
  const time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  const states = ANIME_WIND_STATE.get(root) || [];
  let updated = 0;
  for (const state of states) {
    if (!state?.shader || state.windStrength <= 0) continue;
    state.shader.uniforms.wtAnimeTime.value = time;
    updated++;
  }
  return updated;
}

export function createAnimeSkyDome(THREE, scene, map = 'garden') {
  if (!THREE || !scene) return null;
  const palette = getAnimeSkyPalette(map);
  const geometry = new THREE.SphereGeometry(235, 32, 20);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const top = new THREE.Color(palette.top);
  const horizon = new THREE.Color(palette.horizon);
  const lower = new THREE.Color(palette.lower);
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const height = position.getY(i) / 235;
    if (height < 0.08) color.copy(lower).lerp(horizon, Math.max(0, (height + 0.72) / 0.8));
    else color.copy(horizon).lerp(top, Math.min(1, (height - 0.08) / 0.92));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false
  });
  const dome = new THREE.Mesh(geometry, material);
  dome.name = 'Wild Trails original anime gradient sky';
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  dome.userData.wtAnimeSky = true;
  scene.add(dome);
  return dome;
}

export function updateAnimeSkyDome(dome, camera) {
  if (dome && camera) dome.position.copy(camera.position);
}

export function disposeAnimeSkyDome(scene, dome) {
  if (!dome) return;
  if (dome.parent) dome.parent.remove(dome);
  else scene?.remove?.(dome);
  dome.geometry?.dispose?.();
  dome.material?.dispose?.();
}
