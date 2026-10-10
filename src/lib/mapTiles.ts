/**
 * OpenStreetMap tiles. In the dark (space) theme `.map-tiles` is inverted to a
 * night map in index.css - free night basemaps (CARTO) now need an API key.
 */
export const MAP_TILES = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  className: "map-tiles",
};

/** Marker colours that read on both the day and the night map. */
export const MAP_MARK = "#22d3ee";
export const MAP_MARK_ACTIVE = "#a78bfa";
