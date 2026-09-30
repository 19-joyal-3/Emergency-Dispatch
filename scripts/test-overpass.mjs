const query = `[out:json][timeout:25];
area["ISO3166-2"="IN-KL"]->.kerala;
(
  node["amenity"="hospital"](area.kerala);
);
out 10;`;

try {
  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'KeralaEmergencyDispatchApp/1.0 (contact: admin@vanguardgeo.org)'
    },
    body: 'data=' + encodeURIComponent(query)
  });
  if (!resp.ok) {
    console.log('HTTP status:', resp.status);
  } else {
    const data = await resp.json();
    console.log('Overpass connected successfully! Elements returned:', data.elements?.length);
    console.log('Sample element:', JSON.stringify(data.elements?.[0], null, 2));
  }
} catch (err) {
  console.log('Overpass connection error:', err.message);
}
