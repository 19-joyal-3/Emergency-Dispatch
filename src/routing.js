// Haversine formula to compute distance between two points in km
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(3));
}

// Calculate angle/heading between two points (in degrees)
export function getHeading(p1, p2) {
  const lat1 = p1[0] * Math.PI / 180;
  const lat2 = p2[0] * Math.PI / 180;
  const dLng = (p2[1] - p1[1]) * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

// Priority Queue for Dijkstra
class PriorityQueue {
  constructor() {
    this.values = [];
  }
  enqueue(val, priority) {
    this.values.push({ element: val, priority });
    this.sort();
  }
  dequeue() {
    return this.values.shift();
  }
  sort() {
    this.values.sort((a, b) => a.priority - b.priority);
  }
  isEmpty() {
    return this.values.length === 0;
  }
}

// Dijkstra solver excluding blocked edges
export function solveDijkstra(startNodeId, endNodeId, nodes, edges, blockages) {
  if (!nodes[startNodeId] || !nodes[endNodeId]) return null;

  // 1. Build adjacency list of open edges
  const adj = {};
  Object.keys(nodes).forEach(id => {
    adj[id] = [];
  });

  // Keep track of active blockages
  const blockedKeys = new Set();
  blockages.forEach(b => {
    if (b.active && b.fromNode && b.toNode) {
      blockedKeys.add(`${b.fromNode}-${b.toNode}`);
      blockedKeys.add(`${b.toNode}-${b.fromNode}`);
    }
  });

  edges.forEach(edge => {
    const key = `${edge.from}-${edge.to}`;
    if (!blockedKeys.has(key)) {
      adj[edge.from].push({ to: edge.to, dist: edge.distance, edge: edge });
      adj[edge.to].push({ to: edge.from, dist: edge.distance, edge: edge }); // Bidirectional
    }
  });

  // 2. Run Dijkstra
  const distances = {};
  const previous = {};
  const pq = new PriorityQueue();

  Object.keys(nodes).forEach(id => {
    distances[id] = Infinity;
    previous[id] = null;
  });

  distances[startNodeId] = 0;
  pq.enqueue(startNodeId, 0);

  while (!pq.isEmpty()) {
    const { element: curr } = pq.dequeue();

    if (curr === endNodeId) break;

    const neighbors = adj[curr] || [];
    for (const neighbor of neighbors) {
      const alt = distances[curr] + neighbor.dist;
      if (alt < distances[neighbor.to]) {
        distances[neighbor.to] = alt;
        previous[neighbor.to] = { from: curr, edge: neighbor.edge };
        pq.enqueue(neighbor.to, alt);
      }
    }
  }

  if (distances[endNodeId] === Infinity) {
    return null; // No path available
  }

  // 3. Reconstruct path
  const pathNodes = [];
  const pathEdges = [];
  let curr = endNodeId;

  while (curr !== startNodeId) {
    pathNodes.unshift(curr);
    const prevInfo = previous[curr];
    if (!prevInfo) break;
    pathEdges.unshift(prevInfo.edge);
    curr = prevInfo.from;
  }
  pathNodes.unshift(startNodeId);

  // 4. Build complete path geometry
  let fullGeometry = [];
  let currentPos = startNodeId;

  for (const edge of pathEdges) {
    let edgeGeom = [...edge.geometry];
    
    // Determine geometry direction. If the last coordinate of our geometry is closer
    // to the next node than the first coordinate, we should reverse it.
    const firstPt = edgeGeom[0];
    const lastPt = edgeGeom[edgeGeom.length - 1];

    const currNode = nodes[currentPos];
    const distToFirst = Math.hypot(currNode.lat - firstPt[0], currNode.lng - firstPt[1]);
    const distToLast = Math.hypot(currNode.lat - lastPt[0], currNode.lng - lastPt[1]);

    if (distToLast < distToFirst) {
      edgeGeom.reverse();
    }

    if (fullGeometry.length > 0) {
      // Avoid duplicate coordinates at junctions
      fullGeometry = fullGeometry.concat(edgeGeom.slice(1));
    } else {
      fullGeometry = fullGeometry.concat(edgeGeom);
    }

    currentPos = currentPos === edge.from ? edge.to : edge.from;
  }

  return {
    nodes: pathNodes,
    edges: pathEdges,
    distance: parseFloat(distances[endNodeId].toFixed(2)),
    geometry: fullGeometry
  };
}

// Find closest node to coordinates
export function findClosestNode(lat, lng, nodes) {
  let closestNodeId = null;
  let minDistance = Infinity;

  Object.keys(nodes).forEach(id => {
    const node = nodes[id];
    const dist = haversineDistance(lat, lng, node.lat, node.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestNodeId = id;
    }
  });

  return { id: closestNodeId, distance: minDistance };
}

// Find closest edge to coordinates (returns the edge and nodes)
export function findClosestEdge(lat, lng, edges) {
  let closestEdge = null;
  let minDistance = Infinity;

  edges.forEach(edge => {
    // Check distance to all points along the edge geometry
    edge.geometry.forEach(pt => {
      const dist = haversineDistance(lat, lng, pt[0], pt[1]);
      if (dist < minDistance) {
        minDistance = dist;
        closestEdge = edge;
      }
    });
  });

  return { edge: closestEdge, distance: minDistance };
}

// Get position and heading along polyline geometry at specific distance (km)
export function getPositionAtDistance(geometry, targetDistance) {
  if (!geometry || geometry.length === 0) return null;
  if (geometry.length === 1) return { lat: geometry[0][0], lng: geometry[0][1], heading: 0 };
  if (targetDistance <= 0) return { lat: geometry[0][0], lng: geometry[0][1], heading: getHeading(geometry[0], geometry[1]) };

  let accumulatedDistance = 0;
  for (let i = 0; i < geometry.length - 1; i++) {
    const p1 = geometry[i];
    const p2 = geometry[i+1];
    const segmentDist = haversineDistance(p1[0], p1[1], p2[0], p2[1]);

    if (accumulatedDistance + segmentDist >= targetDistance) {
      const remainingDist = targetDistance - accumulatedDistance;
      const ratio = remainingDist / (segmentDist || 1);
      const lat = p1[0] + (p2[0] - p1[0]) * ratio;
      const lng = p1[1] + (p2[1] - p1[1]) * ratio;
      const heading = getHeading(p1, p2);
      return { lat, lng, heading };
    }
    accumulatedDistance += segmentDist;
  }

  const last = geometry[geometry.length - 1];
  const prev = geometry[geometry.length - 2] || last;
  return { lat: last[0], lng: last[1], heading: getHeading(prev, last) };
}

// Calculate total length of geometry polyline in km
export function getRouteLength(geometry) {
  let distance = 0;
  for (let i = 1; i < geometry.length; i++) {
    distance += haversineDistance(geometry[i-1][0], geometry[i-1][1], geometry[i][0], geometry[i][1]);
  }
  return parseFloat(distance.toFixed(2));
}
