import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function hash(value) {
  const result = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return result - Math.floor(result);
}

export default function DistantFauna({ count = 12, spread = 10, height = 3.2, depth = -12, tint = "#132b38" }) {
  const flockRef = useRef(null);
  const meshRef = useRef(null);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.28, 0.0);
    shape.lineTo(-0.06, 0.035);
    shape.lineTo(0, 0.13);
    shape.lineTo(0.06, 0.035);
    shape.lineTo(0.28, 0.0);
    shape.lineTo(0.07, -0.035);
    shape.lineTo(0, 0.01);
    shape.lineTo(-0.07, -0.035);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: tint, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false }), [tint]);
  const placements = useMemo(() => Array.from({ length: count }, (_, index) => ({
    x: (hash(index + 1) - 0.5) * spread,
    y: height + hash(index + 7) * height * 0.8,
    z: depth - hash(index + 17) * spread * 0.75,
    rotation: (hash(index + 23) - 0.5) * 0.3,
    scale: 0.22 + hash(index + 31) * 0.30,
  })), [count, spread, height, depth]);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const bird = new THREE.Object3D();
    placements.forEach((placement, index) => {
      bird.position.set(placement.x, placement.y, placement.z);
      bird.rotation.set(0, placement.rotation, 0);
      bird.scale.set(placement.scale, placement.scale, placement.scale);
      bird.updateMatrix();
      meshRef.current.setMatrixAt(index, bird.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.computeBoundingSphere();
  }, [placements]);

  useFrame((state) => {
    if (flockRef.current) {
      flockRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.12) * 0.45;
      flockRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.08;
    }
  });

  return <group ref={flockRef}><instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} /></group>;
}
