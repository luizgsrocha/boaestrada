export type Barrier = {
  id: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  status: "active" | "inactive" | "unknown";
  verificationStatus: "verified" | "unverified";
  bypassPoints: Array<{ latitude: number; longitude: number; label: string }>;
};

export function isUsableBarrier(barrier: Barrier): boolean {
  return barrier.status === "active" && barrier.verificationStatus === "verified";
}

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const r = 6371000;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export function routeCrossesBarrier(
  coordinates: Array<[number, number]>,
  barrier: Barrier,
): boolean {
  if (!isUsableBarrier(barrier)) return false;
  return coordinates.some(([longitude, latitude]) =>
    distanceMeters({ latitude, longitude }, barrier) <= barrier.radiusMeters,
  );
}

export function selectBypassPoints(barriers: Barrier[]): Array<{ latitude: number; longitude: number; label: string }> {
  return barriers.filter(isUsableBarrier).flatMap((barrier) => barrier.bypassPoints);
}
