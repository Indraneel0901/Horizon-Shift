import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const SKY_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const SKY_FRAGMENT_SHADER = `
  varying vec3 vWorldPosition;
  uniform vec3 uSunDirection;
  uniform vec3 uSunColor;
  uniform float uSunElevation;
  uniform float uSunWeight;
  uniform vec3 uSunDirection2;
  uniform vec3 uSunColor2;
  uniform float uSunElevation2;
  uniform float uSunWeight2;
  uniform vec3 uSunDirection3;
  uniform vec3 uSunColor3;
  uniform float uSunElevation3;
  uniform float uSunWeight3;
  uniform vec3 uHazeColor;
  uniform float uRayleighStrength;
  uniform float uMieStrength;
  const float PI = 3.141592653589793;

  vec3 scatterOneSun(vec3 viewRay, vec3 sunDir, vec3 sunColor, float sunElevation, float weight) {
    float mu = clamp(dot(viewRay, normalize(sunDir)), -1.0, 1.0);
    float viewElevation = max(viewRay.y, -0.08);
    float airMass = min(5.0, 1.0 / max(0.12, viewElevation + 0.11));
    vec3 betaR = vec3(0.055, 0.20, 0.62);
    float daylight = smoothstep(-0.16, 0.10, sunElevation);
    float lowSun = 1.0 - smoothstep(0.015, 0.50, max(0.0, sunElevation));
    float rayleighDepth = max(0.0, uRayleighStrength) * airMass * 0.34;
    float mieDepth = max(0.0, uMieStrength) * airMass * 0.055;
    vec3 extinction = exp(-(betaR * rayleighDepth + vec3(0.22) * mieDepth));
    float rayleighPhase = 0.75 * (1.0 + mu * mu);
    float g = 0.76;
    float hgDenominator = pow(max(0.025, 1.0 + g*g - 2.0*g*mu), 1.5);
    float miePhase = (1.0 - g*g) / (4.0 * PI * hgDenominator);
    float horizonFade = exp(-max(viewRay.y, 0.0) * 7.5);
    float atmosphereStrength = clamp(max(uRayleighStrength, uMieStrength * 0.25), 0.0, 1.0);
    float aerosolAmount = clamp(uMieStrength / 2.2, 0.0, 1.0);
    vec3 rayleigh = betaR * (1.0 - extinction) * rayleighPhase * 1.95;
    vec3 mie = uHazeColor * (1.0 - exp(-mieDepth)) * miePhase * 5.2;
    vec3 aerosolDiffuse = uHazeColor * (1.0 - exp(-mieDepth * 0.8)) * 0.85;
    aerosolDiffuse += uHazeColor * aerosolAmount * 0.045;
    vec3 sunsetAmber = vec3(1.0, 0.30, 0.105);
    vec3 horizonBlue = vec3(0.27, 0.53, 0.78);
    vec3 warmHorizon = mix(horizonBlue, mix(sunsetAmber, uHazeColor, 0.32), lowSun);
    warmHorizon = mix(warmHorizon, uHazeColor, aerosolAmount * 0.72);
    vec3 zenithBlue = vec3(0.012, 0.045, 0.15) * clamp(uRayleighStrength, 0.0, 1.2);
    vec3 result = zenithBlue + rayleigh + mie + aerosolDiffuse;
    result += warmHorizon * horizonFade * (0.055 + lowSun * 0.30 + aerosolAmount * 0.10) * atmosphereStrength;
    result *= daylight * weight;
    float starDisc = smoothstep(0.9989, 0.99975, mu) * 1.6 + pow(max(mu, 0.0), 72.0) * 0.12;
    result += sunColor * starDisc * daylight * weight;
    return result;
  }

  void main() {
    vec3 viewRay = normalize(vWorldPosition - cameraPosition);
    vec3 nightSky = vec3(0.0018, 0.0045, 0.016) + vec3(0.005, 0.014, 0.04) * pow(max(viewRay.y, 0.0), 1.8);
    vec3 sky = nightSky;
    sky += scatterOneSun(viewRay, uSunDirection, uSunColor, uSunElevation, uSunWeight);
    sky += scatterOneSun(viewRay, uSunDirection2, uSunColor2, uSunElevation2, uSunWeight2);
    sky += scatterOneSun(viewRay, uSunDirection3, uSunColor3, uSunElevation3, uSunWeight3);
    gl_FragColor = vec4(max(sky, vec3(0.0)), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * Procedural single-scattering sky dome shared by both ground-level terrain views.
 * It supports up to three independently positioned suns, whose scattering fields
 * add together to create different sunset times and overlapping colour casts.
 * This is a real-time educational approximation, not a full radiative-transfer solver.
 */
export default function AtmosphericSky({
  sunPosition = [0, 25, 30],
  sunDirection: sunDirectionInput = null,
  sunElevation = 0.7,
  sunColor = "#fff0d1",
  hazeColor = "#8fc8f0",
  rayleighStrength = 1,
  mieStrength = 0.25,
  additionalSuns = [],
}) {
  const { camera } = useThree();
  const materialRef = useRef(null);
  const sunDirectionRef = useRef(new THREE.Vector3());
  const uniforms = useMemo(() => ({
    uSunDirection: { value: new THREE.Vector3(0, 0.7, 0.7).normalize() },
    uSunColor: { value: new THREE.Color("#fff0d1") },
    uSunElevation: { value: 0.7 },
    uSunWeight: { value: 1 },
    uSunDirection2: { value: new THREE.Vector3(0.2, 0.6, 0.8).normalize() },
    uSunColor2: { value: new THREE.Color("#ffc38a") },
    uSunElevation2: { value: 0 },
    uSunWeight2: { value: 0 },
    uSunDirection3: { value: new THREE.Vector3(-0.2, 0.6, 0.8).normalize() },
    uSunColor3: { value: new THREE.Color("#b5d9ff") },
    uSunElevation3: { value: 0 },
    uSunWeight3: { value: 0 },
    uHazeColor: { value: new THREE.Color("#8fc8f0") },
    uRayleighStrength: { value: 1 },
    uMieStrength: { value: 0.25 },
  }), []);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uSunColor.value.set(sunColor);
    material.uniforms.uSunElevation.value = sunElevation;
    material.uniforms.uSunWeight.value = 1;
    material.uniforms.uHazeColor.value.set(hazeColor);
    material.uniforms.uRayleighStrength.value = rayleighStrength;
    material.uniforms.uMieStrength.value = mieStrength;
    for (let index = 0; index < 2; index += 1) {
      const sun = additionalSuns[index];
      const suffix = index + 2;
      const direction = material.uniforms[`uSunDirection${suffix}`].value;
      if (sun) {
        direction.set(sun.direction[0], sun.direction[1], sun.direction[2]).normalize();
        material.uniforms[`uSunColor${suffix}`].value.set(sun.color || "#ffc38a");
        material.uniforms[`uSunElevation${suffix}`].value = sun.elevation ?? 0;
        material.uniforms[`uSunWeight${suffix}`].value = sun.weight ?? 0.85;
      } else {
        material.uniforms[`uSunWeight${suffix}`].value = 0;
      }
    }
    material.uniformsNeedUpdate = true;
  }, [sunColor, sunElevation, hazeColor, rayleighStrength, mieStrength, additionalSuns]);

  useFrame(() => {
    if (sunDirectionInput) {
      sunDirectionRef.current.set(sunDirectionInput[0], sunDirectionInput[1], sunDirectionInput[2]).normalize();
    } else {
      sunDirectionRef.current.set(sunPosition[0], sunPosition[1], sunPosition[2]).sub(camera.position).normalize();
    }
    const material = materialRef.current;
    if (material) material.uniforms.uSunDirection.value.copy(sunDirectionRef.current);
  });

  return (
    <mesh scale={130} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={SKY_VERTEX_SHADER}
        fragmentShader={SKY_FRAGMENT_SHADER}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}
