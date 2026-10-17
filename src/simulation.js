// Simplified illustrative environment presets for the Horizon Shift timeline.
// These are interface/readout values, not outputs from a complete climate model.
export const presets = [
  { id: "pangaea", label: "Pangaea", year: -250, temperature: 18, seaLevel: -30, vegetation: 0.25, iceCoverage: 0.05, atmosphere: 1.2, description: "An illustrative state for a world with one large connected supercontinent." },
  { id: "cretaceous", label: "Late Cretaceous", year: -66, temperature: 22, seaLevel: 60, vegetation: 0.7, iceCoverage: 0.02, atmosphere: 1.1, description: "A generally warm reconstructed interval; values are illustrative." },
  { id: "ice-age", label: "Ice Age", year: -0.02, temperature: 9, seaLevel: -120, vegetation: 0.45, iceCoverage: 0.25, atmosphere: 1, description: "A simplified last-glacial-period style state, not a dated reconstruction." },
  { id: "present", label: "Present", year: 2026, temperature: 15, seaLevel: 0, vegetation: 0.55, iceCoverage: 0.1, atmosphere: 1, description: "A modern reference state for the simulation." },
  { id: "future", label: "Hypothetical Future", year: 2100, temperature: 17, seaLevel: 0.7, vegetation: 0.45, iceCoverage: 0.07, atmosphere: 1, description: "An illustrative future scenario, not a forecast." },
];

export function getEnvironment(year) {
  const ordered = [...presets].sort((a, b) => a.year - b.year);
  if (year <= ordered[0].year) return { ...ordered[0] };
  if (year >= ordered[ordered.length - 1].year) return { ...ordered[ordered.length - 1] };
  let left = ordered[0];
  let right = ordered[1];
  for (let i = 0; i < ordered.length - 1; i += 1) {
    if (year >= ordered[i].year && year <= ordered[i + 1].year) {
      left = ordered[i]; right = ordered[i + 1]; break;
    }
  }
  const t = (year - left.year) / (right.year - left.year);
  const mix = (a, b) => a + (b - a) * t;
  return {
    year,
    temperature: mix(left.temperature, right.temperature),
    seaLevel: mix(left.seaLevel, right.seaLevel),
    vegetation: mix(left.vegetation, right.vegetation),
    iceCoverage: mix(left.iceCoverage, right.iceCoverage),
    atmosphere: mix(left.atmosphere, right.atmosphere),
    description: "Interpolated illustrative simulation state; not a physical climate calculation.",
  };
}
