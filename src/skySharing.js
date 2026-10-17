import { EARTH_REFERENCE } from "./planetSkyDefaults";
import { validateSkyConfig } from "./planetSkyModel";

export const DEFAULT_CELESTIAL_SETTINGS = Object.freeze({ sunCount: 1, moon: true, ringShadows: false, separationDeg: 36 });

function encodeBase64Url(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function validateCelestialSettings(input) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const sunCount = Math.max(1, Math.min(3, Math.round(Number(source.sunCount) || 1)));
  const separation = Number(source.separationDeg);
  return {
    sunCount,
    moon: typeof source.moon === "boolean" ? source.moon : DEFAULT_CELESTIAL_SETTINGS.moon,
    ringShadows: typeof source.ringShadows === "boolean" ? source.ringShadows : DEFAULT_CELESTIAL_SETTINGS.ringShadows,
    separationDeg: Number.isFinite(separation) ? Math.max(10, Math.min(90, separation)) : DEFAULT_CELESTIAL_SETTINGS.separationDeg,
  };
}

function readTerrainRelief(params) {
  const value = params.get("terrain");
  if (value === null || value.trim() === "") return 1.0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1.0;
  return Math.min(2.1, Math.max(0.8, numeric));
}

export function loadInitialSkyConfig(search = typeof window !== "undefined" ? window.location.search : "") {
  const params = new URLSearchParams(search);
  const encoded = params.get("sky");
  const encodedCelestial = params.get("celestial");
  const terrainRelief = readTerrainRelief(params);
  let celestial = { ...DEFAULT_CELESTIAL_SETTINGS };
  if (encodedCelestial) {
    try {
      celestial = validateCelestialSettings(decodeBase64Url(encodedCelestial));
    } catch {
      celestial = { ...DEFAULT_CELESTIAL_SETTINGS };
    }
  }
  if (!encoded) return { config: structuredClone(EARTH_REFERENCE), warnings: [], celestial, terrainRelief };
  try {
    if (encoded.length > 12000) throw new Error("The shared settings are unexpectedly large.");
    const raw = decodeBase64Url(encoded);
    if (!raw || raw.schemaVersion !== 1) throw new Error("This sky link uses an unsupported settings version.");
    const { config, warnings } = validateSkyConfig(raw);
    return { config, warnings: ["Sky settings restored from the shared URL.", ...warnings], celestial, terrainRelief };
  } catch (error) {
    return {
      config: structuredClone(EARTH_REFERENCE),
      warnings: [`The shared sky URL could not be restored (${error instanceof Error ? error.message : "invalid data"}). Earth Reference was loaded instead.`],
      celestial,
      terrainRelief,
    };
  }
}

export function createSkyShareUrl(config, currentHref = typeof window !== "undefined" ? window.location.href : "http://localhost:5173/", celestial = DEFAULT_CELESTIAL_SETTINGS, terrainRelief = 1.0) {
  const validated = validateSkyConfig(config).config;
  const encodedSky = encodeBase64Url(validated);
  if (encodedSky.length > 12000) throw new Error("These settings are too large to share in a URL.");
  const numericRelief = Number(terrainRelief);
  const safeRelief = Math.min(2.1, Math.max(0.8, Number.isFinite(numericRelief) ? numericRelief : 1.0));
  const url = new URL(currentHref);
  // Keep the current deployment path, but avoid accidentally sharing stale
  // configuration or tracking parameters from a previously opened URL.
  url.search = "";
  url.hash = "";
  url.searchParams.set("sky", encodedSky);
  url.searchParams.set("celestial", encodeBase64Url(validateCelestialSettings(celestial)));
  url.searchParams.set("terrain", safeRelief.toFixed(2));
  return url.toString();
}

/** Copy reliably on HTTPS and in browsers where Clipboard API is unavailable. */
export async function copyTextToClipboard(value) {
  const text = String(value ?? "");
  if (!text) throw new Error("There is no URL to copy yet.");

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText &&
      (typeof window === "undefined" || window.isSecureContext)) {
    try {
      await navigator.clipboard.writeText(text);
      return "clipboard";
    } catch {
      // Continue to the selection/execCommand fallback for permission-denied
      // browsers and embedded contexts.
    }
  }

  if (typeof document === "undefined" || !document.body) {
    throw new Error("Clipboard access is unavailable. Select the URL field and copy it manually.");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = Boolean(document.execCommand?.("copy"));
  } catch {
    // Leave copied as false when the legacy copy command is unavailable.
  } finally {
    textarea.remove();
  }

  if (!copied) throw new Error("Automatic copying was blocked. Select the URL field and copy it manually.");
  return "fallback";
}
