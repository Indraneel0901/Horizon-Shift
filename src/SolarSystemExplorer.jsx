import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import "./solar-system.css";
import { COSMIC_TIME_MARKS, EXOPLANETS, SOLAR_BODIES } from "./solarSystemData";

const PLANET_PALETTES = {
  sun: [[255, 104, 26], [255, 218, 100]],
  mercury: [[83, 85, 83], [190, 188, 177]],
  venus: [[139, 91, 42], [244, 220, 169]],
  earth: [[3, 24, 71], [18, 107, 164]],
  mars: [[91, 37, 25], [214, 105, 59]],
  jupiter: [[133, 75, 45], [239, 211, 166]],
  saturn: [[151, 116, 69], [241, 222, 172]],
  uranus: [[48, 143, 153], [165, 231, 226]],
  neptune: [[16, 45, 143], [91, 155, 245]],
  pluto: [[101, 76, 67], [225, 204, 178]],
  hotjupiter: [[84, 40, 36], [218, 144, 92]],
  exoearth: [[6, 39, 81], [50, 139, 160]],
  lava: [[48, 15, 18], [255, 126, 41]],
};

function seededNumber(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) / 4294967295;
}

function mix(a, b, amount) {
  return a + (b - a) * amount;
}

function createPlanetTexture(body) {
  // Use procedural canvas textures so the demo works without additional image downloads.
  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const image = context.createImageData(width, height);
  const seed = seededNumber(body.id) * 19 + 1;
  const style = body.textureStyle;
  const palette = PLANET_PALETTES[style] || PLANET_PALETTES.earth;

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    const latitude = Math.abs(v * 2 - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const waveA = Math.sin(u * Math.PI * 2 * 3 + seed) * 0.5;
      const waveB = Math.cos(u * Math.PI * 2 * 7 - seed * 0.7) * 0.25;
      const waveC = Math.sin((u + v) * Math.PI * 2 * 13 + seed) * 0.14;
      const noise = (waveA + waveB + waveC + Math.sin(v * 91 + u * 41 + seed) * 0.1) / 1.1;
      let amount;
      let rgb;

      if (style === "earth" || style === "exoearth") {
        const continentField =
          Math.sin(u * Math.PI * 2 * 2.7 + seed) * 0.42 +
          Math.cos(u * Math.PI * 2 * 4.1 - seed) * 0.25 +
          Math.sin((u + v * 0.5) * Math.PI * 2 * 5.5 + seed * 0.3) * 0.22 +
          Math.cos(v * Math.PI * 2 * 3.4 + u * 9 + seed) * 0.18 +
          noise * 0.22;
        if (latitude > 0.88) {
          rgb = [207 + noise * 25, 221 + noise * 25, 226 + noise * 25];
        } else if (continentField > 0.33) {
          const dry = Math.max(0, Math.sin(v * 12 + u * 8 + seed));
          rgb = dry > 0.72
            ? [166 + noise * 35, 132 + noise * 30, 77 + noise * 18]
            : [43 + noise * 23, 91 + noise * 20, 54 + noise * 17];
        } else {
          amount = Math.max(0, Math.min(1, 0.35 + noise * 0.5 + (1 - latitude) * 0.13));
          rgb = [mix(2, 15, amount), mix(17, 85, amount), mix(54, 157, amount)];
        }
      } else if (["jupiter", "saturn", "uranus", "neptune", "venus", "hotjupiter"].includes(style)) {
        const bandCount = style === "jupiter" ? 26 : style === "saturn" ? 19 : style === "venus" ? 14 : style === "uranus" ? 10 : 17;
        const band = Math.sin(v * Math.PI * bandCount * 2 + waveA * 0.95 + noise * 0.65);
        amount = Math.max(0, Math.min(1, 0.5 + band * (style === "venus" ? 0.2 : 0.36) + noise * 0.14));
        rgb = [mix(palette[0][0], palette[1][0], amount), mix(palette[0][1], palette[1][1], amount), mix(palette[0][2], palette[1][2], amount)];
        if (style === "venus") {
          const cloud = Math.sin(u * 80 + v * 19 + seed) * 6;
          rgb = [rgb[0] + cloud, rgb[1] + cloud, rgb[2] + cloud];
        }
      } else if (style === "sun") {
        amount = Math.max(0, Math.min(1, 0.5 + noise * 0.8 + Math.sin(v * 34 + waveA * 2) * 0.16));
        rgb = [mix(palette[0][0], palette[1][0], amount), mix(palette[0][1], palette[1][1], amount), mix(palette[0][2], palette[1][2], amount)];
      } else if (style === "mars") {
        amount = Math.max(0, Math.min(1, 0.48 + noise * 0.65));
        rgb = [mix(palette[0][0], palette[1][0], amount), mix(palette[0][1], palette[1][1], amount), mix(palette[0][2], palette[1][2], amount)];
        if (latitude > 0.92) rgb = [207, 190, 171];
      } else {
        amount = Math.max(0, Math.min(1, 0.5 + noise * 0.85));
        rgb = [mix(palette[0][0], palette[1][0], amount), mix(palette[0][1], palette[1][1], amount), mix(palette[0][2], palette[1][2], amount)];
      }

      const i = (y * width + x) * 4;
      const shade = 0.92 + 0.08 * Math.sin(v * Math.PI);
      image.data[i] = Math.max(0, Math.min(255, rgb[0] * shade));
      image.data[i + 1] = Math.max(0, Math.min(255, rgb[1] * shade));
      image.data[i + 2] = Math.max(0, Math.min(255, rgb[2] * shade));
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  // Craters on rocky worlds add relief cues; this remains a stylized procedural texture.
  if (["mercury", "mars", "pluto"].includes(style)) {
    let seedState = Math.floor(seed * 1000000) || 1;
    const random = () => {
      seedState = (seedState * 1664525 + 1013904223) >>> 0;
      return seedState / 4294967295;
    };
    const count = style === "mercury" ? 220 : style === "mars" ? 120 : 70;
    for (let n = 0; n < count; n += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = 1.5 + Math.pow(random(), 2) * (style === "mercury" ? 15 : 9);
      const shade = random() > 0.5 ? "rgba(24,25,26,0.14)" : "rgba(255,238,218,0.13)";
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = shade;
      context.fill();
      context.beginPath();
      context.arc(x - radius * 0.16, y - radius * 0.16, radius * 0.7, Math.PI * 1.1, Math.PI * 1.9);
      context.strokeStyle = "rgba(30,24,21,0.18)";
      context.lineWidth = Math.max(0.5, radius * 0.08);
      context.stroke();
    }
  }

  if (style === "jupiter") {
    const spotX = width * 0.71;
    const spotY = height * 0.56;
    const grad = context.createRadialGradient(spotX, spotY, 2, spotX, spotY, 37);
    grad.addColorStop(0, "rgba(145,58,37,0.95)");
    grad.addColorStop(0.6, "rgba(183,91,55,0.78)");
    grad.addColorStop(1, "rgba(183,91,55,0)");
    context.fillStyle = grad;
    context.beginPath();
    context.ellipse(spotX, spotY, 47, 22, -0.08, 0, Math.PI * 2);
    context.fill();
  }

  if (style === "sun") {
    for (let n = 0; n < 180; n += 1) {
      const x = seededNumber(`${body.id}-x${n}`) * width;
      const y = seededNumber(`${body.id}-y${n}`) * height;
      context.fillStyle = n % 3 === 0 ? "rgba(255,244,157,0.16)" : "rgba(182,40,12,0.12)";
      context.beginPath();
      context.ellipse(x, y, 2 + (n % 7), 1 + (n % 3), 0.2, 0, Math.PI * 2);
      context.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function getTimelineBodies(bodies, cosmicTime, isSolar) {
  if (!isSolar) return bodies;
  // Orbital positions are an intentionally stylized time response, not ephemerides.
  // The time control moves each world along its schematic track so a jump is visible.
  return bodies.map((body) => {
    if (!body.orbitRadius) return body;
    const phase = cosmicTime * (0.86 / Math.sqrt(Math.max(1, body.orbitRadius)));
    return {
      ...body,
      position: [
        Math.cos(phase) * body.orbitRadius,
        Math.sin(phase * 0.48 + body.orbitRadius) * 0.035,
        Math.sin(phase) * body.orbitRadius,
      ],
    };
  });
}

function PlanetBody({ body, selected, onSelect, timeValue = 0, isSolar = true }) {
  const meshRef = useRef();
  const groupRef = useRef();
  const glowRef = useRef();
  const outerGlowRef = useRef();
  const texture = useMemo(() => createPlanetTexture({ id: body.id, textureStyle: body.textureStyle }), [body.id, body.textureStyle]);

  useEffect(() => () => texture.dispose(), [texture]);

  const isSun = body.id === "sun";
  const futureFactor = isSolar && isSun ? THREE.MathUtils.clamp((timeValue - 3.9) / 1.1, 0, 1) : 0;
  const youngFactor = isSolar && isSun ? THREE.MathUtils.clamp((-timeValue - 4.0) / 0.6, 0, 1) : 0;
  const targetScale = isSun ? 1 + futureFactor * 1.25 - youngFactor * 0.22 : 1;
  const targetGlow = isSun ? 0.31 + futureFactor * 0.25 : 0.16 + (selected ? 0.12 : 0);

  useFrame((_, delta) => {
    const alpha = 1 - Math.exp(-delta * 2.6);
    if (meshRef.current) meshRef.current.rotation.y += delta * (isSun ? 0.025 : 0.075);
    if (groupRef.current) {
      groupRef.current.position.lerp(new THREE.Vector3(...body.position), alpha);
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), alpha);
    }
    if (glowRef.current || outerGlowRef.current) {
      const pulse = 1 + Math.sin(performance.now() * 0.0008 + body.radius * 4) * 0.018;
      if (glowRef.current) glowRef.current.scale.setScalar((isSun ? 1.44 + futureFactor * 0.34 : 1.2 + (selected ? 0.06 : 0)) * pulse);
      if (outerGlowRef.current) outerGlowRef.current.scale.setScalar((isSun ? 2.0 + futureFactor * 0.25 : 1.68 + (selected ? 0.08 : 0)) * pulse);
    }
  });

  const sunColor = futureFactor > 0.05 ? new THREE.Color("#ff5738").lerp(new THREE.Color("#ff9870"), 1 - futureFactor) : youngFactor > 0.05 ? new THREE.Color("#ffd577") : new THREE.Color("#fff1c4");

  return (
    <group ref={groupRef} position={body.position}>
      {/* Layered additive halos give every body its own readable silhouette at a distance. */}
      <mesh ref={outerGlowRef} scale={isSun ? 2.0 : 1.68}>
        <sphereGeometry args={[body.radius, 40, 28]} />
        <meshBasicMaterial
          color={isSun ? sunColor : body.color}
          transparent
          opacity={isSun ? 0.14 : selected ? 0.12 : 0.065}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glowRef} scale={isSun ? 1.44 : 1.20}>
        <sphereGeometry args={[body.radius, 48, 32]} />
        <meshBasicMaterial
          color={isSun ? sunColor : body.color}
          transparent
          opacity={targetGlow}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      {isSun && <pointLight color={futureFactor > 0.05 ? "#ff6847" : "#ffc36b"} intensity={135 + futureFactor * 65} distance={65} decay={2} />}
      <mesh
        ref={meshRef}
        onClick={(event) => { event.stopPropagation(); onSelect(body); }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "default"; }}
        scale={selected ? 1.035 : 1}
      >
        <sphereGeometry args={[body.radius, 72, 48]} />
        <meshStandardMaterial
          map={texture}
          roughness={isSun ? 0.92 : 0.83}
          metalness={isSun ? 0 : 0.02}
          color={isSun ? sunColor : "#ffffff"}
          emissive={isSun ? (futureFactor > 0.05 ? "#ff492d" : "#ff7a1c") : selected ? body.color : "#000000"}
          emissiveMap={isSun ? texture : undefined}
          emissiveIntensity={isSun ? 1.5 + futureFactor * 0.75 : selected ? 0.2 : 0.025}
        />
      </mesh>

      {body.rings && (
        <mesh rotation={[Math.PI / 2.45, 0.04, 0.08]}>
          <ringGeometry args={[body.radius * 1.22, body.radius * 1.86, 112]} />
          <meshStandardMaterial color="#c9b48e" side={THREE.DoubleSide} transparent opacity={0.82} roughness={1} />
        </mesh>
      )}

      {selected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[body.radius * 1.24, body.radius * 1.27, 80]} />
          <meshBasicMaterial color="#78edff" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}

      <Html position={[0, body.radius + 0.2, 0]} center distanceFactor={17} occlude={false}>
        <button
          type="button"
          className={`solar-body-label${selected ? " is-selected" : ""}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); onSelect(body); }}
          title={`Navigate to ${body.name}`}
        >
          {body.name}
        </button>
      </Html>
    </group>
  );
}

function OrbitTrack({ radius }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.006, radius + 0.006, 180]} />
      <meshBasicMaterial color="#3d6182" transparent opacity={0.42} side={THREE.DoubleSide} />
    </mesh>
  );
}

function CameraFlight({ selectedBody, travelToken, controlsRef }) {
  const flight = useRef({ token: 0, active: false, destination: new THREE.Vector3(), target: new THREE.Vector3() });

  useFrame(({ camera }, delta) => {
    if (!selectedBody) return;
    if (flight.current.token !== travelToken) {
      flight.current.token = travelToken;
      flight.current.active = true;
      const [x, y, z] = selectedBody.position;
      flight.current.target.set(x, y, z);
      flight.current.destination.set(
        x,
        y + selectedBody.radius * 2.2 + 1.45,
        z + selectedBody.radius * 4.4 + 2.15,
      );
    }

    if (!flight.current.active || !controlsRef.current) return;
    const alpha = 1 - Math.exp(-delta * 2.35);
    camera.position.lerp(flight.current.destination, alpha);
    controlsRef.current.target.lerp(flight.current.target, alpha);
    controlsRef.current.update();

    if (camera.position.distanceTo(flight.current.destination) < 0.055 && controlsRef.current.target.distanceTo(flight.current.target) < 0.055) {
      flight.current.active = false;
    }
  });

  return null;
}

function getCosmicContext(value, body, mode) {
  if (mode === "exoplanets") {
    return "The catalog entries summarize discoveries and scientific questions. The time slider is intentionally limited to the Solar System view; the atlas arrangement is for navigation, not a shared planetary system.";
  }
  if (value <= -4.3) {
    return "System assembly: the Sun and planets emerge from a collapsing cloud and disk. Planet positions and textures in this view are illustrative, not a reconstruction of exact ancient orbits.";
  }
  if (value <= -3.5) {
    return body.category === "Rocky world"
      ? "Early evolution: impacts, internal heating and crust formation shape rocky worlds. This is a broad scientific timeline, not a planet-by-planet geologic simulation."
      : "Early evolution: giant planets and their satellites continue to evolve while gravity reshapes the young Solar System. The exact early paths are reconstructed with models.";
  }
  if (value < -0.1) {
    return "Deep-time preview: worlds shift smoothly along their schematic tracks as you scrub the era. The placement is an illustrative visual response, not a reconstruction of the planets’ ancient orbits.";
  }
  if (value > 4) {
    if (body.id === "sun") return "Stellar-evolution models predict the Sun will expand into a red giant in the distant future. This visualization is a concept, not a detailed stellar model.";
    return "Distant future scenario: the Sun’s evolution is expected to transform conditions throughout the Solar System. Individual planetary outcomes are uncertain and are not simulated here.";
  }
  if (value > 0.1) {
    return "Future preview: orbital positions continue to shift on the schematic tracks. The future styling is illustrative and does not predict exact planetary positions, climates, or surface conditions.";
  }
  return "Present-day reference: explore each world's known properties and the evidence scientists use to reconstruct its past. Sizes and distances are exaggerated, and orbital positions are schematic rather than precise.";
}

function formatCosmicTime(value) {
  if (Math.abs(value) < 0.05) return "Present era";
  return value < 0
    ? `~${Math.abs(value).toFixed(1)} billion years ago`
    : `~${value.toFixed(1)} billion years in the future`;
}

export default function SolarSystemExplorer({ onOpenPlanetSkyLab }) {
  const [viewMode, setViewMode] = useState("solar");
  const [selectedId, setSelectedId] = useState("earth");
  const [cosmicTime, setCosmicTime] = useState(0);
  const [pendingTime, setPendingTime] = useState(0);
  const [wormholeActive, setWormholeActive] = useState(false);
  // A non-zero initial token tells CameraFlight to frame Earth on first mount.
  const [travelToken, setTravelToken] = useState(1);
  const controlsRef = useRef(null);
  const timeoutRef = useRef(null);

  const baseBodies = viewMode === "solar" ? SOLAR_BODIES : EXOPLANETS;
  const visualTime = viewMode === "solar" ? pendingTime : 0;
  const bodies = useMemo(() => getTimelineBodies(baseBodies, visualTime, viewMode === "solar"), [baseBodies, visualTime, viewMode]);
  const selectedBody = bodies.find((body) => body.id === selectedId) || bodies[0];

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(4.72, 0, 0);
      controlsRef.current.update();
    }
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      document.body.style.cursor = "default";
    };
  }, []);

  function beginTransit({ body = null, time = null } = {}) {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setWormholeActive(true);
    if (body) {
      setSelectedId(body.id);
      setTravelToken((token) => token + 1);
    }
    timeoutRef.current = window.setTimeout(() => {
      if (typeof time === "number") {
        setCosmicTime(time);
        setPendingTime(time);
      }
      setWormholeActive(false);
    }, 2050);
  }

  function changeViewMode(nextMode) {
    if (nextMode === viewMode) return;
    const nextBody = nextMode === "solar"
      ? SOLAR_BODIES.find((body) => body.id === "earth")
      : EXOPLANETS[0];
    setViewMode(nextMode);
    beginTransit({ body: nextBody });
  }

  function jumpThroughTime() {
    beginTransit({ time: pendingTime });
  }

  const isSolar = viewMode === "solar";
  const timeContext = getCosmicContext(isNaN(pendingTime) ? cosmicTime : pendingTime, selectedBody, viewMode);

  return (
    <section className="solar-explorer" aria-label="Solar System and exoplanet explorer">
      <header className="solar-explorer__header">
        <div>
          <div className="solar-explorer__eyebrow">HORIZON SHIFT / CELESTIAL ARCHIVE</div>
          <h2>Navigate the cosmos<span className="solar-explorer__dot">.</span></h2>
          <p>Travel between worlds, open their history, and jump across cosmic time.</p>
        </div>
        <div className="solar-explorer__header-actions">
          <div className="solar-explorer__view-switch" role="group" aria-label="Choose celestial catalog">
            <button type="button" className={isSolar ? "is-active" : ""} onClick={() => changeViewMode("solar")}>Solar System</button>
            <button type="button" className={!isSolar ? "is-active" : ""} onClick={() => changeViewMode("exoplanets")}>Exoplanet Atlas</button>
          </div>
          {typeof onOpenPlanetSkyLab === "function" && (
            <button type="button" className="solar-explorer__sky-link" onClick={onOpenPlanetSkyLab}>Planet Sky Lab ↗</button>
          )}
        </div>
      </header>

      <div className="solar-explorer__meta-row">
        <span className="solar-explorer__live-dot" />
        <span>{isSolar ? "SOL SYSTEM / 1 STAR · 8 PLANETS + PLUTO" : "EXOPLANET ATLAS / SELECTED WORLDS"}</span>
        <span className="solar-explorer__meta-spacer" />
        <span className="solar-explorer__scale-note">SCHEMATIC SCALE · NOT TO SCALE</span>
      </div>

      <div className="solar-explorer__layout">
        <aside className="solar-explorer__sidebar">
          <div className="solar-explorer__section-label">DESTINATIONS <span>{String(bodies.length).padStart(2, "0")}</span></div>
          <div className="solar-explorer__body-list">
            {bodies.map((body, index) => (
              <button
                key={body.id}
                type="button"
                className={`solar-explorer__body-item${body.id === selectedBody.id ? " is-selected" : ""}`}
                onClick={() => beginTransit({ body })}
              >
                <span className="solar-explorer__body-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="solar-explorer__swatch" style={{ "--planet-color": body.color }} />
                <span className="solar-explorer__body-copy"><strong>{body.name}</strong><small>{body.category}</small></span>
                <span className="solar-explorer__chevron">↗</span>
              </button>
            ))}
          </div>
          <div className="solar-explorer__sidebar-note">
            <span className="solar-explorer__mini-orbit" />
            <div><strong>FLIGHT CONTROLS</strong><p>Select a name or click a world. Drag to orbit the view; scroll to zoom.</p></div>
          </div>
        </aside>

        <div className="solar-explorer__center-column">
          <div className="solar-explorer__stage">
            <Canvas camera={{ position: [8.2, 12, 27], fov: 44, near: 0.1, far: 500 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
              <color attach="background" args={["#030712"]} />
              <fog attach="fog" args={["#030712", 40, 115]} />
              <ambientLight intensity={0.38} />
              <directionalLight position={[0, 12, 20]} intensity={1.4} color="#b6d7ff" />
              <Stars radius={180} depth={70} count={2600} factor={3.2} saturation={0.15} fade speed={0.35} />
              {isSolar && SOLAR_BODIES.filter((body) => body.orbitRadius > 0).map((body) => (
                <OrbitTrack key={`orbit-${body.id}`} radius={body.orbitRadius} />
              ))}
              {!isSolar && (
                <group position={[7.7, -0.2, -2.4]}>
                  <mesh>
                    <sphereGeometry args={[0.12, 20, 16]} />
                    <meshBasicMaterial color="#6e90ae" transparent opacity={0.55} />
                  </mesh>
                  <pointLight color="#59789c" intensity={1.5} distance={30} />
                </group>
              )}
              {bodies.map((body) => (
                <PlanetBody
                  key={body.id}
                  body={body}
                  selected={body.id === selectedBody.id}
                  onSelect={(nextBody) => beginTransit({ body: nextBody })}
                  timeValue={visualTime}
                  isSolar={isSolar}
                />
              ))}
              <CameraFlight selectedBody={selectedBody} travelToken={travelToken} controlsRef={controlsRef} />
              <OrbitControls
                ref={controlsRef}
                enablePan={false}
                enableDamping
                dampingFactor={0.07}
                minDistance={0.8}
                maxDistance={70}
                maxPolarAngle={Math.PI * 0.49}
              />
            </Canvas>
            <div className="solar-explorer__stage-hud solar-explorer__stage-hud--top"><span>FIELD VIEW / 3D</span><span>● INTERACTIVE</span></div>
            <div className="solar-explorer__stage-hud solar-explorer__stage-hud--bottom"><span>{selectedBody.name.toUpperCase()}</span><span>{selectedBody.classification.toUpperCase()}</span></div>

            {wormholeActive && (
              <div className="solar-wormhole" role="status" aria-live="polite">
                <div className="solar-wormhole__stars" />
                <div className="solar-wormhole__tunnel"><div className="solar-wormhole__core" /></div>
                <div className="solar-wormhole__caption"><strong>WORMHOLE TRANSIT</strong><span>FOLDING SPACE-TIME / REALIGNING COORDINATES</span></div>
              </div>
            )}
          </div>

          {isSolar && (
            <div className="solar-explorer__timeline">
              <div className="solar-explorer__timeline-heading">
                <div><span className="solar-explorer__section-label">COSMIC TIME NAVIGATOR</span><strong>{formatCosmicTime(pendingTime)}</strong><small className="solar-explorer__preview-status">{Math.abs(pendingTime - cosmicTime) < 0.05 ? "Current simulation era" : "Preview active · orbital positions updating"}</small></div>
                <button type="button" className="solar-explorer__jump-button" onClick={jumpThroughTime} disabled={wormholeActive}>{wormholeActive ? "In transit…" : "Jump through time"} <span>↗</span></button>
              </div>
              <input
                className="solar-explorer__time-slider"
                type="range"
                min="-4.6"
                max="5"
                step="0.1"
                value={pendingTime}
                onChange={(event) => setPendingTime(Number(event.target.value))}
                aria-label="Select a point in Solar System history"
              />
              <div className="solar-explorer__time-labels">
                {COSMIC_TIME_MARKS.map((mark) => (
                  <button key={mark.value} type="button" onClick={() => setPendingTime(mark.value)} className={Math.abs(pendingTime - mark.value) < 0.05 ? "is-active" : ""}>
                    <span>{mark.label}</span><small>{mark.detail}</small>
                  </button>
                ))}
              </div>
              <p className="solar-explorer__timeline-footnote">Scrub to preview the changing orbital arrangement and stellar phase, then jump to commit the era. Orbital motion and the red-giant transition are illustrative, not computed ephemerides or a full stellar model.</p>
            </div>
          )}
        </div>

        <aside className="solar-explorer__history-panel">
          <div className="solar-explorer__history-head">
            <span className="solar-explorer__section-label">WORLD DOSSIER</span>
            <span className="solar-explorer__index">HS / {String(bodies.findIndex((body) => body.id === selectedBody.id) + 1).padStart(2, "0")}</span>
          </div>
          <div className="solar-explorer__type-chip"><span className="solar-explorer__swatch" style={{ "--planet-color": selectedBody.color }} />{selectedBody.classification}</div>
          <h3>{selectedBody.name}</h3>
          <p className="solar-explorer__tagline">{selectedBody.tagline}</p>
          <p className="solar-explorer__summary">{selectedBody.summary}</p>

          <div className="solar-explorer__current-era">
            <span className="solar-explorer__section-label">TIME CONTEXT</span>
            <strong>{isSolar ? formatCosmicTime(cosmicTime) : "Discovery / evidence record"}</strong>
            <p>{timeContext}</p>
          </div>

          <div className="solar-explorer__section-label solar-explorer__history-label">HISTORY & MILESTONES</div>
          <div className="solar-explorer__history-list">
            {selectedBody.history.map((entry, index) => (
              <article className="solar-explorer__history-item" key={`${selectedBody.id}-${entry.era}`}>
                <div className="solar-explorer__history-marker"><span>{String(index + 1).padStart(2, "0")}</span></div>
                <div><small>{entry.era}</small><strong>{entry.title}</strong><p>{entry.text}</p></div>
              </article>
            ))}
          </div>

          <div className="solar-explorer__source-card">
            <span className="solar-explorer__section-label">READ THE EVIDENCE</span>
            <a href={selectedBody.sourceUrl} target="_blank" rel="noreferrer">{selectedBody.sourceTitle} <span>↗</span></a>
            <p>Open the science source for more detail. Visual textures and layout here are illustrative, not scientific surface maps or computed orbital positions.</p>
          </div>
        </aside>
      </div>

      <footer className="solar-explorer__footer">
        <span>HORIZON SHIFT / EDUCATIONAL SIMULATION</span>
        <span>WORMHOLE IS A VISUAL EFFECT · NOT A PHYSICAL MODEL</span>
      </footer>
    </section>
  );
}
