export type Coordinate={latitude:number;longitude:number};
export function googleMapsDirectionsUrl(origin:Coordinate,destination:Coordinate,waypoints:Coordinate[]=[]):string{
  const point=(p:Coordinate)=>`${p.latitude},${p.longitude}`;
  const parts=[point(origin),...waypoints.map(point),point(destination)];
  return "https://www.google.com/maps/dir/"+parts.join("/");
}
export function chooseWaypoint(waypoints:Coordinate[],fallback:Coordinate):Coordinate{
  return waypoints[0]??fallback;
}
