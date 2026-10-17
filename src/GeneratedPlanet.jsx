import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  createProceduralPlanetTextures,
  samplePlanetRadius,
  sampleProceduralPlanet,
  sphereDirectionFromUv,
} from "./proceduralVisuals";

function translateGeometry(geometry, x, y, z, rotateZ = 0, rotateX = 0, scale = null) {
  if (scale) geometry.scale(scale[0], scale[1], scale[2]);
  if (rotateZ) geometry.rotateZ(rotateZ);
  if (rotateX) geometry.rotateX(rotateX);
  geometry.translate(x, y, z);
  return geometry;
}

function mergedShape(parts) {
  // Convert all inputs to the same indexed/non-indexed format before merging.
  const compatibleParts = parts.map((part) => (part.index ? part.toNonIndexed() : part));
  const geometry = mergeGeometries(compatibleParts, false);
  compatibleParts.forEach((part, index) => {
    if (part !== parts[index]) part.dispose();
  });
  parts.forEach((part) => part.dispose());
  if (!geometry) throw new Error("Unable to build a procedural flora shape from compatible geometries.");
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// Each species is a small, low-poly silhouette positioned with its roots at y=0.
// Instancing keeps thousands of organisms inexpensive compared with individual meshes.
const FLORA_SHAPES = {
  broadleaf: mergedShape([
    translateGeometry(new THREE.CylinderGeometry(0.035, 0.055, 0.62, 5), 0, 0.31, 0),
    translateGeometry(new THREE.IcosahedronGeometry(0.38, 1), 0, 0.69, 0),
    translateGeometry(new THREE.IcosahedronGeometry(0.27, 0), 0.16, 0.62, 0.03),
  ]),
  conifer: mergedShape([
    translateGeometry(new THREE.CylinderGeometry(0.027, 0.05, 0.58, 5), 0, 0.29, 0),
    translateGeometry(new THREE.ConeGeometry(0.46, 1.08, 6, 2), 0, 0.70, 0),
  ]),
  shrub: translateGeometry(new THREE.IcosahedronGeometry(0.30, 1), 0, 0.22, 0),
  dryshrub: mergedShape([
    translateGeometry(new THREE.DodecahedronGeometry(0.23, 0), 0, 0.20, 0),
    translateGeometry(new THREE.DodecahedronGeometry(0.17, 0), 0.14, 0.17, 0.02),
    translateGeometry(new THREE.DodecahedronGeometry(0.16, 0), -0.12, 0.19, -0.04),
  ]),
  cactus: mergedShape([
    translateGeometry(new THREE.CylinderGeometry(0.075, 0.105, 0.82, 7), 0, 0.41, 0),
    translateGeometry(new THREE.CylinderGeometry(0.045, 0.06, 0.30, 6), 0.13, 0.43, 0, Math.PI / 2),
    translateGeometry(new THREE.CylinderGeometry(0.042, 0.057, 0.25, 6), -0.12, 0.59, 0, Math.PI / 2),
  ]),
  grass: mergedShape([
    translateGeometry(new THREE.ConeGeometry(0.12, 0.46, 5), 0, 0.23, 0),
    translateGeometry(new THREE.ConeGeometry(0.105, 0.35, 5), 0.13, 0.17, 0.04, 0, 0, [1, 1, 1]),
    translateGeometry(new THREE.ConeGeometry(0.09, 0.32, 5), -0.12, 0.16, -0.04),
  ]),
  lichen: translateGeometry(new THREE.IcosahedronGeometry(0.19, 0), 0, 0.13, 0),
  iceCrystal: mergedShape([
    translateGeometry(new THREE.ConeGeometry(0.22, 0.90, 5, 1), 0, 0.45, 0),
    translateGeometry(new THREE.ConeGeometry(0.13, 0.52, 5, 1), 0.18, 0.27, 0.04, 0, 0, [1, 1, 1]),
  ]),
  lavaSpire: mergedShape([
    translateGeometry(new THREE.ConeGeometry(0.24, 0.78, 5, 1), 0, 0.39, 0),
    translateGeometry(new THREE.ConeGeometry(0.15, 0.48, 5, 1), -0.13, 0.24, 0.05),
  ]),
  alienCrystal: mergedShape([
    translateGeometry(new THREE.OctahedronGeometry(0.28, 0), 0, 0.34, 0),
    translateGeometry(new THREE.OctahedronGeometry(0.18, 0), 0.18, 0.22, 0.04, 0.4),
    translateGeometry(new THREE.OctahedronGeometry(0.14, 0), -0.14, 0.18, -0.04, -0.3),
  ]),
  alienMushroom: mergedShape([
    translateGeometry(new THREE.CylinderGeometry(0.055, 0.075, 0.40, 6), 0, 0.20, 0),
    translateGeometry(new THREE.SphereGeometry(0.23, 8, 6), 0, 0.43, 0, 0, 0, [1.0, 0.56, 1.0]),
  ]),
  coral: mergedShape([
    translateGeometry(new THREE.CylinderGeometry(0.07, 0.10, 0.40, 5), 0, 0.20, 0),
    translateGeometry(new THREE.CylinderGeometry(0.045, 0.06, 0.33, 5), 0.11, 0.36, 0, 0, 0, [1, 1, 1]),
    translateGeometry(new THREE.CylinderGeometry(0.04, 0.055, 0.28, 5), -0.10, 0.33, 0.02, 0, 0.5),
    translateGeometry(new THREE.CylinderGeometry(0.035, 0.05, 0.27, 5), 0.02, 0.46, 0.06, 0.5, 0),
  ]),
};

const FLORA_COLORS = {
  broadleaf: ["#428d4c", "#5fa95b", "#2f7143", "#7aad5c"],
  conifer: ["#20543d", "#2c6a47", "#497a50", "#1b4838"],
  shrub: ["#76934e", "#98a85a", "#547b48", "#a8aa66"],
  dryshrub: ["#a7a05c", "#c0a365", "#777c43", "#bb8958"],
  cactus: ["#4f8f60", "#71a46a", "#3b7650"],
  grass: ["#82a85d", "#9cb966", "#6f964f"],
  lichen: ["#8ba6a0", "#b2c3bb", "#6d928d"],
  iceCrystal: ["#a8e9fa", "#d2f7ff", "#78cae7"],
  lavaSpire: ["#82433c", "#b75a3d", "#e0773d"],
  alienCrystal: ["#9275f3", "#59d8e3", "#d878ec", "#7e9eff"],
  alienMushroom: ["#b96ddd", "#65c7d0", "#d88abf"],
  coral: ["#2ed1b4", "#77edc7", "#26a7b9"],
};

function makeSeededRandom(seed) {
  let state = (Number(seed) || 1) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chooseFloraSpecies(type, field, random) {
  const wet = field.moisture;
  const warmth = field.temperature;
  const elevation = field.elevation;
  if (type === "temperate") {
    if (warmth < 0.20) return "lichen";
    if (warmth < 0.38 || elevation > 0.78) return random() < 0.68 ? "conifer" : "lichen";
    if (wet > 0.62) return random() < 0.75 ? "broadleaf" : "conifer";
    if (wet > 0.42) return random() < 0.55 ? "conifer" : "shrub";
    return random() < 0.62 ? "dryshrub" : "grass";
  }
  if (type === "desert") {
    if (warmth < 0.22) return "lichen";
    if (warmth < 0.40) return "dryshrub";
    return wet > 0.63 ? "dryshrub" : (random() < 0.70 ? "cactus" : "dryshrub");
  }
  if (type === "icy") return warmth < 0.35 || elevation > 0.56 ? (random() < 0.62 ? "iceCrystal" : "lichen") : "lichen";
  if (type === "volcanic") return elevation > 0.35 && random() < 0.62 ? "lavaSpire" : "dryshrub";
  if (type === "ocean") return wet > 0.58 ? (random() < 0.60 ? "coral" : "broadleaf") : "grass";
  return wet > 0.56 ? (random() < 0.58 ? "alienMushroom" : "alienCrystal") : "alienCrystal";
}

function buildPlanetFlora(settings) {
  const seed = Math.max(1, Number(settings.seed) || 1);
  const waterValue = Number(settings.water);
  const terrainValue = Number(settings.terrain);
  const water = Number.isFinite(waterValue) ? waterValue : 0.5;
  const terrain = Number.isFinite(terrainValue) ? terrainValue : 0.5;
  const type = settings.planetType || "temperate";
  const random = makeSeededRandom(seed * 31 + 97);
  const instances = Object.fromEntries(Object.keys(FLORA_SHAPES).map((key) => [key, []]));
  const candidateCount = type === "ocean" ? 2200 : 1900;
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < candidateCount; i += 1) {
    // Uniform sampling on a sphere avoids the dense poles produced by uniform latitude.
    const y = random() * 2 - 1;
    const latitude = Math.asin(y);
    const v = latitude / Math.PI + 0.5;
    const u = random();
    const field = sampleProceduralPlanet(u, v, seed, water);
    if (field.land < 0.62) continue;
    if (field.elevation > 0.96 && type !== "icy" && type !== "volcanic") continue;
    if (type === "ocean" && field.land < 0.78 && random() < 0.72) continue;
    if (random() < 0.12) continue; // Preserve natural gaps between plant clusters.

    const species = chooseFloraSpecies(type, field, random);
    const directionValues = sphereDirectionFromUv(u, v);
    const normal = new THREE.Vector3(directionValues.x, directionValues.y, directionValues.z).normalize();
    const radius = samplePlanetRadius(field, terrain) + 0.003;
    const position = normal.clone().multiplyScalar(radius);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
    const scale = species === "broadleaf" || species === "conifer" || species === "cactus" || species === "alienMushroom"
      ? 0.048 + random() * 0.052
      : 0.035 + random() * 0.043;
    const colors = FLORA_COLORS[species];
    instances[species].push({
      position,
      quaternion,
      scale,
      color: colors[Math.floor(random() * colors.length)],
    });
  }
  return instances;
}

function PlantInstances({ species, items }) {
  const meshRef = useRef(null);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: species === "alienCrystal" || species === "iceCrystal" ? 0.42 : 0.91,
    metalness: species === "alienCrystal" ? 0.10 : 0.0,
    emissive: species === "alienCrystal" ? "#45209a" : species === "lavaSpire" ? "#7d2714" : "#000000",
    emissiveIntensity: species === "alienCrystal" ? 0.32 : species === "lavaSpire" ? 0.20 : 0,
  }), [species]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !items.length) return;
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    items.forEach((item, index) => {
      scale.setScalar(item.scale);
      matrix.compose(item.position, item.quaternion, scale);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, new THREE.Color(item.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  if (!items.length) return null;
  return <instancedMesh ref={meshRef} args={[FLORA_SHAPES[species], material, items.length]} castShadow receiveShadow frustumCulled={false} />;
}

function PlanetFlora({ settings }) {
  const seed = settings.seed;
  const water = settings.water;
  const terrain = settings.terrain;
  const planetType = settings.planetType;
  const flora = useMemo(() => buildPlanetFlora({ seed, water, terrain, planetType }), [seed, water, terrain, planetType]);
  return <group>
    {Object.entries(flora).map(([species, items]) => (
      <PlantInstances key={species} species={species} items={items} />
    ))}
  </group>;
}

function PlanetMesh({ settings, textures }) {
  const seedValue = Number(settings.seed) || 1;
  const waterValue = Number.isFinite(Number(settings.water)) ? Number(settings.water) : 0.5;
  const terrainValue = Number.isFinite(Number(settings.terrain)) ? Number(settings.terrain) : 0.5;
  const geometry = useMemo(() => {
    const segments = 192;
    const geo = new THREE.SphereGeometry(1.45, segments, 128);
    const positions = geo.attributes.position;
    const uv = geo.attributes.uv;
    const seed = Math.max(1, seedValue);
    const water = waterValue;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positions.count; i += 1) {
      vertex.fromBufferAttribute(positions, i).normalize();
      const field = sampleProceduralPlanet(uv.getX(i), uv.getY(i), seed, water);
      const radius = samplePlanetRadius(field, terrainValue);
      positions.setXYZ(i, vertex.x * radius, vertex.y * radius, vertex.z * radius);
    }
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }, [seedValue, waterValue, terrainValue]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const tilt = (Number(settings.axialTilt) || 23.4) * Math.PI / 180;
  const hasAtmosphere = Boolean(settings.atmosphere);
  const clouds = Math.max(0, Math.min(1, Number(settings.clouds ?? 0.48)));
  return (
    <group rotation={[0, 0, tilt]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial map={textures.albedo} bumpMap={textures.bump} bumpScale={0.014 + (Number(settings.terrain) || 0) * 0.032} roughness={0.92} metalness={0.005} />
      </mesh>
      <PlanetFlora settings={settings} />
      {hasAtmosphere && <mesh scale={1.014}>
        <sphereGeometry args={[1.45, 128, 96]} />
        <meshStandardMaterial map={textures.clouds} transparent opacity={0.92 * clouds} roughness={1} depthWrite={false} alphaTest={0.018} side={THREE.FrontSide} />
      </mesh>}
      {hasAtmosphere && <>
        <mesh scale={1.045}>
          <sphereGeometry args={[1.45, 96, 64]} />
          <meshBasicMaterial color={settings.planetType === "icy" ? "#9ce8ff" : settings.planetType === "alien" ? "#ab7cff" : settings.planetType === "volcanic" ? "#ff8050" : "#55d8ff"} transparent opacity={0.18} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh scale={1.095}>
          <sphereGeometry args={[1.45, 64, 48]} />
          <meshBasicMaterial color={settings.planetType === "alien" ? "#854cff" : "#3d85ff"} transparent opacity={0.065} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </>}
      {settings.companion === "ringed-world" && <>
        <mesh rotation={[Math.PI / 2, 0, 0.12]} castShadow receiveShadow>
          <ringGeometry args={[1.80, 2.42, 192]} />
          <meshStandardMaterial color="#cab48a" side={THREE.DoubleSide} roughness={0.94} metalness={0.04} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0.12]} scale={1.02} castShadow receiveShadow>
          <ringGeometry args={[1.91, 2.06, 192]} />
          <meshStandardMaterial color="#8d9db2" side={THREE.DoubleSide} roughness={1} transparent opacity={0.8} />
        </mesh>
      </>}
    </group>
  );
}

function OrbitingMoon({ visible }) {
  const orbitRef = useRef(null);
  useFrame((_, delta) => {
    if (orbitRef.current) orbitRef.current.rotation.y += delta * 0.24;
  });
  if (!visible) return null;
  return (
    <group ref={orbitRef}>
      <mesh position={[2.75, 0.38, 0.2]} castShadow receiveShadow>
        <sphereGeometry args={[0.23, 36, 24]} />
        <meshStandardMaterial color="#aab9c6" roughness={0.96} />
      </mesh>
      <mesh position={[2.75, 0.38, 0.2]} scale={1.22}>
        <sphereGeometry args={[0.23, 24, 16]} />
        <meshBasicMaterial color="#9dcfff" transparent opacity={0.14} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <directionalLight position={[2.75, 0.38, 0.2]} color="#a9cfff" intensity={0.17} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} />
    </group>
  );
}

function SunSprites({ sunCount }) {
  const suns = [
    { position: [-3.5, 2.8, 4.2], color: "#fff0ca", intensity: 2.4, radius: 0.23 },
    { position: [3.5, 2.0, 3.2], color: "#ffc58e", intensity: 1.9, radius: 0.19 },
    { position: [-2.8, -2.5, -3.4], color: "#a9cfff", intensity: 1.5, radius: 0.18 },
  ].slice(0, sunCount);
  return suns.map((sun, index) => (
    <group key={index} position={sun.position}>
      <directionalLight position={[0, 0, 0]} color={sun.color} intensity={sun.intensity} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <mesh>
        <sphereGeometry args={[sun.radius, 24, 16]} />
        <meshBasicMaterial color={sun.color} toneMapped={false} />
      </mesh>
      <mesh scale={2.6}>
        <sphereGeometry args={[sun.radius, 20, 16]} />
        <meshBasicMaterial color={sun.color} transparent opacity={0.24} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh scale={4.6}>
        <sphereGeometry args={[sun.radius, 20, 16]} />
        <meshBasicMaterial color={sun.color} transparent opacity={0.075} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  ));
}

function RotatingWorld({ settings, textures }) {
  const groupRef = useRef(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.035;
  });
  return (
    <>
      <group ref={groupRef}>
        <PlanetMesh settings={settings} textures={textures} />
      </group>
      <OrbitingMoon visible={settings.companion !== "none"} />
    </>
  );
}

export default function GeneratedPlanet({ settings }) {
  const textureSeed = settings.seed;
  const textureWater = settings.water;
  const textureTerrain = settings.terrain;
  const textureColor = settings.color;
  const textureClouds = settings.clouds;
  const texturePlanetType = settings.planetType;
  const textures = useMemo(() => createProceduralPlanetTextures({
    seed: textureSeed,
    water: textureWater,
    terrain: textureTerrain,
    color: textureColor,
    clouds: textureClouds,
    planetType: texturePlanetType,
  }), [textureSeed, textureWater, textureTerrain, textureColor, textureClouds, texturePlanetType]);
  useEffect(() => () => { textures.albedo.dispose(); textures.bump.dispose(); textures.clouds.dispose(); }, [textures]);
  return (
    <div className="generated-preview">
      <Canvas camera={{ position: [0, 0, 5.15], fov: 42 }} dpr={[1, 1.5]} shadows gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
        <color attach="background" args={["#040a17"]} />
        <Stars radius={80} depth={30} count={1250} factor={2.1} fade speed={0.12} />
        <ambientLight intensity={0.32} />
        <SunSprites sunCount={Math.max(1, Math.min(3, Number(settings.sunCount) || 1))} />
        <RotatingWorld settings={settings} textures={textures} />
        <OrbitControls enablePan={false} minDistance={2.6} maxDistance={8} enableDamping dampingFactor={0.065} />
      </Canvas>
    </div>
  );
}
