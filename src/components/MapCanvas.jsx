import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import L from 'leaflet';
import { FUTURE_LEGEND, FUTURE_POINTS, LAND_LEGEND, LAND_POINTS, LISTINGS, PLACE_LABELS, RAIL_LINES, RIVER, ROADS } from '../data.js';

// A drawn, invented base map. It never loads the original's map pictures or key.
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  return (noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.27 + noise(x * 4.3, y * 4.3) * 0.18);
}

const CENTERS = [[13.75, 100.56, 0.2], [13.0, 101.0, 0.14], [7.93, 98.33, 0.08], [16.43, 102.83, 0.1]];
const PALETTES = {
  hybrid: { farm: [[64, 83, 60], [98, 107, 76], [50, 68, 44]], city: [[103, 102, 85], [77, 87, 74], [98, 98, 104]], road: '#c9b98b', highway: '#b8a878', water: '#2c362e' },
  satellite: { farm: [[50, 66, 36], [92, 96, 60], [32, 50, 30]], city: [[104, 100, 92], [130, 124, 112], [70, 68, 62]], road: '#6f6b60', highway: '#7a7568', water: '#16262a' },
  traffic: { farm: [[64, 83, 60], [98, 107, 76], [50, 68, 44]], city: [[103, 102, 85], [77, 87, 74], [98, 98, 104]], road: '#35c46a', highway: '#e0483f', water: '#1d2f2c' },
  terrain: { farm: [[198, 212, 176], [226, 226, 200], [176, 198, 158]], city: [[226, 222, 214], [238, 234, 226], [210, 206, 198]], road: '#ffffff', highway: '#f6d98a', water: '#9cc6dc' },
};

function colorAt(map, palette, zoom, tile, px, py) {
  const sx = (tile.x * 256 + px);
  const sy = (tile.y * 256 + py);
  const scale = 2 ** (zoom - 12);
  const wx = sx / scale;
  const wy = sy / scale;
  const point = map.unproject([sx, sy], zoom);
  let urban = 0;
  for (const [lat, lng, reach] of CENTERS) {
    const d = Math.hypot(point.lat - lat, (point.lng - lng) * 0.95);
    urban = Math.max(urban, 1 - d / (reach * 1.8));
  }
  const large = fbm(wx / 95, wy / 95);
  const small = fbm(wx / 11, wy / 11);
  const fine = hash(Math.floor(sx / 4), Math.floor(sy / 4));
  urban = Math.min(1, Math.max(0, urban + (large - 0.5) * 0.9));
  const set = urban > 0.32 ? palette.city : palette.farm;
  const k = small * 2;
  const i = Math.min(2, Math.floor(k * 1.5));
  const base = set[i];
  const shade = 0.82 + fine * 0.3;
  return [base[0] * shade, base[1] * shade, base[2] * shade];
}

function makeTileLayer(paletteRef) {
  const Layer = L.GridLayer.extend({
    createTile(coords) {
      const tile = document.createElement('canvas');
      tile.width = 256;
      tile.height = 256;
      const map = this._map;
      const palette = PALETTES[paletteRef.current] || PALETTES.hybrid;
      const ctx = tile.getContext('2d');
      const step = 4;
      for (let y = 0; y < 256; y += step) {
        for (let x = 0; x < 256; x += step) {
          const [r, g, b] = colorAt(map, palette, coords.z, coords, x, y);
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
          ctx.fillRect(x, y, step, step);
        }
      }
      const toTile = (latlng) => {
        const p = map.project(latlng, coords.z);
        return [p.x - coords.x * 256, p.y - coords.y * 256];
      };
      const stroke = (points, color, width) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        points.forEach((latlng, i) => {
          const [x, y] = toTile(latlng);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      };
      const zoomScale = 2 ** Math.max(0, coords.z - 12);
      stroke(RIVER, palette.water, Math.min(40, 9 * zoomScale));
      ROADS.forEach((road) => stroke(road, palette.highway, Math.min(10, 2.2 * zoomScale)));
      RAIL_LINES.forEach((line) => stroke(line.points, line.color, 3));
      if (paletteRef.current !== 'satellite' && coords.z >= 10) {
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        PLACE_LABELS.forEach((label) => {
          if (coords.z < 12 && label.size < 16) return;
          const [x, y] = toTile([label.lat, label.lng]);
          if (x < -160 || x > 416 || y < -60 || y > 316) return;
          const draw = (text, size, dy) => {
            ctx.font = `500 ${size}px Inter, system-ui, sans-serif`;
            ctx.strokeStyle = 'rgba(0,0,0,.75)';
            ctx.lineWidth = 3;
            ctx.fillStyle = '#ffffff';
            ctx.strokeText(text, x, y + dy);
            ctx.fillText(text, x, y + dy);
          };
          draw(label.text, label.size, 0);
          draw(label.sub, Math.max(11, label.size - 2), label.size);
        });
      }
      const image = document.createElement('img');
      image.alt = '';
      image.width = 256;
      image.height = 256;
      image.src = tile.toDataURL('image/jpeg', 0.82);
      return image;
    },
  });
  return new Layer({ tileSize: 256, updateWhenIdle: false, keepBuffer: 2 });
}

function colorOfPoint(point, legendColors) {
  return legendColors[point.kind] || '#22d3ee';
}

function renderPoints(map, group, points, mode, onMarker) {
  group.clearLayers();
  const bounds = map.getBounds().pad(0.25);
  const zoom = map.getZoom();
  const reach = 36;
  const groups = [];
  points.forEach((point) => {
    if (!bounds.contains([point.lat, point.lng])) return;
    const p = map.project([point.lat, point.lng], zoom);
    const near = groups.find((g) => Math.abs(g.x - p.x) < reach && Math.abs(g.y - p.y) < reach);
    if (near) near.list.push(point);
    else groups.push({ x: p.x, y: p.y, lat: point.lat, lng: point.lng, list: [point] });
  });
  const colors = Object.fromEntries((mode === 'future' ? FUTURE_LEGEND : LAND_LEGEND).map(([k, c]) => [k, c]));
  groups.forEach(({ lat, lng, list }) => {
    if (list.length >= 3 && zoom < 17) {
      const size = Math.min(46, 30 + list.length * 0.7);
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: `<div class="map-cluster" style="width:${size}px;height:${size}px;font-size:${size > 40 ? 15 : 14}px">${list.length}</div>`, iconSize: [size, size] }),
        title: `${list.length} listings`,
        keyboard: true,
      });
      marker.on('click', () => map.flyTo([lat, lng], Math.min(18, zoom + 2), { duration: 0.5 }));
      group.addLayer(marker);
    } else {
      list.forEach((point) => {
        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({ className: '', html: `<div class="map-dot" style="background:${colorOfPoint(point, colors)}"></div>`, iconSize: [18, 18] }),
          title: point.kind,
        });
        marker.on('click', () => onMarker(point, marker));
        group.addLayer(marker);
      });
    }
  });
}

const MapCanvas = forwardRef(function MapCanvas({ mode, baseMap, cityPlan, measuring, focus }, ref) {
  const box = useRef(null);
  const mapRef = useRef(null);
  const groupRef = useRef(null);
  const paletteRef = useRef(baseMap);
  const tileRef = useRef(null);
  const planRef = useRef(null);
  const modeRef = useRef(mode);
  const measureRef = useRef({ points: [], layer: null });
  const measuringRef = useRef(measuring);

  const redraw = () => {
    const map = mapRef.current;
    if (!map) return;
    if (!modeRef.current) {
      // The original shows no markers until a mode is chosen.
      groupRef.current.clearLayers();
      return;
    }
    const points = modeRef.current === 'future' ? FUTURE_POINTS : LAND_POINTS;
    renderPoints(map, groupRef.current, points, modeRef.current, (point, marker) => {
      const pick = LISTINGS[Math.floor(point.r * 400)];
      const price = pick.price ? `฿${pick.price.toLocaleString('en-US')}` : '';
      marker.unbindPopup();
      marker.bindPopup(`<strong>${pick.code}</strong><br/>${pick.province} · ${pick.district}<br/><span style="color:#d32f2f;font-weight:700">${price}</span>`).openPopup();
    });
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    flyTo: (latlng, zoom) => mapRef.current?.flyTo(latlng, zoom ?? mapRef.current.getZoom(), { duration: 0.8 }),
    locate: () => {
      const map = mapRef.current;
      if (!map) return;
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((pos) => map.flyTo([pos.coords.latitude, pos.coords.longitude], 14));
    },
  }));

  useEffect(() => {
    const map = L.map(box.current, { zoomControl: false, attributionControl: false, center: [13.752, 100.52], zoom: 12, minZoom: 6, maxZoom: 18 });
    mapRef.current = map;
    const tiles = makeTileLayer(paletteRef);
    tiles.addTo(map);
    tileRef.current = tiles;
    L.control.scale({ metric: true, imperial: false, maxWidth: 100, position: 'bottomleft' }).addTo(map);
    map.getContainer().querySelector('.leaflet-bottom.leaflet-left')?.classList.add('map-scale--stats-open');
    groupRef.current = L.layerGroup().addTo(map);
    map.on('moveend zoomend', redraw);
    map.on('click', (event) => {
      if (!measuringRef.current) return;
      const m = measureRef.current;
      m.points = m.points.length === 2 ? [event.latlng] : [...m.points, event.latlng];
      if (m.layer) m.layer.remove();
      m.layer = L.layerGroup().addTo(map);
      m.points.forEach((p) => L.circleMarker(p, { radius: 5, color: '#fff', fillColor: '#d32f2f', fillOpacity: 1, weight: 2 }).addTo(m.layer));
      if (m.points.length === 2) {
        const metres = m.points[0].distanceTo(m.points[1]);
        L.polyline(m.points, { color: '#d32f2f', weight: 3 }).addTo(m.layer)
          .bindTooltip(metres > 1000 ? `${(metres / 1000).toFixed(2)} km` : `${metres | 0} m`, { permanent: true, direction: 'top' });
      }
    });
    redraw();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(box.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // The map is created once. Later changes arrive through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    modeRef.current = mode;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    paletteRef.current = baseMap;
    tileRef.current?.redraw();
  }, [baseMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (cityPlan && !planRef.current) {
      planRef.current = L.layerGroup([
        L.polygon([[13.8, 100.47], [13.8, 100.56], [13.72, 100.56], [13.72, 100.47]], { color: '#f59e0b', weight: 1, fillOpacity: 0.22, interactive: false }),
        L.polygon([[13.72, 100.56], [13.72, 100.66], [13.65, 100.66], [13.65, 100.56]], { color: '#ef4444', weight: 1, fillOpacity: 0.22, interactive: false }),
        L.polygon([[13.8, 100.56], [13.8, 100.68], [13.72, 100.68], [13.72, 100.56]], { color: '#10b981', weight: 1, fillOpacity: 0.22, interactive: false }),
      ]).addTo(map);
    } else if (!cityPlan && planRef.current) {
      planRef.current.remove();
      planRef.current = null;
    }
  }, [cityPlan]);

  useEffect(() => {
    measuringRef.current = measuring;
    if (!measuring && measureRef.current.layer) {
      measureRef.current.layer.remove();
      measureRef.current = { points: [], layer: null };
    }
  }, [measuring]);

  useEffect(() => {
    if (focus && mapRef.current) mapRef.current.setView([focus.lat, focus.lng], 15);
  }, [focus]);

  return <div ref={box} className="leaflet-grab" style={{ height: '100%', width: '100%', position: 'relative' }} tabIndex={0} />;
});

export default MapCanvas;
