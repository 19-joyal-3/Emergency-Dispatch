import { evaluateStatewideHazardAI } from './aiPrediction';

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

export function getWeatherEmoji(code) {
  if (code >= 95) return '⛈️'; // Thunderstorm
  if (code >= 80) return '🌧️'; // Showers
  if (code >= 71) return '🌨️'; // Snow / Cold
  if (code >= 61) return '🌧️'; // Rain
  if (code >= 51) return '🌦️'; // Drizzle
  if (code === 45 || code === 48) return '🌫️'; // Fog / Mist
  if (code === 3) return '☁️';  // Overcast
  if (code === 2) return '⛅';  // Partly cloudy
  if (code === 1) return '🌤️';  // Mainly clear
  return '☀️';                  // Clear sky
}

export const KERALA_DISTRICTS = [
  { id: 'tvm', name: 'Thiruvananthapuram', region: 'South', lat: 8.5241, lng: 76.9366, node: 'tvm' },
  { id: 'kollam', name: 'Kollam', region: 'South', lat: 8.8932, lng: 76.6141, node: 'kollam' },
  { id: 'pathanamthitta', name: 'Pathanamthitta', region: 'South', lat: 9.2648, lng: 76.7870, node: 'pathanamthitta' },
  { id: 'alappuzha', name: 'Alappuzha', region: 'South', lat: 9.4981, lng: 76.3388, node: 'alappuzha' },
  { id: 'kottayam', name: 'Kottayam', region: 'South', lat: 9.5916, lng: 76.5222, node: 'kottayam' },
  { id: 'idukki', name: 'Idukki', region: 'Central', lat: 9.8500, lng: 76.9700, node: 'idukki' },
  { id: 'kochi', name: 'Ernakulam', region: 'Central', lat: 9.9312, lng: 76.2673, node: 'kochi' },
  { id: 'thrissur', name: 'Thrissur', region: 'Central', lat: 10.5276, lng: 76.2144, node: 'thrissur' },
  { id: 'palakkad', name: 'Palakkad', region: 'Central', lat: 10.7867, lng: 76.6548, node: 'palakkad' },
  { id: 'malappuram', name: 'Malappuram', region: 'North', lat: 11.0722, lng: 76.0740, node: 'malappuram' },
  { id: 'kozhibode', name: 'Kozhikode', region: 'North', lat: 11.2588, lng: 75.7804, node: 'kozhibode' },
  { id: 'wayanad', name: 'Wayanad', region: 'North', lat: 11.6050, lng: 76.0830, node: 'wayanad' },
  { id: 'kannur', name: 'Kannur', region: 'North', lat: 11.8745, lng: 75.3704, node: 'kannur' },
  { id: 'kasaragod', name: 'Kasaragod', region: 'North', lat: 12.5103, lng: 74.9852, node: 'kasaragod' }
];

export const DEFAULT_DISTRICT_WEATHER = [
  { id: 'tvm', name: 'Thiruvananthapuram', region: 'South', lat: 8.5241, lng: 76.9366, temp: 29, humidity: 78, rain: 0.0, wind: 14, gusts: 20, condition: 'Partly Cloudy', code: 2, level: 'normal', alertColor: '#22c55e', label: '🟢 Normal', isAlert: false },
  { id: 'kollam', name: 'Kollam', region: 'South', lat: 8.8932, lng: 76.6141, temp: 29, humidity: 80, rain: 0.0, wind: 12, gusts: 18, condition: 'Partly Cloudy', code: 2, level: 'normal', alertColor: '#22c55e', label: '🟢 Normal', isAlert: false },
  { id: 'pathanamthitta', name: 'Pathanamthitta', region: 'South', lat: 9.2648, lng: 76.7870, temp: 27, humidity: 85, rain: 0.4, wind: 10, gusts: 22, condition: 'Passing Showers', code: 80, level: 'yellow', alertColor: '#eab308', label: '🟡 Yellow Alert', isAlert: true },
  { id: 'alappuzha', name: 'Alappuzha', region: 'South', lat: 9.4981, lng: 76.3388, temp: 28, humidity: 82, rain: 0.0, wind: 18, gusts: 26, condition: 'Coastal Breeze', code: 1, level: 'normal', alertColor: '#22c55e', label: '🟢 Normal', isAlert: false },
  { id: 'kottayam', name: 'Kottayam', region: 'South', lat: 9.5916, lng: 76.5222, temp: 28, humidity: 81, rain: 0.1, wind: 11, gusts: 16, condition: 'Light Drizzle', code: 51, level: 'yellow', alertColor: '#eab308', label: '🟡 Yellow Alert', isAlert: true },
  { id: 'idukki', name: 'Idukki', region: 'Central', lat: 9.8500, lng: 76.9700, temp: 22, humidity: 89, rain: 1.2, wind: 16, gusts: 32, condition: 'Highland Showers', code: 61, level: 'yellow', alertColor: '#eab308', label: '🟡 Yellow Alert', isAlert: true },
  { id: 'kochi', name: 'Ernakulam', region: 'Central', lat: 9.9312, lng: 76.2673, temp: 30, humidity: 79, rain: 0.0, wind: 15, gusts: 22, condition: 'Humid / Clear', code: 1, level: 'normal', alertColor: '#22c55e', label: '🟢 Normal', isAlert: false },
  { id: 'thrissur', name: 'Thrissur', region: 'Central', lat: 10.5276, lng: 76.2144, temp: 29, humidity: 80, rain: 0.0, wind: 13, gusts: 19, condition: 'Partly Cloudy', code: 2, level: 'normal', alertColor: '#22c55e', label: '🟢 Normal', isAlert: false },
  { id: 'palakkad', name: 'Palakkad', region: 'Central', lat: 10.7867, lng: 76.6548, temp: 32, humidity: 70, rain: 0.0, wind: 24, gusts: 38, condition: 'Gap Winds', code: 1, level: 'yellow', alertColor: '#eab308', label: '🟡 Yellow Alert', isAlert: true },
  { id: 'malappuram', name: 'Malappuram', region: 'North', lat: 11.0722, lng: 76.0740, temp: 29, humidity: 76, rain: 0.0, wind: 12, gusts: 17, condition: 'Mainly Clear', code: 1, level: 'normal', alertColor: '#22c55e', label: '🟢 Normal', isAlert: false },
  { id: 'kozhibode', name: 'Kozhikode', region: 'North', lat: 11.2588, lng: 75.7804, temp: 29, humidity: 80, rain: 0.0, wind: 14, gusts: 21, condition: 'Coastal Clear', code: 1, level: 'normal', alertColor: '#22c55e', label: '🟢 Normal', isAlert: false },
  { id: 'wayanad', name: 'Wayanad', region: 'North', lat: 11.6050, lng: 76.0830, temp: 21, humidity: 92, rain: 2.1, wind: 14, gusts: 34, condition: 'Ghat Mist & Showers', code: 61, level: 'yellow', alertColor: '#eab308', label: '🟡 Yellow Alert', isAlert: true },
  { id: 'kannur', name: 'Kannur', region: 'North', lat: 11.8745, lng: 75.3704, temp: 29, humidity: 78, rain: 0.0, wind: 15, gusts: 22, condition: 'Partly Cloudy', code: 2, level: 'normal', alertColor: '#22c55e', label: '🟢 Normal', isAlert: false },
  { id: 'kasaragod', name: 'Kasaragod', region: 'North', lat: 12.5103, lng: 74.9852, temp: 29, humidity: 79, rain: 0.0, wind: 16, gusts: 24, condition: 'Mainly Clear', code: 1, level: 'normal', alertColor: '#22c55e', label: '🟢 Normal', isAlert: false }
].map(d => ({
  ...d,
  emoji: getWeatherEmoji(d.code),
  center: [d.lat, d.lng],
  detail: `${d.condition} • ${d.temp}°C • Wind ${d.wind}km/h (Gusts ${d.gusts}km/h) • Hum ${d.humidity}%`
}));

export function getFallbackDistrictWeather() {
  try {
    if (typeof localStorage !== 'undefined') {
      const cached = localStorage.getItem('kerala_districts_weather_cache');
      if (cached) {
        const { data } = JSON.parse(cached);
        if (Array.isArray(data) && data.length === 14) {
          return data;
        }
      }
    }
  } catch {}
  return DEFAULT_DISTRICT_WEATHER;
}

export async function fetchDistrictLiveAlerts(signal) {
  const cacheKey = 'kerala_districts_weather_cache';

  try {
    const lats = KERALA_DISTRICTS.map(d => d.lat.toFixed(4)).join(',');
    const lngs = KERALA_DISTRICTS.map(d => d.lng.toFixed(4)).join(',');
    
    const params = new URLSearchParams({
      latitude: lats,
      longitude: lngs,
      current: 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m',
      timezone: 'Asia/Kolkata'
    });

    const response = await fetch(`${WEATHER_URL}?${params}`, { signal });
    if (response.ok) {
      const data = await response.json();
      const results = Array.isArray(data) ? data : [data];

      const parsed = KERALA_DISTRICTS.map((district, idx) => {
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
          ? `${condition} • ${temp}°C • Rain: ${rain.toFixed(1)}mm/h • Wind: ${wind}km/h (Gusts: ${gusts}km/h)`
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
          code,
          emoji: getWeatherEmoji(code)
        };
      });

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: parsed }));
        }
      } catch {}

      return parsed;
    }
  } catch (err) {
    console.warn('[Weather API] Live district telemetry fetch deferred, using cached baseline:', err?.message || err);
  }

  return getFallbackDistrictWeather();
}

/**
 * fetch7DayClimatePrediction
 * 
 * Retrieves 7-day predictive meteorological forecast, rainfall totals,
 * and autonomous Landslide & Flash Flood Susceptibility Indices.
 * Cached in localStorage for zero-connectivity field operations.
 */
export async function fetch7DayClimatePrediction(lat, lng, districtName = 'Kerala Sector', signal) {
  const cacheKey = `vanguard_climate_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  
  // High-risk Western Ghats hilly districts where landslide threshold is lower
  const hillyNames = ['wayanad', 'idukki', 'pathanamthitta', 'palakkad', 'kannur'];
  const isHilly = hillyNames.some(h => (districtName || '').toLowerCase().includes(h));

  try {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lng.toFixed(4),
      current: 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max',
      forecast_days: '7',
      timezone: 'Asia/Kolkata'
    });

    const response = await fetch(`${WEATHER_URL}?${params}`, { signal });
    if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}`);
    const data = await response.json();

    const daily = data.daily || {};
    const dates = daily.time || [];
    const maxTemps = daily.temperature_2m_max || [];
    const minTemps = daily.temperature_2m_min || [];
    const precipSums = daily.precipitation_sum || [];
    const precipProbs = daily.precipitation_probability_max || [];
    const windSpeeds = daily.wind_speed_10m_max || [];
    const windGusts = daily.wind_gusts_10m_max || [];
    const weatherCodes = daily.weather_code || [];

    const days = dates.map((dateStr, idx) => {
      const d = new Date(dateStr);
      const dayName = idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const rain = Number(precipSums[idx] ?? 0);
      const prob = Number(precipProbs[idx] ?? 0);
      const code = weatherCodes[idx] ?? 0;
      const wind = Math.round(Number(windSpeeds[idx] ?? 0));
      const gusts = Math.round(Number(windGusts[idx] ?? 0));
      const tMax = Math.round(Number(maxTemps[idx] ?? 28));
      const tMin = Math.round(Number(minTemps[idx] ?? 22));

      let rainSeverity = 'safe'; // 'safe', 'caution', 'warning', 'danger'
      if (rain >= 70 || (rain >= 45 && isHilly)) {
        rainSeverity = 'danger'; // Torrential / Extreme
      } else if (rain >= 35 || (rain >= 25 && isHilly)) {
        rainSeverity = 'warning'; // Heavy
      } else if (rain >= 10) {
        rainSeverity = 'caution'; // Moderate
      }

      let icon = '☀️';
      if (code >= 95) icon = '⛈️';
      else if (code >= 80 || code === 65) icon = '🌧️';
      else if (code >= 51) icon = '🌦️';
      else if (code === 3 || code === 45) icon = '☁️';
      else if (code === 1 || code === 2) icon = '⛅';

      return {
        date: dateStr,
        dayName,
        formattedDate,
        code,
        label: WEATHER_LABELS[code] || 'Clear',
        icon,
        tempMax: tMax,
        tempMin: tMin,
        precipMm: rain,
        precipProb: prob,
        windSpeed: wind,
        windGusts: gusts,
        rainSeverity
      };
    });

    const total7DayRain = days.reduce((acc, curr) => acc + curr.precipMm, 0);
    const peakRainDay = [...days].sort((a, b) => b.precipMm - a.precipMm)[0] || days[0];

    // Compute Landslide Susceptibility Index
    let landslideRisk = 'LOW';
    let landslideColor = '#22c55e';
    if (isHilly) {
      if (total7DayRain >= 120 || peakRainDay?.precipMm >= 50) {
        landslideRisk = 'SEVERE';
        landslideColor = '#ef4444';
      } else if (total7DayRain >= 70 || peakRainDay?.precipMm >= 30) {
        landslideRisk = 'HIGH';
        landslideColor = '#f97316';
      } else if (total7DayRain >= 30 || peakRainDay?.precipMm >= 15) {
        landslideRisk = 'MODERATE';
        landslideColor = '#eab308';
      }
    } else {
      if (total7DayRain >= 200 || peakRainDay?.precipMm >= 80) {
        landslideRisk = 'HIGH';
        landslideColor = '#f97316';
      } else if (total7DayRain >= 100) {
        landslideRisk = 'MODERATE';
        landslideColor = '#eab308';
      }
    }

    // Flash Flood Vulnerability Index
    let flashFloodRisk = 'LOW';
    let flashFloodColor = '#22c55e';
    if (peakRainDay?.precipMm >= 60 || total7DayRain >= 150) {
      flashFloodRisk = 'CRITICAL';
      flashFloodColor = '#ef4444';
    } else if (peakRainDay?.precipMm >= 35 || total7DayRain >= 80) {
      flashFloodRisk = 'HIGH';
      flashFloodColor = '#f97316';
    } else if (peakRainDay?.precipMm >= 15 || total7DayRain >= 40) {
      flashFloodRisk = 'MODERATE';
      flashFloodColor = '#eab308';
    }

    // Coastal / Terrain Squall & Wind Warning
    const maxGustOverall = Math.max(...days.map(d => d.windGusts), 0);
    let squallRisk = 'CALM';
    let squallColor = '#22c55e';
    if (maxGustOverall >= 55) {
      squallRisk = 'GALE FORCE';
      squallColor = '#ef4444';
    } else if (maxGustOverall >= 40) {
      squallRisk = 'SQUALL WARNING';
      squallColor = '#f97316';
    } else if (maxGustOverall >= 25) {
      squallRisk = 'MODERATE BREEZE';
      squallColor = '#eab308';
    }

    // Evaluate Unified 14-District Statewide AI Hazard Model
    const aiHazard = evaluateStatewideHazardAI({
      districtId: (districtName || '').toLowerCase(),
      rain1h: Number(data.current?.precipitation ?? 0),
      rain24h: days[0]?.precipMm ?? 0,
      rain72h: days.slice(0, 3).reduce((acc, d) => acc + d.precipMm, 0),
      rain7d: total7DayRain,
      windGusts: maxGustOverall,
      pressure: 1010
    });

    const payload = {
      isOffline: false,
      fetchedAt: new Date().toISOString(),
      districtName,
      isHilly,
      current: {
        temp: Math.round(data.current?.temperature_2m ?? 28),
        humidity: Math.round(data.current?.relative_humidity_2m ?? 75),
        rain: Number(data.current?.precipitation ?? 0),
        wind: Math.round(data.current?.wind_speed_10m ?? 0),
        gusts: Math.round(data.current?.wind_gusts_10m ?? 0),
        code: data.current?.weather_code ?? 0,
        condition: WEATHER_LABELS[data.current?.weather_code] || 'Clear'
      },
      days,
      summary: {
        total7DayRain: parseFloat(total7DayRain.toFixed(1)),
        peakRainDay,
        landslideRisk,
        landslideColor,
        flashFloodRisk,
        flashFloodColor,
        squallRisk,
        squallColor,
        maxGustOverall,
        aiHazard
      }
    };

    // Cache locally for offline survival
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(cacheKey, JSON.stringify(payload));
      }
    } catch {}

    return payload;
  } catch (err) {
    // Offline Fallback: Retrieve from localStorage cache
    if (typeof localStorage !== 'undefined') {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.isOffline = true;
          return parsed;
        }
      } catch {}
    }
    throw err;
  }
}
