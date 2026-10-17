import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import AtmosphericSky from "./AtmosphericSky";
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
    const width = 13.5, depth = 9.2, segmentsX = 260, segmentsZ = 200;
    const geo = new THREE.PlaneGeometry(width, depth, segmentsX, segmentsZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const heightField = new Float32Array(pos.count);
    const styleConfig = TERRAIN_STYLES[style] || TERRAIN_STYLES.alpine;

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i), z = pos.getZ(i);
      const nx = x / width + 0.5, nz = z / depth + 0.5;
      const broadNoise = terrainNoise(nx * 2.8 + 4, nz * 2.8 - 2, styleConfig.seed + 2);
      const coastNoise = terrainNoise(nx * 5.4 + 14, nz * 4.8 - 6, styleConfig.seed + 7);
      const ridgeNoise = terrainNoise(nx * 7.2 + 8, nz * 6.2 + 12, styleConfig.seed + 19);
      const detailNoise = terrainNoise(nx * 15, nz * 14, styleConfig.seed + 31);

      // Large overlapping landmasses fill the local view; the coast recedes naturally to the sea.
      const lobeA = 1.08 - Math.sqrt(((nx - 0.48) / 0.59) ** 2 + ((nz - 0.56) / 0.62) ** 2);
      const lobeB = 0.90 - Math.sqrt(((nx - 0.78) / 0.32) ** 2 + ((nz - 0.65) / 0.40) ** 2);
      const lobeC = 0.72 - Math.sqrt(((nx - 0.23) / 0.27) ** 2 + ((nz - 0.28) / 0.31) ** 2);
      const peninsula = 0.48 - Math.abs(nz - (0.30 + (nx - 0.48) * 0.65)) * 2.1 - Math.max(0, nx - 0.43) * 0.4;
      const landShape = Math.max(lobeA, lobeB, lobeC, peninsula) + coastNoise * 0.052 + broadNoise * 0.035;
      const landMask = smoothstep(-0.37, 0.06, landShape);

      const ridgeAxis = z - (Math.sin(x * 0.43 + styleConfig.seed) * 0.48 + x * 0.10 - 0.05);
      const mountainBelt = Math.exp(-((ridgeAxis / (style === "alpine" ? 1.34 : 1.55)) ** 2));
      const ridged = Math.pow(1 - Math.abs(ridgeNoise), 0.9);
      const secondaryBelt = Math.exp(-(((z + x * 0.31 + 1.8) / 1.7) ** 2)) * 0.22;
      const mountain = (mountainBelt * (0.24 + ridged * 0.64) + secondaryBelt) * landMask;
      let height = -0.96 + landMask * (1.18 + broadNoise * 0.24 + coastNoise * 0.055);
      height += mountain * styleConfig.relief * exaggeration * 0.96;
      height += Math.max(0, broadNoise + 0.16) * landMask * 0.32 * exaggeration;
      height += detailNoise * 0.012 * landMask * exaggeration;

      if (style === "volcanic") {
        const coneDistance = Math.sqrt(((x + 1.15) / 1.55) ** 2 + ((z - 0.35) / 1.35) ** 2);
        const cone = Math.max(0, 1 - coneDistance) * 0.88 * landMask * exaggeration;
        const crater = Math.exp(-(((x + 1.15) ** 2 + (z - 0.35) ** 2) * 1.5)) * 0.16 * exaggeration;
        height += cone - crater;
      } else if (style === "mesa") {
        const plateau = smoothstep(0.20, 0.64, 1 - Math.sqrt(((x - 1.0) / 2.8) ** 2 + ((z + 0.45) / 1.95) ** 2));
        height += plateau * 0.38 * exaggeration;
      } else if (style === "coastal") {
        height -= landMask * 0.08;
        height += mountain * 0.22 * exaggeration;
      }

      // Only distant edges dip below the waterline; there is no sharp island rim in the foreground.
      height = THREE.MathUtils.lerp(-1.04, height, smoothstep(0.01, 0.26, landShape + 0.10));
      heightField[i] = height;
      pos.setY(i, height);
    }

    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const colors = new Float32Array(pos.count * 3);
    const normal = geo.attributes.normal;
    const sand = new THREE.Color("#bca47a");
    const grass = new THREE.Color("#4b9169");
    const forest = new THREE.Color("#286348");
    const rock = new THREE.Color("#777d7c");
    const snow = new THREE.Color("#dbe7ed");
    const shade = new THREE.Color();

    for (let i = 0; i < pos.count; i += 1) {
      const y = heightField[i];
      const x = pos.getX(i), z = pos.getZ(i);
      const slope = 1 - Math.max(0, normal.getY(i));
      if (y < -0.1) shade.copy(sand).lerp(grass, smoothstep(-0.1, 0.25, y));
      else if (y < 0.40) shade.copy(grass).lerp(forest, smoothstep(0.0, 0.4, y));
      else shade.copy(forest).lerp(rock, smoothstep(0.40, 1.08, y));
      shade.lerp(rock, smoothstep(0.18, 0.52, slope) * 0.58);
      shade.lerp(snow, smoothstep(1.05, 1.75, y) * (style === "mesa" ? 0.08 : 0.70));
      if (ringShadows) {
        const curve = Math.sin(z * 0.16) * 1.15 + z * 0.28 + 0.8;
        const bandA = 1 - smoothstep(0.14, 0.48, Math.abs(x - curve));
        const bandB = 1 - smoothstep(0.12, 0.36, Math.abs(x - curve - 1.9 - Math.sin(z * 0.09) * 0.45));
        shade.multiplyScalar(1 - Math.max(bandA * 0.32, bandB * 0.20));
      }
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.userData.terrainMeta = { width, depth, segmentsX, segmentsZ, seaLevel: -0.29, isGasGiant: false };
    geo.computeBoundingSphere();
    return geo;
  }, [exaggeration, style, ringShadows]);

  const textures = useMemo(() => {
    const map = createTerrainDetailTexture(style, TERRAIN_STYLES[style].seed, 8, 6, "color");
    const bump = createTerrainDetailTexture(style, TERRAIN_STYLES[style].seed, 8, 6, "bump");
    return { map, bump };
  }, [style]);
  useEffect(() => () => { textures.map.dispose(); textures.bump.dispose(); }, [textures]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshPhysicalMaterial map={textures.map} bumpMap={textures.bump} bumpScale={0.12} vertexColors roughness={0.92} metalness={0.01} clearcoat={0.03} clearcoatRoughness={0.86} />
      </mesh>
      <TerrainEcosystem geometry={geometry} type={style === "alpine" ? "alpine" : style === "mesa" ? "desert" : style === "volcanic" ? "volcanic" : "temperate"} scaleFactor={0.92} seed={TERRAIN_STYLES[style].seed} density={1.12} />
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
  const fogColor = useMemo(() => {
    const night = new THREE.Color("#07101e");
    const day = new THREE.Color("#437b9d");
    const dusk = new THREE.Color("#94583f");
    return night.clone().lerp(day, daylight).lerp(dusk, (1 - Math.min(1, Math.abs(primarySun.elevation) * 3)) * 0.4);
  }, [daylight, primarySun.elevation]);
  const additionalSuns = suns.slice(1).map((sun) => ({ direction: sun.direction, color: sun.color, elevation: sun.elevation, weight: 0.92 }));

  return (
    <>
      <color attach="background" args={["#030914"]} />
      <fog attach="fog" args={[fogColor, 21, 50]} />
      <AtmosphericSky sunPosition={primarySun.position} sunDirection={primarySun.direction} sunElevation={primarySun.elevation} sunColor={primarySun.color} hazeColor={primarySun.elevation < 0.2 ? "#d28a65" : "#8fc7ef"} rayleighStrength={1} mieStrength={primarySun.elevation < 0.2 ? 0.75 : 0.28} additionalSuns={additionalSuns} />
      <ambientLight intensity={0.25 + daylight * 0.46} />
      <hemisphereLight args={["#b9e8ff", "#1c2935", 0.65 + daylight * 0.4]} />
      {suns.map((sun, index) => <directionalLight key={sun.label} position={sun.position} color={sun.color} intensity={(0.1 + daylight * 2.3) * (index === 0 ? 1 : 0.68)} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-bias={-0.00016} />)}
      {suns.map((sun, index) => <group key={`${sun.label}-disc`} position={sun.position}>
        <mesh><sphereGeometry args={[index === 0 ? 0.43 : 0.31, 28, 20]} /><meshBasicMaterial color={sun.color} toneMapped={false} /></mesh>
        <mesh scale={2.0}><sphereGeometry args={[index === 0 ? 0.43 : 0.31, 20, 16]} /><meshBasicMaterial color={sun.color} transparent opacity={0.18} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></mesh>
      </group>)}
      <pointLight position={[4, 3, -5]} color="#4ad7ff" intensity={8 + daylight * 6} distance={26} />
      <Stars radius={100} depth={40} count={daylight > 0.5 ? 120 : 700} factor={2.1} fade speed={0.16} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.29, 0]} receiveShadow>
        <planeGeometry args={[180, 180]} />
        <meshPhysicalMaterial bumpMap={waterBump} bumpScale={0.055} color="#104861" roughness={0.24} metalness={0.08} clearcoat={0.78} clearcoatRoughness={0.16} emissive="#063044" emissiveIntensity={0.28 + daylight * 0.16} />
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
        <Canvas key={cameraKey} camera={{ position: [7.4, 6.4, 7.6], fov: 34, near: 0.1, far: 250 }} shadows dpr={[1, 1.6]} gl={{ antialias: true }}>
          <TerrainScene exaggeration={exaggeration} showGrid={showGrid} style={style} timeOfDayHours={timeOfDayHours} sunCount={sunCount} showMoon={showMoon} ringShadows={ringShadows} />
          <OrbitControls ref={controlsRef} target={[0, 0.05, 0]} enableDamping dampingFactor={0.08} minDistance={4.8} maxDistance={22} maxPolarAngle={Math.PI * 0.48} />
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
