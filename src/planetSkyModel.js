import { EARTH_REFERENCE, STAR_PRESETS } from "./planetSkyDefaults";

export const STEFAN_BOLTZMANN = 5.670374419e-8;
export const SOLAR_FLUX_AT_1_AU = 1361;

const deepClone = (value) => JSON.parse(JSON.stringify(value));
export const clamp = (value, min, max) => {
  const numeric = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(numeric) ? numeric : min));
};
const radians = (degrees) => (degrees * Math.PI) / 180;
const degrees = (radiansValue) => (radiansValue * 180) / Math.PI;
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isHexColor = (value) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);

export function normalizeComposition(compositionPct = {}) {
  const keys = Object.keys(EARTH_REFERENCE.atmosphere.compositionPct);
  const entries = keys.map((key) => [key, Math.max(0, Number(compositionPct?.[key]) || 0)]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) {
    return { nitrogen: 100, oxygen: 0, argon: 0, methane: 0, hydrogen: 0, helium: 0, other: 0 };
  }
  const result = Object.fromEntries(entries.map(([key, value]) => [key, (value / total) * 100]));
  const normalizedTotal = Object.values(result).reduce((sum, value) => sum + value, 0);
  if (Math.abs(normalizedTotal - 100) > 1e-8) result.other = Math.max(0, result.other + (100 - normalizedTotal));
  return result;
}

function getValue(input, path, fallback) {
  return path.split(".").reduce((value, key) => (value == null ? undefined : value[key]), input) ?? fallback;
}

function readNumber(input, path, fallback, min, max, warnings) {
  const raw = getValue(input, path, fallback);
  const result = clamp(raw, min, max);
  if (raw !== undefined && Number(raw) !== result) warnings.push(`${path} was limited to ${result}.`);
  return result;
}

export function validateSkyConfig(input) {
  const warnings = [];
  const source = isObject(input) ? input : {};
  const base = deepClone(EARTH_REFERENCE);
  const config = base;

  config.schemaVersion = 1;
  config.id = typeof source.id === "string" ? source.id.slice(0, 80) : base.id;
  config.name = typeof source.name === "string" && source.name.trim() ? source.name.trim().slice(0, 100) : base.name;
  config.kind = typeof source.kind === "string" ? source.kind.slice(0, 40) : base.kind;

  const atmospherePresent = getValue(source, "atmosphere.present", base.atmosphere.present);
  config.atmosphere.present = typeof atmospherePresent === "boolean" ? atmospherePresent : base.atmosphere.present;
  if (atmospherePresent !== undefined && typeof atmospherePresent !== "boolean") warnings.push("atmosphere.present was reset because it was not true/false.");
  config.atmosphere.renderedThicknessKm = readNumber(source, "atmosphere.renderedThicknessKm", base.atmosphere.renderedThicknessKm, 0, 500, warnings);
  config.atmosphere.surfacePressureKPa = readNumber(source, "atmosphere.surfacePressureKPa", base.atmosphere.surfacePressureKPa, 0, 100000, warnings);
  config.atmosphere.densityKgM3 = readNumber(source, "atmosphere.densityKgM3", base.atmosphere.densityKgM3, 0, 100, warnings);
  config.atmosphere.co2Ppm = readNumber(source, "atmosphere.co2Ppm", base.atmosphere.co2Ppm, 0, 1000000, warnings);
  config.atmosphere.aerosol = readNumber(source, "atmosphere.aerosol", base.atmosphere.aerosol, 0, 1, warnings);
  const rawComposition = getValue(source, "atmosphere.compositionPct", base.atmosphere.compositionPct);
  if (isObject(rawComposition) && Object.values(rawComposition).some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
    warnings.push("Negative or non-numeric gas shares were set to zero before normalization.");
  }
  if (isObject(rawComposition) && Object.values(rawComposition).every((value) => !(Number(value) > 0))) {
    warnings.push("The gas recipe was empty, so a safe nitrogen-dominant mixture was restored.");
  }
  config.atmosphere.compositionPct = normalizeComposition(rawComposition);

  const validClasses = Object.keys(STAR_PRESETS);
  const incomingClass = getValue(source, "star.spectralClass", base.star.spectralClass);
  config.star.spectralClass = validClasses.includes(incomingClass) ? incomingClass : "Custom";
  if (incomingClass !== undefined && !validClasses.includes(incomingClass)) warnings.push("Unknown host-star class was changed to Custom.");
  config.star.name = typeof getValue(source, "star.name", base.star.name) === "string" ? getValue(source, "star.name", base.star.name).slice(0, 80) : base.star.name;
  config.star.effectiveTemperatureK = readNumber(source, "star.effectiveTemperatureK", base.star.effectiveTemperatureK, 1000, 50000, warnings);
  config.star.luminositySolar = readNumber(source, "star.luminositySolar", base.star.luminositySolar, 0.0001, 100000, warnings);
  config.star.distanceAU = readNumber(source, "star.distanceAU", base.star.distanceAU, 0.01, 1000, warnings);
  const starColor = getValue(source, "star.colorHex", base.star.colorHex);
  config.star.colorHex = isHexColor(starColor) ? starColor : base.star.colorHex;
  if (starColor !== undefined && !isHexColor(starColor)) warnings.push("The host-star color was reset because it was not a valid hex color.");

  const validSurfaceTypes = ["ocean-and-rock", "rocky", "ocean", "icy", "desert", "volcanic", "gas-giant", "custom"];
  const surfaceType = getValue(source, "surface.type", base.surface.type);
  config.surface.type = validSurfaceTypes.includes(surfaceType) ? surfaceType : base.surface.type;
  if (surfaceType !== undefined && !validSurfaceTypes.includes(surfaceType)) warnings.push("Unknown surface type was reset to the Earth Reference surface type.");
  const surfaceColor = getValue(source, "surface.baseColorHex", base.surface.baseColorHex);
  config.surface.baseColorHex = isHexColor(surfaceColor) ? surfaceColor : base.surface.baseColorHex;
  config.surface.bondAlbedo = readNumber(source, "surface.bondAlbedo", base.surface.bondAlbedo, 0, 1, warnings);
  config.surface.roughness = readNumber(source, "surface.roughness", base.surface.roughness, 0, 1, warnings);
  config.surface.waterFraction = readNumber(source, "surface.waterFraction", base.surface.waterFraction, 0, 1, warnings);
  config.surface.snowIceFraction = readNumber(source, "surface.snowIceFraction", base.surface.snowIceFraction, 0, 1, warnings);
  const cloudDeck = getValue(source, "surface.cloudDeck", base.surface.cloudDeck);
  config.surface.cloudDeck = typeof cloudDeck === "boolean" ? cloudDeck : base.surface.cloudDeck;
  if (cloudDeck !== undefined && typeof cloudDeck !== "boolean") warnings.push("surface.cloudDeck was reset because it was not true/false.");

  config.observer.latitudeDeg = readNumber(source, "observer.latitudeDeg", base.observer.latitudeDeg, -90, 90, warnings);
  config.observer.axialTiltDeg = readNumber(source, "observer.axialTiltDeg", base.observer.axialTiltDeg, 0, 180, warnings);
  config.observer.dayLengthHours = readNumber(source, "observer.dayLengthHours", base.observer.dayLengthHours, 1, 1000, warnings);
  config.observer.timeOfDayHours = readNumber(source, "observer.timeOfDayHours", base.observer.timeOfDayHours, 0, 1000, warnings);
  if (config.observer.timeOfDayHours > config.observer.dayLengthHours) {
    config.observer.timeOfDayHours = config.observer.timeOfDayHours % config.observer.dayLengthHours;
    warnings.push("Time of day was wrapped to fit within the selected day length.");
  }
  config.observer.yearProgress = readNumber(source, "observer.yearProgress", base.observer.yearProgress, 0, 1, warnings);
  config.observer.viewing.cloudiness = readNumber(source, "observer.viewing.cloudiness", base.observer.viewing.cloudiness, 0, 1, warnings);
  config.observer.viewing.haze = readNumber(source, "observer.viewing.haze", base.observer.viewing.haze, 0, 1, warnings);
  config.observer.viewing.moonlight = readNumber(source, "observer.viewing.moonlight", base.observer.viewing.moonlight, 0, 1, warnings);
  config.observer.viewing.exposure = readNumber(source, "observer.viewing.exposure", base.observer.viewing.exposure, 0.1, 3, warnings);
  const wavelengths = ["visible", "infrared", "ultraviolet"];
  const wavelength = getValue(source, "observer.viewing.wavelength", base.observer.viewing.wavelength);
  config.observer.viewing.wavelength = wavelengths.includes(wavelength) ? wavelength : base.observer.viewing.wavelength;
  if (wavelength !== undefined && !wavelengths.includes(wavelength)) warnings.push("Unknown wavelength mode was reset to visible.");
  const airglow = getValue(source, "observer.viewing.airglow", base.observer.viewing.airglow);
  config.observer.viewing.airglow = typeof airglow === "boolean" ? airglow : base.observer.viewing.airglow;
  if (airglow !== undefined && typeof airglow !== "boolean") warnings.push("observer.viewing.airglow was reset because it was not true/false.");
  const skyTint = getValue(source, "observer.viewing.skyTintHex", base.observer.viewing.skyTintHex);
  config.observer.viewing.skyTintHex = isHexColor(skyTint) ? skyTint : base.observer.viewing.skyTintHex;

  config.mechanic = { type: "solar-altitude", enabled: true };
  const provenanceKind = getValue(source, "provenance.kind", base.provenance.kind);
  config.provenance = {
    kind: ["real-reference", "illustrative", "measured", "reconstructed"].includes(provenanceKind) ? provenanceKind : "illustrative",
    sourceLabel: String(getValue(source, "provenance.sourceLabel", base.provenance.sourceLabel)).slice(0, 160),
  };
  return { config, warnings };
}

export function computeSolarAltitudeDeg(observer) {
  const latitude = radians(clamp(observer.latitudeDeg, -90, 90));
  const tilt = radians(clamp(observer.axialTiltDeg, 0, 180));
  const seasonAngle = 2 * Math.PI * clamp(observer.yearProgress, 0, 1);
  const declination = Math.asin(Math.sin(tilt) * Math.sin(seasonAngle));
  const dayLength = Math.max(1, Number(observer.dayLengthHours) || 1);
  const time = clamp(observer.timeOfDayHours, 0, dayLength);
  const hourAngle = 2 * Math.PI * (time / dayLength - 0.5);
  const sinAltitude =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  return degrees(Math.asin(clamp(sinAltitude, -1, 1)));
}

export function computeStellarFluxWm2(star) {
  const luminosity = clamp(star.luminositySolar, 0.0001, 100000);
  const distance = clamp(star.distanceAU, 0.01, 1000);
  return (SOLAR_FLUX_AT_1_AU * luminosity) / (distance * distance);
}

export function equilibriumTemperatureK(fluxWm2, bondAlbedo) {
  const flux = Math.max(0, Number(fluxWm2) || 0);
  const albedo = clamp(bondAlbedo, 0, 1);
  return Math.pow((flux * (1 - albedo)) / (4 * STEFAN_BOLTZMANN), 0.25);
}

export function getAtmosphereMix(atmosphere) {
  const co2Fraction = clamp(atmosphere.co2Ppm, 0, 1000000) / 1000000;
  const remainder = normalizeComposition(atmosphere.compositionPct);
  const mix = {};
  for (const [gas, pct] of Object.entries(remainder)) mix[gas] = pct * (1 - co2Fraction);
  mix.carbonDioxide = co2Fraction * 100;
  return mix;
}

export function getSkyPalette(config, starAltitudeDeg) {
  const viewing = config.observer.viewing;
  const atmo = config.atmosphere;
  let color;
  if (viewing.wavelength === "infrared") {
    color = starAltitudeDeg > 0 ? "#5c315d" : "#100a20";
  } else if (viewing.wavelength === "ultraviolet") {
    color = starAltitudeDeg > 0 ? "#35379b" : "#080a27";
  } else if (!atmo.present || atmo.surfacePressureKPa <= 0) {
    color = starAltitudeDeg > 0 ? "#182541" : "#030610";
  } else if (starAltitudeDeg > 18) {
    const co2Mix = atmo.co2Ppm / 1000000;
    const gasWeight = atmo.compositionPct.nitrogen / 100;
    if (co2Mix > 0.45) {
      color = "#bd7352";
    } else if (co2Mix > 0.05) {
      color = rgbToHex({
        r: 73 * (1 - co2Mix) + 189 * co2Mix,
        g: 151 * (1 - co2Mix) + 115 * co2Mix,
        b: 214 * (1 - co2Mix) + 82 * co2Mix,
      });
    } else {
      color = gasWeight > 0.5 ? viewing.skyTintHex : "#9a8dc2";
    }
  } else if (starAltitudeDeg > -8) {
    color = viewing.haze > 0.45 || atmo.aerosol > 0.4 ? "#d68155" : "#a87b8a";
  } else {
    color = "#040816";
  }
  if (viewing.cloudiness > 0.05 && starAltitudeDeg > -10 && atmo.present) {
    const amount = Math.min(0.72, viewing.cloudiness * 0.48 + viewing.haze * 0.14);
    const source = colorToRgb(color);
    color = rgbToHex({ r: source.r * (1 - amount) + 174 * amount, g: source.g * (1 - amount) + 189 * amount, b: source.b * (1 - amount) + 205 * amount });
  }
  return color;
}

function colorToRgb(hex) {
  const clean = hex.replace("#", "");
  return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
}
function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

export function buildWorldExplanation(config, starAltitudeDeg) {
  const mix = getAtmosphereMix(config.atmosphere);
  const gasSummary = Object.entries(mix)
    .filter(([, pct]) => pct >= 0.05)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, pct]) => `${name === "carbonDioxide" ? "CO₂" : name} ${pct.toFixed(pct >= 1 ? 1 : 2)}%`)
    .join(", ") || "trace mixture";
  const dayState = starAltitudeDeg > 6 ? "above the idealized horizon" : starAltitudeDeg < -6 ? "below the idealized horizon" : "near the idealized horizon";
  const surfaceLabel = config.surface.type === "gas-giant" ? "an upper cloud-deck viewpoint (no solid ground is implied)" : `a ${config.surface.type.replaceAll("-", " ")} surface`; 
  const atmosphereText = config.atmosphere.present
    ? `Atmosphere is enabled with a rendered shell of ${config.atmosphere.renderedThicknessKm.toFixed(0)} km, pressure ${config.atmosphere.surfacePressureKPa.toFixed(2)} kPa, density ${config.atmosphere.densityKgM3.toFixed(3)} kg/m³, and a modeled gas recipe led by ${gasSummary}.`
    : "Atmosphere is disabled, so the scene removes atmospheric haze and the shell; the sky uses a space-like palette.";
  return `${config.name} is shown from ${surfaceLabel}. ${atmosphereText} The host-star preset is ${config.star.name} (${config.star.spectralClass}-class, ${Math.round(config.star.effectiveTemperatureK).toLocaleString()} K, ${config.star.colorHex}), with ${config.star.luminositySolar.toPrecision(3)} solar luminosities at ${config.star.distanceAU.toPrecision(3)} AU. The observer is at ${config.observer.latitudeDeg >= 0 ? `${config.observer.latitudeDeg.toFixed(1)}° N` : `${Math.abs(config.observer.latitudeDeg).toFixed(1)}° S`}, axial tilt ${config.observer.axialTiltDeg.toFixed(1)}°, a ${config.observer.dayLengthHours.toFixed(1)}-hour day, time ${config.observer.timeOfDayHours.toFixed(1)} hours, and season phase ${config.observer.yearProgress.toFixed(2)}. The simplified mechanic places the host star ${dayState} at ${starAltitudeDeg.toFixed(1)}° altitude. Viewing conditions: cloudiness ${(config.observer.viewing.cloudiness * 100).toFixed(0)}%, haze ${(config.observer.viewing.haze * 100).toFixed(0)}%, moonlight ${(config.observer.viewing.moonlight * 100).toFixed(0)}%, exposure ${config.observer.viewing.exposure.toFixed(2)}×, ${config.observer.viewing.wavelength} band, airglow ${config.observer.viewing.airglow ? "on" : "off"}. These sky colors are qualitative visualization choices, not outputs from a full radiative-transfer model. Unless this is the Earth reference preset, the settings describe an illustrative scenario rather than measured properties of a discovered planet.`;
}

export function applyWorldPrompt(prompt, currentConfig) {
  const text = String(prompt || "").toLowerCase();
  const next = deepClone(currentConfig);
  const changes = [];
  const set = (path, value, label, note = "Interpreted from your prompt.") => {
    const keys = path.split(".");
    let target = next;
    for (const key of keys.slice(0, -1)) target = target[key];
    target[keys[keys.length - 1]] = value;
    changes.push({ field: label, value: String(value), note });
  };
  const starMatch = text.match(/red dwarf|orange dwarf|sun-like|sun like|yellow star|blue star|blue-white star|white star/i);
  if (starMatch) {
    const phrase = starMatch[0].toLowerCase();
    const spectral = phrase.includes("red dwarf") ? "M" : phrase.includes("orange dwarf") ? "K" : phrase.includes("blue") ? (phrase.includes("white") ? "B" : "A") : phrase.includes("white star") ? "A" : "G";
    const preset = STAR_PRESETS[spectral];
    set("star.spectralClass", spectral, "Host-star class", `${preset.name} approximation; not an observed host star.`);
    set("star.name", preset.name, "Host-star preset");
    set("star.effectiveTemperatureK", preset.effectiveTemperatureK, "Host-star temperature", "Typical illustrative class temperature.");
    set("star.colorHex", preset.colorHex, "Host-star color");
    set("star.luminositySolar", preset.luminositySolar, "Host-star luminosity", "Typical demo value; luminosity varies within stellar classes.");
  }
  if (/carbon dioxide|carbon-dioxide|\bco2\b/i.test(text)) {
    const rich = /thick|rich|dense|mostly|80\s*%|eighty percent/i.test(text);
    const ppm = rich ? 800000 : 100000;
    set("atmosphere.present", true, "Atmosphere", "Enabled because a gas mixture was requested.");
    set("atmosphere.co2Ppm", ppm, "CO₂ concentration", `${(ppm / 10000).toFixed(1)}% illustrative mix; selected by transparent prompt rule.`);
  }
  if (/\b(thick|dense|heavy)\b.{0,45}\batmosphere\b/i.test(text)) {
    set("atmosphere.present", true, "Atmosphere", "Enabled because a thick atmosphere was requested.");
    set("atmosphere.renderedThicknessKm", 150, "Rendered shell thickness (km)", "‘Thick’ is interpreted as a 150 km visual shell, not a measured atmospheric boundary.");
    set("atmosphere.surfacePressureKPa", 150, "Surface pressure (kPa)", "Illustrative preset for a thick atmosphere; edit the value before applying if needed.");
    set("atmosphere.densityKgM3", 1.8, "Atmospheric density (kg/m³)", "Illustrative value; pressure and density are not physically linked in this prototype.");
  } else if (/thin atmosphere|tenuous atmosphere/i.test(text)) {
    set("atmosphere.renderedThicknessKm", 20, "Rendered shell thickness (km)", "‘Thin’ is interpreted as a 20 km visual shell.");
    set("atmosphere.surfacePressureKPa", 10, "Surface pressure (kPa)", "Illustrative prompt mapping.");
  }
  if (/no atmosphere|airless|vacuum/i.test(text)) set("atmosphere.present", false, "Atmosphere", "Disabled by prompt.");
  if (/rocky|rock planet|terrestrial/i.test(text)) set("surface.type", "rocky", "Surface type");
  else if (/ocean world|ocean planet|water world/i.test(text)) { set("surface.type", "ocean", "Surface type"); set("surface.waterFraction", 0.9, "Water fraction"); }
  else if (/ice world|icy world|frozen world/i.test(text)) { set("surface.type", "icy", "Surface type"); set("surface.snowIceFraction", 0.8, "Snow/ice fraction"); }
  else if (/desert world|desert planet/i.test(text)) set("surface.type", "desert", "Surface type");
  else if (/lava world|volcanic world|molten/i.test(text)) set("surface.type", "volcanic", "Surface type");
  else if (/gas giant|cloud[- ]top|cloud deck/i.test(text)) {
    set("surface.type", "gas-giant", "Viewing surface", "Shows a cloud-deck viewpoint; no solid ground is implied.");
    set("surface.cloudDeck", true, "Cloud deck", "Enabled for a cloud-top view.");
  }
  const latitudeMatch = text.match(/(-?\d+(?:\.\d+)?)\s*(?:°|degrees?)\s*(north|south|n|s)\b/i);
  if (latitudeMatch) {
    const magnitude = Math.abs(Number(latitudeMatch[1]));
    const sign = /south|\bs\b/i.test(latitudeMatch[2]) ? -1 : 1;
    set("observer.latitudeDeg", sign * clamp(magnitude, 0, 90), "Latitude", "The numeric latitude was read from the prompt.");
  }
  const tiltMatch = text.match(/(?:axial\s+)?tilt(?:\s+of)?\s+(\d+(?:\.\d+)?)\s*(?:°|degrees?)/i);
  if (tiltMatch) set("observer.axialTiltDeg", clamp(Number(tiltMatch[1]), 0, 180), "Axial tilt (degrees)");
  const dayMatch = text.match(/(\d+(?:\.\d+)?)\s*[- ]?hour(?:s)?(?:\s+day)?/i);
  const namedTimeRequested = /orange dusk|orange sunset|orange twilight|sunset|dusk|twilight|sunrise|dawn|midnight|night|noon|midday/i.test(text);
  if (dayMatch) {
    const hours = clamp(Number(dayMatch[1]), 1, 1000);
    set("observer.dayLengthHours", hours, "Day length (hours)");
    if (!namedTimeRequested) {
      set("observer.timeOfDayHours", Math.min(next.observer.timeOfDayHours, hours), "Time of day (hours)", "Kept inside the selected day length.");
    } else {
      next.observer.timeOfDayHours = Math.min(next.observer.timeOfDayHours, hours);
    }
  }
  // Apply named time-of-day after day length so e.g. 30-hour orange dusk means 77% of 30 hours.
  if (/orange dusk|orange sunset|orange twilight/i.test(text)) {
    set("observer.timeOfDayHours", next.observer.dayLengthHours * 0.77, "Time of day (hours)", "Dusk is mapped to 77% of one rotation in this simplified model.");
    set("observer.viewing.skyTintHex", "#df814c", "Sky tint");
  } else if (/sunset|dusk|twilight/i.test(text)) set("observer.timeOfDayHours", next.observer.dayLengthHours * 0.75, "Time of day (hours)", "Dusk is mapped to 75% of one rotation.");
  else if (/sunrise|dawn/i.test(text)) set("observer.timeOfDayHours", next.observer.dayLengthHours * 0.25, "Time of day (hours)");
  else if (/midnight|night/i.test(text)) set("observer.timeOfDayHours", 0, "Time of day (hours)");
  else if (/noon|midday/i.test(text)) set("observer.timeOfDayHours", next.observer.dayLengthHours * 0.5, "Time of day (hours)");
  if (/moderate haze/i.test(text)) set("observer.viewing.haze", 0.45, "Viewing haze");
  else if (/heavy haze|thick haze/i.test(text)) set("observer.viewing.haze", 0.75, "Viewing haze");
  else if (/clear sky|clear atmosphere/i.test(text)) set("observer.viewing.haze", 0.05, "Viewing haze");
  if (/cloudy|overcast/i.test(text)) set("observer.viewing.cloudiness", 0.8, "Cloudiness");
  else if (/few clouds|light clouds/i.test(text)) set("observer.viewing.cloudiness", 0.25, "Cloudiness");
  if (text.includes("infrared")) set("observer.viewing.wavelength", "infrared", "Viewing wavelength");
  else if (/ultraviolet|\buv\b/.test(text)) set("observer.viewing.wavelength", "ultraviolet", "Viewing wavelength");
  if (/airglow off|no airglow/i.test(text)) set("observer.viewing.airglow", false, "Airglow");
  else if (text.includes("airglow")) set("observer.viewing.airglow", true, "Airglow");

  const { config, warnings } = validateSkyConfig(next);
  if (changes.length > 0) {
    config.name = "Prompt-built world";
    config.id = "prompt-world";
    config.provenance = { kind: "illustrative", sourceLabel: "Deterministic local prompt interpretation" };
  }
  return { config, changes, warnings };
}
