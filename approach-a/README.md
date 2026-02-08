# Approach A — Mapbox GL + React

Interactive heat map of Ashland, OR real estate data using Mapbox GL JS and React.

## Setup

```bash
cd approach-a
npm install
```

### Mapbox Token

You need a free Mapbox access token. Get one at [mapbox.com](https://www.mapbox.com/).

**Option 1:** Create a `.env` file:
```
VITE_MAPBOX_TOKEN=pk.eyJ1...your_token_here
```

**Option 2:** Enter the token in the browser when prompted.

## Development

```bash
npm run dev
```

Opens at `http://localhost:5173`. The app loads parcel data from `../data/parcels.json`.

## Features

- 10,000+ parcels rendered as circle markers via Mapbox GL
- Color-coded by selectable metric ($/sqft, sale price, assessed value, year built, etc.)
- 7 color ramp options (Viridis, Inferno, Magma, Plasma, YlOrRd, Blues, RdYlGn)
- Opacity control
- Date range filter for sales
- Hover tooltip with key stats
- Click parcel for detail panel with sales history, price chart, permits, improvements
- Mobile-first responsive design (slide-up panel on mobile, side panel on desktop)

## Stack

- React 19 + Vite
- mapbox-gl + react-map-gl
- No additional UI libraries — lightweight CSS
