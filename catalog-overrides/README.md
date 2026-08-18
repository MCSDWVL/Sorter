# Catalog overrides

Optional JSON files named `movies.json`, `television.json`, `games.json`, or `foods.json` let editorial review correct generated Wikidata catalogs.

The Foods generator intentionally includes only direct instances of dishes, street foods, desserts, snacks, and beverages. It excludes ingredients, botanical taxa, and generic food classes by design.

```json
{
  "include": [
    { "qid": "Q123", "label": "An important missing title", "sitelinks": 0, "source": "editorial" }
  ],
  "excludeQids": ["Q456"]
}
```

Included entries appear first, in the order written. Excluded QIDs are removed from generated results. Do not put API keys or private data in this folder.
