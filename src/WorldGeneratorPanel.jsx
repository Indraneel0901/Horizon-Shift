import { useState } from "react";
import GeneratedPlanet from "./GeneratedPlanet";

const defaults = { name: "Aurelia", seed: 7, water: 0.50, terrain: 0.82, clouds: 0.48, atmosphere: true, axialTilt: 23.4, color: "#287c98", planetType: "temperate", sunCount: 1, companion: "moon" };

const floraDescriptions = {
  temperate: "Forests, conifers, scrub and alpine lichen follow regional moisture, temperature and elevation.",
  desert: "Cacti and drought-adapted shrubs cluster in warm, dry regions.",
  icy: "Ice spires and low lichens favor cold zones and elevated terrain.",
  volcanic: "Ash shrubs and hardy volcanic spires favor rugged highlands.",
  ocean: "Coral-like growth and island vegetation appear on higher islands and coasts.",
  alien: "Glowing crystals and alien mushroom-like growth use a non-Earth palette.",
};

export default function WorldGeneratorPanel() {
  const [settings, setSettings] = useState(defaults);
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  return (
    <section className="world-generator-panel">
      <div className="generator-heading">
        <span className="eyebrow">PROCEDURAL WORLD LAB</span>
        <h2>World Generator</h2>
        <p>Generate a procedural planet with spherical-domain continents, coastlines, raised mountain chains, moving cloud cover and an atmosphere. Planet type changes the surface palette and flora; local moisture, temperature and elevation guide where species appear. Add multiple stars or a moon/ring system to explore changing light. Visuals are illustrative, not a physical climate model.</p>
      </div>
      <div className="generator-layout">
        <div className="generator-controls">
          <label>World name<input value={settings.name} onChange={(e) => update("name", e.target.value)} maxLength={50} /></label>
          <label>Seed<input type="number" min="1" max="999999" value={settings.seed} onChange={(e) => update("seed", Number(e.target.value))} /></label>
          <label>Planet type / flora<select value={settings.planetType} onChange={(e) => update("planetType", e.target.value)}>
            <option value="temperate">Temperate / Earth-like</option>
            <option value="desert">Desert world</option>
            <option value="icy">Ice world</option>
            <option value="volcanic">Volcanic world</option>
            <option value="ocean">Ocean world</option>
            <option value="alien">Alien biosphere</option>
          </select></label>
          <p className="flora-description">{floraDescriptions[settings.planetType] || floraDescriptions.temperate}</p>
          <label>Water coverage <output>{Math.round(settings.water * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={settings.water} onChange={(e) => update("water", Number(e.target.value))} /></label>
          <label>Terrain intensity <output>{Math.round(settings.terrain * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={settings.terrain} onChange={(e) => update("terrain", Number(e.target.value))} /></label>
          <label>Cloud cover <output>{Math.round(settings.clouds * 100)}%</output><input type="range" min="0" max="1" step="0.01" value={settings.clouds} onChange={(e) => update("clouds", Number(e.target.value))} /></label>
          <label>Axial tilt <output>{settings.axialTilt.toFixed(1)}°</output><input type="range" min="0" max="90" step="0.1" value={settings.axialTilt} onChange={(e) => update("axialTilt", Number(e.target.value))} /></label>
          <label>Surface tint<input type="color" value={settings.color} onChange={(e) => update("color", e.target.value)} /></label>
          <label>Number of suns<select value={settings.sunCount} onChange={(e) => update("sunCount", Number(e.target.value))}><option value={1}>One star</option><option value={2}>Binary stars</option><option value={3}>Three stars</option></select></label>
          <label>Companion body<select value={settings.companion} onChange={(e) => update("companion", e.target.value)}><option value="none">No moon or rings</option><option value="moon">Orbiting moon</option><option value="ringed-world">Moon + planetary rings</option></select></label>
          <label className="generator-check"><input type="checkbox" checked={settings.atmosphere} onChange={(e) => update("atmosphere", e.target.checked)} /> Atmosphere + clouds visible</label>
          <button type="button" className="generate-button" onClick={() => setSettings((s) => ({ ...s, seed: (Number(s.seed) % 999999) + 1 }))}>Generate variation</button>
          <button type="button" className="generate-button secondary" onClick={() => setSettings(defaults)}>Reset settings</button>
        </div>
        <div className="generated-output">
          <div className="globe-label"><span>{settings.name || "Unnamed world"}</span><span>DRAG TO ORBIT · SCROLL TO ZOOM</span></div>
          <GeneratedPlanet settings={settings} />
          <p className="simulation-note">Seed {settings.seed} · {settings.planetType} biome · Water {Math.round(settings.water * 100)}% · Terrain {Math.round(settings.terrain * 100)}% · Clouds {Math.round(settings.clouds * 100)}% · {settings.sunCount} sun{settings.sunCount > 1 ? "s" : ""} · {settings.companion === "none" ? "no companion" : settings.companion === "moon" ? "orbiting moon" : "moon + rings"}</p>
        </div>
      </div>
    </section>
  );
}
