import { useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";

/**
 * Step 21 surface switcher.
 *
 * Keep your existing NASA/Blue Marble texture at public/earth.jpg.
 * The included Pangaea and Late Cretaceous SVGs are schematic starter
 * textures for testing the time-dependent rendering. Replace them with
 * properly sourced equirectangular paleogeographic rasters before presenting
 * the view as scientific data.
 */
function Earth({ year = 2026 }) {
  const earthRef = useRef();
  const overlayRef = useRef();
  const atmosphereRef = useRef();

  const [pangaeaTexture, cretaceousTexture, modernTexture, futureTexture] =
    useLoader(THREE.TextureLoader, [
      "/earth-pangaea.svg",
      "/earth-cretaceous.svg",
      "/earth-modern-starter.svg",
      "/earth-future-scenario.svg",
    ]);

  for (const texture of [
    pangaeaTexture,
    cretaceousTexture,
    modernTexture,
    futureTexture,
  ]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  }

  let baseTexture;
  let overlayTexture;
  let blend = 0;

  if (year <= -250) {
    baseTexture = pangaeaTexture;
    overlayTexture = pangaeaTexture;
  } else if (year < -66) {
    baseTexture = pangaeaTexture;
    overlayTexture = cretaceousTexture;
    blend = (year + 250) / (250 - 66);
  } else if (year <= -0.02) {
    baseTexture = cretaceousTexture;
    overlayTexture = modernTexture;
    // Fade to modern-like geography by the Ice Age preset near the present.
    blend = (year + 66) / (66 - 0.02);
  } else if (year < 2100) {
    baseTexture = modernTexture;
    overlayTexture = futureTexture;
    blend = (year - 2026) / (2100 - 2026);
  } else {
    baseTexture = futureTexture;
    overlayTexture = futureTexture;
  }

  blend = THREE.MathUtils.clamp(blend, 0, 1);

  const glowColor =
    year < -66
      ? "#5a3920"
      : year < 0
        ? "#174d60"
        : year > 2050
          ? "#164c76"
          : "#073b4c";
  const glowIntensity = year < 0 ? 0.4 : 0.25;

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.035;
    if (overlayRef.current) overlayRef.current.rotation.y += delta * 0.035;
    if (atmosphereRef.current) atmosphereRef.current.rotation.y += delta * 0.02;
  });

  return (
    <group>
      {/* Base map */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[2, 128, 128]} />
        <meshStandardMaterial
          map={baseTexture}
          metalness={0.18}
          roughness={0.72}
          emissive={glowColor}
          emissiveIntensity={glowIntensity}
        />
      </mesh>

      {/* Upper map cross-fades over the base map while the timeline moves. */}
      <mesh ref={overlayRef} scale={1.002}>
        <sphereGeometry args={[2, 128, 128]} />
        <meshStandardMaterial
          map={overlayTexture}
          transparent
          opacity={blend}
          depthWrite={false}
          metalness={0.18}
          roughness={0.72}
          emissive={glowColor}
          emissiveIntensity={glowIntensity}
        />
      </mesh>

      {/* Holographic wireframe */}
      <mesh scale={1.003}>
        <sphereGeometry args={[2, 48, 32]} />
        <meshBasicMaterial
          color="#16e0ff"
          wireframe
          transparent
          opacity={0.12}
          depthWrite={false}
        />
      </mesh>

      {/* Atmospheric glow */}
      <mesh ref={atmosphereRef} scale={1.045}>
        <sphereGeometry args={[2, 96, 64]} />
        <meshBasicMaterial
          color="#32dfff"
          transparent
          opacity={0.16}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh scale={1.095}>
        <sphereGeometry args={[2, 64, 48]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.075}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export default function Globe({ year = 2026 }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#030914"]} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[5, 3, 5]} intensity={2} />
      <Stars radius={100} depth={50} count={1800} factor={3} fade speed={0.4} />
      <Earth year={year} />
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={2.6}
        maxDistance={12}
        enableDamping
        dampingFactor={0.06}
      />
    </Canvas>
  );
}
