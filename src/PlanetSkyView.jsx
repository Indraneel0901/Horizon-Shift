import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import AtmosphericSky from "./AtmosphericSky";
import TerrainEcosystem from "./TerrainEcosystem";
import DistantFauna from "./DistantFauna";
import { createTerrainDetailTexture } from "./proceduralVisuals";
import "./planet-sky-view.css";
import { EARTH_REFERENCE, INITIAL_ILLUSTRATIVE_WORLD, STAR_PRESETS } from "./planetSkyDefaults";
import {
  applyWorldPrompt,
  buildWorldExplanation,
  clamp,
  computeSolarAltitudeDeg,
  computeStellarFluxWm2,
  equilibriumTemperatureK,
  getAtmosphereMix,
  getSkyPalette,
  validateSkyConfig,
} from "./planetSkyModel";
import { createSkyShareUrl, loadInitialSkyConfig, DEFAULT_CELESTIAL_SETTINGS } from "./skySharing";

const gasShortLabels = {
  nitrogen: "N₂",
  oxygen: "O₂",
  argon: "Ar",
  methane: "CH₄",
  hydrogen: "H₂",
  helium: "He",
  other: "Other",
  carbonDioxide: "CO₂",
};
const surfaceLabels = {
  "ocean-and-rock": "Ocean and rock",
  rocky: "Rocky",
  ocean: "Ocean world",
  icy: "Icy",
  desert: "Desert",
  volcanic: "Volcanic / lava",
  "gas-giant": "Gas-giant cloud deck",
  custom: "Custom surface",
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatNumber(value, digits = 1) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function setNestedValue(source, path, value) {
  const target = clone(source);
  const keys = path.split(".");
  let cursor = target;
  for (const key of keys.slice(0, -1)) cursor = cursor[key];
  cursor[keys[keys.length - 1]] = value;
  return target;
}

function markUserEdited(candidate) {
  if (candidate.provenance?.kind === "real-reference" || candidate.id === "earth-reference") {
    candidate.id = "earth-reference-variant";
    candidate.name = "Customized Earth scenario";
    candidate.provenance = { kind: "illustrative", sourceLabel: "User-edited scenario based on Earth Reference starting values" };
  } else {
    candidate.provenance = { kind: "illustrative", sourceLabel: "User-configured illustrative scenario" };
  }
  return candidate;
}

const MARS_REFERENCE = {
  ...clone(EARTH_REFERENCE),
  id: "mars-reference",
  name: "Mars reference",
  kind: "terrestrial",
  atmosphere: {
    ...clone(EARTH_REFERENCE.atmosphere),
    renderedThicknessKm: 80,
    surfacePressureKPa: 0.636,
    densityKgM3: 0.016,
    compositionPct: { nitrogen: 51.8, oxygen: 3.2, argon: 38.8, methane: 0.001, hydrogen: 0.001, helium: 0.001, other: 6.197 },
    co2Ppm: 950000,
    aerosol: 0.68,
  },
  star: { ...clone(EARTH_REFERENCE.star), distanceAU: 1.524 },
  surface: {
    ...clone(EARTH_REFERENCE.surface),
    type: "desert",
    baseColorHex: "#b77b45",
    bondAlbedo: 0.25,
    roughness: 0.96,
    waterFraction: 0.01,
    snowIceFraction: 0.08,
  },
  observer: {
    ...clone(EARTH_REFERENCE.observer),
    axialTiltDeg: 25.19,
    dayLengthHours: 24.6597,
    timeOfDayHours: 14.5,
    viewing: {
      ...clone(EARTH_REFERENCE.observer.viewing),
      cloudiness: 0.08,
      haze: 0.62,
      moonlight: 0.02,
      airglow: false,
      skyTintHex: "#c8764f",
    },
  },
  provenance: {
    kind: "real-reference",
    sourceLabel: "NASA/NSSDC Mars Fact Sheet and NASA Mars Facts; rendered atmosphere is a simplified Rayleigh/Mie approximation",
  },
};

function getScatteringParameters(config) {
  const present = config.atmosphere.present;
  return {
    rayleigh: present ? clamp(config.atmosphere.surfacePressureKPa / 101.4, 0, 3) : 0,
    // Aerosol and user-defined haze act as a qualitative proxy for the Mie-scattering term.
    mie: present ? clamp(config.atmosphere.aerosol * 1.6 + config.observer.viewing.haze * 1.15, 0, 3) : 0,
  };
}

function RangeField({ label, value, min, max, step = 1, unit = "", onChange, help, disabled = false }) {
  return (
    <label className={`sky-field${disabled ? " is-disabled" : ""}`}>
      <span className="sky-field__top"><span>{label}</span><output>{unit === "%" ? formatNumber(value * 100, 0) : formatNumber(value, step < 0.1 ? 3 : step < 1 ? 2 : 1)}{unit ? ` ${unit}` : ""}</output></span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
      {help && <small>{help}</small>}
    </label>
  );
}

function SelectField({ label, value, options, onChange, help, disabled = false }) {
  return (
    <label className={`sky-field sky-field--select${disabled ? " is-disabled" : ""}`}>
      <span className="sky-field__top"><span>{label}</span></span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {help && <small>{help}</small>}
    </label>
  );
}

function ToggleField({ label, checked, onChange, help }) {
  return (
    <label className="sky-toggle">
      <span><strong>{label}</strong>{help && <small>{help}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="sky-toggle__track" aria-hidden="true"><span /></span>
    </label>
  );
}

function fadeNoise(t) {
  return t * t * (3 - 2 * t);
}

function latticeHash(x, z, seed) {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function valueNoise(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = fadeNoise(x - x0);
  const tz = fadeNoise(z - z0);
  const a = latticeHash(x0, z0, seed);
  const b = latticeHash(x0 + 1, z0, seed);
  const c = latticeHash(x0, z0 + 1, seed);
  const d = latticeHash(x0 + 1, z0 + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * tz;
}

function fractalNoise(x, z, seed) {
  let total = 0;
  let amplitude = 0.5;
  let weight = 0;
  for (let octave = 0; octave < 5; octave += 1) {
    total += valueNoise(x, z, seed + octave * 19.17) * amplitude;
    weight += amplitude;
    x *= 2.03;
    z *= 2.03;
    amplitude *= 0.5;
  }
  return total / weight;
}

function smoothRange(low, high, value) {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}

function buildTerrainGeometry(config, terrainRelief = 1.0, ringShadows = false) {
  // This is a local ground-level terrain patch, not a globe or a group of spheres.
  // Broad noise defines ranges; ridged noise defines connected mountain chains;
  // fine noise adds detail without turning the surface into random spikes.
  const width = 52;
  const depth = 58;
  const segmentsX = 240;
  const segmentsZ = 256;
  const geometry = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsZ);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const heights = new Float32Array(positions.count);
  const type = config.surface.type;
  const surfaceColorHex = config.surface.baseColorHex || "#52795b";
  const terrainSeeds = {
    "ocean-and-rock": 101,
    rocky: 211,
    ocean: 307,
    icy: 401,
    desert: 503,
    volcanic: 601,
    "gas-giant": 701,
    custom: 809,
  };
  const seed = terrainSeeds[type] || 101;
  const reliefByType = { "ocean-and-rock": 1.0, rocky: 1.12, ocean: 0.88, icy: 0.82, desert: 0.9, volcanic: 1.18, custom: 1.0 };
  const relief = reliefByType[type] || 1.0;
  const isGasGiant = type === "gas-giant";
  // Lower the waterline relative to the old default so continental shelves and foothills
  // stay visible; high water settings still inundate more of the landform.
  const seaLevel = THREE.MathUtils.clamp(-0.62 + config.surface.waterFraction * 0.38, -0.62, -0.24);

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const nx = x / width + 0.5;
    const nz = z / depth + 0.5;

    const continental = fractalNoise(nx * 2.5, nz * 2.05, seed + 2);
    const regional = fractalNoise(nx * 5.3 + 4, nz * 4.25 - 3, seed + 31);
    const coastNoise = fractalNoise(nx * 6.1 + 6, nz * 6.8 - 4, seed + 21);
    const massif = fractalNoise(nx * 2.9 + 11, nz * 2.35 + 7, seed + 53);
    const ridgeSource = fractalNoise(nx * 7.4 + 17, nz * 5.9 - 8, seed + 79);
    const ridges = 1 - Math.abs(ridgeSource * 2 - 1);
    const fine = fractalNoise(nx * 18.0 + 2, nz * 16.0 + 5, seed + 109);
    let height;

    if (isGasGiant) {
      // Gas giants have a banded cloud-top view, not solid mountains or ground.
      const bands = Math.sin(nz * 83 + fractalNoise(nx * 3.6, nz * 8.1, seed + 43) * 3.0);
      const stormUndulation = fractalNoise(nx * 7, nz * 4, seed + 67) - 0.5;
      height = bands * 0.09 + stormUndulation * 0.11 + (regional - 0.5) * 0.035;
    } else {
      // Broad connected landmasses keep the view occupied by terrain instead of isolated islands.
      // Coastal falloff is kept to the distant edge of the patch; local topography stays continuous.
      const lobeA = 1.10 - Math.sqrt(((nx - 0.50) / 0.70) ** 2 + ((nz - 0.56) / 0.73) ** 2);
      const lobeB = 0.93 - Math.sqrt(((nx - 0.78) / 0.40) ** 2 + ((nz - 0.65) / 0.46) ** 2);
      const lobeC = 0.74 - Math.sqrt(((nx - 0.23) / 0.34) ** 2 + ((nz - 0.28) / 0.37) ** 2);
      const peninsula = 0.52 - Math.abs(nz - (0.29 + (nx - 0.48) * 0.65)) * 1.9 - Math.max(0, nx - 0.43) * 0.40;
      const coastShape = Math.max(lobeA, lobeB, lobeC, peninsula) + (coastNoise - 0.5) * 0.10 + (regional - 0.5) * 0.045;
      const landMask = smoothRange(-0.40, 0.08, coastShape);
      const mountainMask = smoothRange(0.34, 0.72, massif);
      const ridgeAxis = z - (Math.sin(x * 0.22 + seed) * 4.2 + x * 0.12 + 0.5);
      const mountainBelt = Math.exp(-Math.pow(ridgeAxis / (type === "rocky" ? 8.3 : 7.4), 2));
      const secondaryBelt = Math.exp(-Math.pow((z + x * 0.26 + 9.5) / 5.2, 2)) * 0.24;
      const connectedRidges = Math.pow(Math.max(0, mountainBelt * 0.72 + secondaryBelt), 0.88) * (0.16 + ridges * 0.34) * (0.48 + mountainMask * 0.52);
      const lowland = (regional - 0.5) * 0.42 + (continental - 0.48) * 0.26;
      height = -0.92 + landMask * (1.18 + lowland * 0.78 + continental * 0.10);
      height += connectedRidges * relief * landMask * 0.78;
      height += (fine - 0.5) * 0.025 * landMask;

      if (type === "icy") height = -0.92 + landMask * (1.14 + lowland * 0.66) + connectedRidges * relief * landMask * 0.84;
      if (type === "desert") {
        height += Math.sin(nz * 24 + regional * 3.1) * 0.04 * landMask;
        height += Math.pow(Math.max(0, ridgeSource - 0.28), 2) * landMask * 0.19;
      }
      if (type === "volcanic") {
        const coneDistance = Math.sqrt(((x + 4.5) / 5.2) ** 2 + ((z - 1.5) / 5.0) ** 2);
        const cone = Math.max(0, 1 - coneDistance);
        const crater = Math.exp(-(((x + 4.5) ** 2 + (z - 1.5) ** 2) / 8.0));
        height += (cone * 0.98 - crater * 0.20) * landMask;
      }
      height *= relief;
      height = THREE.MathUtils.lerp(-1.20, height, smoothRange(0.005, 0.28, coastShape + 0.12));
      height = -1.20 + (height + 1.20) * terrainRelief;
    }

    heights[i] = height;
    positions.setY(i, height);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  const colors = new Float32Array(positions.count * 3);
  const userTint = new THREE.Color(surfaceColorHex);
  const wavelength = config.observer.viewing.wavelength;

  const oceanDeep = new THREE.Color(type === "icy" ? "#153c59" : "#0a314f");
  const oceanShelf = new THREE.Color(type === "icy" ? "#4d91a5" : "#267d91");
  const beach = new THREE.Color(type === "icy" ? "#a5c9d1" : "#b3a47a");
  const grassLow = new THREE.Color(type === "icy" ? "#557f88" : type === "desert" ? "#9c794e" : type === "volcanic" ? "#282b2b" : type === "rocky" ? "#7a654e" : "#315b45");
  const grassHigh = new THREE.Color(type === "icy" ? "#a9cbd0" : type === "desert" ? "#c8a875" : type === "volcanic" ? "#4d5150" : type === "rocky" ? "#a48c70" : "#718564");
  const rock = new THREE.Color(type === "icy" ? "#9fbfc9" : type === "desert" ? "#a18b6b" : "#777b78");
  const snow = new THREE.Color(type === "icy" ? "#f2fbff" : "#dce8e9");
  const gasBase = userTint.clone();
  const gasCream = new THREE.Color("#d6b898");
  const gasDark = new THREE.Color("#704c42");

  for (let i = 0; i < positions.count; i += 1) {
    const height = heights[i];
    const nx = positions.getX(i) / width + 0.5;
    const nz = positions.getZ(i) / depth + 0.5;
    let color;

    if (isGasGiant) {
      const band = 0.5 + 0.5 * Math.sin(nz * 83 + fractalNoise(nx * 3.6, nz * 8.1, seed + 43) * 3.0);
      color = gasDark.clone().lerp(gasBase, 0.48).lerp(gasCream, smoothRange(0.42, 0.77, band) * 0.88);
      const turbulentCloud = fractalNoise(nx * 9.0, nz * 3.2, seed + 143);
      color.lerp(gasCream, smoothRange(0.72, 0.9, turbulentCloud) * 0.22);
    } else if (config.surface.waterFraction > 0.04 && height < seaLevel) {
      const depthFactor = clamp((seaLevel - height) / 1.15, 0, 1);
      color = oceanShelf.clone().lerp(oceanDeep, depthFactor);
    } else if (config.surface.waterFraction > 0.04 && height < seaLevel + 0.085) {
      color = beach.clone().lerp(grassLow, smoothRange(seaLevel + 0.01, seaLevel + 0.12, height) * 0.28);
    } else {
      const relativeElevation = clamp((height - seaLevel) / 1.55, 0, 1);
      color = grassLow.clone().lerp(grassHigh, smoothRange(0.08, 0.62, relativeElevation));
      const normalY = normals.getY(i);
      const slope = 1 - clamp(normalY, 0, 1);
      color.lerp(rock, smoothRange(0.16, 0.42, slope) * 0.83);

      const snowStart = 0.77 - config.surface.snowIceFraction * 0.5;
      const snowCoverage = smoothRange(snowStart, Math.min(1.8, snowStart + 0.32), height)
        * clamp(0.22 + config.surface.snowIceFraction * 1.8, 0, 1);
      color.lerp(snow, snowCoverage);

      if (type === "volcanic") {
        const fissure = fractalNoise(nx * 22, nz * 19, seed + 177);
        const lava = smoothRange(0.76, 0.86, fissure) * (1 - smoothRange(0.8, 1.15, height));
        color.lerp(new THREE.Color("#a74421"), lava * 0.72);
      }
      if (type === "custom" || type === "rocky") color.lerp(userTint, type === "custom" ? 0.42 : 0.12);
    }

    if (ringShadows && !isGasGiant) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const curve = Math.sin(z * 0.055) * 3.4 + z * 0.31 + 3.0;
      const bandA = 1 - smoothRange(0.55, 1.9, Math.abs(x - curve));
      const bandB = 1 - smoothRange(0.32, 1.15, Math.abs(x - curve - 4.2 - Math.sin(z * 0.035) * 1.2));
      color.multiplyScalar(1 - Math.max(bandA * 0.32, bandB * 0.21));
    }

    // Optional false-colour viewing bands are a visualization mode, not literal imagery.
    if (wavelength === "infrared") color.lerp(new THREE.Color("#bd5873"), isGasGiant ? 0.12 : 0.28);
    if (wavelength === "ultraviolet") color.lerp(new THREE.Color("#7b6bd0"), isGasGiant ? 0.1 : 0.28);

    // Slight contour banding helps the eye read elevation changes without a wireframe.
    if (!isGasGiant && height > seaLevel) {
      const contourDistance = Math.abs(((height - seaLevel) * 5.2) % 1 - 0.5);
      const contour = 1 - smoothRange(0.455, 0.49, contourDistance);
      color.lerp(new THREE.Color("#101d25"), contour * 0.075);
    }

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  geometry.userData.seaLevel = seaLevel;
  geometry.userData.isGasGiant = isGasGiant;
  geometry.userData.terrainMeta = { width, depth, segmentsX, segmentsZ, seaLevel, isGasGiant };
  return geometry;
}

function TerrainPatch({ config, terrainRelief, ringShadows }) {
  const geometry = useMemo(
    () => buildTerrainGeometry({
      surface: {
        type: config.surface.type,
        baseColorHex: config.surface.baseColorHex,
        waterFraction: config.surface.waterFraction,
        snowIceFraction: config.surface.snowIceFraction,
      },
      observer: { viewing: { wavelength: config.observer.viewing.wavelength } },
    }, terrainRelief, ringShadows),
    [
      terrainRelief,
      config.surface.type,
      config.surface.baseColorHex,
      config.surface.waterFraction,
      config.surface.snowIceFraction,
      config.observer.viewing.wavelength,
      ringShadows,
    ],
  );
  const isGasGiant = config.surface.type === "gas-giant";
  const seaLevel = geometry.userData.seaLevel ?? 0;
  const waterColor = config.surface.type === "icy" ? "#347b94" : config.observer.viewing.wavelength === "infrared" ? "#543b60" : config.observer.viewing.wavelength === "ultraviolet" ? "#332d75" : "#0c4768";

  const textures = useMemo(() => {
    const seed = ({ "ocean-and-rock": 101, rocky: 211, ocean: 307, icy: 401, desert: 503, volcanic: 601, "gas-giant": 701, custom: 809 }[config.surface.type] || 101);
    const map = createTerrainDetailTexture(config.surface.type, seed, 9, 10, "color");
    const bump = createTerrainDetailTexture(config.surface.type, seed, 9, 10, "bump");
    const waterBump = createTerrainDetailTexture("ocean-and-rock", seed + 919, 18, 18, "bump");
    return { map, bump, waterBump };
  }, [config.surface.type]);
  useEffect(() => () => { textures.map.dispose(); textures.bump.dispose(); textures.waterBump.dispose(); }, [textures]);

  return (
    <group position={[0, -0.34, -12]} scale={[1, 1.23, 1]}>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshPhysicalMaterial
          map={textures.map}
          bumpMap={textures.bump}
          bumpScale={0.13}
          vertexColors
          roughness={clamp(config.surface.roughness, 0.2, 1)}
          clearcoat={0.035}
          clearcoatRoughness={0.88}
          metalness={config.surface.type === "volcanic" ? 0.08 : 0.01}
          emissive={config.surface.type === "volcanic" ? "#2d1208" : "#000000"}
          emissiveIntensity={config.surface.type === "volcanic" ? 0.12 : 0}
          side={THREE.DoubleSide}
        />
      </mesh>
      <TerrainEcosystem geometry={geometry} type={config.surface.type} scaleFactor={1.9} seed={({ "ocean-and-rock": 101, rocky: 211, ocean: 307, icy: 401, desert: 503, volcanic: 601, custom: 809 }[config.surface.type] || 101)} density={1.2} />
      {!isGasGiant && config.surface.waterFraction > 0.04 && (
        <mesh position={[0, seaLevel + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[260, 260, 1, 1]} />
          <meshPhysicalMaterial color={waterColor === "#0c4768" ? "#135b73" : waterColor} bumpMap={textures.waterBump} bumpScale={0.045} roughness={0.22} metalness={0.08} clearcoat={0.82} clearcoatRoughness={0.14} emissive={waterColor} emissiveIntensity={0.22} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function SoftAtmosphere({ color, opacity }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTint: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 uTint;
      uniform float uOpacity;
      void main() {
        float verticalFade = 1.0 - smoothstep(0.04, 0.92, vUv.y);
        float lateralFade = 0.58 + 0.42 * (1.0 - abs(vUv.x - 0.5) * 2.0);
        float alpha = uOpacity * verticalFade * verticalFade * lateralFade;
        gl_FragColor = vec4(uTint, alpha);
      }
    `,
  }), [color, opacity]);

  return <mesh position={[0, 2.1, -29]}><planeGeometry args={[54, 15]} /><primitive object={material} attach="material" /></mesh>;
}

function CloudVeil({ tint, opacity }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTint: { value: new THREE.Color(tint) }, uOpacity: { value: opacity } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 uTint;
      uniform float uOpacity;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        float a = hash(i); float b = hash(i + vec2(1.0,0.0));
        float c = hash(i + vec2(0.0,1.0)); float d = hash(i + vec2(1.0,1.0));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0; float amp = 0.5;
        for (int i=0; i<4; i++) { value += noise(p)*amp; p*=2.0; amp*=0.5; }
        return value;
      }
      void main() {
        vec2 p = vUv * vec2(9.0, 3.0);
        p.y += sin(p.x * 0.68) * 0.20;
        float cloud = smoothstep(0.53, 0.73, fbm(p));
        cloud *= smoothstep(0.18, 0.58, fbm(p * vec2(0.5, 1.3) + 3.7));
        float verticalFade = smoothstep(0.02, 0.24, vUv.y) * (1.0 - smoothstep(0.78, 0.98, vUv.y));
        gl_FragColor = vec4(uTint, cloud * verticalFade * uOpacity * 0.78);
      }
    `,
  }), [tint, opacity]);

  return <mesh position={[0, 3.1, -23.5]}><planeGeometry args={[50, 11]} /><primitive object={material} attach="material" /></mesh>;
}

function SkyScene({ config, altitudeDeg, terrainRelief, celestial, ringShadows }) {
  const palette = getSkyPalette(config, altitudeDeg);
  const atmosphereFactor = config.atmosphere.present
    ? clamp((config.atmosphere.surfacePressureKPa / 101.4) * (config.atmosphere.densityKgM3 / 1.217), 0, 3)
    : 0;
  const exposure = config.observer.viewing.exposure;
  const dayBrightness = clamp((altitudeDeg + 9) / 40, 0, 1);
  const starsVisible = altitudeDeg < 4 && config.observer.viewing.cloudiness < 0.8 && config.observer.viewing.haze < 0.85;
  const hourFraction = config.observer.timeOfDayHours / config.observer.dayLengthHours;
  const azimuth = 2 * Math.PI * (hourFraction - 0.25);
  const separation = THREE.MathUtils.degToRad(celestial.separationDeg);
  const sunProfiles = useMemo(() => [
    { azimuthOffset: 0, altitudeOffset: 0, color: config.star.colorHex, weight: 1, name: config.star.name },
    { azimuthOffset: separation, altitudeOffset: 5.5, color: "#ffc18a", weight: 0.83, name: "Warm companion" },
    { azimuthOffset: -separation * 1.12, altitudeOffset: -7.5, color: "#9ccaff", weight: 0.72, name: "Blue companion" },
  ].slice(0, celestial.sunCount), [config.star.colorHex, config.star.name, separation, celestial.sunCount]);
  const suns = useMemo(() => sunProfiles.map((profile) => {
    const sunAltitudeDeg = clamp(altitudeDeg + profile.altitudeOffset, -89, 89);
    const altitude = THREE.MathUtils.degToRad(sunAltitudeDeg);
    const sunAzimuth = azimuth + profile.azimuthOffset;
    const horizontal = Math.cos(altitude);
    return {
      ...profile,
      altitudeDeg: sunAltitudeDeg,
      elevation: Math.sin(altitude),
      direction: [Math.cos(sunAzimuth) * horizontal, Math.sin(altitude), Math.sin(sunAzimuth) * horizontal],
      position: [Math.cos(sunAzimuth) * horizontal * 18, -0.2 + Math.sin(altitude) * 18, -11 + Math.sin(sunAzimuth) * horizontal * 18],
    };
  }), [sunProfiles, altitudeDeg, azimuth]);
  const primarySun = suns[0];
  const additionalSuns = suns.slice(1).map((sun) => ({ direction: sun.direction, color: sun.color, elevation: sun.elevation, weight: sun.weight }));
  const cloudOpacity = config.surface.cloudDeck
    ? clamp(config.observer.viewing.cloudiness * 0.56, 0, 0.56)
    : 0;
  const atmosphereOpacity = config.atmosphere.present
    ? clamp(0.025 + (config.atmosphere.renderedThicknessKm / 500) * 0.16 + Math.log10(1 + atmosphereFactor) * 0.05 + config.atmosphere.aerosol * 0.06, 0.02, 0.34)
    : 0;
  const fluxFactor = clamp(Math.sqrt(computeStellarFluxWm2(config.star) / 1361), 0.3, 2.1);
  const temperatureFactor = clamp(Math.pow(config.star.effectiveTemperatureK / 5772, 0.18), 0.75, 1.45);
  const starIntensity = clamp((0.7 + dayBrightness * 1.7) * exposure * fluxFactor * temperatureFactor, 0.1, 5);
  const starRadius = clamp(0.19 + (config.star.effectiveTemperatureK / 50000) * 0.19, 0.19, 0.38);
  const hazeColor = config.observer.viewing.wavelength === "infrared"
    ? "#bb7294"
    : config.observer.viewing.wavelength === "ultraviolet"
      ? "#8877db"
      : config.observer.viewing.skyTintHex;
  const moonAngle = hourFraction * Math.PI * 2 + Math.PI * 0.65;
  const moonPosition = [Math.cos(moonAngle) * 17, 2.2 + Math.sin(moonAngle) * 5.5, -11 + Math.sin(moonAngle) * 14];
  return (
    <>
      <color attach="background" args={[palette]} />
      <fog attach="fog" args={[palette, 25, 72]} />
      <AtmosphericSky
        sunPosition={primarySun.position}
        sunDirection={primarySun.direction}
        sunElevation={primarySun.elevation}
        sunColor={primarySun.color}
        hazeColor={hazeColor}
        rayleighStrength={getScatteringParameters(config).rayleigh}
        mieStrength={getScatteringParameters(config).mie}
        additionalSuns={additionalSuns}
      />
      <ambientLight color={palette} intensity={0.23 + dayBrightness * 0.34 + config.observer.viewing.moonlight * (celestial.moon ? 0.12 : 0)} />
      <pointLight position={[-8, 4, -19]} color={hazeColor} intensity={1.4 + atmosphereOpacity * 8} distance={48} decay={2} />
      {suns.map((sun, index) => <directionalLight key={`${sun.name}-light`} position={sun.position} color={sun.color} intensity={starIntensity * sun.weight * (index === 0 ? 1 : 0.72)} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={32} shadow-camera-bottom={-32} shadow-bias={-0.00018} />)}
      <Stars radius={80} depth={45} count={starsVisible ? Math.round(1450 * (1 - config.observer.viewing.cloudiness * 0.6)) : 90} factor={2.3} saturation={0.22} fade speed={0.08} />

      {atmosphereOpacity > 0.01 && <SoftAtmosphere color={hazeColor} opacity={Math.min(0.4, atmosphereOpacity * 1.3)} />}
      {cloudOpacity > 0.025 && <CloudVeil tint={config.observer.viewing.wavelength === "infrared" ? "#d5a2d5" : config.observer.viewing.wavelength === "ultraviolet" ? "#b1a6ee" : "#edf5fb"} opacity={cloudOpacity * (1 - config.observer.viewing.haze * 0.25)} />}

      {suns.map((sun, index) => <group key={`${sun.name}-disc`} position={sun.position}>
        <mesh>
          <sphereGeometry args={[index === 0 ? starRadius : starRadius * 0.82, 32, 24]} />
          <meshBasicMaterial color={sun.color} toneMapped={false} />
        </mesh>
        <mesh scale={2.1}>
          <sphereGeometry args={[index === 0 ? starRadius : starRadius * 0.82, 32, 24]} />
          <meshBasicMaterial color={sun.color} transparent opacity={clamp(0.18 + config.observer.viewing.haze * 0.16, 0.14, 0.36)} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh scale={3.35}>
          <sphereGeometry args={[index === 0 ? starRadius : starRadius * 0.82, 24, 16]} />
          <meshBasicMaterial color={sun.color} transparent opacity={0.065} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <pointLight color={sun.color} intensity={starIntensity * sun.weight * 6.5} distance={46} decay={2} />
      </group>)}

      {celestial.moon && <group position={moonPosition}>
        <mesh castShadow>
          <sphereGeometry args={[0.42, 36, 24]} />
          <meshStandardMaterial color="#c7d9e8" roughness={0.96} emissive="#496d95" emissiveIntensity={0.08} />
        </mesh>
        <mesh scale={1.23}>
          <sphereGeometry args={[0.42, 28, 20]} />
          <meshBasicMaterial color="#9ec8ff" transparent opacity={0.11} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <pointLight color="#a8ceff" intensity={0.22 + config.observer.viewing.moonlight * 0.65} distance={25} decay={2} />
      </group>}
      {celestial.moon && <directionalLight position={moonPosition} color="#a9cfff" intensity={Math.max(0.12, config.observer.viewing.moonlight * 0.65)} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18} />}

      {celestial.ringShadows && <group position={[5.4, 4.0, -18.5]} rotation={[0.32, -0.22, 0.1]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[1.12, 40, 26]} />
          <meshStandardMaterial color="#a99a80" roughness={0.78} />
        </mesh>
        <mesh rotation={[Math.PI / 2.35, 0, 0]} castShadow receiveShadow>
          <ringGeometry args={[1.34, 2.06, 128]} />
          <meshStandardMaterial color="#d8c49d" side={THREE.DoubleSide} roughness={0.94} transparent opacity={0.8} />
        </mesh>
        <mesh rotation={[Math.PI / 2.35, 0, 0]} scale={1.08}>
          <ringGeometry args={[1.5, 1.92, 128]} />
          <meshBasicMaterial color="#9ebbd9" side={THREE.DoubleSide} transparent opacity={0.25} />
        </mesh>
      </group>}
      <DistantFauna count={24} spread={22} height={1.8} depth={-15.6} tint="#142b36" />

      <TerrainPatch config={config} terrainRelief={terrainRelief} ringShadows={ringShadows} />

      {config.observer.viewing.airglow && config.atmosphere.present && (
        <mesh position={[0, -0.25, -25.5]}>
          <torusGeometry args={[5.9, 0.018 + (config.atmosphere.renderedThicknessKm / 500) * 0.045, 6, 90, Math.PI]} />
          <meshBasicMaterial color={config.observer.viewing.wavelength === "infrared" ? "#d665c9" : "#42e0b9"} transparent opacity={0.08 + config.atmosphere.aerosol * 0.12} />
        </mesh>
      )}

      <OrbitControls enablePan={false} enableZoom minDistance={15} maxDistance={34} minPolarAngle={0.72} maxPolarAngle={1.39} target={[0, -0.2, -11]} enableDamping dampingFactor={0.075} />
    </>
  );
}

function PromptChangeRow({ field, value }) {
  return <><dt>{field}</dt><dd>{value}</dd></>;
}

function SkyCard({ config, altitudeDeg, fluxWm2, equilibriumK, explanation, lastPrompt, lastPromptChanges }) {
  const mixture = getAtmosphereMix(config.atmosphere);
  const atmoSummary = config.atmosphere.present
    ? Object.entries(mixture).filter(([, pct]) => pct > 0).sort((a, b) => b[1] - a[1]).map(([gas, pct]) => `${gasShortLabels[gas] || gas}: ${pct.toFixed(pct >= 1 ? 1 : pct >= 0.01 ? 2 : 4)}%`).join(" · ")
    : "No atmosphere configured";
  return (
    <aside className="sky-card" id="sky-card">
      <div className="sky-card__topline"><span>HORIZON SHIFT / OBSERVATION REPORT</span><span>HS-SKY / 01</span></div>
      <h2>{config.name}</h2>
      <div className="sky-card__preview" style={{ background: `linear-gradient(180deg, ${getSkyPalette(config, altitudeDeg)} 0%, #141c35 68%, ${config.surface.baseColorHex} 100%)` }}>
        <span className="sky-card__preview-star" style={{ left: `${clamp((config.observer.timeOfDayHours / config.observer.dayLengthHours) * 100, 4, 96)}%`, bottom: `${clamp(27 + altitudeDeg * 0.42, 7, 78)}%`, background: config.star.colorHex, boxShadow: `0 0 18px 5px ${config.star.colorHex}88` }} />
        <span className="sky-card__preview-horizon" style={{ background: config.surface.baseColorHex }} />
        <span className="sky-card__preview-caption">QUALITATIVE SKY PREVIEW · NOT A PHOTOGRAPH</span>
      </div>
      <div className="sky-card__badge-row"><span>{config.provenance.kind.replaceAll("-", " ")}</span><span>{config.surface.type === "gas-giant" ? "CLOUD-TOP VIEW" : "SURFACE VIEW"}</span></div>
      <p className="sky-card__explanation">{explanation}</p>

      <section className="sky-card__section">
        <h3>Atmosphere</h3>
        <dl>
          <dt>Present</dt><dd>{config.atmosphere.present ? "Yes" : "No"}</dd>
          <dt>Rendered shell</dt><dd>{formatNumber(config.atmosphere.renderedThicknessKm, 1)} km</dd>
          <dt>Pressure</dt><dd>{formatNumber(config.atmosphere.surfacePressureKPa, 2)} kPa</dd>
          <dt>Density</dt><dd>{formatNumber(config.atmosphere.densityKgM3, 3)} kg/m³</dd>
          <dt>CO₂</dt><dd>{Math.round(config.atmosphere.co2Ppm).toLocaleString()} ppm ({formatNumber(config.atmosphere.co2Ppm / 10000, 3)}%)</dd>
          <dt>Modeled mixture</dt><dd>{atmoSummary}</dd>
          <dt>Aerosol</dt><dd>{Math.round(config.atmosphere.aerosol * 100)}%</dd>
        </dl>
      </section>

      <section className="sky-card__section">
        <h3>Host star</h3>
        <dl>
          <dt>Type</dt><dd>{config.star.spectralClass}-class · {config.star.name}</dd>
          <dt>Temperature</dt><dd>{Math.round(config.star.effectiveTemperatureK).toLocaleString()} K</dd>
          <dt>Color</dt><dd><i className="sky-card__color-dot" style={{ background: config.star.colorHex }} />{config.star.colorHex}</dd>
          <dt>Luminosity</dt><dd>{config.star.luminositySolar.toPrecision(3)} L☉</dd>
          <dt>Distance</dt><dd>{config.star.distanceAU.toPrecision(3)} AU</dd>
          <dt>Estimated flux</dt><dd>{fluxWm2.toLocaleString(undefined, { maximumFractionDigits: 2 })} W/m²</dd>
          <dt>Flux assumption</dt><dd>S ≈ 1361 × L / d²</dd>
        </dl>
      </section>

      <section className="sky-card__section">
        <h3>Surface & observer</h3>
        <dl>
          <dt>Surface/view</dt><dd>{surfaceLabels[config.surface.type]}</dd>
          <dt>Albedo</dt><dd>{config.surface.bondAlbedo.toFixed(3)}</dd>
          <dt>Roughness</dt><dd>{config.surface.roughness.toFixed(2)}</dd>
          <dt>Water / ice</dt><dd>{Math.round(config.surface.waterFraction * 100)}% / {Math.round(config.surface.snowIceFraction * 100)}%</dd>
          <dt>Cloud deck</dt><dd>{config.surface.cloudDeck ? "Enabled" : "Disabled"}</dd>
          <dt>Latitude</dt><dd>{Math.abs(config.observer.latitudeDeg).toFixed(1)}° {config.observer.latitudeDeg < 0 ? "S" : "N"}</dd>
          <dt>Axial tilt</dt><dd>{config.observer.axialTiltDeg.toFixed(2)}°</dd>
          <dt>Day length</dt><dd>{config.observer.dayLengthHours.toFixed(2)} h</dd>
          <dt>Time of day</dt><dd>{config.observer.timeOfDayHours.toFixed(2)} h</dd>
          <dt>Season phase</dt><dd>{config.observer.yearProgress.toFixed(3)}</dd>
        </dl>
      </section>

      <section className="sky-card__section">
        <h3>Viewing conditions</h3>
        <dl>
          <dt>Cloudiness</dt><dd>{Math.round(config.observer.viewing.cloudiness * 100)}%</dd>
          <dt>Haze</dt><dd>{Math.round(config.observer.viewing.haze * 100)}%</dd>
          <dt>Moonlight</dt><dd>{Math.round(config.observer.viewing.moonlight * 100)}%</dd>
          <dt>Exposure</dt><dd>{config.observer.viewing.exposure.toFixed(2)}×</dd>
          <dt>Wavelength</dt><dd>{config.observer.viewing.wavelength}</dd>
          <dt>Airglow</dt><dd>{config.observer.viewing.airglow ? "On" : "Off"}</dd>
          <dt>Sky tint</dt><dd><i className="sky-card__color-dot" style={{ background: config.observer.viewing.skyTintHex }} />{config.observer.viewing.skyTintHex}</dd>
        </dl>
      </section>

      <section className="sky-card__science">
        <span className="sky-card__kicker">CELESTIAL MECHANIC</span>
        <strong>Modeled host-star altitude: {altitudeDeg >= 0 ? "+" : ""}{altitudeDeg.toFixed(2)}°</strong>
        <p>δ = asin(sin ε × sin(2πp))</p>
        <p>h = asin(sin φ sin δ + cos φ cos δ cos H)</p>
        <small>φ = latitude; ε = axial tilt; p = seasonal phase; H = 2π(t/P − 0.5); t = time of day; P = day length. Circular-orbit simplification, not an astronomical ephemeris.</small>
      </section>

      <section className="sky-card__science">
        <span className="sky-card__kicker">FORMULA READOUT / EFFECTIVE EQUILIBRIUM TEMPERATURE</span>
        <strong>Tₑq = [S × (1 − A) / (4σ)]<sup>1/4</sup></strong>
        <p>S = {fluxWm2.toFixed(2)} W/m² · A = {config.surface.bondAlbedo.toFixed(3)} · σ = 5.670374419 × 10⁻⁸ W·m⁻²·K⁻⁴</p>
        <strong>{equilibriumK.toFixed(2)} K / {(equilibriumK - 273.15).toFixed(2)} °C</strong>
        <small>Assumptions: spherical planet, steady-state energy balance, uniform effective temperature and complete heat redistribution. The formula excludes greenhouse warming. This is not a surface-temperature prediction.</small>
      </section>

      {lastPrompt && (
        <section className="sky-card__section">
          <h3>Applied natural-language prompt</h3>
          <p>{lastPrompt}</p>
          {lastPromptChanges?.length > 0 && <dl>{lastPromptChanges.map((change, index) => <PromptChangeRow key={`${change.field}-${index}`} field={change.field} value={change.value} />)}</dl>}
        </section>
      )}
      <section className="sky-card__science sky-card__science--scattering">
        <span className="sky-card__kicker">ATMOSPHERIC OPTICS / REAL-TIME APPROXIMATION</span>
        <strong>Rayleigh + Mie single-scattering model</strong>
        <p>Rayleigh strength (pressure-column proxy): {getScatteringParameters(config).rayleigh.toFixed(3)}× Earth</p>
        <p>Mie / aerosol intensity proxy: {getScatteringParameters(config).mie.toFixed(2)} · Henyey–Greenstein g = 0.76</p>
        <small>Rayleigh wavelength weighting follows βR ∝ λ⁻⁴; aerosols use a forward-peaked Mie phase approximation. Pressure proxies the atmospheric column, while haze/aerosol controls the dust term. This is a simplified RGB shader, not multi-wavelength radiative transfer; Mars dust tint and all rendered colors are qualitative.</small>
      </section>

      <section className="sky-card__section">
        <h3>Provenance & assumptions</h3>
        <p>{config.provenance.sourceLabel}</p>
        <p>The rendered shell thickness, color, clouds and sky response are visualization settings. Unless marked as an Earth reference, the planet settings are illustrative user inputs.</p>
        <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html" target="_blank" rel="noreferrer">NASA/NSSDC Earth Fact Sheet ↗</a>
        <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html" target="_blank" rel="noreferrer">NASA/NSSDC Sun Fact Sheet ↗</a>
        <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html?level=1" target="_blank" rel="noreferrer">NASA/NSSDC Mars Fact Sheet ↗</a>
        <a href="https://science.nasa.gov/mars/facts/" target="_blank" rel="noreferrer">NASA Mars atmosphere and dust ↗</a>
        <a href="https://science.nasa.gov/resource/rayleigh-scattering-in-exoplanet-atmospheres/" target="_blank" rel="noreferrer">NASA: Rayleigh scattering ↗</a>
        <a href="https://www.noaa.gov/jetstream/clouds/color-of-clouds" target="_blank" rel="noreferrer">NOAA: aerosol / Mie scattering ↗</a>
      </section>
      <p className="sky-card__timestamp">Generated {new Date().toLocaleString()}</p>
    </aside>
  );
}

export default function PlanetSkyView() {
  const [initial] = useState(() => loadInitialSkyConfig());
  const [config, setConfig] = useState(() => initial.config);
  const [terrainRelief, setTerrainRelief] = useState(1.0);
  const [celestial, setCelestial] = useState(() => ({ ...DEFAULT_CELESTIAL_SETTINGS, ...(initial.celestial || {}) }));
  const [prompt, setPrompt] = useState("");
  const [promptPreview, setPromptPreview] = useState(null);
  const [promptMessage, setPromptMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [validationWarnings, setValidationWarnings] = useState(initial.warnings);
  const [lastPrompt, setLastPrompt] = useState("");
  const [lastPromptChanges, setLastPromptChanges] = useState([]);
  const rendererRef = useRef(null);

  const altitudeDeg = useMemo(() => computeSolarAltitudeDeg(config.observer), [config.observer]);
  const fluxWm2 = useMemo(() => computeStellarFluxWm2(config.star), [config.star]);
  const equilibriumK = useMemo(() => equilibriumTemperatureK(fluxWm2, config.surface.bondAlbedo), [fluxWm2, config.surface.bondAlbedo]);
  const explanation = useMemo(() => buildWorldExplanation(config, altitudeDeg), [config, altitudeDeg]);

  function updateConfig(path, value) {
    const candidate = markUserEdited(setNestedValue(config, path, value));
    const result = validateSkyConfig(candidate);
    setConfig(result.config);
    setValidationWarnings(result.warnings);
    setShareUrl("");
    setShareMessage("");
  }

  function updateCelestial(path, value) {
    setCelestial((current) => ({ ...current, [path]: value }));
    setShareUrl("");
    setShareMessage("");
  }

  function loadEarthPreset() {
    setConfig(clone(EARTH_REFERENCE));
    setValidationWarnings([]);
    setPromptPreview(null);
    setLastPrompt("");
    setLastPromptChanges([]);
    setShareUrl("");
    setPromptMessage("Earth Reference preset loaded. Values are linked to the NASA/NSSDC reference sources shown in the sky card.");
  }

  function loadMarsPreset() {
    setConfig(clone(MARS_REFERENCE));
    setValidationWarnings([]);
    setPromptPreview(null);
    setLastPrompt("");
    setLastPromptChanges([]);
    setShareUrl("");
    setPromptMessage("Mars Reference preset loaded using NASA/NSSDC pressure, composition, rotation and orbital references. Sky colors remain a simplified dust/scattering visualization.");
  }

  function loadSampleWorld() {
    setConfig(clone(INITIAL_ILLUSTRATIVE_WORLD));
    setValidationWarnings([]);
    setPromptPreview(null);
    setLastPrompt("");
    setLastPromptChanges([]);
    setShareUrl("");
    setPromptMessage("Illustrative red-dwarf sample loaded. These values are a designed scenario, not measurements of a known world.");
  }

  function previewPrompt(event) {
    event.preventDefault();
    const result = applyWorldPrompt(prompt, config);
    if (result.changes.length === 0) {
      setPromptPreview(null);
      setPromptMessage("I couldn't identify a supported setting in that prompt. Try a star type, surface, latitude, day length, atmosphere, haze or time-of-day phrase.");
      return;
    }
    setPromptPreview(result);
    setPromptMessage("");
  }

  function applyPromptPreview() {
    if (!promptPreview) return;
    setConfig(promptPreview.config);
    setValidationWarnings(promptPreview.warnings || []);
    setLastPrompt(prompt);
    setLastPromptChanges(promptPreview.changes || []);
    setPromptMessage("Prompt interpretation applied. The scene and report now use the displayed values.");
    setPromptPreview(null);
    setShareUrl("");
  }

  async function shareConfiguration() {
    try {
      const url = createSkyShareUrl(config, window.location.href, celestial);
      setShareUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setShareMessage("Share URL copied. Open it in a new tab to restore this configuration.");
      } catch {
        setShareMessage("Clipboard access was blocked. Copy the URL from the field below.");
      }
    } catch (error) {
      setShareMessage(`Could not create the share URL: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage("Share URL copied.");
    } catch {
      setShareMessage("Select the URL field and copy it manually.");
    }
  }

  function exportSkyCard() {
    const renderer = rendererRef.current;
    if (!renderer?.domElement) {
      setShareMessage("The sky render is not ready yet. Try exporting again in a moment.");
      return;
    }
    try {
      const source = renderer.domElement;
      const target = document.createElement("canvas");
      const width = 1400;
      const imageHeight = Math.round(width * source.height / source.width);
      target.width = width;
      target.height = imageHeight + 300;
      const context = target.getContext("2d");
      if (!context) throw new Error("Canvas context unavailable");
      context.fillStyle = "#06101b";
      context.fillRect(0, 0, target.width, target.height);
      context.drawImage(source, 0, 0, width, imageHeight);
      context.fillStyle = "#eaf6ff";
      context.font = "700 32px system-ui, sans-serif";
      context.fillText(`HORIZON SHIFT / ${config.name}`, 42, imageHeight + 54);
      context.fillStyle = "#89b9d1";
      context.font = "18px system-ui, sans-serif";
      context.fillText(`${config.star.name} · ${surfaceLabels[config.surface.type]} · ${config.observer.timeOfDayHours.toFixed(2)} h local`, 42, imageHeight + 91);
      context.fillText(`Atmosphere: ${config.atmosphere.present ? `${config.atmosphere.surfacePressureKPa.toFixed(3)} kPa` : "none"} · Haze ${Math.round(config.observer.viewing.haze * 100)}% · Rayleigh ${getScatteringParameters(config).rayleigh.toFixed(3)}× Earth · Mie ${getScatteringParameters(config).mie.toFixed(2)}`, 42, imageHeight + 126, 1310);
      context.fillText(`Celestial setup: ${celestial.sunCount} sun(s) · moon ${celestial.moon ? "on" : "off"} · ring-shadow experiment ${celestial.ringShadows ? "on" : "off"} · sun separation ${celestial.separationDeg}°`, 42, imageHeight + 188, 1310);
      context.fillText(`Stellar flux ${fluxWm2.toFixed(2)} W/m² · Equilibrium temperature ${equilibriumK.toFixed(1)} K · Albedo ${config.surface.bondAlbedo.toFixed(3)}`, 42, imageHeight + 161, 1310);
      context.fillStyle = "#66859d";
      context.font = "15px system-ui, sans-serif";
      context.fillText("Procedural 3D scene · Rayleigh/Mie single-scattering approximation · not a photographic or full climate simulation", 42, imageHeight + 218);
      context.fillText(`Source / scenario: ${config.provenance.sourceLabel}`, 42, imageHeight + 249, 1310);
      const link = document.createElement("a");
      link.download = `horizon-shift-${config.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-sky.png`;
      link.href = target.toDataURL("image/png");
      link.click();
      setShareMessage("Sky card exported as a PNG with its key parameters and assumptions.");
    } catch (error) {
      setShareMessage(`Could not export the current WebGL frame: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return (
    <div className="planet-sky-app">
      <header className="planet-sky-hero">
        <div>
          <div className="planet-sky-eyebrow"><span /> HORIZON SHIFT / PLANET SKY LAB</div>
          <h1>Design a world. <em>Read its sky.</em></h1>
          <p>Tune a few meaningful world settings and explore a local, ground-level landscape with sculpted relief, a luminous horizon, and lighting that responds to your star and time of day.</p>
        </div>
        <div className="planet-sky-hero__actions no-print">
          <button type="button" className="sky-button sky-button--secondary" onClick={loadEarthPreset}>Earth Reference</button>
          <button type="button" className="sky-button sky-button--secondary" onClick={loadMarsPreset}>Mars Reference</button>
          <button type="button" className="sky-button sky-button--secondary" onClick={loadSampleWorld}>Load sample world</button>
        </div>
      </header>

      {validationWarnings.length > 0 && (
        <div className="sky-alert" role="status">
          <strong>Configuration notes</strong>
          {validationWarnings.map((warning, index) => <p key={`${index}-${warning}`}>{warning}</p>)}
        </div>
      )}

      <div className="planet-sky-layout">
        <section className="sky-controls no-print" aria-label="Essential world settings">
          <div className="sky-panel-title"><span>01 / QUICK SETUP</span><h2>Shape your world</h2><p>Six simple controls change the landscape, daylight, and atmosphere immediately.</p></div>
          <div className="sky-quick-controls">
            <SelectField
              label="Surface type"
              value={config.surface.type}
              options={Object.entries(surfaceLabels).map(([value, label]) => ({ value, label }))}
              onChange={(value) => {
                const presets = {
                  "ocean-and-rock": { color: "#275d72", albedo: 0.294, water: 0.71, ice: 0.03, roughness: 0.82 },
                  rocky: { color: "#8e7460", albedo: 0.25, water: 0.1, ice: 0.02, roughness: 0.9 },
                  ocean: { color: "#145c87", albedo: 0.12, water: 0.9, ice: 0.02, roughness: 0.22 },
                  icy: { color: "#b8d6e8", albedo: 0.62, water: 0.15, ice: 0.82, roughness: 0.48 },
                  desert: { color: "#b77b45", albedo: 0.36, water: 0.01, ice: 0, roughness: 0.96 },
                  volcanic: { color: "#512b2c", albedo: 0.12, water: 0, ice: 0, roughness: 0.32 },
                  "gas-giant": { color: "#9b715a", albedo: 0.5, water: 0, ice: 0, roughness: 0.25 },
                  custom: { color: config.surface.baseColorHex, albedo: config.surface.bondAlbedo, water: config.surface.waterFraction, ice: config.surface.snowIceFraction, roughness: config.surface.roughness },
                };
                const preset = presets[value] || presets.custom;
                const next = markUserEdited(setNestedValue(config, "surface.type", value));
                next.surface.baseColorHex = preset.color;
                next.surface.bondAlbedo = preset.albedo;
                next.surface.waterFraction = preset.water;
                next.surface.snowIceFraction = preset.ice;
                next.surface.roughness = preset.roughness;
                const result = validateSkyConfig(next);
                setConfig(result.config); setValidationWarnings(result.warnings); setShareUrl("");
              }}
              help="Gas giant switches to an illustrative cloud-top view."
            />
            <SelectField
              label="Host star"
              value={config.star.spectralClass}
              options={Object.entries(STAR_PRESETS).map(([value, preset]) => ({ value, label: `${value} — ${preset.name}` }))}
              onChange={(value) => {
                const preset = STAR_PRESETS[value];
                const next = markUserEdited(setNestedValue(config, "star.spectralClass", value));
                next.star.name = preset.name;
                next.star.effectiveTemperatureK = preset.effectiveTemperatureK;
                next.star.colorHex = preset.colorHex;
                next.star.luminositySolar = preset.luminositySolar;
                const result = validateSkyConfig(next);
                setConfig(result.config); setValidationWarnings(result.warnings); setShareUrl("");
              }}
              help="Changes star color, lighting, and estimated flux."
            />
            <ToggleField label="Atmosphere enabled" checked={config.atmosphere.present} onChange={(value) => updateConfig("atmosphere.present", value)} help="Toggle haze and the atmospheric glow." />
            <RangeField label="Haze" value={config.observer.viewing.haze} min={0} max={1} step={0.01} unit="%" disabled={!config.atmosphere.present} onChange={(value) => updateConfig("observer.viewing.haze", value)} help="0 = clear distance; 100% = heavy atmospheric haze." />
            <RangeField label="Time of day" value={config.observer.timeOfDayHours} min={0} max={config.observer.dayLengthHours} step={0.25} unit="hours" onChange={(value) => updateConfig("observer.timeOfDayHours", value)} help="Drag from night through sunrise, noon, and sunset." />
            <RangeField label="Terrain relief" value={terrainRelief} min={0.8} max={2.1} step={0.05} unit="×" disabled={config.surface.type === "gas-giant"} onChange={setTerrainRelief} help={config.surface.type === "gas-giant" ? "Cloud-top scenes do not use ground relief." : "Lift the peaks and valleys for a stronger 3D profile."} />
          </div>
          <div className="sky-controls__note"><span className="sky-controls__note-orb" /><p><strong>Tip:</strong> drag the scene to look around and scroll to move closer. The terrain is procedural and illustrative, not measured elevation data.</p></div>
          <details className="sky-celestial-panel no-print">
            <summary><span>CELESTIAL EXPERIMENTS</span><strong>Multiple suns, moons & ring shadows</strong><small>Optional lighting controls; your settings are included in share links.</small></summary>
            <div className="sky-celestial-panel__fields">
              <SelectField label="Number of suns" value={String(celestial.sunCount)} options={[{ value: "1", label: "One sun" }, { value: "2", label: "Binary suns" }, { value: "3", label: "Three suns" }]} onChange={(value) => updateCelestial("sunCount", Number(value))} help="Each star contributes its own light and atmospheric scattering." />
              {celestial.sunCount > 1 && <RangeField label="Sun separation" value={celestial.separationDeg} min={10} max={90} step={1} unit="°" onChange={(value) => updateCelestial("separationDeg", value)} help="Change how far apart the companion suns appear in the sky." />}
              <ToggleField label="Moon + cool moonlight" checked={celestial.moon} onChange={(value) => updateCelestial("moon", value)} help="Adds a visible moon and blue-toned night illumination." />
              <ToggleField label="Ringed companion + ground shadows" checked={celestial.ringShadows} onChange={(value) => updateCelestial("ringShadows", value)} help="Adds a ringed body and broad stylized shadow bands across terrain." />
            </div>
            <p>Separate sun lights can create multiple overlapping shadows and offset sunset colors. Ring-shadow bands are a visual projection, not a complete orbital eclipse calculation.</p>
          </details>
        </section>

        <section className="sky-visual-column" aria-label="Planet sky visualization">
          <div className="sky-viewport">
            <div className="sky-viewport__top"><span>02 / LOCAL TERRAIN + SKY</span><span className="sky-viewport__live"><i /> GROUND-LEVEL VIEW</span></div>
            <div className="sky-canvas">
              <Canvas shadows camera={{ position: [0, 8.8, 8.8], fov: 47, near: 0.1, far: 180 }} dpr={[1, 1.5]} gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }} onCreated={({ gl }) => { rendererRef.current = gl; }}>
                <SkyScene config={config} altitudeDeg={altitudeDeg} terrainRelief={terrainRelief} celestial={celestial} ringShadows={celestial.ringShadows} />
              </Canvas>
              <div className="sky-canvas__hud"><span>{config.star.spectralClass}-CLASS / {config.star.name.toUpperCase()}</span><span>RAYLEIGH + MIE SKY · {config.surface.type === "gas-giant" ? "CLOUD-TOP VIEW" : "PROCEDURAL TERRAIN"} · STAR {altitudeDeg >= 0 ? "ABOVE" : "BELOW"} HORIZON</span></div>
            </div>
            <div className="sky-viewport__metrics">
              <div><span>HOST-STAR ALTITUDE</span><strong>{altitudeDeg >= 0 ? "+" : ""}{altitudeDeg.toFixed(2)}°</strong><small>{altitudeDeg > 0 ? "Above idealized horizon" : altitudeDeg < 0 ? "Below idealized horizon" : "On idealized horizon"}</small></div>
              <div><span>EST. STELLAR FLUX</span><strong>{fluxWm2.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong><small>W/m² · inverse-square estimate</small></div>
              <div><span>EQUILIBRIUM TEMP.</span><strong>{equilibriumK.toFixed(1)} K</strong><small>{(equilibriumK - 273.15).toFixed(1)}°C · not surface temperature</small></div>
            </div>
            <div className="sky-mechanic-card">
              <div><span className="sky-card__kicker">CELESTIAL MECHANIC</span><h3>Apparent host-star altitude</h3></div>
              <strong>{altitudeDeg >= 0 ? "+" : ""}{altitudeDeg.toFixed(2)}°</strong>
              <p>δ = asin(sin ε · sin 2πp) · h = asin(sin φ sin δ + cos φ cos δ cos H). Latitude, axial tilt, season phase, day length and time of day feed the result.</p>
            </div>
          </div>

          <details className="sky-prompt-panel no-print sky-prompt-details">
            <summary className="sky-prompt-details__summary"><span>OPTIONAL / ADVANCED</span><strong>Describe a world with text</strong><small>Open only if you want to configure settings beyond the quick controls.</small></summary>
            <div className="sky-prompt-details__body">
            <form className="sky-prompt-form" onSubmit={previewPrompt}>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} placeholder="Example: A rocky world with a thick carbon-dioxide atmosphere around a red dwarf, 35 degrees north, a 30-hour day, orange dusk, and moderate haze." aria-label="Describe a planet in plain language" />
              <div className="sky-prompt-form__bottom"><span>Recognizes atmosphere, star class, surface, latitude, tilt, day length, time of day, haze and viewing band.</span><button className="sky-button" type="submit">Interpret prompt</button></div>
            </form>
            {promptPreview && (
              <div className="sky-prompt-preview" role="region" aria-label="Prompt interpretation preview">
                <div className="sky-prompt-preview__head"><div><span>INTERPRETATION PREVIEW</span><h3>{promptPreview.config.name}</h3></div><span>{promptPreview.changes.length} proposed changes</span></div>
                <ul>{promptPreview.changes.map((change, index) => <li key={`${change.field}-${index}`}><strong>{change.field}:</strong> {change.value}<small>{change.note}</small></li>)}</ul>
                {promptPreview.warnings?.map((warning, index) => <p className="sky-inline-warning" key={index}>{warning}</p>)}
                <p className="sky-prompt-preview__explanation">{buildWorldExplanation(promptPreview.config, computeSolarAltitudeDeg(promptPreview.config.observer))}</p>
                <div className="sky-prompt-preview__actions"><button type="button" className="sky-button" onClick={applyPromptPreview}>Apply these values</button><button type="button" className="sky-button sky-button--secondary" onClick={() => setPromptPreview(null)}>Cancel</button></div>
              </div>
            )}
            {promptMessage && <p className="sky-status-message" role="status">{promptMessage}</p>}
            </div>
          </details>

          <section className="sky-sharing-panel no-print">
            <div className="sky-panel-title"><span>04 / REPRODUCIBILITY</span><h2>Share this sky</h2><p>Validated settings are encoded into the URL; opening it in a new tab restores the controls.</p></div>
            <div className="sky-sharing-panel__actions"><button type="button" className="sky-button" onClick={shareConfiguration}>Create & copy share URL</button><button type="button" className="sky-button sky-button--secondary" onClick={exportSkyCard}>Export sky card PNG</button><button type="button" className="sky-button sky-button--secondary" onClick={() => window.print()}>Print / Save PDF</button></div>
            {shareUrl && <div className="sky-share-url"><input aria-label="Share URL" readOnly value={shareUrl} onFocus={(event) => event.target.select()} /><button type="button" className="sky-button sky-button--secondary" onClick={copyShareUrl}>Copy URL</button></div>}
            {shareMessage && <p className="sky-status-message" role="status">{shareMessage}</p>}
          </section>
        </section>

        <div className="sky-report-column">
          <div className="sky-report-heading"><span>05 / LIVE REPORT</span><h2>Sky card</h2><p>Printed parameters, source links, formulas and assumptions.</p></div>
          <SkyCard config={config} altitudeDeg={altitudeDeg} fluxWm2={fluxWm2} equilibriumK={equilibriumK} explanation={explanation} lastPrompt={lastPrompt} lastPromptChanges={lastPromptChanges} />
          {lastPrompt && <p className="sky-last-prompt"><strong>Applied prompt:</strong> {lastPrompt}</p>}
        </div>
      </div>
      <footer className="planet-sky-footer"><span>HORIZON SHIFT / EDUCATIONAL SKY LAB</span><span>SKY PALETTE IS QUALITATIVE · FORMULAS AND ASSUMPTIONS ARE SHOWN</span></footer>
    </div>
  );
}
