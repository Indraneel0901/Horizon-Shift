import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

function hash(value, seed) {
  const v = Math.sin(value * 127.1 + seed * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function placeInstances(meshRef, items, geometryForItem) {
  const mesh = meshRef.current;
  if (!mesh) return;
  const transform = new THREE.Object3D();
  items.forEach((item, index) => {
    const placement = geometryForItem(item);
    transform.position.set(placement.x, placement.y, placement.z);
    transform.rotation.set(placement.rx || 0, placement.ry || 0, placement.rz || 0);
    transform.scale.set(placement.sx, placement.sy, placement.sz);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/** Deterministic small ecosystem props that follow the same sampled terrain mesh. */
export default function TerrainEcosystem({ geometry, type = "temperate", scaleFactor = 1, seed = 17, density = 1 }) {
  const trunksRef = useRef(null);
  const canopiesRef = useRef(null);
  const shrubsRef = useRef(null);
  const rocksRef = useRef(null);
  const flowersRef = useRef(null);

  const data = useMemo(() => {
    const meta = geometry?.userData?.terrainMeta;
    if (!geometry || !meta || meta.isGasGiant) return { trees: [], shrubs: [], rocks: [], flowers: [] };
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    const trees = [];
    const shrubs = [];
    const rocks = [];
    const flowers = [];
    const dryBiome = type === "desert" || type === "volcanic";
    const icyBiome = type === "icy";
    const alpineBiome = type === "alpine";
    const candidateCount = Math.round(980 * Math.max(0.45, density));
    const cellWidth = meta.width / meta.segmentsX;
    const cellDepth = meta.depth / meta.segmentsZ;
    const surfaceSea = meta.seaLevel ?? -0.3;

    for (let i = 0; i < candidateCount; i += 1) {
      const ux = hash(i + seed * 13, seed + 3);
      const uz = hash(i + seed * 29, seed + 17);
      const x = (ux - 0.5) * meta.width * 0.9;
      const z = (uz - 0.5) * meta.depth * 0.88;
      const column = Math.round(x / cellWidth + meta.segmentsX / 2);
      const row = Math.round(meta.segmentsZ / 2 - z / cellDepth);
      if (column < 1 || column >= meta.segmentsX || row < 1 || row >= meta.segmentsZ) continue;
      const vertex = row * (meta.segmentsX + 1) + column;
      const y = positions.getY(vertex);
      const normalY = normals.getY(vertex);
      if (y < surfaceSea + 0.25 || normalY < 0.78) continue;
      const scale = (0.55 + hash(i + 79, seed + 41) * 0.82) * scaleFactor;
      const item = { x, y, z, scale, rotation: hash(i + 23, seed + 61) * Math.PI * 2 };
      const snowLine = surfaceSea + (alpineBiome ? 1.55 : 1.65);
      if (!dryBiome && !icyBiome && y < snowLine && hash(i + 43, seed + 89) > (alpineBiome ? 0.08 : 0.18)) trees.push(item);
      else if (!icyBiome && hash(i + 53, seed + 101) > 0.56) shrubs.push(item);
      if (hash(i + 67, seed + 127) > (icyBiome || alpineBiome ? 0.50 : 0.70)) rocks.push({ ...item, scale: scale * (0.30 + hash(i + 97, seed + 151) * 0.62) });
      if (!dryBiome && !icyBiome && y < surfaceSea + 1.0 && normalY > 0.91 && hash(i + 131, seed + 167) > 0.84) {
        flowers.push({ ...item, scale: (0.42 + hash(i + 173, seed + 181) * 0.40) * scaleFactor });
      }
    }
    return { trees: trees.slice(0, 240), shrubs: shrubs.slice(0, 190), rocks: rocks.slice(0, 205), flowers: flowers.slice(0, 95) };
  }, [geometry, type, scaleFactor, seed, density]);

  const geometrySet = useMemo(() => ({
    trunk: new THREE.CylinderGeometry(0.038, 0.064, 0.56, 6),
    canopy: new THREE.ConeGeometry(0.29, 0.83, 7, 1),
    shrub: new THREE.IcosahedronGeometry(0.21, 1),
    rock: new THREE.DodecahedronGeometry(0.25, 0),
    flower: new THREE.SphereGeometry(0.075, 7, 5),
  }), []);

  const materialSet = useMemo(() => ({
    trunk: new THREE.MeshStandardMaterial({ color: "#58402d", roughness: 1 }),
    canopy: new THREE.MeshStandardMaterial({ color: type === "desert" ? "#6e7b42" : type === "volcanic" ? "#28523a" : "#2a7248", roughness: 0.94 }),
    shrub: new THREE.MeshStandardMaterial({ color: type === "desert" ? "#9a8a57" : "#42734d", roughness: 0.98 }),
    rock: new THREE.MeshStandardMaterial({ color: type === "icy" || type === "alpine" ? "#929fa7" : type === "desert" ? "#9a8061" : "#686e68", roughness: 0.98 }),
    flower: new THREE.MeshStandardMaterial({ color: "#e3cf78", emissive: "#45300e", emissiveIntensity: 0.08, roughness: 0.84 }),
  }), [type]);

  useLayoutEffect(() => {
    placeInstances(trunksRef, data.trees, (item) => ({ x: item.x, y: item.y + item.scale * 0.28, z: item.z, ry: item.rotation, sx: item.scale, sy: item.scale, sz: item.scale }));
    placeInstances(canopiesRef, data.trees, (item) => ({ x: item.x, y: item.y + item.scale * 0.72, z: item.z, ry: item.rotation, sx: item.scale, sy: item.scale, sz: item.scale }));
    placeInstances(shrubsRef, data.shrubs, (item) => ({ x: item.x, y: item.y + item.scale * 0.13, z: item.z, ry: item.rotation, sx: item.scale, sy: item.scale * 0.65, sz: item.scale }));
    placeInstances(rocksRef, data.rocks, (item) => ({ x: item.x, y: item.y + item.scale * 0.12, z: item.z, ry: item.rotation, rx: 0.2, sx: item.scale, sy: item.scale * 0.76, sz: item.scale }));
    placeInstances(flowersRef, data.flowers, (item) => ({ x: item.x, y: item.y + item.scale * 0.045, z: item.z, ry: item.rotation, sx: item.scale, sy: item.scale * 0.75, sz: item.scale }));
  }, [data]);

  if (!data.trees.length && !data.shrubs.length && !data.rocks.length && !data.flowers.length) return null;
  return (
    <group>
      {data.trees.length > 0 && <>
        <instancedMesh ref={trunksRef} args={[geometrySet.trunk, materialSet.trunk, data.trees.length]} castShadow receiveShadow />
        <instancedMesh ref={canopiesRef} args={[geometrySet.canopy, materialSet.canopy, data.trees.length]} castShadow receiveShadow />
      </>}
      {data.shrubs.length > 0 && <instancedMesh ref={shrubsRef} args={[geometrySet.shrub, materialSet.shrub, data.shrubs.length]} castShadow receiveShadow />}
      {data.rocks.length > 0 && <instancedMesh ref={rocksRef} args={[geometrySet.rock, materialSet.rock, data.rocks.length]} castShadow receiveShadow />}
      {data.flowers.length > 0 && <instancedMesh ref={flowersRef} args={[geometrySet.flower, materialSet.flower, data.flowers.length]} castShadow receiveShadow />}
    </group>
  );
}
