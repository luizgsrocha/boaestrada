export type BarrierPoint={latitude:number;longitude:number;label:string};
export type VirtualBarrier={id:string;road:string;latitude:number;longitude:number;radiusMeters:number;status:"active"|"inactive"|"unknown";verificationStatus:"verified"|"unverified";bypassPoints:BarrierPoint[]};

export function isUsableBarrier(b:VirtualBarrier){return b.status==="active"&&b.verificationStatus==="verified"&&b.bypassPoints.length>=2}
function distance(a:[number,number],b:[number,number]){const R=6371000,lat1=a[1]*Math.PI/180,lat2=b[1]*Math.PI/180,dlat=(b[1]-a[1])*Math.PI/180,dlon=(b[0]-a[0])*Math.PI/180,h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
export function routeCrossesBarriers(routeCoordinates:Array<[number,number]>,barriers:VirtualBarrier[]){return barriers.filter(isUsableBarrier).filter(b=>routeCoordinates.some(p=>distance(p,[b.longitude,b.latitude])<=b.radiusMeters))}
export function buildBypassCandidates(barriers:VirtualBarrier[]){return barriers.filter(isUsableBarrier).map(b=>({barrierId:b.id,waypoints:b.bypassPoints.map(p=>[p.longitude,p.latitude] as [number,number])}))}
export function routeIsValid(routeCoordinates:Array<[number,number]>,barriers:VirtualBarrier[]){return routeCrossesBarriers(routeCoordinates,barriers).length===0}
