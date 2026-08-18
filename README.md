# Stackrank

A static, local-first app for sorting lists using human comparison decisions.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` creates a deployable `dist` directory. Rankings are saved in the browser's IndexedDB; use the library export action for a portable backup.

## Catalogs

The four preset catalogs currently contain curated starter chunks to demonstrate the progressive-catalog flow. `src/catalogs.ts` is intentionally isolated so it can be replaced with generated, versioned Wikidata catalog chunks. The UI and persistence model do not impose a preset size limit.

Generate static Wikidata chunks with:

```sh
npm run catalogs:generate
```

This writes `public/catalogs/<catalog>/manifest.json` plus 100-item JSON chunks. It queries the public Wikidata Query Service, so it may take several minutes and can be rate-limited. Generate just one catalog or use a smaller review run with `node scripts/generate-wikidata-catalogs.mjs --catalog movies --limit 500`. Add editorial corrections in `catalog-overrides/` before regenerating.

## Optional popularity signals

Wikidata sitelinks are always available but are only a rough popularity proxy. The generator can blend in additional build-time-only signals:

- Movies, TV, and games: download IMDb's public `title.ratings.tsv.gz`, decompress it, then pass the resulting TSV path with `--imdb-ratings <path>` (or set `IMDB_RATINGS_PATH`). IMDb vote count is matched through Wikidata's IMDb ID property.
- Games: set `IGDB_CLIENT_ID` and `IGDB_ACCESS_TOKEN` before generating. The generator retrieves IGDB engagement/rating-count signals for its high-popularity main-game set and blends them with Wikidata coverage. These credentials are used only by the local generator and are never included in the static site.

Example:

```powershell
$env:IGDB_CLIENT_ID='…'
$env:IGDB_ACCESS_TOKEN='…'
node scripts/generate-wikidata-catalogs.mjs --catalog games --limit 10000
```
