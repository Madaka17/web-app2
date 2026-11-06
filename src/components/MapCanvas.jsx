import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import L from 'leaflet';
import { useLang } from '../i18n.jsx';
import { clusterByCell, escapeHtml, pinColor, safeHttpUrl } from '../lib/mapData';

// Tile layers for each base map. A base map is one or more layers shown together.
const ESRI_ATTRIBUTION = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
const ESRI_IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const BASE_LAYERS = {
  hybrid: [
    { url: ESRI_IMAGERY, attribution: ESRI_ATTRIBUTION },
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', attribution: ESRI_ATTRIBUTION },
  ],
  satellite: [{ url: ESRI_IMAGERY, attribution: ESRI_ATTRIBUTION }],
  street: [{ url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }],
  terrain: [{ url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' }],
};

function tileLayers(baseMap) {
  return (BASE_LAYERS[baseMap] ?? BASE_LAYERS.hybrid).map(({ url, attribution }) =>
    L.tileLayer(url, { attribution, maxZoom: 18, subdomains: 'abc' }));
}

// Popup HTML. Every scraped string passes escapeHtml; links pass safeHttpUrl first.
function popupHtml(point, t) {
  const place = escapeHtml(`${point.district} · ${point.province}`);
  if (point.kind === 'listing') {
    const image = safeHttpUrl(point.image);
    const href = safeHttpUrl(point.url);
    const area = point.area == null ? '' : `<div>${escapeHtml(`${Math.round(point.area).toLocaleString('en-US')} ${t('sqm')}`)}</div>`;
    return `<div style="width:220px">`
      + (image ? `<img src="${escapeHtml(image)}" alt="" width="220" loading="lazy" referrerpolicy="no-referrer" style="display:block;width:220px;height:auto;border-radius:8px" />` : '')
      + `<div style="margin-top:6px;font-weight:700">${escapeHtml(point.title)}</div>`
      + `<div>${place}</div>`
      + `<div style="color:#d32f2f;font-weight:700">${escapeHtml(`฿${point.price.toLocaleString('en-US')}`)}</div>`
      + area
      + (href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('openListing'))}</a>` : '')
      + `</div>`;
  }
  return `<div style="min-width:180px">`
    + `<div style="font-weight:700">${escapeHtml(point.name)}</div>`
    + `<div>${escapeHtml(point.grade)}</div>`
    + `<div>${place}</div>`
    + `<div>${escapeHtml(t('medianPrice'))}: <span style="color:#d32f2f;font-weight:700">${escapeHtml(`฿${point.price.toLocaleString('en-US')}`)}</span></div>`
    + `<div>${escapeHtml(`${point.n.toLocaleString('en-US')} ${t('listings')}`)}</div>`
    + `</div>`;
}

const CLUSTER_CELL_PX = 48;
const CLUSTER_MIN = 3;
const CLUSTER_MAX_ZOOM = 17;

function renderPoints(map, group, points, { onDot, clusterTitle }) {
  group.clearLayers();
  const zoom = map.getZoom();
  const bounds = map.getBounds().pad(0.25);
  const inView = points.filter((p) => bounds.contains([p.lat, p.lng]));
  const clusters = clusterByCell(inView, (p) => map.project([p.lat, p.lng], zoom), CLUSTER_CELL_PX);
  clusters.forEach(({ lat, lng, items }) => {
    if (items.length >= CLUSTER_MIN && zoom < CLUSTER_MAX_ZOOM) {
      const size = Math.min(46, 30 + items.length * 0.7);
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({ className: '', html: `<div class="map-cluster" style="width:${size}px;height:${size}px;font-size:${size > 40 ? 15 : 14}px">${items.length}</div>`, iconSize: [size, size] }),
        title: clusterTitle(items.length),
        keyboard: true,
      });
      marker.on('click', () => map.flyTo([lat, lng], Math.min(18, zoom + 2), { duration: 0.5 }));
      group.addLayer(marker);
      return;
    }
    items.forEach((point) => {
      const marker = L.marker([point.lat, point.lng], {
        icon: L.divIcon({ className: '', html: `<div class="map-dot" style="background:${pinColor(point)}"></div>`, iconSize: [18, 18] }),
        title: point.kind === 'listing' ? point.title : point.name,
        keyboard: true,
      });
      marker.on('click', () => onDot(point, marker));
      group.addLayer(marker);
    });
  });
}

const MapCanvas = forwardRef(function MapCanvas({ mode, points, baseMap, cityPlan, measuring, focus, target, onPick, onSelectPoint }, ref) {
  const { t } = useLang();
  const box = useRef(null);
  const mapRef = useRef(null);
  const groupRef = useRef(null);
  const baseRef = useRef(null);
  const planRef = useRef(null);
  const targetRef = useRef(null);
  const pointsRef = useRef(points);
  const modeRef = useRef(mode);
  const tRef = useRef(t);
  const callbacksRef = useRef({ onPick, onSelectPoint });
  const measureRef = useRef({ points: [], layer: null });
  const measuringRef = useRef(measuring);
  callbacksRef.current = { onPick, onSelectPoint };

  const redraw = () => {
    const map = mapRef.current;
    if (!map || !groupRef.current) return;
    // Points are empty until a mode is chosen; the original shows no markers then.
    const current = modeRef.current ? pointsRef.current : [];
    renderPoints(map, groupRef.current, current, {
      clusterTitle: (n) => `${n} ${tRef.current(modeRef.current === 'future' ? 'projects' : 'listings')}`,
      onDot: (point, marker) => {
        marker.unbindPopup();
        marker.bindPopup(popupHtml(point, tRef.current)).openPopup();
        callbacksRef.current.onSelectPoint?.(point);
      },
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
    const map = L.map(box.current, { zoomControl: false, attributionControl: true, center: [13.752, 100.52], zoom: 12, minZoom: 6, maxZoom: 18 });
    mapRef.current = map;
    map.createPane('target');
    map.getPane('target').style.zIndex = 650;
    baseRef.current = L.layerGroup().addTo(map);
    L.control.scale({ metric: true, imperial: false, maxWidth: 100, position: 'bottomleft' }).addTo(map);
    map.getContainer().querySelector('.leaflet-bottom.leaflet-left')?.classList.add('map-scale--stats-open');
    groupRef.current = L.layerGroup().addTo(map);
    map.on('moveend zoomend', redraw);
    map.on('click', (event) => {
      if (!measuringRef.current) {
        // The mode picker covers the map until a mode is chosen, so a click picks nothing then.
        if (modeRef.current) callbacksRef.current.onPick?.(event.latlng.lat, event.latlng.lng);
        return;
      }
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
    const group = baseRef.current;
    if (!group) return;
    group.clearLayers();
    tileLayers(baseMap).forEach((layer) => group.addLayer(layer));
  }, [baseMap]);

  useEffect(() => {
    pointsRef.current = points;
    modeRef.current = mode;
    tRef.current = t;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, mode, t]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    targetRef.current?.remove();
    targetRef.current = null;
    if (target) {
      targetRef.current = L.circleMarker([target.lat, target.lng], {
        pane: 'target', interactive: false, radius: 9, color: '#fff', weight: 3, fillColor: '#d32f2f', fillOpacity: 1,
      }).addTo(map);
    }
  }, [target]);

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
