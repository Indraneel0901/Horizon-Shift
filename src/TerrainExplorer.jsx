import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import AtmosphericSky from "./AtmosphericSky";
import CinematicPostFX from "./CinematicPostFX";
import TerrainEcosystem from "./TerrainEcosystem";
import DistantFauna from "./DistantFauna";
import { createTerrainDetailTexture } from "./proceduralVisuals";

const TERRAIN_STYLES = {
  alpine: { label: "Alpine range", seed: 17, relief: 1.05 },
  coastal: { label: "Coastal greenlands", seed: 39, relief: 0.78 },
  volcanic: { label: "Volcanic highlands", seed: 63, relief: 0.92 },
  mesa: { label: "Arid mesas", seed: 91, relief: 0.83 },
};

function smoothstep(min, max, value) {
  const t = THREE.MathUtils.clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function hashGrid(x, z, seed) {
  const v = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

function valueNoise(x, z, seed) {
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const tx = x - x0, tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const a = hashGrid(x0, z0, seed), b = hashGrid(x0 + 1, z0, seed);
  const c = hashGrid(x0, z0 + 1, seed), d = hashGrid(x0 + 1, z0 + 1, seed);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, sx), THREE.MathUtils.lerp(c, d, sx), sz);
}

function terrainNoise(x, z, seed) {
  let total = 0, weight = 0, amplitude = 0.55;
  for (let octave = 0; octave < 5; octave += 1) {
    total += (valueNoise(x, z, seed + octave * 13) - 0.5) * 2 * amplitude;
    weight += amplitude;
    x *= 2.03;
    z *= 2.03;
    amplitude *= 0.48;
  }
  return total / weight;
}

function TerrainSurface({ exaggeration, style, ringShadows }) {
  const geometry = useMemo(() => {
    // A wider field pushes the actual mesh boundary outside the normal camera view.
    // The heightfield gently sinks its perimeter under the ocean to avoid a cut-out slab.
    const width = 22, depth = 18, segmentsX = 320, segmentsZ = 280;
    const geo = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const heightField = new Float32Array(pos.count);
    const styleConfig = TERRAIN_STYLES[style] || TERRAIN_STYLES.alpine;
    const styleRelief = style === "coastal" ? 0.62 : style === "mesa" ? 0.72 : style === "volcanic" ? 0.83 : 1.0;
    const seaLevel = -0.29;

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i), z = pos.getZ(i);
      const nx = x / width + 0.5, nz = z / depth + 0.5;
      // Domain warp breaks up perfect ellipses while keeping the large forms continuous.
      const warpX = terrainNoise(nx * 2.2 + 5, nz * 2.0 - 7, styleConfig.seed + 41) * 0.075;
      const warpZ = terrainNoise(nx * 2.0 - 3, nz * 2.4 + 4, styleConfig.seed + 53) * 0.065;
      const u = THREE.MathUtils.clamp(nx + warpX, 0, 1);
      const v = THREE.MathUtils.clamp(nz + warpZ, 0, 1);

      const broadNoise = terrainNoise(u * 2.5 + 4, v * 2.25 - 2, styleConfig.seed + 2);
      const regionalNoise = terrainNoise(u * 5.1 + 14, v * 4.6 - 6, styleConfig.seed + 7);
      const coastNoise = terrainNoise(u * 7.0 + 9, v * 6.1 + 2, styleConfig.seed + 13);
      const ridgeNoise = terrainNoise(u * 9.4 + 8, v * 7.7 + 12, styleConfig.seed + 19);
      const detailNoise = terrainNoise(u * 18.5 + 2, v * 17.2 - 5, styleConfig.seed + 31);
      const massifNoise = terrainNoise(u * 3.4 - 6, v * 3.1 + 7, styleConfig.seed + 61);

      // Coastline is placed mainly toward the far side, then faded at all mesh edges.
      // This keeps the near field walkable-looking and hides the rectangular mesh boundary.
      const shoreline = 0.105
        + Math.sin(u * 10.5 + styleConfig.seed * 0.1) * 0.024
        + coastNoise * 0.042
        + broadNoise * 0.014;
      const coastMask = smoothstep(shoreline - 0.035, shoreline + 0.075, v);
      const edgeX = smoothstep(0.0, 0.09, nx) * (1 - smoothstep(0.91, 1.0, nx));
      const edgeFront = 1 - smoothstep(0.955, 1.0, nz);
      const landMask = coastMask * edgeX * edgeFront;

      const ridgeAxisA = z - (Math.sin(x * 0.34 + styleConfig.seed * 0.11) * 0.82 + x * 0.085 - 2.1);
      const ridgeAxisB = z + x * 0.24 + 4.15 + Math.sin(x * 0.19) * 0.55;
      const beltWidth = style === "alpine" ? 1.55 : style === "mesa" ? 2.15 : 1.9;
      const mountainBeltA = Math.exp(-Math.pow(ridgeAxisA / beltWidth, 2));
      const mountainBeltB = Math.exp(-Math.pow(ridgeAxisB / 1.95, 2)) * 0.42;
      const ridgedPeaks = Math.pow(THREE.MathUtils.clamp(1 - Math.abs(ridgeNoise), 0, 1), 1.45);
      const mountainMass = smoothstep(-0.38, 0.7, massifNoise);
      const connectedRidges = (mountainBeltA * (0.16 + ridgedPeaks * 0.55) * (0.52 + mountainMass * 0.48) + mountainBeltB * (0.24 + ridgedPeaks * 0.35));

      // Broad rolling land + connected ranges, with restrained high-frequency detail.
      const lowland = 0.055 + broadNoise * 0.13 + regionalNoise * 0.085;
      let landHeight = lowland + connectedRidges * styleRelief * styleConfig.relief * exaggeration * 0.78;
      landHeight += Math.max(0, broadNoise + 0.22) * 0.105 * exaggeration;
      landHeight += detailNoise * 0.018 * exaggeration;
      const subtleValleys = Math.pow(Math.max(0, 1 - Math.abs(terrainNoise(u * 8.3 + 15, v * 7.9 - 9, styleConfig.seed + 83))), 5);
      landHeight -= subtleValleys * 0.045 * landMask;

      if (style === "volcanic") {
        const coneDistance = Math.sqrt(((x + 3.05) / 2.55) ** 2 + ((z + 1.35) / 2.3) ** 2);
        const cone = Math.pow(Math.max(0, 1 - coneDistance), 1.25) * 0.76;
        const crater = Math.exp(-Math.pow(coneDistance / 0.18, 2)) * 0.20;
        landHeight += (cone - crater) * exaggeration;
      } else if (style === "mesa") {
        const plateauDistance = Math.sqrt(((x - 2.7) / 4.0) ** 2 + ((z + 1.5) / 2.4) ** 2);
        const plateau = 1 - smoothstep(0.90, 1.12, plateauDistance);
        landHeight += plateau * 0.42 * exaggeration;
        landHeight += Math.sin(z * 0.68 + broadNoise) * 0.025 * landMask;
      } else if (style === "coastal") {
        landHeight += broadNoise * 0.075 * landMask;
      }

      // Below sea level the land blends to a submerged shelf rather than ending vertically.
      const seabed = seaLevel - 0.62;
      const height = THREE.MathUtils.lerp(seabed, Math.max(seaLevel - 0.04, landHeight), landMask);
      heightField[i] = height;
      pos.setY(i, height);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const colors = new Float32Array(pos.count * 3);
    const normal = geo.attributes.normal;
    const sand = new THREE.Color("#b8a078");
    const shallowWater = new THREE.Color("#367d87");
    const grass = new THREE.Color("#597d4c");
    const forest = new THREE.Color("#284f39");
    const rock = new THREE.Color("#777f7d");
    const snow = new THREE.Color("#d9e5eb");
    const deepWater = new THREE.Color("#103950");
    const sandHighlight = new THREE.Color("#d0b786");
    const color = new THREE.Color();

    for (let i = 0; i < pos.count; i += 1) {
      const y = heightField[i];
      const x = pos.getX(i), z = pos.getZ(i);
      const nx = x / width + 0.5, nz = z / depth + 0.5;
      const beachNoise = terrainNoise(nx * 6 + 8, nz * 7 - 2, styleConfig.seed + 73);

      if (y < seaLevel + 0.005) {
        color.copy(deepWater).lerp(shallowWater, smoothstep(seaLevel - 0.55, seaLevel - 0.02, y));
      } else if (y < seaLevel + 0.18) {
        color.copy(sand).lerp(grass, smoothstep(seaLevel + 0.04, seaLevel + 0.20, y));
        color.lerp(sandHighlight, Math.max(0, beachNoise) * 0.11);
      } else {
        const relative = y - seaLevel;
        color.copy(grass).lerp(forest, smoothstep(0.16, 0.72, relative));
        const slope = 1 - Math.max(0, normal.getY(i));
        color.lerp(rock, smoothstep(0.18, 0.53, slope) * 0.78);
        const snowline = style === "mesa" ? 1.65 : style === "coastal" ? 1.38 : 0.96;
        color.lerp(snow, smoothstep(snowline, snowline + 0.42, y) * (style === "mesa" ? 0.06 : 0.66));
        const mineralNoise = terrainNoise(nx * 12.5, nz * 11.0, styleConfig.seed + 101);
        color.multiplyScalar(0.97 + mineralNoise * 0.035);
      }

      if (ringShadows && y > seaLevel) {
        const curve = Math.sin(z * 0.13) * 0.9 + z * 0.20 + 0.8;
        const bandA = 1 - smoothstep(0.13, 0.48, Math.abs(x - curve));
        const bandB = 1 - smoothstep(0.11, 0.34, Math.abs(x - curve - 1.8 - Math.sin(z * 0.08) * 0.3));
        color.multiplyScalar(1 - Math.max(bandA * 0.28, bandB * 0.17));
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.userData.terrainMeta = { width, depth, segmentsX, segmentsZ, seaLevel, isGasGiant: false };
    geo.computeBoundingSphere();
    return geo;
  }, [exaggeration, style, ringShadows]);

  const textures = useMemo(() => {
    const map = createTerrainDetailTexture(style, TERRAIN_STYLES[style].seed, 7, 5, "color");
    const bump = createTerrainDetailTexture(style, TERRAIN_STYLES[style].seed, 7, 5, "bump");
    return { map, bump };
  }, [style]);
  useEffect(() => () => { textures.map.dispose(); textures.bump.dispose(); }, [textures]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshPhysicalMaterial map={textures.map} bumpMap={textures.bump} bumpScale={0.035} vertexColors roughness={0.96} metalness={0.0} clearcoat={0.015} clearcoatRoughness={0.94} />
      </mesh>
      <TerrainEcosystem geometry={geometry} type={style === "alpine" ? "alpine" : style === "mesa" ? "desert" : style === "volcanic" ? "volcanic" : "temperate"} scaleFactor={0.9} seed={TERRAIN_STYLES[style].seed} density={1.05} />
    </group>
  );
}

function SunCompanion({ showMoon, showRings }) {
  const ringedRef = useRef(null);
  return (
    <>
      {showMoon && <group position={[-5.5, 5.2, -8.2]}>
        <mesh castShadow>
          <sphereGeometry args={[0.34, 28, 20]} />
          <meshStandardMaterial color="#c8d9e7" roughness={0.96} emissive="#6586a7" emissiveIntensity={0.06} />
        </mesh>
        <mesh scale={1.24}>
          <sphereGeometry args={[0.34, 20, 16]} />
          <meshBasicMaterial color="#8dbdff" transparent opacity={0.08} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>}
      {showRings && <group ref={ringedRef} position={[5.6, 4.0, -12.5]} rotation={[0.32, -0.24, 0.18]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[1.08, 40, 28]} />
          <meshStandardMaterial color="#b7a17e" roughness={0.72} />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0, 0]} castShadow receiveShadow>
          <ringGeometry args={[1.34, 2.02, 96]} />
          <meshStandardMaterial color="#e2c99a" side={THREE.DoubleSide} transparent opacity={0.76} roughness={0.92} />
        </mesh>
        <mesh rotation={[Math.PI / 2.4, 0, 0]} scale={1.06}>
          <ringGeometry args={[1.48, 1.88, 96]} />
          <meshBasicMaterial color="#a8c1df" side={THREE.DoubleSide} transparent opacity={0.24} />
        </mesh>
      </group>}
      {showMoon && <directionalLight position={[-5.5, 5.2, -8.2]} color="#a9cfff" intensity={0.28} castShadow shadow-mapSize-width={512} shadow-mapSize-height={512} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} />}
    </>
  );
}

function TerrainScene({ exaggeration, showGrid, style, timeOfDayHours, sunCount, showMoon, ringShadows }) {
  const waterBump = useMemo(() => createTerrainDetailTexture("ocean-and-rock", 919, 26, 26, "bump"), []);
  useEffect(() => () => waterBump.dispose(), [waterBump]);
  const solarAngle = ((timeOfDayHours - 6) / 12) * Math.PI;
  const profiles = [
    { offset: 0, azimuth: 0, color: Math.sin(solarAngle) < 0.18 ? "#ffad76" : "#fff0cf", label: "Sun" },
    { offset: 0.22, azimuth: 0.62, color: "#ffc28e", label: "Companion sun" },
    { offset: -0.32, azimuth: -0.68, color: "#9ccaff", label: "Blue companion" },
  ].slice(0, sunCount);
  const suns = profiles.map((profile) => {
    const angle = solarAngle + profile.offset;
    const elevation = Math.sin(angle);
    const direction = [Math.cos(angle), elevation, Math.sin(profile.azimuth) * Math.cos(angle) + 0.1];
    return {
      ...profile,
      elevation,
      direction,
      position: [Math.cos(angle) * 70, 8.8 + elevation * 55, 57 + profile.azimuth * 21],
    };
  });
  const primarySun = suns[0];
  const daylight = THREE.MathUtils.smoothstep(primarySun.elevation, -0.12, 0.22);
  const nightFog = new THREE.Color("#081321");
  const clearHorizonFog = new THREE.Color("#8fc7ef");
  const duskHorizonFog = new THREE.Color("#d28a65");
  const lowSunAmount = 1 - Math.min(1, Math.abs(primarySun.elevation) * 2.25);
  const horizonFog = clearHorizonFog.lerp(duskHorizonFog, lowSunAmount * 0.82);
  const fogColor = nightFog.lerp(horizonFog, daylight);
  const additionalSuns = suns.slice(1).map((sun) => ({ direction: sun.direction, color: sun.color, elevation: sun.elevation, weight: 0.92 }));

  return (
    <>
      <color attach="background" args={["#030914"]} />
      <fog attach="fog" args={[fogColor, 21, 50]} />
      <AtmosphericSky sunPosition={primarySun.position} sunDirection={primarySun.direction} sunElevation={primarySun.elevation} sunColor={primarySun.color} hazeColor={primarySun.elevation < 0.2 ? "#d28a65" : "#8fc7ef"} rayleighStrength={1} mieStrength={primarySun.elevation < 0.2 ? 0.75 : 0.28} additionalSuns={additionalSuns} />
      <ambientLight intensity={0.14 + daylight * 0.22} />
      <hemisphereLight args={["#b9dced", "#1a241c", 0.38 + daylight * 0.38]} />
      {suns.map((sun, index) => <directionalLight key={sun.label} position={sun.position} color={sun.color} intensity={(0.03 + daylight * 2.05) * (index === 0 ? 1 : 0.62)} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-bias={-0.00016} />)}
      {suns.map((sun, index) => <group key={`${sun.label}-disc`} position={sun.position}>
        <mesh><sphereGeometry args={[index === 0 ? 0.43 : 0.31, 28, 20]} /><meshBasicMaterial color={new THREE.Color(sun.color).multiplyScalar(1.65)} toneMapped={false} /></mesh>
        <mesh scale={2.0}><sphereGeometry args={[index === 0 ? 0.43 : 0.31, 20, 16]} /><meshBasicMaterial color={sun.color} transparent opacity={0.18} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
      </group>)}
      <pointLight position={[4, 3, -5]} color="#4ad7ff" intensity={3.4 + daylight * 2.1} distance={26} decay={2} />
      <Stars radius={100} depth={40} count={daylight > 0.5 ? 120 : 700} factor={2.1} fade speed={0.16} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.29, 0]} receiveShadow>
        <planeGeometry args={[220, 220]} />
        <meshPhysicalMaterial bumpMap={waterBump} bumpScale={0.024} color="#104861" roughness={0.34} metalness={0.035} clearcoat={0.56} clearcoatRoughness={0.25} emissive="#063044" emissiveIntensity={0.045 + daylight * 0.035} />
      </mesh>
      {showGrid && <gridHelper args={[14, 28, "#69d9e7", "#24495d"]} position={[0, -0.23, 0]} />}
      <TerrainSurface exaggeration={exaggeration} style={style} ringShadows={ringShadows} />
      <SunCompanion showMoon={showMoon} showRings={ringShadows} />
      <DistantFauna count={18} spread={6.3} height={1.7} depth={-3.8} tint="#102a35" />
    </>
  );
}

export default function TerrainExplorer() {
  const [exaggeration, setExaggeration] = useState(1.0);
  const [style, setStyle] = useState("alpine");
  const [showGrid, setShowGrid] = useState(false);
  const [timeOfDayHours, setTimeOfDayHours] = useState(15.5);
  const [sunCount, setSunCount] = useState(1);
  const [showMoon, setShowMoon] = useState(true);
  const [ringShadows, setRingShadows] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const controlsRef = useRef(null);

  function resetView() { setCameraKey((value) => value + 1); }

  return (
    <section className="terrain-panel" aria-label="Interactive terrain explorer">
      <div className="terrain-panel__heading">
        <div className="terrain-panel__intro">
          <span className="eyebrow">EARTH SURFACE / LOCAL RELIEF</span>
          <h2>Explore the landscape</h2>
          <p>Inspect a continuous local landscape with textured relief, vegetation, rocks and distant wildlife. Change the time of day to see the shared Rayleigh/Mie sky shift through sunrise, noon and sunset.</p>
        </div>
        <div className="terrain-tools">
          <label className="terrain-style-control">Terrain profile
            <select value={style} onChange={(event) => setStyle(event.target.value)}>
              {Object.entries(TERRAIN_STYLES).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
            </select>
          </label>
          <label className="terrain-relief-control">Vertical relief <strong>{exaggeration.toFixed(1)}×</strong>
            <input type="range" min="0.55" max="1.8" step="0.05" value={exaggeration} onChange={(event) => setExaggeration(Number(event.target.value))} />
          </label>
          <label className="terrain-time-control">Time of day <strong>{`${String(Math.floor(timeOfDayHours) % 24).padStart(2, "0")}:${String(Math.round((timeOfDayHours % 1) * 60)).padStart(2, "0")}`}</strong>
            <input type="range" min="0" max="24" step="0.25" value={timeOfDayHours} onChange={(event) => setTimeOfDayHours(Number(event.target.value))} aria-label="Terrain scene time of day" />
          </label>
          <button type="button" className="terrain-reset" onClick={resetView}>Reset view ↺</button>
        </div>
      </div>
      <details className="terrain-celestial-config">
        <summary>Celestial lighting & shadow experiments</summary>
        <div className="terrain-celestial-config__fields">
          <label>Number of suns <select value={sunCount} onChange={(event) => setSunCount(Number(event.target.value))}><option value={1}>One sun</option><option value={2}>Two suns</option><option value={3}>Three suns</option></select></label>
          <label><input type="checkbox" checked={showMoon} onChange={(event) => setShowMoon(event.target.checked)} /> Moon + cool moonlight</label>
          <label><input type="checkbox" checked={ringShadows} onChange={(event) => setRingShadows(event.target.checked)} /> Ringed companion + projected ring shadows</label>
        </div>
        <p>Multiple suns use separate directional lights and scattering directions, so each can cast its own shadow and its sunset can overlap the others. Ring shadows are a stylized projection; this is an interactive illustration rather than a full orbital shadow solver.</p>
      </details>
      <div className="terrain-canvas">
        <Canvas key={cameraKey} camera={{ position: [7.4, 6.4, 7.6], fov: 34, near: 0.1, far: 250 }} shadows dpr={[1, 1.6]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.12 }}>
          <TerrainScene exaggeration={exaggeration} showGrid={showGrid} style={style} timeOfDayHours={timeOfDayHours} sunCount={sunCount} showMoon={showMoon} ringShadows={ringShadows} />
          <OrbitControls ref={controlsRef} target={[0, 0.05, 0]} enableDamping dampingFactor={0.08} minDistance={4.8} maxDistance={22} maxPolarAngle={Math.PI * 0.48} />
          <CinematicPostFX bloomStrength={0.32} bloomRadius={0.68} bloomThreshold={0.74} vignetteOffset={1.04} vignetteDarkness={1.28} />
        </Canvas>
        <div className="terrain-overlay terrain-overlay--top"><span>3D RELIEF / INTERACTIVE</span><span>RAYLEIGH + MIE ATMOSPHERE · DRAG TO ORBIT</span></div>
        <div className="terrain-overlay terrain-overlay--bottom"><span>{TERRAIN_STYLES[style].label.toUpperCase()}</span><span>{sunCount} SUN{sunCount > 1 ? "S" : ""} · {showMoon ? "MOONLIGHT" : "NO MOON"} · {timeOfDayHours.toFixed(2)} H LOCAL</span></div>
      </div>
      <div className="terrain-panel__footer">
        <label className="terrain-grid-toggle"><input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} /> Show reference grid</label>
        <span>Textured procedural terrain · vegetation + rocks · Rayleigh βR ∝ λ⁻⁴ · Mie/HG g = 0.76</span>
      </div>
    </section>
  );
}
