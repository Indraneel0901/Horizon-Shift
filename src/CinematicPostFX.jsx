import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader.js";

/**
 * Small post-processing stack used only by the two ground-level terrain views.
 * Bloom is deliberately restrained so sun discs, atmospheric rims and glints bloom
 * without turning the terrain into a washed-out glow. Vignette subtly guides the eye.
 */
export default function CinematicPostFX({
  bloomStrength = 0.3,
  bloomRadius = 0.58,
  bloomThreshold = 0.78,
  vignetteOffset = 1.08,
  vignetteDarkness = 1.28,
}) {
  const { gl, scene, camera, size } = useThree();

  const passes = useMemo(() => {
    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), bloomStrength, bloomRadius, bloomThreshold);
    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms.offset.value = vignetteOffset;
    vignettePass.uniforms.darkness.value = vignetteDarkness;
    const outputPass = new OutputPass();

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(vignettePass);
    composer.addPass(outputPass);
    return { composer, bloomPass, vignettePass, outputPass };
  }, [gl, scene, camera, bloomStrength, bloomRadius, bloomThreshold, vignetteOffset, vignetteDarkness]);

  useEffect(() => {
    passes.composer.setPixelRatio(Math.min(gl.getPixelRatio(), 1.6));
    passes.composer.setSize(size.width, size.height);
  }, [passes, gl, size.width, size.height]);

  useEffect(() => () => {
    passes.composer.dispose();
    passes.bloomPass.dispose?.();
    passes.vignettePass.dispose?.();
    passes.outputPass.dispose?.();
  }, [passes]);

  // Taking over the render priority routes this scene through the composer.
  useFrame((_, delta) => {
    passes.composer.render(delta);
  }, 1);

  return null;
}
