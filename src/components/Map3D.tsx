import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, Map as MlMap, Marker, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Box, Globe, Satellite } from "lucide-react";
import { useTheme } from "@/context/theme";
import { ThemeMode } from "@/lib/types";
import { UsedHomeListing } from "@/lib/usedHomes";
import { formatBaht } from "@/lib/prediction";

// Free vector styles with OpenMapTiles buildings (render_height) - no API key.
const STYLES: Record<ThemeMode, string> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};
const SATELLITE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const BANGKOK: [number, number] = [100.5018, 13.7563];
const OVERVIEW = { center: BANGKOK, zoom: 11.3, pitch: 58, bearing: -18 };
// Price callouts only once individual plots are distinguishable.
const CALLOUT_MIN_ZOOM = 14.5;
const CALLOUT_MAX = 80;
const PICK = "#a78bfa";
const RADIUS = "#22d3ee";
const HOME = "#facc15";

interface Map3DProps {
  point: { lat: number; lng: number } | null;
  radius: number;
  homes: UsedHomeListing[];
  onPick: (lat: number, lng: number) => void;
  /** Tailwind height class. */
  height: string;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
}

/** Price per ตร.ว. for land (how land is sold), per ตร.ม. otherwise. */
function unitPrice(home: UsedHomeListing): string | null {
  if (home.type.includes("ที่ดิน") && home.landSqwa) return `฿${compact(home.price / home.landSqwa)}/ตร.ว.`;
  if (home.area) return `฿${compact(home.price / home.area)}/ตร.ม.`;
  if (home.landSqwa) return `฿${compact(home.price / home.landSqwa)}/ตร.ว.`;
  return null;
}

function circle(lat: number, lng: number, radiusM: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: [number, number][] = [];
  const kmLat = radiusM / 111_320;
  const kmLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * 2 * Math.PI;
    ring.push([lng + kmLng * Math.sin(t), lat + kmLat * Math.cos(t)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } };
}

function pickData(point: Map3DProps["point"], radius: number): GeoJSON.FeatureCollection {
  if (!point) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      circle(point.lat, point.lng, radius),
      { type: "Feature", properties: { pick: true }, geometry: { type: "Point", coordinates: [point.lng, point.lat] } },
    ],
  };
}

function homesData(homes: UsedHomeListing[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: homes.map((h) => ({
      type: "Feature",
      properties: { id: h.id },
      geometry: { type: "Point", coordinates: [h.lng, h.lat] },
    })),
  };
}

/** Popup body built from DOM nodes: titles are scraped text, never HTML. */
function homeCard(home: UsedHomeListing): HTMLElement {
  const el = document.createElement("a");
  el.href = home.url;
  el.target = "_blank";
  el.rel = "noopener noreferrer";
  el.className = "home-pop";
  if (home.image) {
    const img = document.createElement("img");
    img.src = home.image;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.loading = "lazy";
    el.append(img);
  }
  const body = document.createElement("div");
  const price = document.createElement("strong");
  price.textContent = formatBaht(home.price);
  const title = document.createElement("p");
  title.textContent = home.title;
  const meta = document.createElement("span");
  meta.textContent = [
    home.type,
    home.area ? `${home.area} ตร.ม.` : null,
    home.landSqwa ? `${home.landSqwa} ตร.ว.` : null,
    home.bedrooms ? `${home.bedrooms} นอน` : null,
    unitPrice(home),
  ]
    .filter(Boolean)
    .join(" · ");
  body.append(price, title, meta);
  el.append(body);
  return el;
}

/**
 * MapLibre map: a globe that flies into Bangkok and settles into a tilted 3D
 * city (extruded OpenMapTiles buildings). Clicking a spot picks it and dives
 * into satellite imagery, where every used-home listing in view carries a
 * price callout, oneatlaz-style.
 */
export function Map3D({ point, radius, homes, onPick, height }: Map3DProps) {
  const { mode } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap>();
  const [satellite, setSatellite] = useState(false);

  // Latest props for map event handlers and style reloads.
  const latest = useRef({ point, radius, homes, onPick, satellite, mode });
  latest.current = { point, radius, homes, onPick, satellite, mode };
  const homesById = useRef(new Map<string, UsedHomeListing>());
  const callouts = useRef<Marker[]>([]);
  const popup = useRef<Popup>();

  const showPopup = useCallback((home: UsedHomeListing) => {
    const map = mapRef.current;
    if (!map) return;
    popup.current?.remove();
    popup.current = new maplibregl.Popup({ offset: 14, maxWidth: "260px", className: "space-pop" })
      .setLngLat([home.lng, home.lat])
      .setDOMContent(homeCard(home))
      .addTo(map);
  }, []);

  const refreshCallouts = useCallback(() => {
    const map = mapRef.current;
    callouts.current.forEach((m) => m.remove());
    callouts.current = [];
    if (!map || !latest.current.satellite || map.getZoom() < CALLOUT_MIN_ZOOM) return;
    const bounds = map.getBounds();
    const inView = latest.current.homes.filter((h) => bounds.contains([h.lng, h.lat])).slice(0, CALLOUT_MAX);
    for (const home of inView) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "price-callout";
      const total = document.createElement("strong");
      total.textContent = `฿${compact(home.price)}`;
      el.append(total);
      const unit = unitPrice(home);
      if (unit) {
        const span = document.createElement("span");
        span.textContent = unit;
        el.append(span);
      }
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        showPopup(home);
      });
      callouts.current.push(new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -7] }).setLngLat([home.lng, home.lat]).addTo(map));
    }
  }, [showPopup]);

  // Our layers sit on top of whichever base style is loaded; a theme switch
  // replaces the style, so this runs again on every style.load.
  const addOverlays = useCallback((map: MlMap) => {
    const { point, radius, homes, satellite, mode } = latest.current;
    const dark = mode === "dark";
    // Insert above every road and fill but under the labels. The dark style
    // puts water names early, so "first symbol" would leave roads on top.
    const layers = map.getStyle().layers;
    const lastShape = layers.reduce((last, l, i) => (l.type === "symbol" ? last : i), -1);
    const firstSymbol = layers[lastShape + 1]?.id;

    try {
      map.setProjection({ type: "globe" });
      map.setSky({
        "sky-color": dark ? "#050a24" : "#bcd3ff",
        "horizon-color": dark ? "#1d2f7a" : "#e8efff",
        "fog-color": dark ? "#04061a" : "#eef2ff",
        "sky-horizon-blend": 0.6,
        "horizon-fog-blend": 0.5,
        "fog-ground-blend": 0.4,
        "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 0.6, 10, 0],
      });
    } catch {
      // Older GPUs / drivers: a flat map is fine.
    }

    // Flat building footprints give way to the extruded ones.
    for (const l of map.getStyle().layers) {
      if ("source-layer" in l && l["source-layer"] === "building") map.setLayoutProperty(l.id, "visibility", "none");
    }

    map.addSource("satellite", {
      type: "raster",
      tiles: [SATELLITE_TILES],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
    });
    map.addLayer(
      { id: "satellite", type: "raster", source: "satellite", layout: { visibility: satellite ? "visible" : "none" } },
      firstSymbol,
    );

    map.addLayer(
      {
        id: "buildings-3d",
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 12,
        layout: { visibility: satellite ? "none" : "visible" },
        paint: {
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "render_height"], 0],
            0,
            dark ? "#18214a" : "#d9def5",
            40,
            dark ? "#2a3f8c" : "#a5b4fc",
            150,
            dark ? "#5eeaff" : "#6366f1",
          ],
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.88,
        },
      },
      firstSymbol,
    );

    map.addSource("pick", { type: "geojson", data: pickData(point, radius) });
    map.addLayer({ id: "radius-fill", type: "fill", source: "pick", filter: ["==", "$type", "Polygon"], paint: { "fill-color": RADIUS, "fill-opacity": 0.08 } });
    map.addLayer({
      id: "radius-line",
      type: "line",
      source: "pick",
      filter: ["==", "$type", "Polygon"],
      paint: { "line-color": RADIUS, "line-width": 1.5, "line-dasharray": [2, 2] },
    });

    map.addSource("homes", { type: "geojson", data: homesData(homes) });
    map.addLayer({
      id: "homes-glow",
      type: "circle",
      source: "homes",
      paint: { "circle-color": HOME, "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 4, 16, 14], "circle-opacity": 0.18, "circle-blur": 1 },
    });
    map.addLayer({
      id: "homes",
      type: "circle",
      source: "homes",
      paint: {
        "circle-color": HOME,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 1.8, 16, 6],
        "circle-stroke-color": "#0b0f24",
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 9, 0, 14, 1.5],
      },
    });

    map.addLayer({
      id: "pick-point",
      type: "circle",
      source: "pick",
      filter: ["==", "$type", "Point"],
      paint: { "circle-color": PICK, "circle-radius": 7, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 },
    });
  }, []);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const start = latest.current.point;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLES[latest.current.mode],
      center: start ? [start.lng, start.lat] : BANGKOK,
      zoom: start ? 15 : 1.6,
      pitch: start ? 50 : 0,
      maxPitch: 75,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");

    let introDone = !!start;
    map.on("style.load", () => {
      addOverlays(map);
      refreshCallouts();
      if (!introDone) {
        introDone = true;
        if (reducedMotion()) map.jumpTo(OVERVIEW);
        else map.flyTo({ ...OVERVIEW, duration: 5000, essential: true });
      }
    });

    map.on("click", (e) => {
      const hit = map.getLayer("homes") ? map.queryRenderedFeatures(e.point, { layers: ["homes"] })[0] : undefined;
      const home = hit && homesById.current.get(String(hit.properties?.id));
      if (home) {
        showPopup(home);
        return;
      }
      latest.current.onPick(e.lngLat.lat, e.lngLat.lng);
      setSatellite(true);
      const target = { center: e.lngLat, zoom: Math.max(map.getZoom(), 16.5), pitch: 45 };
      if (reducedMotion()) map.jumpTo(target);
      else map.flyTo({ ...target, duration: 1800, essential: true });
    });
    map.on("mouseenter", "homes", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "homes", () => (map.getCanvas().style.cursor = ""));
    map.on("moveend", refreshCallouts);

    return () => {
      callouts.current.forEach((m) => m.remove());
      callouts.current = [];
      map.remove();
      mapRef.current = undefined;
    };
  }, [addOverlays, refreshCallouts, showPopup]);

  // Theme switch: swap the base style; style.load re-adds our layers.
  const firstMode = useRef(mode);
  useEffect(() => {
    if (mode === firstMode.current) return;
    firstMode.current = mode;
    mapRef.current?.setStyle(STYLES[mode], { diff: false });
  }, [mode]);

  useEffect(() => {
    (mapRef.current?.getSource("pick") as GeoJSONSource | undefined)?.setData(pickData(point, radius));
  }, [point, radius]);

  useEffect(() => {
    homesById.current = new Map(homes.map((h) => [h.id, h]));
    (mapRef.current?.getSource("homes") as GeoJSONSource | undefined)?.setData(homesData(homes));
    refreshCallouts();
  }, [homes, refreshCallouts]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getLayer("satellite")) {
      map.setLayoutProperty("satellite", "visibility", satellite ? "visible" : "none");
      map.setLayoutProperty("buildings-3d", "visibility", satellite ? "none" : "visible");
    }
    refreshCallouts();
  }, [satellite, refreshCallouts]);

  const overview = () => {
    setSatellite(false);
    popup.current?.remove();
    if (reducedMotion()) mapRef.current?.jumpTo(OVERVIEW);
    else mapRef.current?.flyTo({ ...OVERVIEW, duration: 2200, essential: true });
  };

  const toggleBtn = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-all ${
      active ? "bg-accent/20 text-accent shadow-[0_0_12px_-4px_rgb(var(--c-glow))]" : "text-muted hover:text-ink"
    }`;

  return (
    <div className={`relative overflow-hidden ${height}`}>
      {/* Sized by h-full, not inset: MapLibre sets position: relative on it. */}
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute right-3 top-3 flex gap-1 rounded-xl border border-line/70 bg-surface/80 p-1 backdrop-blur-md">
        <button type="button" onClick={() => setSatellite(false)} aria-pressed={!satellite} className={toggleBtn(!satellite)}>
          <Box className="h-3.5 w-3.5" /> 3D
        </button>
        <button type="button" onClick={() => setSatellite(true)} aria-pressed={satellite} className={toggleBtn(satellite)}>
          <Satellite className="h-3.5 w-3.5" /> ดาวเทียม
        </button>
        <button type="button" onClick={overview} className={toggleBtn(false)} title="กลับมุมกว้าง">
          <Globe className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg border border-line/70 bg-surface/80 px-2.5 py-2 text-[11px] text-muted backdrop-blur-md">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: HOME, boxShadow: `0 0 6px ${HOME}` }} />
          บ้านมือสอง {homes.length.toLocaleString()} หลัง
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full border border-white" style={{ background: PICK }} />
          จุดที่เลือก · รัศมี {radius / 1000} กม.
        </span>
        {satellite && <span className="text-faint">ซูมใกล้เพื่อดูป้ายราคา</span>}
      </div>
    </div>
  );
}
