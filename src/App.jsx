import { useEffect, useRef, useState } from "react";
import Globe from "./Globe";
import TerrainExplorer from "./TerrainExplorer";
import WorldGeneratorPanel from "./WorldGeneratorPanel";
import SolarSystemExplorer from "./SolarSystemExplorer";
import PlanetSkyView from "./PlanetSkyView";
import { getEnvironment } from "./simulation";
import "./index.css";

const eras = [
  { label: "Pangaea", year: -250, position: 0 },
  { label: "Late Cretaceous", year: -66, position: 250 },
  { label: "Ice Age", year: -0.02, position: 500 },
  { label: "Present", year: 2026, position: 750 },
  { label: "Future", year: 2100, position: 1000 },
];

function timelinePositionFromYear(year) {
  for (let index = 0; index < eras.length - 1; index += 1) {
    const start = eras[index];
    const end = eras[index + 1];
    if (year <= end.year) {
      const amount = Math.max(0, Math.min(1, (year - start.year) / (end.year - start.year)));
      return start.position + (end.position - start.position) * amount;
    }
  }
  return eras[eras.length - 1].position;
}

function yearFromTimelinePosition(position) {
  for (let index = 0; index < eras.length - 1; index += 1) {
    const start = eras[index];
    const end = eras[index + 1];
    if (position <= end.position) {
      const amount = Math.max(0, Math.min(1, (position - start.position) / (end.position - start.position)));
      return start.year + (end.year - start.year) * amount;
    }
  }
  return eras[eras.length - 1].year;
}

function formatYear(year) {
  if (year <= -1) return `${Math.abs(year).toLocaleString()} million years ago`;
  if (year < 0) return `${Math.round(Math.abs(year) * 1_000_000).toLocaleString()} years ago`;
  if (year < 1) return "Present day";
  return `${Math.round(year).toLocaleString()} CE`;
}

function describeEarthSurface(year) {
  if (year <= -250) {
    return "Pangaea starter map · approx. 250 Ma";
  }
  if (year < -66) {
    return "Visual blend: Pangaea → Late Cretaceous";
  }
  if (year === -66) {
    return "Late Cretaceous starter map · approx. 66 Ma";
  }
  if (Math.abs(year + 0.02) < 0.0001) {
    return "Ice Age time marker · approx. 20,000 years ago; geography remains illustrative";
  }
  if (year < 2026) {
    return "Visual blend toward modern geography; intermediate dates are illustrative";
  }
  if (year === 2026) {
    return "Present-day Earth";
  }
  if (year < 2100) {
    return "Visual blend toward a hypothetical future scenario";
  }
  return "Hypothetical future scenario — not a prediction";
}

export default function App() {
  const [year, setYear] = useState(2026);
  const [wormholeActive, setWormholeActive] = useState(false);
  const [wormholeCycle, setWormholeCycle] = useState(0);
  const wormholeTimer = useRef(null);
  const [mode, setMode] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("sky")
      ? "sky"
      : "earth"
  );
  const environment = getEnvironment(year);
  const surfaceDescription = describeEarthSurface(year);
  const timelinePosition = timelinePositionFromYear(year);
  const timelineProgress = Math.max(0, Math.min(100, timelinePosition / 10));

  function triggerEarthWormhole() {
    setWormholeActive(true);
    setWormholeCycle((cycle) => cycle + 1);
    if (wormholeTimer.current) window.clearTimeout(wormholeTimer.current);
    wormholeTimer.current = window.setTimeout(() => setWormholeActive(false), 1450);
  }

  function jumpToEra(nextYear) {
    triggerEarthWormhole();
    setYear(nextYear);
  }

  useEffect(() => () => {
    if (wormholeTimer.current) window.clearTimeout(wormholeTimer.current);
  }, []);

  function navigateToMode(nextMode) {
    setMode(nextMode);
    // A copied ?sky= link should open the lab on first load, but leaving the lab
    // removes the payload so a later manual refresh does not force the lab open again.
    if (nextMode !== "sky" && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("sky")) {
        url.searchParams.delete("sky");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">◉</span>
          <div>
            <h1>HORIZON SHIFT</h1>
            <p>PLANETARY TIME SIMULATOR</p>
          </div>
        </div>

        <div className="status">
          <span className="status-dot" />
          SIMULATION ONLINE
        </div>
      </header>

      {/* The Solar System explorer has its own cosmic-time slider. */}
      {mode !== "solar" && mode !== "sky" && (
        <section className="timeline-panel" aria-label="Earth timeline">
          <div className="timeline-heading">
            <div>
              <span className="eyebrow">TEMPORAL NAVIGATION</span>
              <h2>{formatYear(year)}</h2>
            </div>

            <span className="time-coordinate">
              {year <= -1
                ? `T − ${Math.abs(year).toLocaleString()} MYA`
                : year < 0
                  ? `T − ${Math.round(Math.abs(year) * 1_000_000).toLocaleString()} YEARS`
                  : `YEAR ${Math.round(year)}`}
            </span>
          </div>

          <div className="time-slider-wrap">
            <input
              className="time-slider"
              type="range"
              min="0"
              max="1000"
              step="1"
              value={timelinePosition}
              style={{ "--timeline-progress": `${timelineProgress}%` }}
              onChange={(event) => setYear(yearFromTimelinePosition(Number(event.target.value)))}
              onPointerDown={triggerEarthWormhole}
              onPointerUp={triggerEarthWormhole}
              onKeyUp={triggerEarthWormhole}
              aria-label="Travel through Earth's history"
              aria-valuetext={formatYear(year)}
            />
            <div className="timeline-ticks" aria-hidden="true">
              {eras.map((era) => (
                <span
                  key={era.label}
                  className={Math.abs(year - era.year) < 0.5 ? "is-active" : ""}
                  style={{ left: `${era.position / 10}%` }}
                  title={era.label}
                />
              ))}
            </div>
          </div>
          <div className="timeline-range-caption"><span>250 MILLION YEARS AGO</span><span>ILLUSTRATIVE GEOLOGICAL TIMELINE</span><span>YEAR 2100</span></div>

          <div className="era-buttons">
            {eras.map((era) => (
              <button
                key={era.label}
                type="button"
                className={Math.abs(year - era.year) < 0.5 ? "era-button active" : "era-button"}
                onClick={() => jumpToEra(era.year)}
              >
                {era.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {mode === "sky" ? (
        <div className="planet-sky-mode-shell">
          <nav className="planet-sky-mode-nav no-print" aria-label="Return to another Horizon Shift view">
            <button type="button" className="mode" onClick={() => navigateToMode("earth")}>◉ Earth Explorer</button>
            <button type="button" className="mode" onClick={() => navigateToMode("world")}>✧ World Generator</button>
            <button type="button" className="mode" onClick={() => navigateToMode("solar")}>✦ Solar System & Exoplanets</button>
          </nav>
          <PlanetSkyView />
        </div>
      ) : mode === "solar" ? (
        <div className="solar-mode-shell">
          <nav
            className="solar-mode-nav"
            aria-label="Return to another Horizon Shift view"
            style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap", padding: "0.8rem 0 1rem" }}
          >
            <button
              type="button"
              className="mode"
              style={{ width: "auto" }}
              onClick={() => navigateToMode("earth")}
            >
              ◉ Earth Explorer
            </button>
            <button
              type="button"
              className="mode"
              style={{ width: "auto" }}
              onClick={() => navigateToMode("world")}
            >
              ✧ World Generator
            </button>
            <button
              type="button"
              className="mode"
              style={{ width: "auto" }}
              onClick={() => navigateToMode("sky")}
            >
              ✧ Planet Sky Lab
            </button>
            <span className="eyebrow" style={{ marginLeft: "auto" }}>
              SOLAR SYSTEM & EXOPLANET ATLAS
            </span>
          </nav>

          <SolarSystemExplorer onOpenPlanetSkyLab={() => navigateToMode("sky")} />
        </div>
      ) : (
        <>
          <section className="workspace">
            <aside className="side-panel">
              <span className="eyebrow">EXPLORATION MODE</span>

              <button
                type="button"
                className={mode === "earth" ? "mode active" : "mode"}
                aria-pressed={mode === "earth"}
                onClick={() => navigateToMode("earth")}
              >
                ◉ Earth Explorer
              </button>

              <button
                type="button"
                className={mode === "world" ? "mode active" : "mode"}
                aria-pressed={mode === "world"}
                onClick={() => navigateToMode("world")}
              >
                ✧ World Generator
              </button>

              <button
                type="button"
                className="mode"
                onClick={() => navigateToMode("solar")}
              >
                ✦ Solar System & Exoplanets
              </button>

              <button
                type="button"
                className="mode"
                onClick={() => navigateToMode("sky")}
              >
                ✧ Planet Sky Lab
              </button>

              <div className="info-card">
                <span className="eyebrow">CURRENT MISSION</span>
                <h3>
                  {mode === "earth" ? "Explore Earth's past" : "Create a new world"}
                </h3>
                <p>
                  {mode === "earth"
                    ? "Navigate the globe, compare historical surface maps, and explore planetary environments."
                    : "Configure a procedural planet and explore how its world settings affect the result."}
                </p>
              </div>

              <div className="info-card">
                <span className="eyebrow">TIME COORDINATE</span>
                <h3>{formatYear(year)}</h3>
                <p>
                  {mode === "earth"
                    ? surfaceDescription
                    : "The Earth timeline is retained while you configure your generated world."}
                </p>
              </div>

              {mode === "earth" && (
                <div className="info-card">
                  <span className="eyebrow">ENVIRONMENT READOUT</span>
                  <h3>{Number(environment.temperature).toFixed(1)}°C</h3>
                  <p>
                    Temperature preset · Sea-level offset {environment.seaLevel} ·
                    Vegetation {Math.round(environment.vegetation * 100)}% ·
                    Ice coverage {Math.round(environment.iceCoverage * 100)}%
                  </p>
                  <p className="simulation-note">
                    These are simplified preset/interpolated indicators, not outputs from a full climate model.
                  </p>
                </div>
              )}
            </aside>

            {mode === "earth" ? (
              <div className="globe-panel">
                <div className="globe-label">
                  <span>PLANETARY VIEW</span>
                  <span>DRAG TO ROTATE · SCROLL TO ZOOM</span>
                </div>

                <div className="globe-container">
                  <Globe year={year} />
                  {wormholeActive && (
                    <div key={wormholeCycle} className="earth-wormhole" role="status" aria-live="polite">
                      <div className="earth-wormhole__stars" />
                      <div className="earth-wormhole__portal">
                        <span className="earth-wormhole__ring earth-wormhole__ring--outer" />
                        <span className="earth-wormhole__ring earth-wormhole__ring--middle" />
                        <span className="earth-wormhole__ring earth-wormhole__ring--inner" />
                        <span className="earth-wormhole__core" />
                      </div>
                      <div className="earth-wormhole__caption"><strong>TIME JUMP IN PROGRESS</strong><span>REWEAVING GEOLOGICAL COORDINATES</span><b>{formatYear(year)}</b></div>
                    </div>
                  )}
                </div>

                <div className="globe-footer">
                  <span>EARTH / SOL-01</span>
                  <span>3D RENDER ACTIVE</span>
                </div>

                <div className="surface-caption">{surfaceDescription}</div>
              </div>
            ) : (
              <WorldGeneratorPanel />
            )}
          </section>

          {/* Keep the existing terrain explorer available in non-Solar-System views. */}
          <TerrainExplorer />
        </>
      )}
    </main>
  );
}
