import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_JSON_FILE = path.join(__dirname, '..', 'temp-bus-api', 'db', 'data.json');
const MAP_DATA_FILE = path.join(__dirname, '..', 'src', 'mapData.json');

// Map node IDs to regexes matching stations in data.json
const nodeMappings = {
  "tvm": /TRIVANDRUM|THIRUVANANTHAPURAM/i,
  "kollam": /KOLLAM|QUILON/i,
  "alappuzha": /ALAPPUZHA|ALLEPPEY/i,
  "pathanamthitta": /PATHANAMTHITTA/i,
  "kottayam": /KOTTAYAM/i,
  "idukki": /IDUKKI|PAINAVU/i,
  "kochi": /ERNAKULAM|KOCHI|ALUVA|VYTILLA|ANGAMALY/i,
  "thrissur": /THRISSUR|TRICHUR|WADAKKANCHERY/i,
  "palakkad": /PALAKKAD|PALGHAT/i,
  "malappuram": /MALAPPURAM/i,
  "kozhibode": /KOZHIKODE|CALICUT/i,
  "wayanad": /KALPETTA|BATHERY|MANANTHAVADY/i,
  "kannur": /KANNUR|CANNANORE/i,
  "kasaragod": /KASARAGOD|KASARGOD/i,
  "munnar": /MUNNAR/i,
  "guruvayur": /GURUVAYUR|GURUVAYOOR/i,
  "vadakkencherry": /VADAKKENCHERRY|VADAKKANCHERY/i,
  "valliyode": /VALLIYODE|VALIYODE/i,
  "alathur": /ALATHUR|ALATHOOR/i
};

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d+):(\d+)\s*(am|pm)$/i);
  if (!match) return 0;
  let hrs = parseInt(match[1]);
  const mins = parseInt(match[2]);
  const meridiem = match[3].toLowerCase();
  
  if (meridiem === 'pm' && hrs < 12) hrs += 12;
  if (meridiem === 'am' && hrs === 12) hrs = 0;
  return hrs * 60 + mins;
}

function runParser() {
  console.log('Reading private bus database...');
  if (!fs.existsSync(DATA_JSON_FILE)) {
    console.error(`Error: Cloned database not found at ${DATA_JSON_FILE}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(DATA_JSON_FILE, 'utf-8');
  const dbData = JSON.parse(rawData);
  const busSchedules = dbData.busSchedules || [];
  console.log(`Loaded ${busSchedules.length} raw schedules from data.json.`);

  const processedBuses = [];

  busSchedules.forEach((schedule, sidx) => {
    const vehicleNumber = schedule["Vehicle Number"] || `KL-PVT-${sidx}`;
    const rawRoute = schedule.route || [];

    const mappedNodes = [];
    rawRoute.forEach(station => {
      for (const [nodeId, regex] of Object.entries(nodeMappings)) {
        if (regex.test(station)) {
          if (mappedNodes.length === 0 || mappedNodes[mappedNodes.length - 1] !== nodeId) {
            mappedNodes.push(nodeId);
          }
          break;
        }
      }
    });

    if (mappedNodes.length >= 2) {
      let firstTripDeparture = "08:00 am";
      let estimatedDurationMins = 30;

      const trips = schedule.schedule || [];
      if (trips.length > 0) {
        const firstTrip = trips[0];
        const stations = firstTrip.stations || [];
        
        let startMins = null;
        let endMins = null;

        stations.forEach(st => {
          if (nodeMappings[mappedNodes[0]].test(st.station)) {
            startMins = parseTimeToMinutes(st.departureTime || st.arrivalTime);
            firstTripDeparture = st.departureTime || st.arrivalTime;
          }
          if (nodeMappings[mappedNodes[mappedNodes.length - 1]].test(st.station)) {
            endMins = parseTimeToMinutes(st.arrivalTime);
          }
        });

        if (startMins !== null && endMins !== null && endMins > startMins) {
          estimatedDurationMins = endMins - startMins;
        }
      }

      const busName = `Private Bus (${vehicleNumber})`;
      const routeText = rawRoute.map(s => s.replace(/\b(BUS STATION|BUS STAND|PRIVATE BUS STAND|PRIVATE)\b/gi, '').trim()).join(' ➔ ');

      processedBuses.push({
        id: `bus_pvt_${sidx}`,
        name: busName,
        route: routeText,
        frequency: "Every 20 minutes",
        fare: 0,
        time: `${estimatedDurationMins} mins`,
        nodeSequence: mappedNodes,
        departureTime: firstTripDeparture,
        type: "Private Ordinary"
      });
    }
  });

  console.log(`Mapped ${processedBuses.length} buses successfully to Kerala node sequences.`);

  if (!fs.existsSync(MAP_DATA_FILE)) {
    console.error(`Error: Target mapData.json not found at ${MAP_DATA_FILE}`);
    process.exit(1);
  }

  const mapData = JSON.parse(fs.readFileSync(MAP_DATA_FILE, 'utf-8'));

  const localBuses = processedBuses.filter(bus => 
    bus.nodeSequence.includes('vadakkencherry') && 
    bus.nodeSequence.includes('valliyode')
  );

  const otherBuses = processedBuses.filter(bus => 
    !(bus.nodeSequence.includes('vadakkencherry') && bus.nodeSequence.includes('valliyode'))
  );

  const finalBuses = [...localBuses, ...otherBuses.slice(0, 45)];
  
  // Merge with existing high-coverage bus lines in the map file
  const existingBusLines = mapData.busLines || [];
  const filteredExisting = existingBusLines.filter(bus => !bus.id.startsWith('bus_pvt_'));
  mapData.busLines = [...filteredExisting, ...finalBuses];

  fs.writeFileSync(MAP_DATA_FILE, JSON.stringify(mapData, null, 2), 'utf-8');
  console.log(`Successfully merged ${mapData.busLines.length} bus routes into ${MAP_DATA_FILE} (${(fs.statSync(MAP_DATA_FILE).size / 1024).toFixed(1)} KB)`);
}

runParser();
