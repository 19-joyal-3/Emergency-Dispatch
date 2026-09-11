const VALHALLA_URL = (import.meta.env.VITE_VALHALLA_URL || '').replace(/\/$/, '');

const decodePolyline6 = (encoded) => {
  const coordinates = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += (result & 1) ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += (result & 1) ? ~(result >> 1) : result >> 1;

    coordinates.push([latitude / 1e6, longitude / 1e6]);
  }

  return coordinates;
};

const getCosting = (transport) => {
  if (transport === 'walk') return 'pedestrian';
  if (transport === 'bus') return 'bus';
  return 'auto';
};

export const isValhallaConfigured = Boolean(VALHALLA_URL);

export async function requestValhallaRoute({
  start,
  end,
  nodeIds = [],
  transport = 'car',
  avoidLocations = [],
  signal
}) {
  if (!VALHALLA_URL) return null;

  const locations = [
    { lat: start.lat, lon: start.lng },
    { lat: end.lat, lon: end.lng }
  ];
  const request = {
    locations,
    costing: getCosting(transport),
    units: 'kilometers',
    directions_options: { units: 'kilometers' }
  };

  if (avoidLocations.length > 0) {
    request.exclude_locations = avoidLocations.map(({ lat, lng }) => ({
      lat,
      lon: lng
    }));
  }

  const response = await fetch(`${VALHALLA_URL}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal
  });
  if (!response.ok) {
    throw new Error(`Valhalla returned ${response.status}`);
  }

  const data = await response.json();
  const trip = data.trip;
  const leg = trip?.legs?.[0];
  if (!leg?.shape || !Array.isArray(leg.shape)) {
    throw new Error('Valhalla returned an invalid route');
  }

  const geometry = decodePolyline6(leg.shape);
  if (geometry.length < 2) {
    throw new Error('Valhalla returned an empty route geometry');
  }

  return {
    nodes: nodeIds,
    edges: [],
    geometry,
    distance: Number(trip.summary?.length ?? 0),
    timeSeconds: Number(trip.summary?.time ?? 0),
    travelTimeMinutes: Math.round(Number(trip.summary?.time ?? 0) / 60),
    source: 'valhalla'
  };
}
