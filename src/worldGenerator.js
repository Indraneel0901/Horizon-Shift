
export const defaultWorld = {
  name: "Untitled World",
  seed: 42,
  temperature: 18,
  water: 55,
  atmosphere: 1,
  gravity: 1,
  axialTilt: 23.5,
  terrain: 0.6,
  star: "Yellow",
  rings: false,
  moons: 1,
};

export function generateWorld(settings) {
  const seed = Math.floor(Math.random() * 1000000);

  const world = {
    ...settings,
    seed,
    name: `World-${seed}`,
  };

  return world;
}
