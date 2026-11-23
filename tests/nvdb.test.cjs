const assert = require('node:assert/strict');
const { parseWkt, categoryFor, errorFromResponse } = require('../nvdb.js');

const tests = [
  ['converts NVDB SRID 4326 WKT axis order to GeoJSON longitude, latitude', () => {
    const geometry = parseWkt({ srid:4326, wkt:'LINESTRING Z (58.3308 8.2323 12, 58.331 8.233 14)' });
    assert.deepEqual(geometry, { type:'LineString', coordinates:[[8.2323,58.3308],[8.233,58.331]] });
  }],
  ['converts every line in a MULTILINESTRING', () => {
    const geometry = parseWkt({ srid:4326, wkt:'MULTILINESTRING ((58.33 8.23,58.34 8.24),(58.35 8.25,58.36 8.26))' });
    assert.deepEqual(geometry.coordinates, [[[8.23,58.33],[8.24,58.34]],[[8.25,58.35],[8.26,58.36]]]);
  }],
  ['rejects invalid coordinates and unsupported SRIDs before drawing', () => {
    assert.equal(parseWkt({ srid:4326, wkt:'LINESTRING Z (158.33 8.23 12,158.34 8.24 13)' }), null);
    assert.equal(parseWkt({ srid:4326, wkt:'LINESTRING Z (58.33 8.23 12,NaN 8.24 13)' }), null);
    assert.throws(() => parseWkt({ srid:25833, wkt:'LINESTRING (58 8,59 9)' }), /SRID 25833/);
  }],
  ['identifies all supported NVDB road categories', () => {
    const expected = { S:'Skogsbilveg', P:'Privat veg', K:'Kommunal veg', F:'Fylkesveg', R:'Riksveg', E:'Europaveg' };
    for (const [code, name] of Object.entries(expected)) {
      assert.deepEqual(categoryFor({ vegsystemreferanse:{ vegsystem:{ vegkategori:code } } }), { categoryCode:code, roadCategory:name });
    }
  }],
  ['turns an API error response into the displayed HTTP error', async () => {
    const error = await errorFromResponse({ status:400, text:async () => 'invalid query parameter' });
    assert.equal(error.message, 'NVDB svarte med HTTP 400: invalid query parameter');
  }]
];

async function runTests() {
  for (const [name, run] of tests) {
    await run();
    if (typeof process !== 'undefined' && process.stdout) process.stdout.write(`PASS ${name}\n`);
  }
  return { passed:tests.length, failed:0 };
}

if (require.main === module) {
  runTests().then(result => process.stdout.write(`${result.passed} tests passed\n`)).catch(error => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { runTests };
