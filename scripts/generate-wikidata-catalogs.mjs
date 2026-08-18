#!/usr/bin/env node
/*
 * Generates browser-static catalog chunks from Wikidata. It deliberately runs
 * outside the app: GitHub Pages never makes a third-party request at runtime.
 *
 * Usage:
 *   npm run catalogs:generate
 *   node scripts/generate-wikidata-catalogs.mjs --catalog movies --limit 10000
 *   node scripts/generate-wikidata-catalogs.mjs --catalog foods --batch-size 100
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'public', 'catalogs');
const ENDPOINT = process.env.WIKIDATA_ENDPOINT ?? 'https://query.wikidata.org/sparql';
const args = Object.fromEntries(process.argv.slice(2).map((arg, i, all) => arg.startsWith('--') ? [arg.slice(2), all[i + 1]?.startsWith('--') ? 'true' : all[i + 1]] : []).filter(Boolean));
const limit = Number(args.limit ?? process.env.CATALOG_LIMIT ?? 10_000);
const batchSize = Number(args['batch-size'] ?? process.env.CATALOG_BATCH_SIZE ?? 100);
const only = args.catalog ? new Set(String(args.catalog).split(',')) : null;
const imdbRatingsPath = args['imdb-ratings'] ?? process.env.IMDB_RATINGS_PATH;

// QIDs are intentionally conservative, documented roots. Adjust this config
// rather than changing query code when catalog policy changes.
const CATALOGS = [
  { id: 'movies', name: 'All Movies', roots: ['Q11424'], note: 'films', imdb: true },
  { id: 'television', name: 'All TV Shows', roots: ['Q5398426'], note: 'television series', imdb: true },
  { id: 'games', name: 'All Video Games', roots: ['Q7889'], note: 'video games', imdb: true },
  // Deliberately limited to things that are normally consumed on their own.
  // This excludes broad food, ingredient, plant, and taxonomic roots.
  { id: 'foods', name: 'All Foods', roots: ['Q746549', 'Q1316209', 'Q182940', 'Q749316', 'Q40050'], note: 'dishes, street foods, desserts, snacks, and beverages', directInstances: true },
].filter(c => !only || only.has(c.id));

if (!CATALOGS.length) throw new Error(`No matching catalogs. Use: movies, television, games, foods.`);
if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(batchSize) || batchSize < 1) throw new Error('limit and batch-size must be positive integers.');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sparql = (catalog, root, rootLimit) => `
SELECT ?item ?label ?sitelinks ?imdb WHERE {
  ?item wdt:P31${catalog.directInstances ? '' : '/wdt:P279*'} wd:${root} ; wikibase:sitelinks ?sitelinks ; rdfs:label ?label .
  ${catalog.imdb ? 'OPTIONAL { ?item wdt:P345 ?imdb . }' : ''}
  FILTER(LANG(?label) = "en")
}
ORDER BY DESC(?sitelinks) ?item
LIMIT ${rootLimit}`;

async function request(query) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${ENDPOINT}?${new URLSearchParams({ query, format: 'json' })}`, {
      headers: { accept: 'application/sparql-results+json', 'user-agent': 'StackrankCatalogGenerator/0.1 (offline catalog build)' },
    });
    if (response.ok) return response.json();
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 4) throw new Error(`Wikidata query failed: HTTP ${response.status} ${await response.text()}`);
    await sleep(2_000 * (attempt + 1));
  }
}
async function overrides(id) {
  try { return JSON.parse(await readFile(resolve(ROOT, 'catalog-overrides', `${id}.json`), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { include: [], excludeQids: [] }; throw error; }
}
async function imdbVotes(ids) {
  if (!imdbRatingsPath || !ids.size) return new Map();
  const rows = await readFile(resolve(imdbRatingsPath), 'utf8'); const votes = new Map();
  for (const line of rows.split(/\r?\n/)) { const [id, , count] = line.split('\t'); if (ids.has(id)) votes.set(id, Number(count)); }
  return votes;
}
const cleanName = value => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
async function igdbSignals() {
  if (!process.env.IGDB_CLIENT_ID || !process.env.IGDB_ACCESS_TOKEN) return new Map();
  const response = await fetch('https://api.igdb.com/v4/games', { method: 'POST', headers: { 'client-id': process.env.IGDB_CLIENT_ID, authorization: `Bearer ${process.env.IGDB_ACCESS_TOKEN}` }, body: 'fields name,total_rating_count,rating_count,aggregated_rating_count,follows,hypes; where category = 0; sort total_rating_count desc; limit 500;' });
  if (!response.ok) throw new Error(`IGDB query failed: HTTP ${response.status}`);
  const values = await response.json(); return new Map(values.map(game => [cleanName(game.name), (game.total_rating_count ?? 0) + (game.follows ?? 0) * .1 + (game.hypes ?? 0) * .1]));
}
async function normalize(results, custom, catalog) {
  const excluded = new Set(custom.excludeQids ?? []); const seenQids = new Set(); const seenLabels = new Set();
  const generated = results.flatMap(result => result.results.bindings).map(row => ({
    qid: row.item.value.split('/').pop(),
    label: row.label.value.trim(), sitelinks: Number(row.sitelinks.value), imdbId: row.imdb?.value, source: 'wikidata',
  }));
  const votes = catalog.imdb ? await imdbVotes(new Set(generated.map(item => item.imdbId).filter(Boolean))) : new Map();
  const igdb = catalog.igdb ? await igdbSignals() : new Map();
  for (const entry of generated) { entry.imdbVotes = votes.get(entry.imdbId) ?? 0; entry.igdbEngagement = igdb.get(cleanName(entry.label)) ?? 0; entry.popularityScore = entry.sitelinks + Math.log10(entry.imdbVotes + 1) * 10 + Math.log10(entry.igdbEngagement + 1) * 10; }
  generated.sort((a, b) => b.popularityScore - a.popularityScore || a.label.localeCompare(b.label));
  return [...(custom.include ?? []), ...generated].filter(item => {
    const key = item.label.toLocaleLowerCase();
    if (!item.qid || !item.label || excluded.has(item.qid) || seenQids.has(item.qid) || seenLabels.has(key)) return false;
    seenQids.add(item.qid); seenLabels.add(key); return true;
  }).slice(0, limit);
}
async function catalogQueries(catalog) {
  const results = [];
  const rootLimit = Math.ceil(limit / catalog.roots.length) + 250;
  for (const root of catalog.roots) {
    results.push(await request(sparql(catalog, root, rootLimit)));
    await sleep(250);
  }
  return results;
}
async function generate(catalog) {
  console.log(`Fetching ${catalog.name} (up to ${limit.toLocaleString()} items)…`);
  const [data, custom] = await Promise.all([catalogQueries(catalog), overrides(catalog.id)]);
  const items = await normalize(data, custom, catalog);
  const dir = resolve(OUT, catalog.id); await rm(dir, { recursive: true, force: true }); await mkdir(dir, { recursive: true });
  const version = new Date().toISOString().slice(0, 10);
  const chunks = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const file = `${String(i / batchSize + 1).padStart(3, '0')}.json`; const chunk = items.slice(i, i + batchSize);
    await writeFile(resolve(dir, file), JSON.stringify({ catalogId: catalog.id, index: i / batchSize, items: chunk }, null, 2) + '\n');
    chunks.push({ file, count: chunk.length });
  }
  const manifest = { id: catalog.id, name: catalog.name, description: `Wikidata-derived catalog of ${catalog.note}.`, source: 'Wikidata Query Service', generatedAt: new Date().toISOString(), version, totalItems: items.length, batchSize, chunks, inclusionRoots: catalog.roots, overrides: { included: (custom.include ?? []).length, excluded: (custom.excludeQids ?? []).length } };
  await writeFile(resolve(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`  wrote ${items.length.toLocaleString()} items in ${chunks.length} chunks to public/catalogs/${catalog.id}`);
}

await mkdir(OUT, { recursive: true });
for (const catalog of CATALOGS) await generate(catalog);
