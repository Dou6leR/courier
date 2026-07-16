# Local OSRM

Public demo server `router.project-osrm.org` rate-limits requests to roughly
1 req/sec per IP — during a demo with auto-drive that triggers HTTP 429 almost
immediately. Run OSRM locally to remove the limit.

## One-time preparation

Download an OSM PBF that covers Lviv (Ukraine extract is the simplest choice):

```bash
cd osrm
mkdir -p data
curl -L https://download.geofabrik.de/europe/ukraine-latest.osm.pbf \
     -o data/ukraine-latest.osm.pbf
```

Extract + contract the graph for the MLD (multi-level Dijkstra) algorithm:

```bash
docker run --rm -v "$PWD/data:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/ukraine-latest.osm.pbf

docker run --rm -v "$PWD/data:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-partition /data/ukraine-latest.osrm

docker run --rm -v "$PWD/data:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-customize /data/ukraine-latest.osrm
```

This takes a few minutes the first time and produces the `*.osrm*` files under
`data/`. These files are the serving artefacts — the PBF itself is no longer
needed but is left in place for re-processing.

## Run the server

```bash
docker compose up -d
```

OSRM now listens on `http://localhost:5000`.

Quick sanity check:

```bash
curl "http://localhost:5000/route/v1/driving/24.0297,49.8397;24.0353,49.8360?overview=full&geometries=geojson"
```

## Point the frontend at it

In `frontend/.env.development` (or `.env.local`):

```
VITE_OSRM_URL=http://localhost:5000
```

Restart `npm run dev`. The OSRM helper in `frontend/src/lib/osrm.ts` picks up
this env at build time; all courier/client maps then route through the local
instance (and the in-memory LRU cache further reduces call volume).
