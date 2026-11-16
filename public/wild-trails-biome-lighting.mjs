// Six original biome lighting profiles for the existing Wild Trails Three.js scene.
export const BIOME_LIGHTING=Object.freeze({
  garden:{sun:0xffe2b2,sunPower:2.1,sky:0xe5f2dc,ground:0x3d5140,ambient:1.55,exposure:1.12},
  street:{sun:0xffe2c3,sunPower:1.85,sky:0xd8ebf1,ground:0x4d5551,ambient:1.42,exposure:1.08},
  station:{sun:0xe9edf0,sunPower:1.6,sky:0xd8e5e4,ground:0x50564e,ambient:1.32,exposure:1.09},
  home:{sun:0xffc48d,sunPower:1.05,sky:0xffe4c5,ground:0x584337,ambient:1.15,exposure:1.09},
  kitchen:{sun:0xffd8a9,sunPower:1.2,sky:0xe4f1e4,ground:0x555d50,ambient:1.22,exposure:1.1},
  night:{sun:0x9abbe5,sunPower:.48,sky:0x769ab9,ground:0x172b31,ambient:.68,exposure:.98}
});

export function applyBiomeLighting(scene,renderer,biome){
  const profile=BIOME_LIGHTING[biome]||BIOME_LIGHTING.garden;
  const sun=scene?.children?.find(light=>light.isDirectionalLight&&light.castShadow);
  const ambient=scene?.children?.find(light=>light.isHemisphereLight);
  if(sun){
    sun.color.setHex(profile.sun);
    sun.intensity=profile.sunPower;
  }
  if(ambient){
    ambient.color.setHex(profile.sky);
    ambient.groundColor.setHex(profile.ground);
    ambient.intensity=profile.ambient;
  }
  if(renderer)renderer.toneMappingExposure=profile.exposure;
  return profile;
}
