const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

const WEATHER_LABELS = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Light rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Light rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail'
};

export async function fetchWeather(lat, lng, signal) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    hourly: 'precipitation_probability,precipitation',
    forecast_days: '1',
    timezone: 'auto'
  });
  const response = await fetch(`${WEATHER_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
  const data = await response.json();
  const current = data.current;
  const rainProbability = Math.max(...(data.hourly?.precipitation_probability || []).slice(0, 6), 0);
  return {
    temperature: Math.round(current.temperature_2m),
    humidity: Math.round(current.relative_humidity_2m),
    precipitation: current.precipitation,
    windSpeed: Math.round(current.wind_speed_10m),
    rainProbability,
    label: WEATHER_LABELS[current.weather_code] || 'Unknown conditions',
    weatherCode: current.weather_code,
    updatedAt: current.time,
    severity: current.weather_code >= 95 || rainProbability >= 80
      ? 'danger'
      : current.weather_code >= 51 || rainProbability >= 40
        ? 'caution'
        : 'safe'
  };
}

export const KERALA_DISTRICTS = [
  { id: 'tvm', name: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366, node: 'tvm' },
  { id: 'kollam', name: 'Kollam', lat: 8.8932, lng: 76.6141, node: 'kollam' },
  { id: 'pathanamthitta', name: 'Pathanamthitta', lat: 9.2648, lng: 76.7870, node: 'pathanamthitta' },
  { id: 'alappuzha', name: 'Alappuzha', lat: 9.4981, lng: 76.3388, node: 'alappuzha' },
  { id: 'kottayam', name: 'Kottayam', lat: 9.5916, lng: 76.5222, node: 'kottayam' },
  { id: 'idukki', name: 'Idukki', lat: 9.8500, lng: 76.9700, node: 'idukki' },
  { id: 'kochi', name: 'Ernakulam', lat: 9.9312, lng: 76.2673, node: 'kochi' },
  { id: 'thrissur', name: 'Thrissur', lat: 10.5276, lng: 76.2144, node: 'thrissur' },
  { id: 'palakkad', name: 'Palakkad', lat: 10.7867, lng: 76.6548, node: 'palakkad' },
  { id: 'malappuram', name: 'Malappuram', lat: 11.0722, lng: 76.0740, node: 'malappuram' },
  { id: 'kozhibode', name: 'Kozhikode', lat: 11.2588, lng: 75.7804, node: 'kozhibode' },
  { id: 'wayanad', name: 'Wayanad', lat: 11.6050, lng: 76.0830, node: 'wayanad' },
  { id: 'kannur', name: 'Kannur', lat: 11.8745, lng: 75.3704, node: 'kannur' },
  { id: 'kasaragod', name: 'Kasaragod', lat: 12.5103, lng: 74.9852, node: 'kasaragod' }
];

export async function fetchDistrictLiveAlerts(signal) {
  const lats = KERALA_DISTRICTS.map(d => d.lat.toFixed(4)).join(',');
  const lngs = KERALA_DISTRICTS.map(d => d.lng.toFixed(4)).join(',');
  
  const params = new URLSearchParams({
    latitude: lats,
    longitude: lngs,
    current: 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m',
    timezone: 'Asia/Kolkata'
  });

  const response = await fetch(`${WEATHER_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`District telemetry returned ${response.status}`);
  const data = await response.json();
  const results = Array.isArray(data) ? data : [data];

  return KERALA_DISTRICTS.map((district, idx) => {
    const cur = results[idx]?.current || {};
    const code = cur.weather_code ?? 0;
    const rain = Number(cur.precipitation ?? cur.rain ?? 0);
    const wind = Math.round(Number(cur.wind_speed_10m ?? 0));
    const gusts = Math.round(Number(cur.wind_gusts_10m ?? 0));
    const temp = Math.round(cur.temperature_2m ?? 28);
    const humidity = Math.round(cur.relative_humidity_2m ?? 80);

    let level = 'normal';
    let alertColor = '#22c55e';
    let label = '🟢 Normal';
    let condition = WEATHER_LABELS[code] || 'Clear';
    let isAlert = false;

    // Red Alert: Severe storms, torrential downpours (>15mm/h) or destructive gusts (>60km/h)
    if (code === 96 || code === 99 || rain >= 15.0 || gusts >= 60.0) {
      level = 'red';
      alertColor = '#ef4444';
      label = '🔴 Red Alert';
      condition = code >= 95 ? 'Severe Thunderstorm & Hail' : 'Torrential Downpour';
      isAlert = true;
    }
    // Orange Alert: Heavy rain (>4mm/h), squall gusts (>40km/h), or active thunderstorms
    else if (code === 95 || code === 82 || code === 65 || rain >= 4.0 || gusts >= 40.0) {
      level = 'orange';
      alertColor = '#f97316';
      label = '🟠 Orange Alert';
      condition = code === 95 ? 'Thunderstorm Warning' : 'Heavy Rain / Squall';
      isAlert = true;
    }
    // Yellow Alert: Moderate rain/drizzle (>0.1mm/h), high wind gusts (>25km/h), or active showers
    else if (code === 53 || code === 55 || code === 61 || code === 63 || code === 80 || code === 81 || code === 51 || rain >= 0.1 || gusts >= 25.0) {
      level = 'yellow';
      alertColor = '#eab308';
      label = '🟡 Yellow Alert';
      condition = (code >= 51 && code <= 55) ? 'Drizzle' : (code >= 80 ? 'Passing Showers' : (gusts >= 25.0 ? 'High Wind Gusts' : 'Light Rain'));
      isAlert = true;
    }

    const detail = isAlert
      ? `${condition} • Rain: ${rain.toFixed(1)}mm/h • Wind: ${wind}km/h (Gusts: ${gusts}km/h) • ${temp}°C`
      : `${condition} • ${temp}°C • Wind ${wind}km/h • Hum ${humidity}%`;

    return {
      ...district,
      center: [district.lat, district.lng],
      level,
      alertColor,
      label,
      condition,
      detail,
      isAlert,
      rain,
      wind,
      gusts,
      temp,
      humidity,
      code
    };
  });
}
