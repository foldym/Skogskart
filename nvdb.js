(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NvdbGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // NVDB uses latitude, longitude order in WKT for SRID 4326. Leaflet GeoJSON
  // expects longitude, latitude, so every coordinate is deliberately swapped.
  function parseWkt(geometry) {
    if (!geometry || typeof geometry !== 'object') return null;
    if (geometry.type && Array.isArray(geometry.coordinates)) {
      if (Number(geometry.srid || 4326) !== 4326) throw new Error(`Uventet GeoJSON-SRID ${geometry.srid}`);
      return validateGeometry(geometry);
    }
    const wkt = geometry.wkt || geometry.verdi || geometry.value;
    if (typeof wkt !== 'string') return null;
    const srid = Number(geometry.srid || 4326);
    if (srid !== 4326) throw new Error(`NVDB returnerte SRID ${srid}, ikke 4326.`);
    const match = wkt.trim().match(/^(LINESTRING|MULTILINESTRING)\s*(?:Z|M|ZM)?\s*/i);
    if (!match) return null;
    const type = match[1].toUpperCase();
    const body = wkt.trim().slice(match[0].length);
    let rawLines;
    if (type === 'LINESTRING') {
      const inner = body.trim().replace(/^\(/, '').replace(/\)$/, '');
      rawLines = [inner];
    } else {
      const inner = body.trim().replace(/^\(/, '').replace(/\)$/, '');
      rawLines = inner.match(/\([^()]*\)/g)?.map(line => line.slice(1, -1)) || [];
    }
    const lines = rawLines.map(line => {
      const pairs = line.split(',').map(pair => {
        const values = pair.trim().split(/\s+/).map(Number);
        if (values.length < 2 || !Number.isFinite(values[0]) || !Number.isFinite(values[1])) return null;
        const [latitude, longitude] = values;
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
        return [longitude, latitude];
      });
      return pairs.length >= 2 && pairs.every(Boolean) ? pairs : null;
    });
    if (!lines.length || lines.some(line => !line)) return null;
    return validateGeometry({
      type: type === 'LINESTRING' ? 'LineString' : 'MultiLineString',
      coordinates: type === 'LINESTRING' ? lines[0] : lines
    });
  }

  function validateGeometry(geometry) {
    if (!geometry || !['LineString', 'MultiLineString'].includes(geometry.type)) return null;
    const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
    if (!Array.isArray(lines) || !lines.length) return null;
    for (const line of lines) {
      if (!Array.isArray(line) || line.length < 2) return null;
      for (const coordinate of line) {
        if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
        const [longitude, latitude] = coordinate;
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
      }
    }
    return geometry;
  }

  function categoryFor(segment) {
    const system = segment?.vegsystemreferanse?.vegsystem || {};
    const code = String(system.vegkategori || segment?.vegkategori || '').toUpperCase();
    const names = { S:'Skogsbilveg', P:'Privat veg', K:'Kommunal veg', F:'Fylkesveg', R:'Riksveg', E:'Europaveg' };
    return { categoryCode:code, roadCategory:names[code] || (code ? `Kategori ${code}` : 'Ukjent kategori') };
  }

  async function errorFromResponse(response) {
    const body = await response.text().catch(() => '');
    return new Error(`NVDB svarte med HTTP ${response.status}${body ? ': ' + body.slice(0, 180) : ''}`);
  }

  return { parseWkt, validateGeometry, categoryFor, errorFromResponse };
});
