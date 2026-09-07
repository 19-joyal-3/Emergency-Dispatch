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
