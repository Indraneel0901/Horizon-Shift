import * as THREE from "three";

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smoothstep = (low, high, value) => {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};
const linearToSrgb = (channel) => channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;

function hashLattice(x, y, seed, periodX = 0, periodY = 0) {
  const wrap = (value, period) => period ? ((value % period) + period) % period : value;
  const wx = wrap(x, periodX);
  const wy = wrap(y, periodY);
  const value = Math.sin(wx * 127.1 + wy * 311.7 + seed * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

// 3D value noise sampled on the unit sphere. Unlike planar UV noise, its features
// remain continuous at the longitude seam and do not stretch into rings at the poles.
function hashLattice3(x, y, z, seed) {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 53.1) * 43758.5453123;
  return value - Math.floor(value);
}

function valueNoise3(x, y, z, seed) {
  const x0 = Math.floor(x); const y0 = Math.floor(y); const z0 = Math.floor(z);
  const tx0 = x - x0; const ty0 = y - y0; const tz0 = z - z0;
  const tx = tx0 * tx0 * (3 - 2 * tx0);
  const ty = ty0 * ty0 * (3 - 2 * ty0);
  const tz = tz0 * tz0 * (3 - 2 * tz0);
  const c000 = hashLattice3(x0, y0, z0, seed);
  const c100 = hashLattice3(x0 + 1, y0, z0, seed);
  const c010 = hashLattice3(x0, y0 + 1, z0, seed);
  const c110 = hashLattice3(x0 + 1, y0 + 1, z0, seed);
  const c001 = hashLattice3(x0, y0, z0 + 1, seed);
  const c101 = hashLattice3(x0 + 1, y0, z0 + 1, seed);
  const c011 = hashLattice3(x0, y0 + 1, z0 + 1, seed);
  const c111 = hashLattice3(x0 + 1, y0 + 1, z0 + 1, seed);
  const mix = (a, b, t) => a + (b - a) * t;
  const z0a = mix(mix(c000, c100, tx), mix(c010, c110, tx), ty);
  const z1a = mix(mix(c001, c101, tx), mix(c011, c111, tx), ty);
  return mix(z0a, z1a, tz);
}

function valueNoise(x, y, seed, periodX = 0, periodY = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hashLattice(x0, y0, seed, periodX, periodY);
  const b = hashLattice(x0 + 1, y0, seed, periodX, periodY);
  const c = hashLattice(x0, y0 + 1, seed, periodX, periodY);
  const d = hashLattice(x0 + 1, y0 + 1, seed, periodX, periodY);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}

function fbmPeriodic(u, v, seed, octaves = 4) {
  let total = 0;
  let weight = 0;
  let amplitude = 0.55;
  let xFrequency = 3;
  let yFrequency = 2;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(u * xFrequency, v * yFrequency, seed + octave * 29, xFrequency, yFrequency) * amplitude;
    weight += amplitude;
    amplitude *= 0.48;
    xFrequency *= 2;
    yFrequency *= 2;
  }
  return total / weight;
}

export function sphereDirectionFromUv(u, v) {
  const theta = (1 - clamp(v, 0, 1)) * Math.PI;
  const phi = clamp(u, 0, 1) * Math.PI * 2;
  const sinTheta = Math.sin(theta);
  return {
    x: -Math.cos(phi) * sinTheta,
    y: Math.cos(theta),
    z: Math.sin(phi) * sinTheta,
  };
}

function planetField(u, v, seed, water) {
  const direction = sphereDirectionFromUv(u, v);
  const { x, y, z } = direction;
  const macro = valueNoise3(x * 2.65, y * 2.65, z * 2.65, seed + 3);
  const regional = valueNoise3(x * 5.3, y * 5.3, z * 5.3, seed + 17);
  const detail = valueNoise3(x * 10.8, y * 10.8, z * 10.8, seed + 41);
  const continent = macro * 0.58 + regional * 0.29 + detail * 0.13;
  const threshold = clamp(0.50 + (water - 0.5) * 0.72, 0.12, 0.88);
  // A slightly wider transition makes natural shelves and beaches, not hard color islands.
  const land = smoothstep(threshold - 0.068, threshold + 0.068, continent);
  const ridgeNoise = valueNoise3(x * 13.8, y * 13.8, z * 13.8, seed + 73);
  const ridges = Math.pow(1 - Math.abs(ridgeNoise * 2 - 1), 1.12);
  const highland = smoothstep(0.48, 0.76, regional * 0.72 + macro * 0.28);
  const foothill = smoothstep(threshold + 0.005, threshold + 0.24, continent);
  const elevation = clamp(foothill * (macro * 0.18 + regional * 0.24 + highland * 0.36 + ridges * highland * 0.22), 0, 1);
  const moisture = valueNoise3(x * 3.5, y * 3.5, z * 3.5, seed + 101) * 0.68
    + valueNoise3(x * 7.4, y * 7.4, z * 7.4, seed + 129) * 0.32;
  const cloudField = valueNoise3(x * 4.4, y * 4.4, z * 4.4, seed + 211) * 0.64
    + valueNoise3(x * 12.2, y * 12.2, z * 12.2, seed + 251) * 0.36;
  const latitude = Math.asin(clamp(y, -1, 1));
  const temperature = clamp(1 - Math.abs(latitude) * 0.92 - elevation * 0.48, 0, 1);
  const lavaField = valueNoise3(x * 20.5, y * 20.5, z * 20.5, seed + 503);
  return { direction, continent, land, elevation, ridges, moisture, cloudField, latitude, temperature, lavaField };
}

export function createTerrainDetailTexture(type = "temperate", seed = 7, repeatX = 5, repeatY = 5, channel = "color") {
  const width = 256;
  const height = 256;
  const data = new Uint8Array(width * height * 4);
  const styleSeed = seed + ({ desert: 21, icy: 34, volcanic: 48, rocky: 62, "ocean-and-rock": 76, custom: 90 }[type] || 0);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const v = y / height;
      const broad = fbmPeriodic(u, v, styleSeed, 4);
      const patch = fbmPeriodic(u * 2.0, v * 2.0, styleSeed + 17, 4);
      const fine = hashLattice(x, y, styleSeed + 31, width, height);
      const grain = hashLattice(x * 7, y * 7, styleSeed + 55, width * 7, height * 7);
      let relief;
      if (channel === "bump") {
        // A linear-space height map with a broad, low-amplitude response avoids the
        // greasy, blurry shading caused by reusing an sRGB colour map as bump data.
        relief = 0.5 + (broad - 0.5) * 0.48 + (patch - 0.5) * 0.30
          + (fine - 0.5) * 0.14 + (grain - 0.5) * 0.08;
        if (type === "desert") relief += Math.sin(v * 88 + broad * 12 + patch * 3.5) * 0.045;
        if (type === "icy") relief += Math.sin((u * 31 + v * 17 + broad) * 12) * 0.025;
        relief = clamp(relief, 0.16, 0.84);
      } else {
        // The albedo detail is deliberately close to white: it adds fine texture while
        // preserving the material's biome/elevation vertex colours instead of muddying them.
        relief = 0.94 + (broad - 0.5) * 0.085 + (patch - 0.5) * 0.042
          + (fine - 0.5) * 0.022 + (grain - 0.5) * 0.012;
        if (type === "desert") relief += Math.sin(v * 88 + broad * 12 + patch * 3.5) * 0.018;
        if (type === "icy") {
          const crack = smoothstep(0.78, 0.96, Math.abs(Math.sin((u * 31 + v * 17 + broad) * 12)));
          relief -= crack * 0.035;
        } else if (type === "volcanic") {
          relief -= smoothstep(0.68, 0.94, fine * 0.65 + patch * 0.35) * 0.025;
        }
        relief = clamp(relief, 0.84, 1.02);
        relief = relief <= 0.0031308 ? relief * 12.92 : 1.055 * Math.pow(relief, 1 / 2.4) - 0.055;
      }
      const value = Math.round(clamp(relief, 0, 1) * 255);
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = channel === "bump" ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function sampleProceduralPlanet(u, v, seed, water) {
  return planetField(u, v, seed, water);
}

export function samplePlanetRadius(field, terrainValue) {
  const intensity = clamp(Number.isFinite(Number(terrainValue)) ? Number(terrainValue) : 0.5, 0, 1);
  const continentalRise = field.land * intensity * 0.045;
  const ridgeRelief = field.ridges * field.land * Math.max(0.12, field.elevation) * intensity * 0.13;
  const broadRelief = field.land * field.elevation * intensity * 0.19;
  const oceanBasin = (1 - field.land) * intensity * 0.032;
  return 1.45 + continentalRise + broadRelief + ridgeRelief - oceanBasin;
}

export function createProceduralPlanetTextures(settings) {
  const width = 512;
  const height = 256;
  const seed = Math.max(1, Number(settings.seed) || 1);
  const waterValue = Number(settings.water);
  const water = clamp(Number.isFinite(waterValue) ? waterValue : 0.5, 0.01, 0.99);
  const terrainValue = Number(settings.terrain);
  const terrain = clamp(Number.isFinite(terrainValue) ? terrainValue : 0.5, 0, 1);
  const cloudValue = Number(settings.clouds ?? 0.48);
  const clouds = clamp(Number.isFinite(cloudValue) ? cloudValue : 0.48, 0, 1);
  const planetType = settings.planetType || "temperate";
  const tint = new THREE.Color(settings.color || "#287c98");
  const albedoData = new Uint8Array(width * height * 4);
  const bumpData = new Uint8Array(width * height * 4);
  const cloudData = new Uint8Array(width * height * 4);

  const palettes = {
    temperate: { deep: "#04182c", shelf: "#0b4c66", beach: "#cbb58b", grass: "#64854b", forest: "#28583b", dry: "#b59861", rock: "#81898a", snow: "#eef7fb", tint: 0.10 },
    desert: { deep: "#071e34", shelf: "#265767", beach: "#d7bb83", grass: "#ad985b", forest: "#787e44", dry: "#c28b54", rock: "#957866", snow: "#e4e5d9", tint: 0.06 },
    icy: { deep: "#051d3e", shelf: "#326d8b", beach: "#93bccc", grass: "#7da6a3", forest: "#5b8985", dry: "#b5c6c7", rock: "#7998ac", snow: "#f1fcff", tint: 0.08 },
    volcanic: { deep: "#120b1e", shelf: "#472633", beach: "#61474a", grass: "#292c2d", forest: "#222729", dry: "#674039", rock: "#595256", snow: "#bdbbbd", tint: 0.05 },
    ocean: { deep: "#05233d", shelf: "#087f95", beach: "#74b9a6", grass: "#32a78a", forest: "#0b716a", dry: "#84b58a", rock: "#4e9899", snow: "#c7f4f6", tint: 0.06 },
    alien: { deep: "#0d163b", shelf: "#293b75", beach: "#a16f9c", grass: "#56704d", forest: "#3c6b66", dry: "#b48170", rock: "#7775a5", snow: "#dfd8ff", tint: 0.06 },
  };
  const palette = palettes[planetType] || palettes.temperate;
  const deepOcean = new THREE.Color(palette.deep);
  const shelfOcean = new THREE.Color(palette.shelf);
  const beach = new THREE.Color(palette.beach);
  const grass = new THREE.Color(palette.grass);
  const forest = new THREE.Color(palette.forest);
  const dry = new THREE.Color(palette.dry);
  const rock = new THREE.Color(palette.rock);
  const snow = new THREE.Color(palette.snow);
  const lava = new THREE.Color("#ff622a");
  const trenchColor = new THREE.Color(palette.deep).multiplyScalar(0.72);
  const crevasseColor = new THREE.Color("#91d8ef");
  const alienVeinColor = new THREE.Color("#b45cff");
  const color = new THREE.Color();

  for (let y = 0; y < height; y += 1) {
    const v = y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const field = planetField(u, v, seed, water);
      const { direction } = field;
      const { x: dx, y: dy, z: dz } = direction;
      const elevation = field.elevation;
      const wetness = field.moisture;
      const temperature = field.temperature;

      if (field.land < 0.40) {
        const shelf = smoothstep(0.12, 0.45, field.continent) * (1 - smoothstep(0.68, 0.86, field.continent));
        color.copy(deepOcean).lerp(shelfOcean, shelf * 0.88);
        const trench = smoothstep(0.38, 0.79, valueNoise3(dx * 8.1, dy * 8.1, dz * 8.1, seed + 601));
        color.lerp(trenchColor, trench * 0.26);
      } else {
        const landColor = grass.clone().lerp(forest, smoothstep(0.38, 0.76, wetness) * 0.66);
        landColor.lerp(dry, (1 - smoothstep(0.25, 0.62, wetness)) * smoothstep(0.34, 0.74, temperature) * 0.82);
        color.copy(landColor);
        color.lerp(beach, (1 - smoothstep(0.36, 0.62, field.land)) * 0.66);
        color.lerp(rock, smoothstep(0.50, 0.83, elevation) * 0.85);
        const snowCoverage = Math.max(
          smoothstep(0.75, 0.95, elevation) * 0.86,
          (1 - smoothstep(0.12, 0.45, temperature)) * 0.92,
        );
        color.lerp(snow, snowCoverage);

        if (planetType === "volcanic") {
          const fissure = smoothstep(0.78, 0.95, field.lavaField) * smoothstep(0.38, 0.70, elevation);
          color.lerp(lava, fissure * 0.88);
        } else if (planetType === "icy") {
          const crevasse = smoothstep(0.80, 0.95, valueNoise3(dx * 18, dy * 18, dz * 18, seed + 811));
          color.lerp(crevasseColor, crevasse * 0.23);
        } else if (planetType === "alien") {
          const vein = smoothstep(0.82, 0.96, valueNoise3(dx * 19, dy * 19, dz * 19, seed + 907));
          color.lerp(alienVeinColor, vein * 0.20);
        }
      }

      // Keep the user tint subtle so the selected planet still retains readable biomes.
      color.lerp(tint, palette.tint);
      // Sphere-domain micro detail avoids stretched UV noise or an obvious vertical seam.
      const micro = valueNoise3(dx * 42, dy * 42, dz * 42, seed + 303) - 0.5;
      const detail = valueNoise3(dx * 76, dy * 76, dz * 76, seed + 353) - 0.5;
      color.multiplyScalar(0.96 + elevation * 0.045 + micro * 0.095 + detail * 0.025);

      const i = (y * width + x) * 4;
      albedoData[i] = Math.round(clamp(linearToSrgb(color.r), 0, 1) * 255);
      albedoData[i + 1] = Math.round(clamp(linearToSrgb(color.g), 0, 1) * 255);
      albedoData[i + 2] = Math.round(clamp(linearToSrgb(color.b), 0, 1) * 255);
      albedoData[i + 3] = 255;

      const heightValue = clamp(
        0.38 + field.land * (0.12 + elevation * 0.39 + field.ridges * terrain * 0.17)
          - (1 - field.land) * 0.16,
        0, 1,
      );
      const bumpByte = Math.round(heightValue * 255);
      bumpData[i] = bumpByte;
      bumpData[i + 1] = bumpByte;
      bumpData[i + 2] = bumpByte;
      bumpData[i + 3] = 255;

      const cloudShape = smoothstep(0.53 - clouds * 0.12, 0.76 - clouds * 0.035, field.cloudField);
      const cloudBand = 0.80 + 0.20 * Math.cos(field.latitude * 2);
      const alpha = Math.round(clamp(cloudShape * cloudBand * clouds * 1.25, 0, 0.84) * 255);
      cloudData[i] = 240;
      cloudData[i + 1] = 247;
      cloudData[i + 2] = 255;
      cloudData[i + 3] = alpha;
    }
  }

  const makeTexture = (data, colorSpace) => {
    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = colorSpace;
    texture.anisotropy = 8;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  };

  return {
    albedo: makeTexture(albedoData, THREE.SRGBColorSpace),
    bump: makeTexture(bumpData, THREE.NoColorSpace),
    clouds: makeTexture(cloudData, THREE.NoColorSpace),
  };
}
