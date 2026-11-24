import * as THREE from 'three-platformize';
import { RGBELoader } from 'three-platformize/examples/jsm/loaders/RGBELoader';
import { createTextureCanvas, loadOceanTexture, readOceanFile, readOceanModel } from './assets';
import { crewOnWatch, roomSpecs } from './content';
import { disposeOceanResources } from './disposeOceanResources';
import { createOceanCamera, type OceanView } from './OceanCamera';

type Point2 = [number, number];
type Point3 = [number, number, number];
type LocalPoint = (x: number, y: number, z: number) => Point3;

interface RigOptions {
  anchor: Point3;
  links: number;
  span: number;
  damping: number;
  weight: number;
  update(points: THREE.Vector3[]): void;
  collision?(point: THREE.Vector3): void;
}

type DeckRig = ReturnType<typeof createDeckRig>;

function createDeckRig({ anchor, links, span, damping, weight, update, collision }: RigOptions) {
  return {
    anchor: new THREE.Vector3(...anchor), localStep: span / links, worldStep: 0, links, weight, damping,
    points: Array.from({ length: links + 1 }, () => new THREE.Vector3()),
    previous: Array.from({ length: links + 1 }, () => new THREE.Vector3()),
    local: Array.from({ length: links + 1 }, () => new THREE.Vector3()),
    anchorFrom: new THREE.Vector3(), anchorTo: new THREE.Vector3(), update, collision
  };
}

interface SpotOptions {
  color?: number;
  power?: number;
  cone?: number;
  shadows?: boolean;
}

interface PendantOptions {
  color: number;
  power: number;
  cone: number;
  roomId?: string;
}

interface PendantLight {
  pendant: THREE.Object3D;
  fill: THREE.SpotLight;
  power: number;
  sourceOffset: THREE.Vector3;
  targetOffset: THREE.Vector3;
}

interface CabinLight extends PendantLight {
  light: THREE.SpotLight;
  restSource: THREE.Vector3;
  restTarget: THREE.Vector3;
  cachedMap: THREE.WebGLRenderTarget | null;
  cachedMatrix: THREE.Matrix4;
}

interface PhotoSet {
  color: THREE.Texture;
  normal: THREE.Texture;
  arm: THREE.Texture;
}

interface PhotoSettings {
  tint?: number;
  metal?: number;
  metalMap?: boolean;
  rough?: number;
  relief?: number;
  environment?: number;
  ao?: number;
  coat?: number;
  coatRough?: number;
}

function isStandardMesh(node: THREE.Object3D): node is THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  return node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial;
}

export function createOceanShelterScene(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  onChange: () => void
) {
  let disposed = false;
  const useShadows = renderer.capabilities.maxTextures >= 16;
  const textures = new Set<THREE.Texture>();
  async function loadTexture(file: string) {
    const map = await loadOceanTexture(file);
    if (disposed) map.dispose();
    else textures.add(map);
    return map;
  }
  const camera = new THREE.PerspectiveCamera(42,1,.12,480);
  const vessel = new THREE.Group();
  const proportions = new THREE.Vector3(.67,1.46,.91);
  vessel.scale.copy(proportions);
  scene.add(vessel);

  const cold = new THREE.DirectionalLight(0xe3e6dc, 2.15);
  cold.position.set(-12, 18, 4);
  scene.add(cold, new THREE.HemisphereLight(0xd5dfe2, 0x66594a, 1.02));
  const frontLight = new THREE.DirectionalLight(0xf1e3c9, .91);
  frontLight.position.set(13, 5, 12);
  scene.add(frontLight);
  cold.position.set(-11,27,13);
  cold.target.position.set(0,7,0);scene.add(cold.target);cold.castShadow=true;
  Object.assign(cold.shadow.camera,{left:-11,right:11,top:13,bottom:-13,near:1,far:60});
  cold.shadow.camera.updateProjectionMatrix();
  cold.shadow.mapSize.set(1536,1536);cold.shadow.bias=-.00020;cold.shadow.normalBias=.027;
  cold.shadow.autoUpdate=false;cold.shadow.needsUpdate=true;
  const sunInHull=new THREE.Matrix4();

  let seed = 491913;
  const rand = () => {
    seed = Math.imul(1664525, seed) + 1013904223 | 0;
    return (seed >>> 0) / 4294967296;
  };
  const choose = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)];
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  function hash2(x: number,y: number) {
    const hash = Math.imul(x,1597334677) ^ Math.imul(y,3812015801);
    return (Math.imul(hash ^ (hash >>> 16),2246822519) >>> 0) / 4294967296;
  }
  function surfaceNoise(x: number,y: number,period: number) {
    const ix=Math.floor(x), iy=Math.floor(y);
    let fx=x-ix, fy=y-iy;
    fx=fx*fx*(3-2*fx);
    fy=fy*fy*(3-2*fy);
    const a=hash2(ix%period,iy%period), b=hash2((ix+1)%period,iy%period);
    const c=hash2(ix%period,(iy+1)%period), d=hash2((ix+1)%period,(iy+1)%period);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,fx),THREE.MathUtils.lerp(c,d,fx),fy);
  }
  function texture(size: number, paint: (ctx: CanvasRenderingContext2D, size: number) => void, tiled = true) {
    const source = createTextureCanvas();
    source.width = source.height = size;
    paint(source.getContext("2d")!, size);
    const map = new THREE.CanvasTexture(source);
    textures.add(map);
    map.encoding = THREE.sRGBEncoding;
    if (!THREE.MathUtils.isPowerOfTwo(size)) {
      map.minFilter = THREE.LinearFilter;
      map.generateMipmaps = false;
    } else if (tiled) map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return map;
  }
  const plateMap = texture(512, (ctx, size) => {
    const image=ctx.createImageData(size,size);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const u=x/size,v=y/size;
      const broad=surfaceNoise(u*7,v*7,7);
      const flecks=surfaceNoise(u*48,v*48,48);
      const streak=surfaceNoise(u*103,v*7,103);
      const seam=1-Math.min(1,Math.abs((v+.012)% .5)*17);
      const rust=clamp01((broad*.43+flecks*.26+streak*.31+seam*.23-.51)*4.45);
      const light=(broad-.5)*22+(flecks-.5)*14+(hash2(x,y)-.5)*20;
      const at=(y*size+x)*4;
      image.data[at]=THREE.MathUtils.lerp(110,120,rust)+light;
      image.data[at+1]=THREE.MathUtils.lerp(119,83,rust)+light;
      image.data[at+2]=THREE.MathUtils.lerp(119,62,rust)+light;
      image.data[at+3]=255;
    }
    ctx.putImageData(image,0,0);
    for(const y of [0,256]) {
      ctx.fillStyle="#221d1bcc";ctx.fillRect(0,y,512,4);
      ctx.fillStyle="#c7b29b54";ctx.fillRect(0,y+4,512,2);
    }
    for (let i=0;i<650;i++) {
      ctx.fillStyle=choose(["#221b1766","#a05d3770","#c4834838","#d1b39630"]);
      const x=rand()*size,y=rand()*size;
      ctx.fillRect(x,y,.4+rand()*1.3,3+rand()**2*49);
    }
  });
  const woodMap = texture(1024, (ctx,size) => {
    for(let y=0;y<size;y+=42) {
      const offset=Math.floor(rand()*248);
      for(let x=offset-252;x<size;x+=252) {
        const tone=choose(["#786858","#685749","#7d6a55","#91806d","#65564b","#7b6c63"]);
        ctx.fillStyle=tone;ctx.fillRect(x,y,250,40);
        const shade=ctx.createLinearGradient(0,y,0,y+42);
        shade.addColorStop(0,"#d2b48c47");shade.addColorStop(.16,"#ae9d8320");
        shade.addColorStop(.72,"#1c1b1810");shade.addColorStop(1,"#120e0bb0");
        ctx.fillStyle=shade;ctx.fillRect(x,y,250,42);
        ctx.fillStyle="#251f1b";ctx.fillRect(x,y+40,252,2);ctx.fillRect(x+250,y,2,42);
        for(let i=0;i<130;i++) {
          const xx=x+rand()*252, yy=y+rand()*39, width=3+rand()*67;
          ctx.strokeStyle=choose(["#2d211a54","#bda78147","#25191022","#a6aa983c"]);
          ctx.lineWidth=.35+rand()*.75;
          ctx.beginPath();ctx.moveTo(xx,yy);
          ctx.quadraticCurveTo(Math.min(x+252,xx+width*.55),yy+(rand()-.5)*2,Math.min(x+252,xx+width),yy+rand()*.5);
          ctx.stroke();
        }
        for(const xx of [x+11,x+240]) for(const yy of [y+9,y+31]) {
          ctx.fillStyle="#2b2524";ctx.fillRect(xx,yy,3,2);
          ctx.fillStyle="#b7aba07a";ctx.fillRect(xx,yy+2,3,1);
        }
      }
    }
  });
  function luminanceMap(source: THREE.Texture, min: number, range: number) {
    const image=source.image;
    const map=texture(image.width,(ctx)=>{
      ctx.drawImage(image,0,0);
      const pixels=ctx.getImageData(0,0,image.width,image.height);
      for(let i=0;i<pixels.data.length;i+=4) {
        const data=pixels.data;
        data[i]=data[i+1]=data[i+2]=min+range*(data[i]*.22+data[i+1]*.71+data[i+2]*.07)/255;
      }
      ctx.putImageData(pixels,0,0);
    });
    map.encoding=THREE.LinearEncoding;
    return map;
  }
  const steelRelief=luminanceMap(plateMap,-15,260);
  const steelBreakup=luminanceMap(plateMap,123,174);
  const woodRelief=luminanceMap(woodMap,-65,350);
  const canvasWeave=texture(256,(ctx,size)=>{
    const image=ctx.createImageData(size,size);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const grain=(hash2(x,y)-.5)*25;
      const weave=(x%3===0?-11:2)+(y%3===0?-10:4);
      const stain=(surfaceNoise(x/size*9,y/size*9,9)-.5)*40;
      const fading=(surfaceNoise(x/size*3,y/size*3,3)-.5)*37;
      const at=(y*size+x)*4;
      image.data[at]=image.data[at+1]=image.data[at+2]=200+grain+weave+stain+fading;
      image.data[at+3]=255;
    }
    ctx.putImageData(image,0,0);
  });
  const fabricRelief=luminanceMap(canvasWeave,-145,385);
  const paintedAlloy=luminanceMap(plateMap,40,450);
  const wetMask=texture(256,(ctx,size)=>{
    const frame=ctx.createImageData(size,size);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const u=x/size,v=y/size;
      const phase=surfaceNoise(u*6,v*6,6)*.75+surfaceNoise(u*26,v*26,26)*.25;
      const value=THREE.MathUtils.lerp(41,211,clamp01((phase-.34)*4.2));
      const at=(y*size+x)*4;
      frame.data[at]=frame.data[at+1]=frame.data[at+2]=value;
      frame.data[at+3]=255;
    }
    ctx.putImageData(frame,0,0);
  });
  wetMask.encoding=THREE.LinearEncoding;
  const reflectionSky=texture(256,(ctx,size)=>{
    const frame=ctx.createImageData(size,size);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const u=x/size,v=y/size;
      const cloud=surfaceNoise(u*11,v*11,11)*.61+surfaceNoise(u*25,v*25,25)*.39;
      const horizon=Math.exp(-(((v-.46)*5.6)**2));
      const bright=clamp01((cloud-.4)*2.4)*horizon;
      const at=(y*size+x)*4;
      frame.data[at]=35+bright*178;
      frame.data[at+1]=47+bright*181;
      frame.data[at+2]=52+bright*180;
      frame.data[at+3]=255;
    }
    ctx.putImageData(frame,0,0);
  });
  reflectionSky.mapping=THREE.EquirectangularReflectionMapping;
  scene.environment=reflectionSky;
  const M: Record<string, THREE.MeshStandardMaterial> = {};
  function material(name: string, color: number, options: THREE.MeshStandardMaterialParameters = {}) {
    M[name] = new THREE.MeshStandardMaterial({color, roughness:.86, ...options});
  }
  material("hull",0xc3c1b9,{map:plateMap,bumpMap:steelRelief,bumpScale:.032,roughness:.91,roughnessMap:steelBreakup,metalness:.30,side:THREE.DoubleSide});
  material("keel",0x966c52,{map:plateMap,bumpMap:steelRelief,bumpScale:.035,side:THREE.DoubleSide});
  material("rim",0x788483,{map:plateMap,bumpMap:steelRelief,bumpScale:.02,roughness:.64,metalness:.28});
  material("repair",0xa5a49a,{map:plateMap,bumpMap:steelRelief,bumpScale:.022,roughness:.68,metalness:.25});
  material("frame",0x37474a,{metalness:.22}); material("edge",0x849192,{metalness:.25});
  material("wall",0x857665,{map:paintedAlloy,bumpMap:steelRelief,bumpScale:.019,roughness:.90});
  material("outerWall",0xa3a49a,{map:plateMap,bumpMap:steelRelief,bumpScale:.026,roughness:.79,metalness:.17});
  material("deck",0xbeb3a7,{map:woodMap,bumpMap:woodRelief,bumpScale:.017,roughness:.79});
  const wetDeckMaterial = new THREE.MeshPhysicalMaterial({color:0xb9ada0,map:woodMap,bumpMap:woodRelief,bumpScale:.024,
    roughness:.75,roughnessMap:wetMask,clearcoat:.58,clearcoatRoughness:.37,clearcoatRoughnessMap:wetMask,envMapIntensity:1.56});
  M.wetDeck = wetDeckMaterial;
  material("timber",0xbda48a,{map:woodMap,bumpMap:woodRelief,bumpScale:.015});
  material("woodEdge",0x8c7156);
  material("rust",0x8f4129); material("ivory",0xdac8a9); material("amber",0xc4924f);
  material("dark",0x252b2b); material("rubber",0x343a36);
  material("brass",0xb08853,{metalness:.17});
  material("glass",0x567b6d,{metalness:.19,roughness:.32,emissive:0x203a31,emissiveIntensity:.35});
  material("blue",0x60868e,{map:paintedAlloy,bumpMap:steelRelief,bumpScale:.016,metalness:.19,roughness:.72});
  material("green",0x62795a);
  material("leaf",0x64804a); material("leafLight",0x97a85f);
  material("red",0xa64335); material("cloth",0xaea990);
  material("hose",0x3c342c);
  material("safety",0xb28a40); material("paleGreen",0x7e8d60);
  paintedAlloy.encoding=THREE.sRGBEncoding;
  M.cloth.map=canvasWeave;
  M.cloth.bumpMap=fabricRelief;
  M.cloth.bumpScale=.009;
  material("lamp",0xeed7b4,{emissive:0xffc57d,emissiveIntensity:4.1});
  material("window",0xffca78,{emissive:0xffad4a,emissiveIntensity:.72});

  const geometry: Record<string, THREE.BufferGeometry> = {
    block:new THREE.BoxGeometry(1,1,1),
    tube:new THREE.CylinderGeometry(.5,.5,1,16),
    bolt:new THREE.CylinderGeometry(.5,.5,1,6),
    ball:new THREE.SphereGeometry(.5,13,10),
    ring:new THREE.TorusGeometry(.39,.105,8,24),
    patch:new THREE.PlaneGeometry(1,1),
  };
  function lathe(profile: Point2[], sides=16) {
    return new THREE.LatheGeometry(profile.map(([y,r])=>new THREE.Vector2(r,y)),sides);
  }
  const batches = new Map<string, { type: string; tint: string; matrices: THREE.Matrix4[] }>();
  const dummy = new THREE.Object3D();
  function part(type: string, tint: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) {
    const key = type + ":" + tint;
    if (!batches.has(key)) batches.set(key, { type, tint, matrices:[] });
    dummy.position.set(x,y,z);
    dummy.scale.set(sx,sy,sz);
    dummy.rotation.set(rx,ry,rz);
    dummy.updateMatrix();
    batches.get(key)!.matrices.push(dummy.matrix.clone());
  }
  const box = (m: string,x: number,y: number,z: number,w: number,h: number,d: number,ry=0) => part("block",m,x,y,z,w,h,d,0,ry);
  const tube = (m: string,x: number,y: number,z: number,d: number,h: number,rx=0,rz=0) => part("tube",m,x,y,z,d,h,d,rx,0,rz);
  const ball = (m: string,x: number,y: number,z: number,w: number,h: number,d: number) => part("ball",m,x,y,z,w,h,d);
  function beam(m: string, a: number[], b: number[], width: number, mode = "tube") {
    const start = new THREE.Vector3().fromArray(a), end = new THREE.Vector3().fromArray(b);
    dummy.position.copy(start).lerp(end,.5);
    const diff = end.sub(start);
    dummy.scale.set(width,diff.length(),width);
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),diff.normalize());
    dummy.updateMatrix();
    const key = mode + ":" + m;
    if (!batches.has(key)) batches.set(key,{type:mode,tint:m,matrices:[]});
    batches.get(key)!.matrices.push(dummy.matrix.clone());
  }
  function mesh<G extends THREE.BufferGeometry, M extends THREE.Material>(geom: G, mat: M) {
    const node = new THREE.Mesh(geom,mat);
    vessel.add(node);
    return node;
  }
  const contactMap=texture(64,(ctx)=>{
    const fade=ctx.createRadialGradient(32,32,1,32,32,32);
    fade.addColorStop(0,"#18130de8");
    fade.addColorStop(.49,"#18130da2");
    fade.addColorStop(1,"#18130d00");
    ctx.fillStyle=fade;ctx.fillRect(0,0,64,64);
  },false);
  const contactMaterial=new THREE.MeshBasicMaterial({map:contactMap,transparent:true,opacity:.58,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  function contact(x: number,y: number,z: number,w: number,d: number) {
    part("patch","contact",x,y+.007,z,w,d,1,-Math.PI/2);
  }
  function hex(m: string,x: number,y: number,z: number,d=.055,h=.035,rx=Math.PI/2,rz=0) {
    part("bolt",m,x,y,z,d,h,d,rx,0,rz);
  }
  function pipe(m: string, coordinates: number[][], radius: number, segments=16) {
    const curve=new THREE.CatmullRomCurve3(coordinates.map(p=>new THREE.Vector3().fromArray(p)), false, "catmullrom", .20);
    return mesh(new THREE.TubeGeometry(curve,segments,radius,7,false),M[m]);
  }
  function sign(label: string, x: number, y: number, z: number, w: number, h: number, rotate = 0, ink="#ead4a8", fill="#253439") {
    const map = texture(128,(ctx) => {
      ctx.fillStyle = fill; ctx.fillRect(0,0,128,128);
      ctx.strokeStyle = "#ac9572"; ctx.lineWidth = 3; ctx.strokeRect(4,5,120,118);
      ctx.font = "bold 62px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = ink; ctx.fillText(label,64,67,106);
    },false);
    const face = mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map}));
    face.position.set(x,y,z); face.rotation.y = rotate;
  }
  function floorShape(points: Point2[], y: number, thickness: number, material: THREE.Material) {
    const outline = new THREE.Shape(points.map(([x,z]) => new THREE.Vector2(x,-z)));
    const g = new THREE.ExtrudeGeometry(outline,{depth:thickness,bevelEnabled:false});
    g.rotateX(-Math.PI/2);
    const uv = g.getAttribute("uv");
    for (let i=0; i<uv.count; i++) uv.setXY(i,uv.getX(i)/4.4,uv.getY(i)/4.4);
    mesh(g,material).position.y = y-thickness;
  }

  // A common station plan sets the hull, deck sheer, and location of the wash.
  const base=2.04;
  const deckProfiles=[
    {y:base,       half:5.12, cut:4.01, aft:-5.94},
    {y:base+2.09,  half:4.99, cut:3.78, aft:-5.80},
    {y:base+4.10,  half:4.90, cut:3.64, aft:-5.58},
    {y:base+6.12,  half:4.94, cut:3.55, aft:-5.51},
    {y:base+8.20,  half:5.04, cut:3.78, aft:-5.68},
  ];
  for(const deck of deckProfiles) deck.aft-=1.95;
  const roof=deckProfiles[4].y;
  const shipStations: Point2[]=[
    [-6.25,0],[-6.23,1.65],[-6.06,2.77],[-5.72,3.49],
    [-5.14,4.19],[-4.24,4.76],[-2.73,5.16],[-.82,5.32],
    [1.13,5.33],[2.34,5.23],[3.50,4.99],[4.54,4.53],
    [5.55,3.89],[6.53,2.99],[7.43,1.83],[8.18,.57],[8.49,0],
  ];
  for(const station of shipStations) {
    if(station[0]<-2.1) station[0]-=(-2.1-station[0])*.47;
  }
  function stationWidth(z: number){
    let i=1;
    while(i<shipStations.length-1&&z>shipStations[i][0]) i++;
    const [za,xa]=shipStations[i-1],[zb,xb]=shipStations[i];
    const [zp,xp]=shipStations[Math.max(0,i-2)],[zn,xn]=shipStations[Math.min(shipStations.length-1,i+1)];
    const h=zb-za,t=clamp01((z-za)/h),s=t*t;
    const m=(xb-xa)/h;
    const da=(xa-xp)/Math.max(.001,za-zp);
    const db=(xn-xb)/Math.max(.001,zn-zb);
    const slope=(p: number,q: number)=>p*q>0?2*p*q/(p+q):0;
    const u=i===1?m:slope(da,m),v=i===shipStations.length-1?m:slope(m,db);
    return Math.max(0,(2*t*s-3*s+1)*xa+(t*s-2*s+t)*h*u+(-2*t*s+3*s)*xb+(t*s-s)*h*v);
  }
  const bowLimit=shipStations[shipStations.length-1][0];
  const sternLimit=shipStations[0][0];
  const hullLayers=[
    [-2.16,.20,.62,-.39],[-1.68,.52,.76,-.22],[-.95,.74,.84,-.13],
    [-.20,.875,.91,-.07],[.54,.947,.951,-.025],[1.29,.978,.976,-.009],[base,1,1,0],
  ];
  function sheer(z: number){
    return .34*clamp01((z-3.85)/4.64)**1.55+.145*clamp01((-z-4.55)/1.76)**1.4;
  }
  function hullSection(phase: number){
    const p=clamp01(phase)*(hullLayers.length-1),i=Math.min(Math.floor(p),hullLayers.length-2);
    const a=hullLayers[i],b=hullLayers[i+1],t=p-i;
    return a.map((x,j)=>THREE.MathUtils.lerp(x,b[j],t));
  }
  function hullPoint(t: number,v: number,outward=0): Point3{
    const phi=t*2*Math.PI;
    const topZ=(sternLimit+bowLimit)/2+(bowLimit-sternLimit)/2*Math.cos(phi);
    const [y,width,length,shift]=hullSection(v);
    const sign=t<=.5?1:-1;
    const side=stationWidth(topZ);
    const breadth=(side*width+outward*clamp01(side/.56))*sign;
    return [breadth,y+sheer(topZ)*(.25+.75*v),topZ*length+shift];
  }

  function marineMaps(){
    const size=512;
    const canvases=Array.from({length:3},()=>{
      const canvas=createTextureCanvas();
      canvas.width=canvas.height=size;
      const ctx=canvas.getContext("2d")!;
      return {canvas,ctx,data:ctx.createImageData(size,size)};
    });
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const u=x/size,v=y/size;
      const mill=surfaceNoise(u*5,v*5,5);
      const fine=surfaceNoise(u*70,v*70,70);
      const drip=surfaceNoise(u*113,v*9,113);
      const row=Math.floor(v*3);
      const across=u*4+(row%2)*.46;
      const h=Math.abs((v*3+.003)%1-.5);
      const seamH=Math.max(0,1-(.5-h)*46);
      const seamV=Math.max(0,1-Math.min(across%1,1-across%1)*42);
      const seam=Math.max(seamH,seamV*.72);
      const flow=clamp01((drip*.71+mill*.29-.46)*2.8);
      const rust=clamp01((flow*.60+fine*.23+seam*.23-.36)*4.1)*(.65+.33*mill);
      const chip=clamp01((fine*.45+drip*.25+seam*.29-.60)*8.0);
      const color=(hash2(x,y)-.5)*7+(mill-.5)*24+(fine-.5)*9;
      const idx=(y*size+x)*4;
      const steel=canvases[0].data.data;
      steel[idx]=THREE.MathUtils.lerp(103,122,rust)+color+chip*14;
      steel[idx+1]=THREE.MathUtils.lerp(115,86,rust)+color+chip*15;
      steel[idx+2]=THREE.MathUtils.lerp(117,59,rust)+color+chip*17;
      steel[idx+3]=255;
      const grit=canvases[1].data.data;
      grit[idx]=grit[idx+1]=grit[idx+2]=106+surfaceNoise(u*34,v*34,34)*63+rust*21-seam*62+chip*22;
      grit[idx+3]=255;
      const roughness=canvases[2].data.data;
      roughness[idx]=roughness[idx+1]=roughness[idx+2]=142+rust*79+mill*21-chip*44;
      roughness[idx+3]=255;
    }
    return canvases.map(({ctx,canvas,data},i)=>{
      ctx.putImageData(data,0,0);
      const map=new THREE.CanvasTexture(canvas);
      textures.add(map);
      map.wrapS=map.wrapT=THREE.RepeatWrapping;
      map.encoding=i===0?THREE.sRGBEncoding:THREE.LinearEncoding;
      map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
      return map;
    });
  }
  const [marineColor,marineHeight,marineRough]=marineMaps();
  for(const [key,color,roughness,metalness] of [
    ["marineSteel",0xbfc0b9,.92,.18],["marineLower",0x797268,.97,.12],
    ["marineStrake",0xa09d8f,.85,.25],["marineGuard",0x7d8380,.90,.19],
    ["marinePatch",0xaeb5b0,.91,.21],["marineDark",0x686763,.93,.17],
  ] as const){
    material(key,color,{map:marineColor,bumpMap:marineHeight,bumpScale:.027,
      roughnessMap:marineRough,roughness,metalness,side:THREE.DoubleSide});
  }
  material("windowGlass",0x8e8371,{roughness:.41,metalness:.13,
    emissive:0xbf854c,emissiveIntensity:.43,side:THREE.DoubleSide});
  material("steelEdge",0xa7a397,{metalness:.39,roughness:.65,map:marineColor,bumpMap:marineHeight,bumpScale:.011});

  function shipSurface(rows: number,cols: number,point: (u: number, v: number) => Point3,key: string,uvAt?: (u: number, v: number, p: Point3) => Point2,flip=false){
    const positions=[],uv=[],indices=[];
    for(let i=0;i<=rows;i++) for(let j=0;j<=cols;j++){
      const u=j/cols,v=i/rows;
      const p=point(u,v);
      positions.push(...p);
      uv.push(...(uvAt?uvAt(u,v,p):[u,v]));
      if(i&&j){
        const a=i*(cols+1)+j,b=a-cols-1;
        if(flip) indices.push(b-1,a-1,a,b-1,a,b);
        else indices.push(b-1,b,a,b-1,a,a-1);
      }
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(indices);geo.computeVertexNormals();
    return mesh(geo,M[key]);
  }
  function hullStrip(up: number,down: number,key: string,outset=0,start=0,end=1){
    const n=Math.max(5,Math.ceil((end-start)*150));
    const bands=Math.max(2,Math.ceil((up-down)*26));
    return shipSurface(bands,n,(u,v)=>{
      const t=THREE.MathUtils.lerp(start,end,u);
      const vertical=THREE.MathUtils.lerp(down,up,v);
      return hullPoint(t,vertical,outset);
    },key,(u,v,p)=>[THREE.MathUtils.lerp(start,end,u)*6.9,p[1]/1.52],true);
  }
  hullStrip(.52,0,"marineLower");
  hullStrip(1,.52,"marineSteel");
  for(const [lo,hi,offset,key] of [
    [.502,.543,.020,"marineLower"],[.647,.670,.027,"marineGuard"],[.803,.824,.039,"marineStrake"],
    [.924,.953,.050,"marinePatch"],[.971,1,.069,"marineDark"],
  ] as const) hullStrip(hi,lo,key,offset);
  for(const [start,end,bottom,top] of [
    [.087,.144,.649,.799],[.148,.230,.765,.906],[.241,.317,.586,.794],[.307,.363,.840,.943],
    [.711,.793,.710,.846],[.814,.877,.656,.800],[.920,.964,.782,.910],
  ]) hullStrip(top,bottom,"marinePatch",.057,start,end);
  function hullRivets(phase: number,start: number,end: number,steps: number,diameter=.047){
    for(let i=0;i<steps;i++){
      const t=THREE.MathUtils.lerp(start,end,(i+.48)/steps);
      const p=hullPoint(t,phase,.064);
      ball(i%9===2?"rust":"steelEdge",...p,diameter,diameter,diameter);
    }
  }
  for(const phase of [.671,.824,.956]) hullRivets(phase,.012,.988,132,phase>.8?.047:.039);
  for(const t of [.076,.141,.226,.318,.706,.823,.908]){
    for(let j=0;j<6;j++){
      const p=hullPoint(t,.67+j*.046,.076);
      ball("marineGuard",...p,.046,.046,.046);
    }
  }
  const stem: Point3[]=[.62,.72,.80,.90,.97,1].map(v=>{
    const p=hullPoint(0,v);
    return [0,p[1],p[2]+.041];
  });
  pipe("steelEdge",stem,.044,24);

  const forwardDeck=shipSurface(11,150,(u,v)=>{
    const [bx,,bz]=hullPoint(u,1);
    const z=bz*v;
    return [bx*v,base+sheer(z),z];
  },"wetDeck",(u,v,p)=>[p[0]/4.15,-p[2]/4.15],false);
  forwardDeck.material.side=THREE.DoubleSide;

  function frontEdge(deck: (typeof deckProfiles)[number],x: number){
    const ratio=x/(deck.half-.30);
    return deck.cut-.475*ratio*ratio+(ratio<0?.068*ratio:-.047*ratio);
  }
  function frontPos(level: number,u: number,below=0,offset=0): Point3{
    const deck=deckProfiles[level];
    const x=(u*2-1)*(deck.half-.30);
    return [x,deck.y-below,frontEdge(deck,x)+offset];
  }
  const sides=deckProfiles.map(deck=>{
    const x=deck.half-.30;
    const pts=[
      new THREE.Vector3(x,deck.y,frontEdge(deck,x)),
      new THREE.Vector3(deck.half-.135,deck.y,deck.cut-1.34),
      new THREE.Vector3(deck.half+.02,deck.y,-.13),
      new THREE.Vector3(deck.half-.081,deck.y,-2.09),
      new THREE.Vector3(deck.half-.42,deck.y,deck.aft+1.51),
      new THREE.Vector3(deck.half-.55,deck.y,deck.aft+.58),
      new THREE.Vector3(deck.half-1.74,deck.y,deck.aft),
    ];
    return new THREE.CatmullRomCurve3(pts,false,"centripetal");
  });
  function sidePos(level: number,u: number,v: number,side=1,out=0): Point3{
    const p=sides[level].getPointAt(u).lerp(sides[level+1].getPointAt(u),v);
    return [p.x*side+side*out,p.y,p.z];
  }
  function deckOutline(i: number): Point2[] {
    const front=Array.from({length:37},(_,j): Point2=>{
      const [x,,z]=frontPos(i,j/36); return [x,z];
    });
    const right=Array.from({length:32},(_,j): Point2=>{
      const p=sides[i].getPointAt((j+1)/32); return [p.x,p.z];
    });
    return [...front,...right,...right.slice().reverse().map(([x,z]): Point2=>[-x,z])];
  }
  const roofOutline=deckOutline(4);

  const exposedSide=[.35,.39,.42,.41];
  function sideSheet(level: number,u0: number,u1: number,v0: number,v1: number,key: string,side=1,out=0){
    if(side===1 && v1>.095){
      u0=Math.max(u0,exposedSide[level]);
      if(u1<=u0) return;
    }
    const strips=Math.max(2,Math.ceil((u1-u0)*44));
    return shipSurface(2,strips,(u,v)=>sidePos(level,
      THREE.MathUtils.lerp(u0,u1,u),THREE.MathUtils.lerp(v0,v1,v),side,out),key,
      (u,v,p)=>[-p[2]/2.5+level*.14,p[1]/1.5],side<0);
  }
  const sideOpenings=[
    [{u:.12,w:.049,v:.55,h:.27},{u:.35,w:.075,v:.49,h:.33},{u:.58,w:.061,v:.52,h:.29},{u:.76,w:.06,v:.55,h:.26}],
    [{u:.19,w:.063,v:.52,h:.29},{u:.38,w:.096,v:.53,h:.31},{u:.63,w:.064,v:.55,h:.29},{u:.80,w:.059,v:.52,h:.30}],
    [{u:.12,w:.076,v:.54,h:.34},{u:.33,w:.082,v:.54,h:.36},{u:.55,w:.090,v:.58,h:.35},{u:.77,w:.067,v:.55,h:.27}],
    [{u:.10,w:.068,v:.54,h:.35},{u:.28,w:.076,v:.58,h:.42},{u:.50,w:.101,v:.57,h:.40},{u:.72,w:.067,v:.55,h:.33}],
  ];
  function cabinWindow(level: number,s: (typeof sideOpenings)[number][number]): Point2{
    const a=s.u-s.w/2,b=s.u+s.w/2,lo=s.v-s.h/2,hi=s.v+s.h/2;
    if(b<exposedSide[level]) return [a,b];
    const z=.055, border=.023, trim=.0048;
    sideSheet(level,a,b,0,lo,"marineSteel");
    sideSheet(level,a,b,hi,1,"marineSteel");
    for(const [u0,u1,v0,v1] of [
      [a-trim,b+trim,lo-border,lo+.034],[a-trim,b+trim,hi-.034,hi+border],
      [a-trim,a+.009,lo,hi],[b-.009,b+trim,lo,hi],
    ]) sideSheet(level,u0,u1,v0,v1,"marineGuard",1,z);
    sideSheet(level,a+.004,b-.004,lo+.018,hi-.018,"windowGlass",1,-.029);
    if(level>=2) sideSheet(level,s.u-.0023,s.u+.0023,lo+.017,hi-.017,"marineGuard",1,.049);
    for(const [u,v] of [[a,lo],[a,hi],[b,lo],[b,hi]]){
      const p=sidePos(level,u,v,1,z+.007);
      ball("steelEdge",...p,.047,.044,.047);
    }
    const sill0=sidePos(level,a-.004,lo-.018,1,.106);
    const sill1=sidePos(level,b+.004,lo-.018,1,.106);
    beam("steelEdge",sill0,sill1,.046,"block");
    return [a,b];
  }
  for(let level=0;level<4;level++){
    const deck=deckProfiles[level], ceiling=deckProfiles[level+1];
    const span=ceiling.y-deck.y;
    if(level) floorShape(deckOutline(level),deck.y,[0,.224,.228,.19][level],M.deck);
    let from=0;
    for(const opening of sideOpenings[level]){
      const [a,b]=cabinWindow(level,opening);
      sideSheet(level,from,a,0,1,"marineSteel");
      from=b;
    }
    sideSheet(level,from,1,0,1,"marineSteel");
    sideSheet(level,0,1,0,1,"marineSteel",-1);
    for(const [low,high] of [[.025,.090],[.148,.177],[.911,.946]]){
      sideSheet(level,0,1,low,high,"marineGuard",1,.047);
      sideSheet(level,0,1,low,high,"marineGuard",-1,.036);
    }
    for(const t of [.047,.226,.452,.691,.866]){
      if(t<exposedSide[level]) continue;
      sideSheet(level,t-.0028,t+.0028,.12,.91,"marineDark",1,.057);
      for(const v of [.20,.42,.68,.85]) ball("steelEdge",...sidePos(level,t,v,1,.076),.042,.043,.046);
    }
    for(const [a,b,lo,hi] of [[.036,.104,.17,.37],[.31,.402,.23,.36],[.68,.778,.156,.33],[.87,.935,.32,.59]]){
      if(a<exposedSide[level]) continue;
      sideSheet(level,a,b,lo,hi,"marinePatch",1,.038);
      for(const u of [a+.006,b-.006]) for(const v of [lo+.028,hi-.028])
        ball("steelEdge",...sidePos(level,u,v,1,.050),.039,.039,.039);
    }
    const sternBottom=sides[level].getPointAt(1), sternTop=sides[level+1].getPointAt(1);
    shipSurface(4,22,(u,v)=>{
      const p=sternBottom.clone().lerp(sternTop,v);
      return [p.x*(u*2-1),p.y,p.z];
    },"marineSteel",(u,v,p)=>[p[0]/2.8,p[1]/1.5]);
    const innerDividerZ=level%2===0?-1.94:-2.23;
    box("marineDark",-.08,deck.y+span*.49,.94,.12,span*.94,5.10);
    box("wall",-.08,deck.y+span*.49,innerDividerZ,.17,span*.94,2.68);
    for(const u of [.024,.495,.976]){
      const foot=frontPos(level,u,.022,-.07), head=frontPos(level+1,u,.16,-.075);
      beam("marineGuard",foot,head,u===.495?.114:.180,"block");
      beam("steelEdge",[foot[0],foot[1],foot[2]+.089],[head[0],head[1],head[2]+.085],.032,"block");
      const brace=frontPos(level+1,u<.25?u+.052:u-.054,.177,-.07);
      const knee=frontPos(level+1,u,.44,-.073);
      beam("marineGuard",knee,brace,.119,"block");
      const plate=frontPos(level,u,-.14,.012);
      box("marinePatch",...plate,.231,.262,.082);
      for(const dx of [-.068,.068]) hex("steelEdge",plate[0]+dx,plate[1]+.055,plate[2]+.053,.043,.019);
    }
    for(const u of [.10,.22,.31,.43,.59,.70,.82,.91]){
      const p=frontPos(level+1,u,.157,-.20);
      const q=new THREE.Vector3(...p).add(new THREE.Vector3(0,0,-2.72));
      beam("marineDark",p,q.toArray(),.108,"block");
    }
  }
  floorShape(roofOutline,roof,.235,M.wetDeck);
  for(let level=0;level<=4;level++){
    const thickness=[.255,.26,.226,.20,.259][level];
    shipSurface(2,60,(u,v)=>frontPos(level,u,thickness*(1-v),.057),"marineStrake",
      (u,v,p)=>[p[0]/2.38,p[1]/1.52]);
    for(const [top,bottom,out,key] of [[.014,.054,.073,"steelEdge"],[thickness-.066,thickness,.071,"marineGuard"]] as const){
      shipSurface(2,61,(u,v)=>frontPos(level,u,THREE.MathUtils.lerp(bottom,top,v),out),key,
        (u,v,p)=>[p[0]/2.1,p[1]/1.32]);
    }
    for(let k=0;k<22;k++){
      const p=frontPos(level,(k+.52)/22,thickness*.63,.086);
      hex(k%6===1?"rust":"steelEdge",...p,.037,.020);
    }
  }

  function arcSamples(points: Point3[],maxInterval: number): Point3[]{
    const cumulative=[0];
    for(let i=1;i<points.length;i++) cumulative.push(cumulative[i-1]+new THREE.Vector3(...points[i-1]).distanceTo(new THREE.Vector3(...points[i])));
    const run=cumulative[cumulative.length-1],count=Math.ceil(run/maxInterval);
    let i=1;
    return Array.from({length:count+1},(_,j)=>{
      const distance=run*j/count;
      while(i<cumulative.length-1&&distance>cumulative[i]) i++;
      const point = new THREE.Vector3(...points[i-1]).lerp(new THREE.Vector3(...points[i]),
        (distance-cumulative[i-1])/Math.max(.001,cumulative[i]-cumulative[i-1]));
      return [point.x, point.y, point.z];
    });
  }
  function refitRail(points: Point3[],closed=false){
    const input=closed?[...points,points[0]]:points;
    const line=arcSamples(input,.86);
    const top: Point3[]=input.map(([x,y,z])=>[x,y+.641,z]);
    pipe("steelEdge",top,.028,Math.min(103,top.length*2));
    for(let i=0;i<line.length;i++){
      const [x,y,z]=line[i];
      if(!closed||i<line.length-1){
        box("marineGuard",x,y+.322,z,.106,.681,.106);
        box("marinePatch",x,y+.029,z,.219,.056,.229);
        box("marinePatch",x,y+.663,z,.139,.046,.136);
        for(const [dx,dz] of [[-.067,-.067],[.067,.067],[-.067,.067],[.067,-.067]])
          hex("steelEdge",x+dx,y+.065,z+dz,.041,.018,0);
        for(const dy of [.265,.455]){
          tube("marineStrake",x,y+dy,z,.135,.036);
          tube("marineGuard",x,y+dy+.023,z,.116,.013);
        }
      }
      if(i===0) continue;
      const [ax,ay,az]=line[i-1];
      for(const lift of [.271,.459]){
        const tension=(i%3===1?.058:.037);
        const pa=[ax,ay+lift,az], pb=[x,y+lift,z];
        const middle=[(x+ax)*.5,(y+ay)*.5+lift-tension,(z+az)*.5];
        beam("woodEdge",pa,middle,.031);beam("woodEdge",middle,pb,.031);
      }
    }
  }
  const bowRail=Array.from({length:45},(_,i): Point3=>{
    const t=.843+.314*i/44;
    const p=hullPoint(t%1,1);
    return [p[0]*.981,p[1],p[2]-.059];
  });
  refitRail(bowRail);
  refitRail(roofOutline.map(([x,z])=>[x*.983,roof,z*.989]),true);

  for(let level=0;level<4;level++){
    const y0=deckProfiles[level].y,y1=deckProfiles[level+1].y;
    const z0=frontEdge(deckProfiles[level],-.08)+.24,z1=frontEdge(deckProfiles[level+1],-.08)+.24;
    for(const x of [-.345,.204]){
      beam("marineStrake",[x,y0-.04,z0],[x,y1+.038,z1],.062,"block");
      beam("steelEdge",[x+.007,y0-.02,z0+.033],[x+.007,y1+.029,z1+.033],.021,"block");
    }
    for(let k=0;k<8;k++){
      const t=(k+.37)/8;
      const y=THREE.MathUtils.lerp(y0,y1,t), z=THREE.MathUtils.lerp(z0,z1,t);
      beam("marinePatch",[-.34,y,z+.010],[.206,y,z+.010],.044,"block");
    }
    for(const x of [-.35,.20]){
      beam("marineGuard",[x,y0+.073,z0-.17],[x,y0+.073,z0+.026],.081,"block");
      hex("steelEdge",x,y0+.068,z0+.067,.041,.023);
    }
  }

  function refitBuoy(x: number,y: number,z: number,rotation=0,scale=1){
    const group=new THREE.Group();
    group.rotation.y=rotation;group.position.set(x,y,z);group.scale.set(scale*1.35,scale,scale*1.14);
    vessel.add(group);
    for(let band=0;band<8;band++){
      const span=band%2?.35:Math.PI*.5-.35;
      const start=Math.floor(band/2)*Math.PI*.5+(band%2?Math.PI*.5-.35:0);
      const section=new THREE.TorusGeometry(.39,.096+(band%2?.004:0),10,band%2?5:14,span);
      section.rotateZ(start+.16);
      group.add(new THREE.Mesh(section,band%2?M.buoyCanvas:M.buoyOrange));
    }
    const rope=[];
    for(let i=0;i<=64;i++){
      const a=i/64*Math.PI*2,r=.48+.04*Math.sin(a*2)**2;
      rope.push(new THREE.Vector3(r*Math.cos(a),r*Math.sin(a),.032));
    }
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rope),64,.012,5,false),M.woodEdge));
  }
  material("buoyCanvas",0xc9bba1,{map:canvasWeave,roughness:.81});
  material("buoyOrange",0x985237,{roughness:.63,bumpMap:marineHeight,bumpScale:.017});
  const buoyHull=hullPoint(.135,.874,.15);
  refitBuoy(buoyHull[0],buoyHull[1],buoyHull[2],.64,1.25);
  for(const [level,u,v] of [[1,.37,.40],[3,.60,.46]]){
    const [x,y,z]=sidePos(level,u,v,1,.134);
    refitBuoy(x,y,z,Math.PI/2,.82);
  }

  const bowNumber=hullPoint(.135,.78,.085);
  sign("07",...bowNumber,.53,.30,.82,"#d1c8ac","#273135");
  const chainMount=hullPoint(.086,.873,.145);
  const bowChainAnchor: Point3=[chainMount[0]+.067,chainMount[1]+.018,chainMount[2]+.094];
  part("ring","steelEdge",...bowChainAnchor,.237,.237,.196,0,.68);

  // Bow fittings follow the deck sheer rather than hanging off a flat ledge.
  function bowFittingPoint(x: number,z: number): Point3{
    return [x,base+sheer(z),z];
  }
  for(const [x,z] of [[-2.67,6.38],[2.67,6.38],[-1.66,7.23],[1.66,7.23]]){
    const [,y]=bowFittingPoint(x,z);
    box("marinePatch",x,y+.042,z,.31,.093,.35,.14*Math.sign(x));
    tube("marineGuard",x,y+.177,z,.134,.261);
    tube("steelEdge",x,y+.293,z,.178,.041);
    for(const [dx,dz] of [[-.10,-.11],[-.10,.11],[.10,-.11],[.10,.11]])
      hex("steelEdge",x+dx,y+.095,z+dz,.049,.025,0);
    contact(x,y,z,.53,.57);
  }
  {
    const x=.19,z=6.23,[,y]=bowFittingPoint(x,z);
    box("marinePatch",x,y+.060,z,1.29,.121,.759,-.024);
    for(const s of [-1,1]){
      box("marineGuard",x+s*.43,y+.208,z,.151,.293,.52);
      for(const z0 of [z-.23,z+.23]) hex("steelEdge",x+s*.54,y+.137,z0,.075,.030,0);
    }
    tube("marineDark",x,y+.363,z,.383,.810,0,Math.PI/2);
    for(const s of [-1,1]){
      tube("marineStrake",x+s*.276,y+.361,z,.54,.062,0,Math.PI/2);
      tube("steelEdge",x+s*.417,y+.362,z,.179,.095,0,Math.PI/2);
    }
    for(let i=0;i<10;i++){
      part("ring","rust",x-.184+i*.038,y+.369,z,.474,.351,.474,0,Math.PI/2);
      const xx=x-.094+Math.sin(i*.36)*.061, zz=z+.247+i*.154;
      const [,deckY]=bowFittingPoint(xx,zz);
      part("ring","marineDark",xx,deckY+.044,zz,.176,.171,.164,i%2?Math.PI/2:.66,0,i*.31);
    }
    contact(x,y,z,1.51,.91);
    const [,ahead]=bowFittingPoint(.065,7.62);
    box("marinePatch",.065,ahead+.054,7.62,.313,.11,.358,-.08);
    tube("marineGuard",.065,ahead+.117,7.62,.201,.051);
    tube("dark",.065,ahead+.145,7.62,.145,.020);
  }

  // World-space Verlet integration keeps gravity vertical as the vessel rolls.
  const deckRigs: DeckRig[]=[];
  const fixedRigStep=1/120;
  const deckInverse=new THREE.Matrix4();
  const rigSegment=new THREE.Vector3();
  const rigLocal=new THREE.Vector3();
  const poseHelper=new THREE.Object3D();
  const rigDown=new THREE.Vector3(0,-1,0);
  const rigUp=new THREE.Vector3(0,1,0);
  const linkTwist=new THREE.Quaternion().setFromAxisAngle(rigUp,Math.PI/2);
  const rigWireGeometry=new THREE.CylinderGeometry(.5,.5,1,8);
  let rigTimeLeft=0,rigsStarted=false;

  function animatedRigMesh(geometry: THREE.BufferGeometry,material: THREE.Material,parent: THREE.Object3D=vessel) {
    const piece=new THREE.Mesh(geometry,material);
    piece.userData.movesWithRig=true;
    parent.add(piece);
    return piece;
  }
  function makeRig(options: RigOptions) {
    deckRigs.push(createDeckRig(options));
  }
  function tubeAlong(mesh: THREE.Mesh,a: THREE.Vector3,b: THREE.Vector3,width: number){
    const tangent=rigSegment.subVectors(b,a);
    const len=Math.max(.0001,tangent.length());
    mesh.position.copy(a).lerp(b,.5);
    mesh.quaternion.setFromUnitVectors(rigUp,tangent.multiplyScalar(1/len));
    mesh.scale.set(width,len,width);
  }

  function installPendant(x: number,y: number,z: number,diameter: number,metal: string) {
    geometry.industrialShade??=lathe([[-.5,0],[-.5,.5],[-.37,.5],[-.19,.407],[.22,.29],[.49,.16],[.5,0]],22);
    const mountY=y+.24;
    tube("rim",x,mountY+.024,z,diameter*.45,.046);
    tube("steelEdge",x,mountY-.006,z,diameter*.26,.022);
    const wire=animatedRigMesh(rigWireGeometry,M.hose);
    const body=new THREE.Group();
    body.name="Swinging pendant lamp";
    vessel.add(body);
    const shade=animatedRigMesh(geometry.industrialShade,M[metal],body);
    shade.position.y=-.012;
    shade.scale.set(diameter,.11,diameter);
    const rim=animatedRigMesh(geometry.tube,M.steelEdge,body);
    rim.position.y=-.066;
    rim.scale.set(diameter*1.02,.014,diameter*1.02);
    const lens=animatedRigMesh(geometry.tube,M.lamp,body);
    lens.position.y=-.078;
    lens.scale.set(diameter*.78,.019,diameter*.78);
    makeRig({
      anchor:[x,mountY,z],links:1,span:.24,damping:.019,weight:1.0,
      update(points){
        tubeAlong(wire,points[0],points[1],.027);
        body.position.copy(points[1]);
        body.quaternion.setFromUnitVectors(rigDown,rigSegment.subVectors(points[1],points[0]).normalize());
      }
    });
    return body;
  }

  function installCraneRope() {
    const count=8;
    const cables=Array.from({length:count},()=>animatedRigMesh(rigWireGeometry,M.hose));
    const hook=new THREE.Group();
    hook.name="Crane swinging hook";
    vessel.add(hook);
    const swivel=animatedRigMesh(geometry.tube,M.steelEdge,hook);
    swivel.position.y=-.046;
    swivel.scale.set(.092,.132,.092);
    const safetyRing=animatedRigMesh(new THREE.TorusGeometry(.104,.021,12,34,Math.PI*1.62),M.amber,hook);
    safetyRing.rotation.z=Math.PI*.64;
    safetyRing.position.set(.019,-.225,0);
    const shoulder=animatedRigMesh(geometry.tube,M.amber,hook);
    shoulder.position.set(-.028,-.142,0);
    shoulder.scale.set(.052,.104,.052);
    makeRig({
      anchor:[1.19,roof+2.18,-3.82],links:count,span:.88,damping:.012,weight:3.8,
      update(points){
        for(let i=0;i<count;i++) tubeAlong(cables[i],points[i],points[i+1],.018);
        hook.position.copy(points[count]);
        hook.quaternion.setFromUnitVectors(rigDown,rigSegment.subVectors(points[count],points[count-1]).normalize());
      }
    });
  }

  function installBowChain() {
    const count=12;
    const iron=new THREE.InstancedMesh(new THREE.TorusGeometry(.5,.124,9,26),M.rust,count);
    iron.name="Hanging bow anchor chain links";
    iron.userData.movesWithRig=true;
    iron.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    iron.frustumCulled=false;
    vessel.add(iron);

    makeRig({
      anchor:bowChainAnchor,links:count,span:1.82,damping:.015,weight:2.0,
      collision(point){
        rigLocal.copy(point).applyMatrix4(deckInverse);
        const distanceBelow=Math.max(0,bowChainAnchor[1]-rigLocal.y);
        const hullClearance=bowChainAnchor[2]-.039-distanceBelow*.40;
        if(rigLocal.z<hullClearance){
          rigLocal.z=hullClearance;
          point.copy(rigLocal).applyMatrix4(vessel.matrixWorld);
        }
      },
      update(points){
        for(let i=0;i<count;i++){
          const direction=rigSegment.subVectors(points[i+1],points[i]).normalize();
          poseHelper.position.copy(points[i]).lerp(points[i+1],.50);
          poseHelper.quaternion.setFromUnitVectors(rigDown,direction);
          if(i%2) poseHelper.quaternion.multiply(linkTwist);
          poseHelper.scale.set(.155,.180,.143);
          poseHelper.updateMatrix();
          iron.setMatrixAt(i,poseHelper.matrix);
        }
        iron.instanceMatrix.needsUpdate=true;
      }
    });
  }

  function initializeRig(rig: DeckRig){
    for(let i=0;i<=rig.links;i++){
      rig.points[i].copy(rig.anchor);
      rig.points[i].y-=i*rig.localStep;
      rig.points[i].applyMatrix4(vessel.matrixWorld);
      rig.previous[i].copy(rig.points[i]);
    }
    rig.worldStep=rig.points[0].distanceTo(rig.points[1]);
    rig.anchorFrom.copy(rig.points[0]);
  }
  function stepRig(rig: DeckRig,fraction: number){
    const n=rig.links;
    rig.points[0].copy(rig.anchorFrom).lerp(rig.anchorTo,fraction);
    for(let i=1;i<=n;i++){
      const at=rig.points[i];
      rigSegment.subVectors(at,rig.previous[i]).multiplyScalar(1-rig.damping);
      rig.previous[i].copy(at);
      at.add(rigSegment);
      at.y-=9.81*fixedRigStep*fixedRigStep;
    }
    for(let pass=0;pass<12;pass++){
      for(let i=1;i<=n;i++){
        const a=rig.points[i-1],b=rig.points[i];
        const delta=rigSegment.subVectors(b,a);
        const length=delta.length();
        if(length<1e-7) continue;
        delta.multiplyScalar((length-rig.worldStep)/length);
        const invA=i===1?0:1,invB=i===n?1/rig.weight:1;
        a.addScaledVector(delta,invA/(invA+invB));
        b.addScaledVector(delta,-invB/(invA+invB));
      }
      if(rig.collision) for(let i=1;i<=n;i++) rig.collision(rig.points[i]);
    }
  }
  function updateShipRigging(delta: number,advanced: boolean) {
    vessel.updateWorldMatrix(true,false);
    deckInverse.copy(vessel.matrixWorld).invert();
    if(!rigsStarted){
      for(const rig of deckRigs) initializeRig(rig);
      rigsStarted=true;
    }
    if(advanced) rigTimeLeft+=Math.min(.06,delta);
    const steps=advanced?Math.floor((rigTimeLeft+1e-8)/fixedRigStep):0;
    rigTimeLeft-=steps*fixedRigStep;
    for(const rig of deckRigs){
      rig.anchorTo.copy(rig.anchor).applyMatrix4(vessel.matrixWorld);
      for(let i=0;i<steps;i++) stepRig(rig,(i+1)/steps);
      if(steps) rig.anchorFrom.copy(rig.anchorTo);
      for(let i=0;i<=rig.links;i++) rig.local[i].copy(rig.points[i]).applyMatrix4(deckInverse);
      rig.update(rig.local);
    }
    return deckInverse;
  }

  installBowChain();

  for (const [x,offsetZ] of [[2.42,2.47],[2.72,-1.67]]) {
    box("marineGuard",x,roof+.056,offsetZ,1.74,.105,1.08);
    for(let board=0;board<5;board++) box("timber",x-.64+.32*board,roof+.129,offsetZ,.31,.052,1.0);
    for(const dx of [-.69,.69]) {
      box("steelEdge",x+dx,roof+.163,offsetZ,.084,.024,1.04);
      for(const dz of [-.39,.39])hex("brass",x+dx,roof+.187,offsetZ+dz,.047,.018,0);
    }
    for(const dx of [-.39,.39]) tube("steelEdge",x+dx,roof+.15,offsetZ-.50,.087,.27,0,Math.PI/2);
    beam("steelEdge",[x-.12,roof+.196,offsetZ+.32],[x+.12,roof+.196,offsetZ+.32],.041);
  }

  function crate(x: number,y: number,z: number,w=.66,h=.56,d=.61) {
    contact(x,y,z,w*1.43,d*1.40);
    box("woodEdge",x,y+h/2,z,w*.98,h*.98,d*.97);
    for(let i=0;i<4;i++){
      box("timber",x,y+h*(.13+i*.244),z+d*.49,w,h*.23,.052);
      box("timber",x+w*.49,y+h*(.13+i*.244),z,.049,h*.23,d);
      box("timber",x,y+h+.006,z+d*(-.37+i*.246),w,.039,d*.23);
    }
    for (const dx of [-.40,.40]) {
      box("woodEdge",x+dx*w,y+h*.5,z+d*.51,.085,h,.055);
      box("woodEdge",x+dx*w,y+h+.024,z,.09,.045,d+.035);
      for(const lift of [.17,.81]) hex("dark",x+dx*w,y+h*lift,z+d*.51+.036,.032,.018);
    }
    box("woodEdge",x,y+h*.13,z+d*.51,w,.085,.06);
    box("woodEdge",x,y+h*.86,z+d*.51,w,.085,.06);
    box("rim",x,y+h*.56,z+d*.53,w*.34,.115,.027);
    box("dark",x,y+h*.56,z+d*.55,w*.24,.043,.013);
  }
  function drum(x: number,y: number,z: number,tint="blue",w=.60,h=.75) {
    contact(x,y,z,w*1.47,w*1.47);
    tube(tint,x,y+h/2,z,w,h);
    for (const at of [.09,.28,.75,.94]) tube("edge",x,y+h*at,z,w+.025,.035);
    tube("rim",x,y+h+.018,z,w*.84,.035);
    tube("brass",x+w*.24,y+h+.046,z,.10,.028);
    tube("rim",x-w*.18,y+h+.045,z,.055,.026);
    box("repair",x,y+h*.54,z+w*.491,w*.32,h*.16,.020);
    for(let i=0;i<3;i++) box("rim",x,y+h*(.5+i*.037),z+w*.508,w*.21,.009,.004);
  }
  function table(x: number,y: number,z: number,w=1.58,h=.82,d=.72,tint="timber") {
    contact(x,y,z,w*1.25,d*1.51);
    box(tint,x,y+h,z,w,.12,d);
    box("woodEdge",x,y+h-.14,z+d*.36,w*.94,.16,.06);
    for (const dx of [-1,1]) for(const dz of [-1,1])
      box("frame",x+dx*(w*.43),y+h/2,z+dz*(d*.35),.10,h,.10);
  }
  function shelf(x: number,y: number,z: number,w: number,tint="woodEdge") {
    for (const dx of [-w/2,w/2]) box("rim",x+dx,y+.84,z,.075,1.67,.37);
    for (let row=0;row<4;row++) {
      const h=.13+.39*row;
      box(tint,x,y+h,z,w+.1,.08,.42);
      for (let col=0;col<Math.floor(w/.23);col++) {
        const item=x-w*.4+col*.204;
        if (rand()>.18) {
          const tint = choose(["ivory","blue","amber","green","timber","red"]);
          tube(tint,item,y+h+.133,z+(rand()-.5)*.14,.12,.18);
          tube("rim",item,y+h+.232,z,.118,.022);
        }
      }
    }
  }
  const cabinLights=new Map<string, CabinLight>();
  const pendantLights: PendantLight[]=[];
  const shadowInterval=1000/12;
  const liveShadowMatrix=new THREE.Matrix4();
  let cabinShadowsReady=false, liveCabin: CabinLight | null=null, liveShadowMap: THREE.WebGLRenderTarget | null=null;
  let lastShadowUpdate=-Infinity, wasCabinMoving=false;

  function cabinSpot(position: Point3,target: Point3,config: SpotOptions) {
    const {color=0xffd2a2,power=12,cone=.76,shadows=false}=config;
    const light=new THREE.SpotLight(color,power,5.8,cone,.69,2);
    light.position.set(...position);
    light.target.position.set(...target);
    vessel.add(light,light.target);
    if(shadows){
      light.castShadow=true;
      light.shadow.mapSize.set(512,512);
      light.shadow.camera.near=.13;
      light.shadow.normalBias=.01;
      light.shadow.bias=-.00018;
      light.shadow.radius=2.75;
      light.shadow.autoUpdate=false;
      light.shadow.needsUpdate=true;
    }
    return light;
  }
  function lightPendant(pendant: THREE.Object3D,origin: Point3,position: Point3,target: Point3,{color,power,cone,roomId}: PendantOptions) {
    const lampOrigin=new THREE.Vector3(...origin);
    const fill=cabinSpot(position,target,{color,power,cone});
    const entry={pendant,fill,power,
      sourceOffset:fill.position.clone().sub(lampOrigin),
      targetOffset:fill.target.position.clone().sub(lampOrigin)
    };
    pendantLights.push(entry);
    if(roomId) {
      const light=cabinSpot(position,target,{color,power,cone,shadows:true});
      const cabin = { ...entry, light, restSource:light.position.clone(),restTarget:light.target.position.clone(),
        cachedMap:null,cachedMatrix:new THREE.Matrix4() };
      restoreCabinLight(cabin);
      cabinLights.set(roomId,cabin);
    }
  }

  function restoreCabinLight(entry: CabinLight) {
    const {light,fill,power,restSource,restTarget,cachedMap}=entry;
    light.shadow.map=cachedMap!;
    light.position.copy(restSource);
    light.target.position.copy(restTarget);
    light.intensity=power*.48;
    fill.intensity=power*.52;
  }

  function prepareCabinLighting(now: number,roomId: string | undefined,moving: boolean,worldToHull: THREE.Matrix4) {
    for(const {pendant,fill,sourceOffset,targetOffset} of pendantLights) {
      fill.position.copy(sourceOffset).applyQuaternion(pendant.quaternion).add(pendant.position);
      fill.target.position.copy(targetOffset).applyQuaternion(pendant.quaternion).add(pendant.position);
    }
    if(!useShadows || !cabinShadowsReady) return false;
    cold.shadow.matrix.multiplyMatrices(sunInHull,worldToHull);

    const selected=(roomId ? cabinLights.get(roomId) : undefined)??null;
    if(selected!==liveCabin) {
      if(liveCabin) restoreCabinLight(liveCabin);
      liveCabin=selected;
      if(liveCabin) {
        liveCabin.light.shadow.map=liveShadowMap!;
        liveCabin.light.intensity=liveCabin.power*.82;
        liveCabin.fill.intensity=liveCabin.power*.18;
        lastShadowUpdate=-Infinity;
      }
    }

    // Keep the depth lookups aligned to the ship as it rolls and heaves.
    for(const entry of cabinLights.values()) {
      const localMatrix=entry===liveCabin?liveShadowMatrix:entry.cachedMatrix;
      entry.light.shadow.matrix.multiplyMatrices(localMatrix,worldToHull);
    }
    const stopped=wasCabinMoving&&!moving;
    wasCabinMoving=moving;
    if(!liveCabin) return false;

    const {light,fill}=liveCabin;
    light.position.copy(fill.position);
    light.target.position.copy(fill.target.position);
    const update=lastShadowUpdate===-Infinity||stopped||(moving&&now-lastShadowUpdate>=shadowInterval);
    if(update) {
      light.shadow.needsUpdate=true;
      renderer.shadowMap.needsUpdate=true;
    }
    return update;
  }

  function finishCabinLighting(now: number,updatedLiveShadow: boolean) {
    if (!useShadows) return;
    if(!cabinShadowsReady) {
      for(const entry of cabinLights.values()) {
        entry.cachedMap=entry.light.shadow.map as THREE.WebGLRenderTarget | null;
        entry.cachedMatrix.multiplyMatrices(entry.light.shadow.matrix,vessel.matrixWorld);
      }
      sunInHull.multiplyMatrices(cold.shadow.matrix,vessel.matrixWorld);
      cabinShadowsReady=true;
    }
    if(updatedLiveShadow && liveCabin) {
      const {shadow}=liveCabin.light;
      liveShadowMap=shadow.map as THREE.WebGLRenderTarget | null;
      liveShadowMatrix.multiplyMatrices(shadow.matrix,vessel.matrixWorld);
      lastShadowUpdate=now;
    }
  }


  const rooms = roomSpecs.map(room => ({ ...room, anchor: new THREE.Vector3() }));
  const gaugeFace=texture(128,(ctx)=>{
    ctx.fillStyle="#cfc4a9";ctx.fillRect(0,0,128,128);
    ctx.strokeStyle="#514b3f";ctx.lineWidth=2;
    for(let i=0;i<=12;i++) {
      const a=(-.75+i*.125)*Math.PI;
      ctx.beginPath();
      ctx.moveTo(64+Math.sin(a)*48,64-Math.cos(a)*48);
      ctx.lineTo(64+Math.sin(a)*(i%3?43:37),64-Math.cos(a)*(i%3?43:37));
      ctx.stroke();
    }
    ctx.font="10px monospace";ctx.fillStyle="#41372c";ctx.textAlign="center";
    ctx.fillText("PRESS",64,89);ctx.fillText("BAR",64,103);
  },false);
  const gaugeMat=new THREE.MeshStandardMaterial({map:gaugeFace,roughness:.63,emissive:0xb49a70,emissiveIntensity:.11});
  function gauge(x: number,y: number,z: number,r=.11,needle=.5) {
    tube("rim",x,y,z,r*2.48,.089,Math.PI/2);
    part("ring","brass",x,y,z+.045,r*2.47,r*2.47,.22);
    const face=mesh(new THREE.CircleGeometry(r,22),gaugeMat);
    face.position.set(x,y,z+.052);
    beam("red",[x,y,z+.056],[x+Math.sin(needle)*r*.76,y+Math.cos(needle)*r*.76,z+.057],.015);
    ball("dark",x,y,z+.059,.040,.04,.018);
    tube("brass",x,y-r-.047,z,.057,.102);
  }
  function valve(x: number,y: number,z: number,size=.28) {
    tube("edge",x,y,z,size*.29,.125,Math.PI/2);
    part("ring","rust",x,y,z+.08,size,size,size);
    for(let i=0;i<3;i++) part("block","brass",x,y,z+.08,size*.72,.024,.026,0,0,i*Math.PI/3);
    hex("rim",x,y,z+.11,size*.27,.05);
  }
  const pickTargets: THREE.Object3D[] = [];
  const proxy = new THREE.MeshBasicMaterial({visible:false});
  for (const room of rooms) {
    const deck=deckProfiles[room.level], ceiling=deckProfiles[room.level+1];
    const y=deck.y, x=2.4*room.side;
    room.anchor=new THREE.Vector3(x,y+.95,1.63);
    if (!room.close) {
      box("deck",x,y+.05,2.03,4.38,.048,2.58);
      box("wall",x,y+.965,.24,4.40,1.82,.099);
    }
    box("rim",x,y+.15,.328,4.41,.16,.096);
    box("rim",x,y+1.68,.342,4.39,.072,.055);
    for (const dx of [-1.61,-.52,.52,1.61])
      box("frame",x+dx,y+.96,.305,.042,1.68,.045);
    for (const dx of [-1.95,-1.10,-.22,.68,1.53]) {
      box("edge",x+dx,y+.99,.309,.018,1.65,.032);
      for(const dy of [.30,.76,1.26,1.62]) hex("rim",x+dx,y+dy,.351,.029,.014);
    }
    beam("rim",[x-2.06,y+1.49,.39],[x+2.05,y+1.49,.39],.041);
    beam("brass",[x-2.06,y+1.42,.38],[x+2.05,y+1.42,.38],.029);
    if (!room.close) {
      const lx=x-.13*room.side, ly=y+1.59, lz=frontEdge(ceiling,lx)+.10;
      beam("steelEdge",[lx,ly+.24,lz-.42],[lx,ly+.24,lz+.02],.048,"block");
      const pendant=installPendant(lx,ly,lz,.33,"repair");
      lightPendant(pendant,[lx,ly,lz],[lx,ly-.093,lz],[lx-.16,ly-1.14,lz-1.04],
        {color:0xffbd72,power:26,cone:1.01,roomId:room.id});
    }
    const labelZ=frontEdge(ceiling,x)+.101;
    const tangent=frontEdge(ceiling,x+.25)-frontEdge(ceiling,x-.25);
    sign(room.id,x,ceiling.y-.118,labelZ,.54,.165,-Math.atan2(tangent,.5),"#d7d1b8","#293336");
    const points=[],indices=[];
    for(let i=0;i<=12;i++){
      const px=x-2.15+i*4.30/12;
      points.push(px,y+.058,frontEdge(deck,px),px,ceiling.y-.24,frontEdge(ceiling,px));
      if(i>0){const a=2*i;indices.push(a-2,a,a-1,a,a+1,a-1);}
    }
    const aperture=new THREE.BufferGeometry();
    aperture.setAttribute("position",new THREE.Float32BufferAttribute(points,3));
    aperture.setIndex(indices);
    const hit=mesh(aperture,proxy);
    hit.userData.room=room;
    pickTargets.push(hit);
  }
  // Upper-deck rooms. All meshes and maps are generated offline in the browser.
  const upperFloor=deckProfiles[3].y;
  const upper=(x: number,y: number,z: number): Point3 => [x,upperFloor+y,z];

  function enamelTexture(bright: Point3, dark: Point3, tiles=false) {
    return texture(512,(ctx,size)=>{
      const frame=ctx.createImageData(size,size);
      for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
        const u=x/size,v=y/size;
        const broad=surfaceNoise(u*8,v*8,8);
        const grime=surfaceNoise(u*29,v*29,29)*.54+surfaceNoise(u*72,v*9,72)*.46;
        const edge=Math.max(0,1-Math.min((y+2)%128,128-(y+2)%128)*.092);
        const chips=clamp01((grime*.68+broad*.16+edge*.25-.47)*3.85);
        const grout=tiles&&(x%128<3||y%128<3);
        const light=(hash2(x,y)-.5)*24+(broad-.5)*22;
        const offset=(y*size+x)*4;
        for(let channel=0;channel<3;channel++) {
          const color=THREE.MathUtils.lerp(bright[channel],dark[channel],chips)+light;
          frame.data[offset+channel]=grout?color*.50:color;
        }
        frame.data[offset+3]=255;
      }
      ctx.putImageData(frame,0,0);
    });
  }
  const oliveAge=enamelTexture([101,111,93],[58,48,33]);
  const whiteAge=enamelTexture([178,176,160],[91,78,64]);
  const slateAge=enamelTexture([125,125,116],[67,68,57],true);
  const brownAge=enamelTexture([129,113,88],[53,46,31]);
  const barkAge=enamelTexture([102,88,61],[45,41,26]);
  const quiltAge=enamelTexture([172,165,147],[117,111,96]);
  for(const [name,color,map,roughness,metalness] of [
    ["growSteel",0x989f8b,oliveAge,.63,.29],["growTrim",0xbbafa0,brownAge,.69,.33],
    ["greenWall",0x938b73,oliveAge,.96,.04],["oldCeramic",0xb5b6a3,whiteAge,.77,.11],
    ["clinicWall",0xb0a79b,whiteAge,.87,.06],["clinicTile",0x928d82,slateAge,.84,.03],
    ["bedSteel",0xa3a699,brownAge,.61,.39],["soil",0x625846,barkAge,.99,0],
    ["linen",0xd5cbbb,quiltAge,.96,0],["bedroll",0x8b9186,quiltAge,.96,0],
  ] as const){
    material(name,color,{map,roughness,metalness,bumpMap:luminanceMap(map,-34,257),bumpScale:.012});
  }
  for(const [name,color] of [["canvasShade",0x675c4e],["inkWood",0x3b3028],["berry",0xb49957],["clay",0x655345]] as const){
    material(name,color,{roughness:.88});
  }

  const upperPlinths=[
    {x:-2.4,wall:"greenWall",floor:"deck"},
    {x:2.4,wall:"clinicWall",floor:"clinicTile"},
  ];
  for(const {x,wall,floor} of upperPlinths){
    const footprint: Point2[]=[[x-2.19,.38],[x+2.19,.38],[x+2.19,3.38],[x-2.19,3.38]];
    floorShape(footprint,upperFloor+.049,.042,M[floor]);
    box(wall,...upper(x,.99,.235),4.38,1.87,.12);
    box(wall,...upper(x-Math.sign(x)*2.19,1.005,1.33),.10,1.88,2.12);
    for(let i=0;i<5;i++) {
      const xx=x-1.77+i*.876;
      box("frame",...upper(xx,.99,.305),.025,1.88,.035);
      for(const y of [.19,.60,1.02,1.52,1.81]) hex("growTrim",...upper(xx+.022,y,.334),.030,.016);
    }
  }

  const roofShade=texture(128,(ctx,size)=>{
    const gradient=ctx.createLinearGradient(0,0,0,size);
    gradient.addColorStop(0,"#1b160fd9");
    gradient.addColorStop(.21,"#211a146b");
    gradient.addColorStop(.52,"#201a161b");
    gradient.addColorStop(.89,"#1c171512");
    gradient.addColorStop(1,"#19140e78");
    ctx.fillStyle=gradient;ctx.fillRect(0,0,size,size);
  },false);
  const recessMat=new THREE.MeshBasicMaterial({map:roofShade,transparent:true,depthWrite:false,opacity:.63});
  for(const x of [-2.4,2.4]){
    const recessed=mesh(new THREE.PlaneGeometry(4.30,1.86),recessMat);
    recessed.position.set(...upper(x,1.007,.350));
  }
  function taskLamp(x: number,y: number,z: number,target: Point3,color: number,power: number,size: number=.24,cone: number=.88,roomId?: string) {
    const origin=upper(x,y,z);
    const pendant=installPendant(...origin,size,"growTrim");
    lightPendant(pendant,origin,upper(x,y-.089,z),upper(...target),{color,power,cone,roomId});
  }
  taskLamp(-3.38,1.71,2.08,[-3.2,.39,1.50],0xffc075,30,.32,.83,"04A");
  taskLamp(-1.81,1.52,3.57,[-1.53,.56,2.72],0xffcf87,14,.25,.83);
  taskLamp(1.33,1.52,3.56,[1.79,.44,1.63],0xffcb8a,24,.34,.89,"04B");
  taskLamp(3.91,1.73,2.05,[3.74,.60,1.0],0xffbd80,22,.30);

  const dirtyGlass=texture(256,(ctx,size)=>{
    const image=ctx.createImageData(size,size);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const u=x/size,v=y/size;
      const edge=1-clamp01(Math.min(u,1-u,v,1-v)*14);
      const grain=surfaceNoise(u*30,v*30,30);
      const streak=surfaceNoise(u*51,v*4,51);
      const offset=(y*size+x)*4;
      image.data[offset]=129+edge*33;
      image.data[offset+1]=134+edge*24;
      image.data[offset+2]=109+edge*17;
      const condensation=(1-clamp01((1-v)*4.5))*grain*14;
      image.data[offset+3]=16+grain*9+edge*51+condensation+clamp01((streak-.68)*3.1)*(16+edge*32);
    }
    ctx.putImageData(image,0,0);
    for(let i=0;i<142;i++){
      const x=rand()*size,y=rand()*size;
      ctx.fillStyle=choose(["#aab5a92a","#aebaaa31","#1e261b3d"]);
      ctx.fillRect(x,y,.38+rand()*.65,4+rand()**3*63);
    }
  },false);
  const upperGlass=new THREE.MeshPhysicalMaterial({map:dirtyGlass,color:0xe3e3cf,transparent:true,
    depthWrite:false,side:THREE.DoubleSide,roughness:.24,metalness:.055,clearcoat:.48,
    clearcoatRoughness:.32,envMapIntensity:1.26,opacity:.80});
  function glazingSurface(a: Point3,b: Point3,c: Point3,d: Point3,material=upperGlass) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute("position",new THREE.Float32BufferAttribute([...a,...b,...c,...d],3));
    geometry.setAttribute("uv",new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));
    geometry.setIndex([0,1,2,1,3,2]);
    geometry.computeVertexNormals();
    mesh(geometry,material);
  }

  // Arched ribs run across the roof of the greenhouse, with thicker jambs below them.
  const glazingRibs: Point2[]=[[-4.67,2.04],[-4.42,2.68],[-3.91,3.063],
    [-3.34,3.19],[-2.77,3.19],[-2.18,3.155],[-1.68,2.86]];
  const archSamples: Point2[]=[[1.21,0],[1.35,-.022],[1.49,-.105],[1.61,-.235],[1.72,-.43],[1.79,-.66],[1.83,-.89]];
  function archPoint([x,z]: Point2,[y,offset]: Point2) {
    return upper(x,y,z+offset);
  }
  for(const [x,z] of glazingRibs){
    box("growSteel",...upper(x,.72,z),.046,1.00,.062);
    box("growTrim",...upper(x+.012,.71,z+.027),.019,.967,.017);
    const rib=[...archSamples.map(point=>archPoint([x,z],point))];
    pipe("growSteel",rib,.030,15);
    for(const y of [.245,.747,1.205]) hex("growTrim",...upper(x,y,z+.043),.027,.017);
  }
  for(let i=1;i<glazingRibs.length;i++){
    const a=glazingRibs[i-1],b=glazingRibs[i];
    glazingSurface(archPoint(a,[.27,0]),archPoint(b,[.27,0]),archPoint(a,[1.21,0]),archPoint(b,[1.21,0]));
    for(let row=1;row<archSamples.length;row++){
      glazingSurface(archPoint(a,archSamples[row-1]),archPoint(b,archSamples[row-1]),
        archPoint(a,archSamples[row]),archPoint(b,archSamples[row]));
    }
    for(const [h,o] of [[.25,0],[.76,0],[1.21,0],archSamples[3],archSamples[6]]) {
      beam("growSteel",archPoint(a,[h,o]),archPoint(b,[h,o]),h<.77?.042:.030,"block");
    }
    const [x,z]=a, [nx,nz]=b;
    const turn=-Math.atan2(nz-z,nx-x);
    const width=Math.hypot(nx-x,nz-z);
    box("growSteel",...upper((x+nx)/2,.134,(z+nz)/2),width,.21,.065,turn);
    box("growTrim",...upper((x+nx)/2,.239,(z+nz)/2),width,.032,.091,turn);
  }
  box("growSteel",...upper(-1.683,.765,2.853),.074,1.08,.083);
  box("growTrim",...upper(-1.84,.701,2.917),.23,.026,.04,-.46);

  const plantSurface=texture(128,(ctx,size)=>{
    const gradient=ctx.createLinearGradient(0,0,0,size);
    gradient.addColorStop(0,"#9eaa65");
    gradient.addColorStop(.46,"#71804a");
    gradient.addColorStop(1,"#435638");
    ctx.fillStyle=gradient;ctx.fillRect(0,0,size,size);
    ctx.strokeStyle="#c8c19090";ctx.lineWidth=1.3;
    ctx.beginPath();ctx.moveTo(64,127);ctx.bezierCurveTo(61,85,68,48,64,0);ctx.stroke();
    for(let row=12;row<121;row+=10) for(const side of [-1,1]){
      ctx.strokeStyle="#c9cb9480";ctx.lineWidth=.59;
      ctx.beginPath();ctx.moveTo(64,row);
      ctx.quadraticCurveTo(64+side*19,row-7,64+side*59,row-21);ctx.stroke();
    }
  },false);
  for(const [key,tint] of [["herb",0xb6bd8a],["sprout",0xa5b56c],["vineLeaf",0x81935d],["leafShade",0x748d61]] as const){
    material(key,tint,{map:plantSurface,roughness:.62,side:THREE.DoubleSide});
  }
  function leafGeometry(lobed: boolean) {
    const position=[],uv=[],indices=[];
    const segments=10;
    for(let i=0;i<=segments;i++){
      const t=i/segments;
      const width=Math.pow(Math.sin(t*Math.PI),.85)*(.34+(lobed?.05:.025)*Math.cos(t*32));
      for(let j=0;j<3;j++){
        const side=j-1;
        position.push(side*width,t,Math.sin(t*Math.PI*.82)*.33-(Math.abs(side)*width*.31));
        uv.push(j/2,t);
        if(i&&j){
          const a=i*3+j;
          indices.push(a-4,a-3,a-1,a-3,a,a-1);
        }
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(position,3));
    g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(indices);g.computeVertexNormals();
    return g;
  }
  geometry.herb=leafGeometry(false);
  geometry.salad=leafGeometry(true);
  geometry.pot=lathe([[-.5,.04],[-.5,.28],[-.41,.32],[.32,.44],[.35,.49],[.5,.49],[.5,.43],[.34,.41]],13);
  function pottedPlant(x: number,y: number,z: number,size: number,kind: string) {
    const potHeight=.14*size;
    part("pot",kind==="salad"?"clay":"growSteel",x,y+potHeight*.5,z,.19*size,potHeight,.19*size);
    tube("soil",x,y+potHeight*.91,z,.155*size,.013);
    const height=.15*size, roots=y+potHeight*.91;
    beam("leaf", [x,roots,z],[x+.023,roots+height*.95,z],.011*size);
    for(let ring=0;ring<2;ring++){
      const count=kind==="salad"?8:5;
      for(let i=0;i<count;i++){
        const angle=2*Math.PI*i/count+rand()*.44+ring*.73;
        const len=(.09+rand()*.11+(.032*ring))*size;
        const shade=choose(["herb","sprout","vineLeaf","leafShade"]);
        part(kind,shade,x,roots+.027+ring*.039,z,len,len,len,
          .70+rand()*.57,angle,(rand()-.5)*.32);
      }
    }
  }
  for(const [tier,depth,row] of [[.45,1.90,0],[.76,1.39,1],[1.10,.91,2]]){
    const x=-3.26;
    const trayW=2.39;
    box("growSteel",...upper(x,tier-.061,depth),trayW,.077,.64);
    box("soil",...upper(x,tier-.008,depth),trayW-.04,.030,.597);
    for(const z of [depth-.305,depth+.305]) box("growTrim",...upper(x,tier+.025,z),trayW,.068,.035);
    for(const xx of [x-1.12,x+1.13]){
      box("growSteel",...upper(xx,(tier-.056)/2,depth),.066,tier-.06,.051);
      hex("growTrim",...upper(xx,tier+.013,depth+.334),.038,.028);
    }
    for(let col=0;col<8;col++) for(let line=0;line<2;line++){
      const localX=x-1.00+col*.278+(rand()-.5)*.075;
      const localZ=depth+(line-.5)*.275+(rand()-.5)*.067;
      pottedPlant(localX,upperFloor+tier+.013,localZ,.72+rand()*.53, (col+row)%3?"herb":"salad");
    }
    beam("rubber",upper(x-1.13,tier+.115,depth+.325),upper(x+1.16,tier+.115,depth+.325),.025);
  }
  for(const x of [-4.28,-3.18,-2.14]){
    beam("growSteel",upper(x,.11,2.25),upper(x,1.46,.62),.042,"block");
    for(const {y,z} of [{y:1.54,z:.86},{y:1.22,z:1.36}]){
      box("growTrim",...upper(x,y,z),.94,.081,.21);
      box("lamp",...upper(x,y-.046,z),.81,.016,.09);
    }
  }
  for(let i=0;i<5;i++) {
    const x=-4.15+i*.50,z=.65+(i%2)*.19;
    pipe("leaf", [upper(x,1.48,z),upper(x+.13,1.29,z+.16),upper(x+.01,1.17,z+.33),
      upper(x+.22,.92,z+.51)],.010,12);
    for(let k=0;k<8;k++){
      const y=1.44-k*.061;
      const leafLen=.104+rand()*.043;
      part("herb","sprout",...upper(x+(k%2)*.11,y,z+k*.057),leafLen,leafLen,leafLen,.76,rand()*6.28);
      if(k%3===0) ball("berry",...upper(x+.11,y-.015,z+k*.062),.049,.047,.048);
    }
  }
  pipe("brass",[upper(-4.60,1.73,.51),upper(-4.60,1.64,.73),upper(-4.61,1.05,1.23),
    upper(-4.53,.61,1.42),upper(-4.37,.53,1.53)],.023,17);
  valve(-4.60,upperFloor+.83,1.49,.17);
  for(const [x,z] of [[-4.54,1.30],[-3.91,2.44],[-2.12,2.20]]) contact(x,upperFloor+.049,z,.69,.59);

  // Contact occlusion follows the greenhouse base, tray stands, and bench legs.
  const greenhouseOcclusion=texture(256,(ctx,size)=>{
    const image=ctx.createImageData(size,size);
    const legs=[[-4.38,1.71],[-4.38,2.10],[-2.13,1.71],[-2.13,2.10],
      [-4.39,1.16],[-2.13,1.16],[-1.12,2.48],[-1.59,2.72],[-.89,2.46]];
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const px=-4.58+(x+.5)/size*4.31, pz=.40+(y+.5)/size*2.96;
      let shadow=0;
      for(const [lx,lz] of legs){
        shadow=Math.max(shadow,.48*Math.exp(-((px-lx)**2/.017+(pz-lz)**2/.019)));
      }
      for(const [bx,bz,rx,rz,opacity] of [[-3.26,1.64,1.25,.36,.20],[-1.24,2.60,.59,.32,.23],[-.89,2.51,.32,.26,.19]]){
        shadow=Math.max(shadow,opacity*Math.exp(-((px-bx)**2/(rx*rx)+(pz-bz)**2/(rz*rz))));
      }
      const edge=Math.min(x,y,size-1-x,size-1-y);
      const at=(y*size+x)*4;
      image.data[at]=39;image.data[at+1]=33;image.data[at+2]=23;
      image.data[at+3]=255*shadow*clamp01(edge/15);
    }
    ctx.putImageData(image,0,0);
  },false);
  const greenhouseAO=mesh(new THREE.PlaneGeometry(4.31,2.96),new THREE.MeshBasicMaterial({
    map:greenhouseOcclusion,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1
  }));
  greenhouseAO.rotation.x=-Math.PI/2;
  greenhouseAO.position.set(-2.425,upperFloor+.057,1.88);

  function roundedGeometry(width: number,height: number,depth: number,radius: number) {
    const hw=width/2,hh=height/2;
    const shape=new THREE.Shape();
    shape.moveTo(-hw+radius,-hh);
    shape.lineTo(hw-radius,-hh);
    shape.quadraticCurveTo(hw,-hh,hw,-hh+radius);
    shape.lineTo(hw,hh-radius);
    shape.quadraticCurveTo(hw,hh,hw-radius,hh);
    shape.lineTo(-hw+radius,hh);
    shape.quadraticCurveTo(-hw,hh,-hw,hh-radius);
    shape.lineTo(-hw,-hh+radius);
    shape.quadraticCurveTo(-hw,-hh,-hw+radius,-hh);
    const g=new THREE.ExtrudeGeometry(shape,{depth:depth-2*radius,bevelEnabled:true,bevelThickness:radius,
      bevelSize:radius*.55,bevelSegments:3,curveSegments:8});
    g.translate(0,0,-(depth-2*radius)*.5);
    const uv=g.getAttribute("uv");
    for(let i=0;i<uv.count;i++) uv.setXY(i,.5+uv.getX(i)/width,.5+uv.getY(i)/Math.max(height,depth));
    return g;
  }
  function placeRounded(kind: string,at: Point3,size: Point3,r: number,rx=0,ry=0,rz=0) {
    const piece=mesh(roundedGeometry(...size,r),M[kind]);
    piece.position.set(...at);
    piece.rotation.set(rx,ry,rz);
    return piece;
  }
  function axis(x: number,y: number,z: number,yaw: number): LocalPoint {
    const c=Math.cos(yaw), s=Math.sin(yaw);
    return (a,b,d)=>[x+a*c+d*s,y+b,z-a*s+d*c];
  }
  function posePoint(p: LocalPoint,yaw: number,type: string,shade: string,a: number,b: number,c: number,w: number,h: number,d: number,rx=0,rz=0) {
    part(type,shade,...p(a,b,c),w,h,d,rx,yaw,rz);
  }

  // Position and heading of the seat are the reference for a future imported crew model.
  const greenhouseBenchOrigin: Point3=[-.91,upperFloor+.049,2.48];
  const greenhouseBenchHeading=-1.02;
  const benchPoint=axis(...greenhouseBenchOrigin,greenhouseBenchHeading);
  const workbenchLook=new THREE.Vector3(...benchPoint(0,.49,.39));
  material("seatPad",0x766c59,{map:canvasWeave,roughness:.96,bumpMap:fabricRelief,bumpScale:.0048});
  material("rootSoil",0x5a4b3a,{map:barkAge,bumpMap:steelRelief,bumpScale:.036,roughness:.99});

  crate(-.904,upperFloor+.049,2.465,.509,.375,.462);
  placeRounded("seatPad",benchPoint(-.015,.390,-.028),[.448,.043,.401],.017,0,greenhouseBenchHeading);
  contact(...benchPoint(0,0,-.049),.74,.61);

  for(let i=0;i<4;i++) box("timber",...benchPoint(0,.531,.426+i*.156),.638,.065,.151,greenhouseBenchHeading);
  placeRounded("growTrim",benchPoint(0,.488,.394),[.597,.060,.033],.007,0,greenhouseBenchHeading);
  for(const x of [-.253,.253]) for(const z of [.425,.888]){
    beam("woodEdge",benchPoint(x,.018,z),benchPoint(x,.511,z),.053,"block");
    hex("growTrim",...benchPoint(x,.576,z),.028,.012,0);
    contact(...benchPoint(x,.008,z),.143,.137);
  }
  beam("growSteel",benchPoint(-.252,.19,.901),benchPoint(.252,.19,.901),.037,"block");
  beam("growTrim",benchPoint(-.247,.33,.898),benchPoint(.251,.46,.898),.038,"block");
  contact(...benchPoint(0,0,.68),.79,.75);
  pottedPlant(...benchPoint(.009,.564,.583),1.04,"herb");
  part("pot","clay",...benchPoint(-.207,.617,.777),.13,.108,.13);
  part("pot","growSteel",...benchPoint(.223,.602,.805),.090,.082,.090);
  placeRounded("oldCeramic",benchPoint(.183,.574,.661),[.160,.020,.105],.007,0,greenhouseBenchHeading+.19);
  pipe("growTrim",[benchPoint(-.195,.579,.55),benchPoint(-.151,.585,.651),benchPoint(-.125,.581,.726)],.009,9);
  ball("woodEdge",...benchPoint(-.197,.584,.537),.025,.021,.067);
  for(let i=0;i<17;i++) {
    const x=(hash2(i,43)-.5)*.43,z=.585+(hash2(i,81)-.5)*.36;
    if(Math.hypot(x-.009,z-.583)>.091)
      ball("rootSoil",...benchPoint(x,.570,z),.011+hash2(i,12)*.011,.006,.016);
  }
  drum(-.56,upperFloor+.049,1.45,"growSteel",.32,.48);
  pipe("growTrim",[upper(-.55,.61,1.43),upper(-.38,.68,1.44),upper(-.34,.48,1.45)],.010,13);


  function bedCloth(p: LocalPoint,shade: string,w=.78,length=1.45,baseY=.59){
    const pos=[],uv=[],indices=[];
    const across=34,long=49;
    function point(u: number,v: number){
      const side=Math.abs(2*u-1);
      const x=(u-.5)*w*(.96+.040*Math.sin(v*31));
      const z=(v-.47)*length+.22;
      const creases=(.008+.014*side)*Math.sin(u*37+Math.sin(v*13)*1.75)
        +.008*Math.sin(v*37+u*12)*Math.sin(u*Math.PI)+.007*Math.sin(v*83+u*11);
      const overhang=clamp01((side-.80)/.20)**2*.092+.019*(v**7);
      return p(x,baseY+creases-overhang,z);
    }
    for(let iz=0;iz<=long;iz++){
      const v=iz/long;
      for(let ix=0;ix<=across;ix++){
        const u=ix/across;
        pos.push(...point(u,v));
        uv.push(u,v);
        if(iz&&ix){
          const a=iz*(across+1)+ix;
          indices.push(a-across-2,a-1,a,a-across-2,a,a-across-1);
        }
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(indices);g.computeVertexNormals();
    mesh(g,M[shade]);
    for(const u of [.01,.98]){
      const edge=[];
      for(let i=0;i<=11;i++) edge.push(point(u,i/11));
      pipe("canvasShade",edge,.0037,30);
    }
    pipe("linen",[0,.16,.36,.55,.75,1].map(u=>point(u,.032)),.007,21);
  }
  function bedstead(x: number,z: number,yaw: number,blanket: string){
    const p=axis(x,upperFloor+.049,z,yaw);
    const q=(type: string,shade: string,a: number,b: number,c: number,w: number,h: number,d: number,rx=0,rz=0)=>posePoint(p,yaw,type,shade,a,b,c,w,h,d,rx,rz);
    contact(x,upperFloor+.049,z,1.28,1.89);
    for(const side of [-1,1]){
      const xx=side*.323;
      beam("bedSteel",p(xx,.288,-.806),p(xx,.288,.815),.084,"block");
      beam("growTrim",p(xx,.497,-.827),p(xx,.497,.825),.045,"block");
      for(const z of [-.724,.728]){
        beam("growTrim",p(xx,.071,z),p(xx,.471,z),.046);
        q("tube","rubber",xx,.065,z,.106,.068,Math.PI/2);
        q("tube","growTrim",xx,.065,z+.036,.063,.017,Math.PI/2);
        hex("growTrim",...p(xx,.192,z+.035),.043,.022);
      }
    }
    beam("bedSteel",p(-.34,.403,-.76),p(.36,.403,.76),.050,"block");
    beam("bedSteel",p(.34,.397,-.76),p(-.36,.397,.76),.050,"block");
    for(const [z,top] of [[-.85,.831],[.85,.674]]){
      const corners=[p(-.349,.44,z),p(-.356,top-.045,z),p(-.298,top,z),
        p(.298,top,z),p(.357,top-.044,z),p(.351,.443,z)];
      pipe("bedSteel",corners,.027,30);
      q("block","oldCeramic",0,top-.119,z,.575,.123,.043);
      for(const a of [-.302,.302]) hex("growTrim",...p(a,top-.12,z+.028),.037,.026);
    }
    placeRounded("linen",p(0,.495,0),[.726,.136,1.623],.054,0,yaw);
    placeRounded("linen",p(.020,.621,-.59),[.53,.098,.344],.046,0,yaw-.14,-.04);
    bedCloth(p,blanket,.804,1.36,.571);
  }

  bedstead(1.52,1.98,.62,"bedroll");
  bedstead(3.82,1.22,-.40,"linen");

  function cabinet(x: number,z: number,w=.63,h=1.49){
    placeRounded("oldCeramic",upper(x,h/2+.055,z),[w,h,.38],.029);
    box("bedSteel",...upper(x,.106,z),w+.022,.105,.405);
    for(const y of [.28,.59,1.02,1.335]){
      box("growTrim",...upper(x,y,z+.205),w-.072,.254,.024);
      box("oldCeramic",...upper(x,y,z+.222),w-.087,.235,.020);
      beam("growTrim",upper(x-.083,y+.045,z+.243),upper(x+.093,y+.045,z+.243),.023);
      hex("bedSteel",...upper(x+w*.29,y+.038,z+.244),.024,.013);
    }
  }
  cabinet(.58,.63,.53);
  cabinet(3.08,.62,.51);
  const medicalPlaque=texture(256,(ctx,size)=>{
    ctx.fillStyle="#a59c86";ctx.fillRect(0,0,size,size);
    ctx.fillStyle="#c1b9a4";ctx.fillRect(8,8,size-16,size-16);
    ctx.strokeStyle="#47453a";ctx.lineWidth=4;ctx.strokeRect(7,7,size-14,size-14);
    ctx.fillStyle="#733b35";ctx.fillRect(107,39,42,115);ctx.fillRect(70,75,116,43);
    ctx.fillStyle="#544738";ctx.textAlign="center";ctx.font="bold 22px monospace";
    ctx.fillText("FIRST AID",128,192);
    ctx.font="13px monospace";ctx.fillText("MEDICAL STORES",128,219);
    for(let i=0;i<1100;i++){
      ctx.fillStyle=choose(["#35291f12","#6b4c2e20","#e6e0c62a"]);
      ctx.fillRect(rand()*size,rand()*size,1+rand()*4,1+rand()*2);
    }
  },false);
  const medicalSign=mesh(new THREE.PlaneGeometry(.42,.40),new THREE.MeshStandardMaterial({map:medicalPlaque,roughness:.91}));
  medicalSign.position.set(...upper(1.33,1.368,.378));
  for(const x of [1.142,1.519]) for(const y of [1.184,1.551]) hex("growTrim",...upper(x,y,.385),.024,.017);

  // Diagnostic equipment, IV stand, jars, linen trays and bedside work area.
  function ivStand(x: number,z: number){
    tube("bedSteel",...upper(x,.805,z),.025,1.426);
    tube("growTrim",...upper(x,1.465,z),.036,.223);
    for(let i=0;i<4;i++){
      const a=Math.PI*.5*i;
      beam("bedSteel",upper(x,.12,z),upper(x+Math.cos(a)*.169,.095,z+Math.sin(a)*.169),.030);
      tube("rubber",...upper(x+Math.cos(a)*.157,.068,z+Math.sin(a)*.157),.042,.052);
    }
    pipe("growTrim",[upper(x+.137,1.55,z),upper(x+.127,1.596,z),upper(x,1.58,z),upper(x-.133,1.58,z),upper(x-.14,1.526,z)],.009,18);
    const bag=placeRounded("linen",upper(x-.131,1.381,z+.008),[.099,.168,.055],.018,0,-.22,-.08);
    bag.material=M.linen.clone();
    bag.material.roughness=.40;
    bag.material.color.setHex(0xd0c8ac);
    ball("oldCeramic",...upper(x-.13,1.272,z+.009),.034,.052,.029);
    pipe("oldCeramic",[upper(x-.131,1.26,z),upper(x-.14,1.00,z+.028),upper(x-.172,.780,z+.105),upper(x-.344,.637,z+.252)],.0055,19);
  }
  ivStand(1.07,1.38);
  ivStand(4.31,1.66);
  table(3.50,upperFloor+.049,2.79,.843,.638,.454,"timber");
  placeRounded("oldCeramic",upper(3.53,.739,2.82),[.29,.064,.16],.017,0,.33);
  for(let i=0;i<4;i++) placeRounded("linen",upper(3.25,.733+i*.022,2.756),[.163,.018,.171],.006,0,.04+i*.085);
  placeRounded("linen",upper(3.79,.717,2.89),[.224,.014,.18],.005,0,.22);
  for(let i=0;i<5;i++) box("canvasShade",...upper(3.789,.729,2.833+i*.018),.137,.001,.003,.22);
  beam("inkWood",upper(3.741,.734,2.92),upper(3.842,.736,2.908),.010);
  gauge(3.91,upperFloor+.791,2.77,.053,.68);

  function medicine(x: number,y: number,z: number,tint: string,size=1){
    const d=.078*size,h=.113*size;
    tube(tint,x,y+h*.48,z,d,h*.94);
    tube("oldCeramic",x,y+h*.52,z,d+.002,h*.40);
    tube("growTrim",x,y+h*.98,z,d*.66,h*.19);
  }
  for(const y of [.823,1.146,1.452]){
    box("bedSteel",...upper(2.275,y-.026,.63),1.29,.060,.43);
    box("growTrim",...upper(2.275,y-.014,.847),1.32,.044,.030);
    for(let i=0;i<8;i++){
      const x=1.726+i*.149;
      if(i%4===2) placeRounded("oldCeramic",upper(x,y+.056,.66),[.122,.098,.112],.013,0,.09);
      else medicine(...upper(x,y,.68),choose(["clay","glass","oldCeramic","growSteel"]),.69+rand()*.41);
    }
  }
  for(const x of [1.629,2.936]) box("growTrim",...upper(x,1.12,.69),.044,.84,.414);
  pipe("growTrim",[upper(.45,1.79,.416),upper(2.74,1.785,.42),upper(2.94,1.61,.426),upper(2.935,1.42,.435)],.019,23);
  for(const x of [.76,2.03,2.69]) hex("bedSteel",...upper(x,1.785,.447),.047,.023);
  contact(...upper(3.50,.049,2.79),1.15,.67);

  {
    const y=deckProfiles[2].y;
    box("marineGuard",-3.33,y+.079,1.75,1.77,.015,1.12,.12);
    contact(-3.34,y+.091,1.76,1.84,1.20);
    for(const [x,z] of [[-4.108,1.18],[-2.52,1.39],[-4.20,2.17],[-2.59,2.36]])
      hex("steelEdge",x,y+.095,z,.041,.012,0);
    const galleyBackplate=placeRounded("marineDark",[-3.38,y+1.11,.759],[1.56,1.29,.045],.013,0,-.028);
    galleyBackplate.name="Galley heat shield";
    for(const at of [[-4.085,1.68],[-2.66,1.68],[-4.082,.54],[-2.68,.53]]) hex("steelEdge",at[0],y+at[1],.798,.048,.017);
    table(-1.3,y,1.74,1.35,.81,.77);
    box("ivory",-1.30,y+.89,1.76,.37,.04,.25);
    ball("red",-1.37,y+.94,1.78,.12,.11,.12);

    shelf(3.59,y,.48,1.85);
    table(2.3,y,1.62,1.81,.82,.89);
    box("cloth",2.28,y+.89,1.62,.55,.035,.58);
    tube("ivory",2.18,y+.928,1.82,.18,.035);
    tube("blue",2.51,y+.99,1.57,.11,.15);
    box("ivory",2.74,y+.901,1.43,.29,.024,.22,.18);
    box("timber",2.85,y+.903,1.70,.33,.025,.25,-.17);
    for(let i=0;i<4;i++) box("dark",2.76,y+.918,1.37+i*.038,.108,.004,.003,.18);
    tube("rim",1.85,y+.93,1.46,.144,.07);
    box("frame",1.04,y+.67,.65,.82,1.22,.36);
    for(const py of [.32,.68,1.04]) {
      box("repair",1.04,y+py,.845,.73,.315,.05);
      box("rim",1.11,y+py+.042,.88,.17,.026,.054);
    }
    for (const x of [1.43,3.18]) {
      crate(x,y,2.56,.49,.40,.47);

    }
  }
  {
    const y=deckProfiles[1].y;
    for (const x of [-4.04,-3.07,-2.10]) {
      drum(x,y,.94,"blue",.76,1.34);
      beam("brass",[x,y+1.38,.94],[x,y+1.64,.94],.09);
      beam("edge",[x-.24,y+.67,1.314],[x-.24,y+1.13,1.314],.031);
      for(const h of [.66,1.14]) hex("brass",x-.24,y+h,1.326,.057,.03);
      gauge(x+.14,y+1.097,1.28,.070,x*.63);
    }
    beam("brass",[-4.04,y+1.64,.94],[-1.31,y+1.64,.94],.11);
    drum(-1.0,y,1.26,"blue",.42,.69);
    pipe("brass",[[-4.21,y+.38,.87],[-4.37,y+.35,1.12],[-4.35,y+.35,1.65],[-4.08,y+.35,1.83],[-1.34,y+.35,1.83],[-1.21,y+.50,1.85],[-1.21,y+1.11,1.85]],.054,23);
    valve(-1.22,y+.92,1.86,.29);

    shelf(3.76,y,.53,1.72);
    crate(3.56,y,2.20,.77,.53,.67);
    crate(3.81,y+.54,2.12,.64,.49,.55);
    crate(4.26,y,1.49,.60,.53,.57);
    box("amber",1.27,y+.53,1.83,.95,1.04,.68);
    box("dark",1.27,y+.70,2.195,.66,.36,.035);
    sign("12V",1.27,y+.70,2.22,.32,.16);
    box("rim",1.27,y+.23,2.193,.84,.29,.031);
    for(let i=0;i<6;i++) box("edge",1.27,y+.13+i*.033,2.218,.73,.008,.014);
    for(const x of [1.02,1.54]) {
      tube("rust",x,y+1.083,1.88,.135,.091);
      pipe("dark",[[x,y+1.12,1.88],[x,y+1.24,1.81],[x+.16,y+1.27,1.52],[x+.21,y+1.11,1.23],[x+.23,y+.47,1.23]],.024,12);
    }
    box("repair",4.28,y+.96,2.27,.35,.31,.26);
    box("edge",4.28,y+1.125,2.27,.37,.046,.28);
    drum(2.30,y,.94,"rust",.50,.69);

  }
  {
    const y=base;
    table(-3.13,y,1.54,1.87,.83,.82);
    box("edge",-3.28,y+.96,1.49,.38,.15,.30);
    beam("rust",[-2.73,y+.915,1.32],[-2.41,y+.915,1.57],.04);
    box("repair",-3.26,y+1.29,.39,1.8,.64,.052);
    for(let i=0;i<22;i++) {
      const py=y+1.055+Math.floor(i/7)*.14;
      hex("rim",-4.00+(i%7)*.24,py,.424,.034,.026);
    }
    for(let i=0;i<6;i++){
      const x=-3.91+i*.244;
      tube(i%2?"edge":"brass",x,y+1.23,.441,.041,.317,0,.19-i*.071);
      box("rim",x,y+1.374,.449,.076,.073,.043);
    }
    shelf(-1.46,y,.49,1.31);
    crate(-1.11,y,2.41,.65,.51,.72);

    box("rim",2.64,y+.11,1.60,2.72,.22,1.35);
    contact(2.64,y,1.60,3.4,1.92);
    tube("blue",2.27,y+.83,1.57,1.22,1.55,0,Math.PI/2);
    for (const x of [1.52,1.66,2.76,2.95]) {
      tube("rim",x,y+.83,1.57,1.26,.093,0,Math.PI/2);
      for(let i=0;i<10;i++){
        const a=i/10*Math.PI*2;
        hex("edge",x-.055,y+.83+Math.sin(a)*.58,1.57+Math.cos(a)*.58,.068,.037,0,Math.PI/2);
      }
    }
    for(let i=0;i<13;i++) {
      const a=i/13*Math.PI*2;
      beam("blue",[1.73,y+.83+Math.sin(a)*.615,1.57+Math.cos(a)*.615],
        [2.74,y+.83+Math.sin(a)*.615,1.57+Math.cos(a)*.615],.057,"block");
    }
    box("repair",2.20,y+.95,2.217,.54,.20,.056);
    sign("P–07",2.20,y+.95,2.251,.44,.14);
    tube("rim",3.0,y+.83,2.10,.94,.38,Math.PI/2);
    part("ring","rust",3.0,y+.83,2.325,.92,.92,.92);
    for (let i=0;i<3;i++) part("block","brass",3.0,y+.83,2.356,.62,.062,.063,0,0,i*Math.PI/3);
    tube("brass",3.0,y+.83,2.367,.17,.09,Math.PI/2);
    for (const x of [3.65,4.13]) {
      beam("rust",[x,y+.30,1.55],[x,y+1.52,1.55],.16);
      beam("rust",[x,y+1.52,1.55],[x,y+1.52,.54],.16);
      ball("rust",x,y+1.52,1.55,.173,.173,.173);
      tube("edge",x,y+1.40,1.55,.245,.095);
    }
    gauge(2.35,y+1.55,1.80,.108,.64);
    gauge(3.65,y+1.36,1.75,.085,-.51);
    valve(4.13,y+.79,1.73,.30);
    pipe("brass",[[2.35,y+1.42,1.77],[2.35,y+1.33,1.59],[2.61,y+1.24,1.49],[3.23,y+1.24,1.42],[3.39,y+1.38,1.42],[3.39,y+1.77,1.42]],.028,19);

    drum(-2.1,y,4.10,"rim",.48,.62);
    crate(-2.98,y,3.88,.54,.44,.55);
    for (let i=0;i<4;i++) part("ring","woodEdge",-.94,y+.11+i*.051,4.47,.85,.85,.85,Math.PI/2);
  }

  for (const [x,z] of [[2.66,-3.7],[3.43,-3.51],[3.89,-2.9],[1.74,-3.22]]) crate(x,roof,z);


  function coil(cx: number,y: number,cz: number,radius: number,turns=4.5){
    const points=[];
    for(let i=0;i<=72;i++){
      const progress=i/72,a=progress*turns*Math.PI*2;
      const r=radius*(.20+progress*.74);
      points.push([cx+Math.cos(a)*r,y+.055+Math.sin(a*2)*.008,cz+Math.sin(a)*r*.84]);
    }
    points.push([cx+radius*.89,y+.055,cz+radius*.31],[cx+radius*1.47,y+.053,cz+radius*.22]);
    pipe("woodEdge",points,.024,110);
  }
  function cleat(x: number,y: number,z: number){
    box("repair",x,y+.027,z,.29,.058,.19);
    tube("rim",x,y+.098,z,.102,.155);
    beam("edge",[x-.122,y+.17,z],[x+.122,y+.17,z],.061);
    hex("brass",x+.095,y+.066,z,.046,.022,0);
    hex("brass",x-.095,y+.066,z,.046,.022,0);
  }
  for(const [x,z] of [[-4.36,2.96],[4.41,2.77],[-3.67,-4.34],[3.88,-4.31]]) cleat(x,roof,z);
  coil(2.38,roof,-2.29,.43);
  coil(-2.65,base+sheer(5.04),5.04,.39);
  coil(-1.91,roof,1.63,.225,3.5);


  const deckSheen=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{time:{value:0}},
    vertexShader:`
      varying vec2 deckPoint;
      varying vec3 deckWorld;
      void main(){
        deckPoint=position.xy*vec2(1.,-1.);
        deckWorld=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }`,
    fragmentShader:`
      uniform float time;
      varying vec2 deckPoint;
      varying vec3 deckWorld;
      float hash(vec2 p){return fract(sin(dot(p,vec2(144.7,261.1)))*42718.73);}
      float clouds(vec2 p){
        vec2 i=floor(p), f=fract(p);
        f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);
      }
      float depression(vec2 p,vec2 center,vec2 radius){
        vec2 d=(p-center)/radius;
        return 1.-smoothstep(.62,1.31,dot(d,d));
      }
      void main(){
        vec2 p=deckPoint;
        float basins=max(max(depression(p,vec2(-2.06,.87),vec2(1.68,.58)),
                              depression(p,vec2(.38,-2.83),vec2(1.39,.71))),
                          max(depression(p,vec2(1.56,1.96),vec2(1.46,.49)),
                              depression(p,vec2(-2.47,-1.78),vec2(1.01,.52))));
        float dirty=clouds(p*vec2(1.17,1.94))*.59+clouds(p*vec2(3.39,4.92))*.32+clouds(p*19.)*.09;
        float mask=smoothstep(.62,.83,basins*.40+dirty*.60);
        if(mask<.004) discard;
        vec3 viewDir=normalize(cameraPosition-deckWorld);
        float grazing=.37+.63*pow(1.-max(viewDir.y,0.),1.73);
        float ripple=sin(p.x*52.+p.y*37.+sin(p.y*21.+time*.54)*1.9-time*1.26);
        float lights=clouds(p*vec2(.38,.76)+vec2(viewDir.x,viewDir.z)*2.3);
        float glint=smoothstep(.53,.83,lights+ripple*.064);
        gl_FragColor=vec4(mix(vec3(.126,.166,.174),vec3(.58,.65,.66),glint),mask*grazing*.50);
        #include <encodings_fragment>
      }`
  });
  const roofShape=new THREE.Shape(roofOutline.map(([x,z])=>new THREE.Vector2(x,-z)));
  const puddleGeometry=new THREE.ShapeGeometry(roofShape);
  const puddles=mesh(puddleGeometry,deckSheen);
  puddles.rotation.x=-Math.PI/2;
  puddles.position.set(0,roof+.008,0);

  const vaporMap=texture(64,(ctx)=>{
    for(const [x,y,r,opacity] of [[24,35,18,.22],[39,32,20,.20],[31,21,16,.19]]){
      const cloud=ctx.createRadialGradient(x,y,0,x,y,r);
      cloud.addColorStop(0,"rgba(235,225,201,"+opacity+")");
      cloud.addColorStop(1,"#eee5d000");
      ctx.fillStyle=cloud;ctx.fillRect(0,0,64,64);
    }
  },false);
  const kitchenSteam=Array.from({length:9},(_,i)=>{
    const p=new THREE.Sprite(new THREE.SpriteMaterial({map:vaporMap,transparent:true,depthWrite:false,opacity:0}));
    vessel.add(p);
    return {p,phase:i/9,drift:rand()-.5};
  });


  drum(3.33,roof,-1.89,"rim",.57,.61);
  tube("rim",3.83,roof+.13,-3.92,.71,.25);
  box("rim",3.83,roof+.91,-3.92,.35,1.76,.35);
  beam("edge",[3.83,roof+1.77,-3.92],[1.20,roof+2.23,-3.83],.27,"block");
  beam("rim",[3.83,roof+.95,-3.93],[2.64,roof+1.99,-3.84],.134,"block");
  for (let i=0;i<6;i++) box("brass",1.34+i*.45,roof+2.24-i*.071,-3.69,.059,.075,.037);
  installCraneRope();
  const crane: Point3[] = [[3.83,roof+1.77,-3.73],[1.20,roof+2.23,-3.64]];
  beam("rim",crane[0],crane[1],.106,"block");
  box("repair",3.83,roof+.83,-3.716,.26,1.31,.071);
  for(const py of [.23,.55,1.08,1.51]){
    hex("edge",3.78,roof+py,-3.67,.084,.057);
    hex("rust",3.93,roof+py,-3.67,.076,.051);
  }
  tube("rim",2.94,roof+1.32,-3.77,.35,.48,Math.PI/2);
  for(const z of [-3.51,-4.04]){
    tube("edge",2.94,roof+1.32,z,.38,.056,Math.PI/2);
    tube("brass",2.94,roof+1.32,z+.043,.10,.075,Math.PI/2);
  }
  pipe("hose",[[3.12,roof+.71,-3.57],[3.03,roof+.94,-3.54],[3.07,roof+1.37,-3.55],[3.35,roof+1.62,-3.64],[3.77,roof+1.84,-3.67]],.023,19);
  for(let i=0;i<5;i++){
    const x=1.31+i*.50, py=roof+2.21-i*.088;
    hex("edge",x,py,-3.591,.056,.034);
    hex("rust",x,py-.11,-3.591,.049,.033);
  }
  sign("SWL",3.84,roof+1.17,-3.638,.20,.145,0,"#4c3823","#a58b51");
  drum(-4.14,roof,-3.27,"rim",.49,.59);
  box("repair",-4.20,roof+.21,-2.4,.49,.41,.57);
  box("rim",-4.20,roof+.43,-2.4,.52,.035,.59);
  for(const zz of [-2.51,-2.31]) box("edge",-4.02,roof+.457,zz,.079,.049,.14);

  // The cut along the starboard topsides exposes the ends of the living decks.
  for (let level = 0; level < 4; level++) {
    const lip = exposedSide[level];
    const outline = Array.from({length: 15}, (_, i) => sidePos(level, lip * i / 14, .016, 1, .045));
    pipe("steelEdge", outline, .039, 20);
    beam("marineGuard", sidePos(level,lip,0), sidePos(level,lip,1), .115, "block");
    for (const v of [.08,.37,.68,.91]) ball("steelEdge", ...sidePos(level,lip,v,1,.069), .056,.056,.056);
  }

  // Worn handrails, small windows and a rubber-fender line give the aft shell scale.
  for (const [u,level] of [[.44,1],[.71,0],[.84,2]]) {
    const a=sidePos(level,u,.86,1,.12), b=sidePos(level,u+.025,.30,1,.16);
    beam("woodEdge",a,b,.037);
    const tire=mesh(new THREE.TorusGeometry(.235,.084,10,22),M.rubber);
    tire.rotation.set(.10,Math.PI/2-.10,-.23);
    tire.position.set(...b); tire.position.y-=.14;
  }
  // Slewing jib: pivot pins, sheave cheeks, topping cable and a link at the shackle.
  const jibTip: Point3 = [1.20,roof+2.23,-3.83];
  for (const z of [-3.97,-3.66]) {
    tube("marinePatch",1.19,roof+2.19,z,.33,.045,Math.PI/2);
    hex("brass",1.19,roof+2.19,z+.035,.11,.033);
  }
  pipe("steelEdge",[[3.85,roof+2.02,-3.90],[3.24,roof+2.12,-3.88],[1.65,roof+2.33,-3.84],jibTip],.020,18);
  for (const x of [3.56,4.10]) {
    beam("marineStrake",[x,roof+.1,-3.57],[3.82,roof+.62,-3.86],.12,"block");
    hex("steelEdge",x,roof+.105,-3.57,.10,.065,0);
  }
  // Extra stores occupy the working edge, keeping the central deck clear.
  crate(2.18,roof,-3.83,.89,.56,.73);
  crate(2.20,roof+.56,-3.85,.73,.42,.58);
  drum(.78,roof,-3.39,"steelEdge",.53,.65);
  coil(.43,roof,-2.68,.37,5);
  refitBuoy(-2.76,roof+.38,-7.25,0,.96);

  // Fittings on the forward face stay visible through the main cut.
  const agedTin=new THREE.MeshStandardMaterial({color:0xb6b5a4,metalness:.65,roughness:.39,
    roughnessMap:marineRough,bumpMap:marineHeight,bumpScale:.006});
  agedTin.color.setHex(0x91a5aa);M.galvanized=agedTin;
  material("clothBlue",0x617177,{map:canvasWeave,roughness:.97});
  material("enamel",0xcfbc91,{roughness:.48});
  material("bamboo",0xb39367,{roughness:.69});
  const stowedChart=texture(256,(ctx,s)=>{
    ctx.fillStyle="#c5b990";ctx.fillRect(0,0,s,s);
    ctx.strokeStyle="#a4997d";ctx.lineWidth=.8;
    for(let i=0;i<256;i+=27){ctx.fillRect(i,0,.5,s);ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(s,i);ctx.stroke();}
    for(let k=0;k<6;k++){
      ctx.beginPath();for(let i=0;i<=100;i++){
        const x=i*2.6,y=64+36*Math.sin(i*.092)+22*Math.sin(i*.147)+k*4+6*surfaceNoise(i*.45,k*.16,120);
        if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }ctx.strokeStyle=k===0?"#626953":"#96a197";ctx.stroke();
    }
    ctx.strokeStyle="#8a604d";ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(10,199);
    ctx.lineTo(88,161);ctx.lineTo(186,177);ctx.lineTo(220,155);ctx.stroke();
  },false);
  M.chart=new THREE.MeshStandardMaterial({map:stowedChart,color:0xd3c5a5,side:THREE.DoubleSide,roughness:1});
  const chart=mesh(new THREE.PlaneGeometry(1.24,.69,8,3),M.chart);
  const paper=chart.geometry.attributes.position;
  for(let i=0;i<paper.count;i++)paper.setZ(i,.017*Math.cos(paper.getX(i)*14)+Math.abs(paper.getY(i))*.043);
  chart.geometry.computeVertexNormals();chart.rotation.set(-Math.PI/2,0,.06);
  chart.position.set(2.27,deckProfiles[2].y+.936,1.73);

  // Front benches and the inspection equipment give each deck a working edge.
  for(const [x,level,z,w] of [[-2.65,0,2.95,1.52],[1.12,3,3.05,1.09]]) {
    const y=deckProfiles[level].y;
    table(x,y,z,w,.63,.55);
    for(const dx of [-.31,.29]) {
      tube("galvanized",x+dx,y+.738,z,.19,.11);
      tube("enamel",x+dx,y+.798,z,.173,.015);
    }
    box("cloth",x+.04,y+.713,z+.12,.35,.043,.25,.17);
  }
  for(const [level,x,z] of [[2,4.31,2.03],[1,3.09,2.98],[0,-.85,2.98]]) {
    const y=deckProfiles[level].y;
    for(let i=0;i<2;i++) drum(x+i*.43,y,z-.06*i,"galvanized",.40,.47+i*.15);
  }
  const waterY=deckProfiles[1].y;
  for(const [i,x] of [-4.07,-3.38].entries()){
    const z=2.47+i*.05;
    tube("galvanized",x,waterY+.53,z,.63,1.04);
    ball("galvanized",x,waterY+1.04,z,.62,.19,.62);
    for(const dy of [.13,.80,.98])tube("steelEdge",x,waterY+dy,z,.657,.039);
    pipe("galvanized",[[x,waterY+1.06,z],[x,waterY+1.32,z],[x+.03,waterY+1.38,z-.06],[x+.045,waterY+1.39,1.33]],.034,12);
    gauge(x+.09,waterY+.76,z+.31,.088,i*.65);
  }
  const cupboardY=deckProfiles[1].y;
  const voltageMark=texture(128,ctx=>{
    ctx.clearRect(0,0,128,128);ctx.beginPath();
    for(const [i,[x,y]] of [[78,8],[30,72],[58,70],[48,118],[100,52],[70,55]].entries()){
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }ctx.fillStyle="#3a3022";ctx.closePath();ctx.fill();
  },false);
  const warning=mesh(new THREE.PlaneGeometry(.40,.43),new THREE.MeshBasicMaterial({map:voltageMark,transparent:true,depthWrite:false}));
  warning.position.set(1.27,cupboardY+.70,2.235);
  for(let i=0;i<3;i++) {
    const x=1.43+i*.34;
    tube("rust",x,base+.58,.92,.257,1.03);
    ball("rust",x,base+1.10,.92,.26,.22,.26);
    tube("brass",x,base+1.23,.92,.080,.134);
    tube("steelEdge",x,base+.78,.92,.277,.066);
  }
  for(const [x,z] of [[-.78,2.47],[3.98,.92]]) {
    crate(x,deckProfiles[1].y,z,.66,.52,.55);
    crate(x+.05,deckProfiles[1].y+.55,z-.03,.58,.43,.49);
  }
  for(const [x,y,z] of [[-1.12,deckProfiles[2].y,.84],[3.84,deckProfiles[2].y,1.13],[-.88,base,.83]]) {
    shelf(x,y,z,1.18);
  }

  const lanternGlow = texture(96,(ctx,size)=>{
    const r=size/2, g=ctx.createRadialGradient(r,r,0,r,r,r);
    g.addColorStop(0,"rgba(255,226,153,.88)");
    g.addColorStop(.06,"rgba(255,189,83,.58)");
    g.addColorStop(.20,"rgba(239,147,43,.21)");
    g.addColorStop(.53,"rgba(221,115,25,.054)");
    g.addColorStop(1,"rgba(196,94,21,0)");
    ctx.fillStyle=g;ctx.fillRect(0,0,size,size);
  },false);
  const glowMaterial = new THREE.SpriteMaterial({map:lanternGlow,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  for (const entry of pendantLights) {
    const halo=new THREE.Sprite(glowMaterial);
    halo.position.set(0,-.132,.093);
    halo.scale.set(1.08,.66,1);
    entry.pendant.add(halo);
    const bulb=new THREE.Mesh(geometry.ball,M.lamp);
    bulb.position.y=-.105;bulb.scale.set(.16,.09,.16);entry.pendant.add(bulb);
  }


  const watch = crewOnWatch(roof).map(person => ({
    ...person,
    y: 'y' in person && person.y !== undefined ? person.y
      : deckProfiles[rooms.find(room => room.id === person.room)!.level].y + .082
  }));
  for (const person of watch) {
    contact(person.x,person.y+.008,person.z,person.art==="angler"?1.75:1.15,.79);
  }

  const crewCards: { figure: THREE.Mesh; person: (typeof watch)[number]; w: number }[]=[];
  const stormMap: { value: THREE.Texture } = { value: reflectionSky };
  const capillaryMap: { value: THREE.Texture } = { value: canvasWeave };
  // Independent bulkheads sit behind the actual beds, cabinets, pipes and benches.
  async function installConceptArt() {
    const files = {
      angler: "textures/crew/angler.png", medic: "textures/crew/medic.png", cook: "textures/crew/cook.png",
      fitter: "textures/crew/fitter.png", gardener: "textures/crew/gardener.png", reader: "textures/crew/reader.png",
      bulkheads: "textures/bulkheads.jpg", storm: "environment/storm.jpg",
      oak: "textures/oak.jpg", plating: "textures/plating.jpg", capillary: "textures/capillary.png"
    };
    async function load(file: string) {
      const map=await loadTexture(file);
      map.encoding=THREE.sRGBEncoding;
      map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
      return map;
    }
    const maps=Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name,file])=>[name,await load(file)])));
    if (disposed) return;
    stormMap.value=maps.storm;
    const shortWaves=maps.capillary;
    shortWaves.encoding=THREE.LinearEncoding;
    shortWaves.wrapS=shortWaves.wrapT=THREE.RepeatWrapping;
    capillaryMap.value=shortWaves;
    // Bake the atlas coordinates into each wall so r133 uploads one shared texture.
    const bulkheadMaterial=new THREE.MeshStandardMaterial({
      map:maps.bulkheads,color:0x978573,roughness:.91,emissiveMap:maps.bulkheads,
      emissive:0xffecd2,emissiveIntensity:.46,metalness:.04
    });
    function wallGeometry(width: number, height: number, offsetX: number, offsetY: number, repeatX: number) {
      const geometry = new THREE.PlaneGeometry(width,height);
      const uv = geometry.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) * repeatX + offsetX, uv.getY(i) * .246 + offsetY);
      }
      return geometry;
    }
    for (const [i,room] of rooms.entries()) {
      const u = (i % 2) * .5 + .002;
      const v = (3 - Math.floor(i / 2)) * .25 + .002;
      const bulkhead=mesh(wallGeometry(4.47,1.90,u,v,.496),bulkheadMaterial);
      bulkhead.name=room.name+" · 后舱壁";
      bulkhead.position.set(2.39*room.side,deckProfiles[room.level].y+1.008,.405);
      const sideU = u + (room.side > 0 ? .258 : .016);
      const returnWall=mesh(wallGeometry(2.91,1.85,sideU,v,.228),bulkheadMaterial);
      returnWall.rotation.y=Math.PI/2;
      returnWall.position.set(room.side===1?.004:-4.58,deckProfiles[room.level].y+.995,1.97);
    }
    for (const person of watch) {
      const map=maps[person.art], w=person.h*map.image.width/map.image.height;
      const geo=new THREE.PlaneGeometry(w,person.h);
      geo.translate(0,person.h/2,0);
      const material=new THREE.MeshBasicMaterial({map,alphaTest:.45,side:THREE.DoubleSide,
        color:person.room?0xffebc9:0xe2e0ce,toneMapped:false});
      const figure=mesh(geo,material);
      figure.name=person.name;figure.position.set(person.x,person.y,person.z);
      figure.castShadow=figure.receiveShadow=true;
      crewCards.push({figure,person,w});
    }
    const boards=maps.oak;
    boards.wrapS=boards.wrapT=THREE.RepeatWrapping;
    boards.repeat.set(.94,1.12);
    for (const key of ["deck","wetDeck"]) {
      const m=M[key];
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;
      m.map=boards;m.color.setHex(key==="wetDeck"?0xdad2c4:0xbcb3a3);
      m.normalMap=null;m.bumpMap=boards;m.bumpScale=.029;
      m.aoMap=null;m.roughnessMap=null;m.roughness=key==="wetDeck"?.59:.84;
      m.needsUpdate=true;
    }
    wetDeckMaterial.clearcoat=.51;wetDeckMaterial.clearcoatRoughness=.30;
    const joinery=boards.clone();
    joinery.repeat.set(.68,.24);
    joinery.needsUpdate=true;
    for(const key of ["timber","woodEdge"]){
      const m=M[key];
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;
      m.map=joinery;m.normalMap=null;m.aoMap=null;m.color.setHex(key==="timber"?0xd3bd9c:0xb3a189);m.needsUpdate=true;
    }
    const plates=maps.plating;
    plates.wrapS=plates.wrapT=THREE.RepeatWrapping;
    plates.repeat.set(.62,.80);
    for (const [key,tint] of [["marineSteel",0xe6e4db],["marineLower",0x989188],
        ["marinePatch",0xd5c7ac],["marineStrake",0xccb59e],["marineGuard",0xb7b1a5],["marineDark",0x8b8d89]] as const) {
      const m=M[key];
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;
      m.map=plates;m.color.setHex(tint);m.normalMap=null;m.aoMap=null;
      m.bumpMap=plates;m.bumpScale=.027;m.metalness=.31;m.roughness=.70;m.needsUpdate=true;
    }
  }

  const fishingRod=new THREE.Group();
  vessel.add(fishingRod);
  const cane=new THREE.CatmullRomCurve3([[.095,-.073,0],[-.30,.30,.10],[-1.02,.94,.21],
    [-1.76,1.17,.31],[-2.09,1.12,.34]].map(p=>new THREE.Vector3(...p)));
  const ferrule=new THREE.MeshStandardMaterial({color:0xb29d74,roughness:.43,metalness:.64});
  for(let i=0;i<4;i++) {
    const points=Array.from({length:7},(_,j)=>cane.getPoint((i+j/6)/4));
    const blank=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),9,.022-i*.0042,7,false),M.woodEdge);
    fishingRod.add(blank);
    const loop=new THREE.Mesh(new THREE.TorusGeometry(.027-i*.003,.005,4,9),ferrule);
    loop.position.copy(points[6]);loop.rotation.y=.7;fishingRod.add(loop);
  }
  const linePoints = new Float32Array(3*21);
  const lineGeometry=new THREE.BufferGeometry();
  lineGeometry.setAttribute("position",new THREE.BufferAttribute(linePoints,3).setUsage(THREE.DynamicDrawUsage));
  const fishingLine=new THREE.Line(lineGeometry,new THREE.LineBasicMaterial({color:0xd9d8cc,transparent:true,opacity:.70}));
  fishingLine.frustumCulled=false;
  scene.add(fishingLine);
  const floatMesh=new THREE.Mesh(new THREE.SphereGeometry(.044,9,7),M.safety);
  floatMesh.scale.y=1.65;scene.add(floatMesh);
  const grip=new THREE.Vector3(),tip=new THREE.Vector3(),rodEnd=cane.getPoint(1);
  function updateCrewAndLine(yaw: number,t: number) {
    if (!crewCards.length) return;
    const dx=Math.cos(yaw)/proportions.x, dz=-Math.sin(yaw)/proportions.z;
    for(const {figure,person} of crewCards) {
      figure.rotation.y=Math.atan2(-dz,dx);
      figure.scale.x=(person.flip?-1:1)*Math.hypot(dx,dz)*proportions.y;
    }
    const {figure,person,w}=crewCards[0];
    grip.set(-w*.32,person.h*.535,0);
    figure.updateMatrix(); fishingRod.position.copy(grip.applyMatrix4(figure.matrix));
    fishingRod.rotation.z=.019*Math.sin(t*1.17);
    fishingRod.updateWorldMatrix(true,false);
    tip.copy(rodEnd).applyMatrix4(fishingRod.matrixWorld);
    const x=-5.38+.13*Math.sin(t*.48),z=4.72+.19*Math.cos(t*.67);
    const y=seaHeight(x,z,t)+.035;
    floatMesh.position.set(x,y,z);
    for(let i=0;i<=20;i++){
      const u=i/20, sag=4*u*(1-u);
      linePoints[i*3]=THREE.MathUtils.lerp(tip.x,x,u)-sag*.19;
      linePoints[i*3+1]=THREE.MathUtils.lerp(tip.y,y,u)-sag*.22;
      linePoints[i*3+2]=THREE.MathUtils.lerp(tip.z,z,u)+sag*.13;
    }
    lineGeometry.attributes.position.needsUpdate=true;
  }

  for (const {type,tint,matrices} of batches.values()) {
    const batch=new THREE.InstancedMesh(geometry[type],tint === "contact" ? contactMaterial : M[tint],matrices.length);
    matrices.forEach((matrix,index)=>batch.setMatrixAt(index,matrix));
    vessel.add(batch);
  }

  // Cache the shadows of the hull and fixtures. Pendant meshes move separately.
  vessel.traverse(node=>{
    if(!isStandardMesh(node)||!node.material.visible||node.material.transparent) return;
    const uv = node.geometry.getAttribute("uv");
    if (uv && !node.geometry.getAttribute("uv2")) node.geometry.setAttribute("uv2", uv);
    node.castShadow=!node.userData.movesWithRig;
    node.receiveShadow=true;
  });

  const seaGeometry = new THREE.PlaneGeometry(164,164,125,125);
  seaGeometry.rotateX(-Math.PI/2);
  const [,waterlineBreadth,waterlineLength,waterlineOffset]=hullSection(.545);
  const waterlineStations=shipStations.map(([z,x])=>[
    (z*waterlineLength+waterlineOffset)*proportions.z,x*waterlineBreadth*proportions.x
  ]);
  function projectedBeam(z: number){
    let i=1;
    while(i<waterlineStations.length-1&&z>waterlineStations[i][0]) i++;
    const [a,p]=waterlineStations[i-1],[b,q]=waterlineStations[i];
    return THREE.MathUtils.lerp(p,q,clamp01((z-a)/(b-a)));
  }
  const hullWaterGLSL=`
    float hullBeam(float z){
      ${waterlineStations.slice(1).map(([b,q],i)=>{
        const [a,p]=waterlineStations[i];
        return `if(z<=${b.toFixed(5)}) return mix(${p.toFixed(5)},${q.toFixed(5)},clamp((z-(${a.toFixed(5)}))/${(b-a).toFixed(5)},0.,1.));`;
      }).join("\n")}
      return 0.;
    }`;
  // Each component uses the same phase, amplitude and angular frequency on the
  // CPU (buoyancy and float) and GPU (displaced sea, crest normals and spray).
  const swellBands = [
    [.66,.91,.206,1.39],[-.83,.40,.132,1.12],[.92,-1.40,.088,1.85],
    [.24,.40,.193,.80],[-.37,.15,.115,.63]
  ];
  function seaHeight(x: number,z: number,t: number) {
    let h=0;
    for (const [kx,kz,amplitude,omega] of swellBands) {
      const s=Math.sin(kx*x+kz*z-omega*t);
      h+=amplitude*(s+.18*(s*s-.5));
    }
    return h;
  }
  const directionalWaves=`
    float waveA(vec2 p){return dot(p,vec2(.66,.91))-uTime*1.39;}
    float waveB(vec2 p){return dot(p,vec2(-.83,.40))-uTime*1.12;}
    float waveC(vec2 p){return dot(p,vec2(.92,-1.40))-uTime*1.85;}
    float crestShape(float a){float s=sin(a);return s+.18*(s*s-.5);}
    float swell(vec2 p){return ${swellBands.map(([x,z,a,w])=>
      `crestShape(dot(p,vec2(${x},${z}))-uTime*${w})*${a}`).join("+")};}`;
  const shipResponse={heave:0,roll:0,pitch:0,vHeave:0,vRoll:0,vPitch:0};
  function advanceBuoyancy(dt: number,t: number) {
    const beam=2.42,run=3.84;
    const p=shipResponse;
    const port=seaHeight(-beam,-run,t)+seaHeight(-beam,0,t)+seaHeight(-beam,run,t);
    const starboard=seaHeight(beam,-run,t)+seaHeight(beam,0,t)+seaHeight(beam,run,t);
    const bow=seaHeight(-beam,run,t)+seaHeight(beam,run,t);
    const stern=seaHeight(-beam,-run,t)+seaHeight(beam,-run,t);
    // Damped hydrostatic response around the flotation patch. Integration is
    // substepped so the response stays stable when a frame takes longer.
    const targetY=(port+starboard)/6, targetRoll=Math.atan2(starboard-port,6*beam);
    const targetPitch=-Math.atan2(bow-stern,4*run);
    const steps=Math.max(1,Math.ceil(dt*60)),h=dt/steps;
    for(let i=0;i<steps;i++){
      p.vHeave+=(6.2*(targetY-p.heave)-3.5*p.vHeave)*h;
      p.vRoll+=(3.8*(targetRoll-p.roll)-2.5*p.vRoll)*h;
      p.vPitch+=(3.1*(targetPitch-p.pitch)-2.4*p.vPitch)*h;
      p.heave+=p.vHeave*h;p.roll+=p.vRoll*h;p.pitch+=p.vPitch*h;
    }
    vessel.position.y=p.heave;
    vessel.rotation.set(p.pitch,0,p.roll);
  }
  const weatherUniforms={
    uStorm:stormMap,uAspect:{value:1},uHorizon:{value:.845},uBearing:{value:0}
  };
  const horizonGLSL=`
    uniform sampler2D uStorm;
    uniform float uAspect,uHorizon,uBearing;
    vec3 stormColor(vec2 uv){
      vec3 color=texture2D(uStorm,uv).rgb;
      // Three r133 stores the source texels of WebGL1 custom samplers as sRGB.
      ${renderer.capabilities.isWebGL2 ? "return color;" : "return mix(color/12.92,pow((color+.055)/1.055,vec3(2.4)),step(vec3(.04045),color));"}
    }
    vec3 distantSea(vec2 screen){
      float x=.49+(screen.x-.5)*min(uAspect,3.6)*.61+uBearing*.12;
      x=1.-abs(mod(x,2.)-1.);
      float elevation=screen.y-uHorizon;
      float y=elevation<0.0 ? .50*exp(1.95*elevation) : 1.0-.50*exp(-4.30*elevation);
      return stormColor(vec2(x,clamp(y,.005,.995)))*vec3(.91,.97,1.01);
    }`;
  const skyBackdrop=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
    uniforms:weatherUniforms,depthTest:false,depthWrite:false,
    vertexShader:`varying vec2 screen;void main(){screen=uv;gl_Position=vec4(position.xy,1.,1.);}`,
    fragmentShader:`varying vec2 screen;${horizonGLSL}
      void main(){gl_FragColor=vec4(distantSea(screen),1.);
      #include <encodings_fragment>
      }`
  }));
  skyBackdrop.frustumCulled=false;skyBackdrop.renderOrder=-100;scene.add(skyBackdrop);
  const seaToHull={value:new THREE.Matrix4()};

  const seaMaterial = new THREE.ShaderMaterial({
    uniforms:{...weatherUniforms,uSeaToHull:seaToHull,uCapillary:capillaryMap,uTime:{value:0},uHaze:{value:1}},
    vertexShader:`
      uniform float uTime;
      varying vec3 world;
      varying vec4 clip;
      ${directionalWaves}
      void main() {
        vec3 p = position;
        float d = length(p.xz);
        p.y += swell(p.xz)*(1.0-smoothstep(48.,86.,d));
        world = (modelMatrix * vec4(p,1.)).xyz;
        clip = projectionMatrix * viewMatrix * vec4(world,1.);
        gl_Position = clip;
      }`,
    fragmentShader:`
      uniform float uTime;
      uniform float uHaze;
      uniform mat4 uSeaToHull;
      uniform sampler2D uCapillary;
      ${horizonGLSL}
      varying vec3 world;
      varying vec4 clip;
      ${directionalWaves}
      ${hullWaterGLSL}
      float hash(vec2 p) {
        return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p);
        f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
                   mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }
      float heightAt(vec2 p) {
        float wind=noise(p*1.3-vec2(.46,.51)*uTime);
        return swell(p)+sin(dot(p,vec2(4.1,5.9))-uTime*3.08+wind*2.1)*.019+
          noise(p*vec2(4.0,2.3)-vec2(.31,.41)*uTime)*.020+
          noise(p*vec2(13.5,7.6)+vec2(.25,-.42)*uTime)*.010;
      }
      void main() {
        vec2 p=world.xz;
        float h=heightAt(p);
        vec3 ripple=texture2D(uCapillary,p*.058+vec2(-.012,.004)*uTime).rgb;
        vec3 crossSea=texture2D(uCapillary,p.yx*.146+vec2(.008,-.014)*uTime).rgb;
        vec2 slopes=.19*(ripple.rg*2.-1.)+.105*(crossSea.gr*2.-1.);
        vec3 n=normalize(vec3((h-heightAt(p+vec2(.09,0)))/.09+slopes.x,1.,
                              (h-heightAt(p+vec2(0,.09)))/.09+slopes.y));
        vec3 v=normalize(cameraPosition-world);
        float skyWeight=pow(1.-max(dot(n,v),0.),2.6);
        vec3 reflected=reflect(-v,n);
        float glint=pow(max(dot(reflect(-normalize(vec3(-.42,.68,-.50)),n),v),0.),20.);
        float cloudReflection=noise(reflected.xz*7.0+p*.029)*.64+noise(reflected.xz*13.6-p*.018)*.36;
        float broad=noise(p*.23+vec2(.07,-.08)*uTime);
        vec3 deep=vec3(.008,.020,.026);
        vec3 crest=vec3(.030,.064,.071);
        vec3 c=mix(deep,crest,smoothstep(-.38,.46,h+(broad-.5)*.24));
        c+=vec3(.076,.096,.104)*skyWeight*(.59+.45*cloudReflection);
        vec2 skyUV=vec2(.47+reflected.x*.35,.54+abs(reflected.y)*.4);
        vec3 reflectedCloud=stormColor(skyUV);
        c+=reflectedCloud*(.07+skyWeight*.44)+vec3(.14,.16,.17)*glint*.67;

        float crestGrain=noise(p*vec2(5.7,3.5)+vec2(-.14,-.41)*uTime);
        float breakage=noise(p*vec2(1.3,2.2)+vec2(-.18,.31)*uTime);
        float top=.82*sin(waveA(p))+.18*sin(waveC(p));
        float thin=smoothstep(.83,.96,top+(.5-crestGrain)*.055)*
            smoothstep(.25,.72,h+breakage*.32)*smoothstep(.42,.70,crestGrain*.48+breakage*.52);
        float crossSpume=smoothstep(.91,1.05,sin(waveB(p))+.11*sin(waveC(p)))*
            smoothstep(.59,.91,crestGrain*.30+breakage*.70);
        vec2 local=(uSeaToHull*vec4(world,1.)).xz*vec2(${proportions.x},${proportions.z});
        float width=hullBeam(local.y);
        float side=max(abs(local.x)-width,max(local.y-${waterlineStations[waterlineStations.length-1][0].toFixed(4)},${waterlineStations[0][0].toFixed(4)}-local.y));
        float turmoil=noise(p*2.4+vec2(-.29,.64)*uTime);
        float bubbles=noise(p*7.+vec2(.54,.46)*uTime);
        float widthMask=(1.-smoothstep(.05,1.58,side+turmoil*.44))*smoothstep(-.33,-.03,side);
        float froth=widthMask*smoothstep(.40,.74,turmoil*.53+bubbles*.47);
        float ridges=sin((side+turmoil*.39)*18.0-uTime*3.7+noise(p*2.3)*5.0);
        float washed=widthMask*smoothstep(.38,.92,ridges)*smoothstep(.30,.70,crestGrain);
        float curl=.65*ripple.b+.35*crossSea.b;
        float windStreak=noise(p*vec2(.45,1.24)-vec2(.051,.13)*uTime);
        float crestGate=smoothstep(.12,.51,h+(windStreak-.5)*.44);
        float crestLace=smoothstep(.58,.81,curl+.07*crestGrain);
        float whitecap=crestGate*crestLace*(.34+.56*breakage);
        float wash=widthMask*(.25+.75*smoothstep(.25,.74,curl+.21*turmoil))*
            (.19+.67*smoothstep(.18,.81,turmoil*.66+bubbles*.34));
        float foam=clamp(whitecap+wash+washed*.26+.08*froth,0.,.97);
        c*=vec3(.65,.74,.73)*mix(.57,1.,smoothstep(-.32,1.8,side));
        c+=vec3(.018,.026,.028)*smoothstep(.42,.78,curl);
        c=mix(c,vec3(.56,.60,.58),foam);

        vec2 screen=clip.xy/clip.w*.5+.5;
        float horizonBlend=smoothstep(uHorizon-.40,uHorizon-.025,screen.y)*uHaze;
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        gl_FragColor.rgb=mix(gl_FragColor.rgb,distantSea(screen),max(horizonBlend,smoothstep(46.,77.,length(world.xz))));
        #include <encodings_fragment>
      }`
  });
  const water = new THREE.Mesh(seaGeometry,seaMaterial);
  scene.add(water);
  scene.background=new THREE.Color(0x424e52);

  const sprayGeometry=new THREE.BufferGeometry();
  const spawnPoints=[],spraySeeds=[];
  const oceanRandom=(i: number,band: number)=>hash2(i+217,band+981);
  for(let i=0;i<216;i++){
    const p=oceanRandom(i,1);
    const z=3.5+(waterlineStations[waterlineStations.length-1][0]-3.55)*p;
    const w=projectedBeam(z);
    const side=i%2?1:-1;
    spawnPoints.push(side*(w+.045),0,z);
    spraySeeds.push(oceanRandom(i,3),oceanRandom(i,4),side);
  }
  sprayGeometry.setAttribute("position",new THREE.Float32BufferAttribute(spawnPoints,3));
  sprayGeometry.setAttribute("seed",new THREE.Float32BufferAttribute(spraySeeds,3));
  const sprayMaterial=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uSize:{value:1.3}},
    transparent:true,depthWrite:false,
    vertexShader:`
      uniform float uTime,uSize;
      attribute vec3 seed;
      varying float lifetime;
      ${directionalWaves}
      void main(){
        float age=fract(uTime*(.67+seed.y*.76)+seed.x);
        float speed=.39+seed.y*.62;
        vec3 p=position;
        p.x+=seed.z*age*speed;
        p.z+=age*(seed.x-.10)*.71;
        p.y=swell(p.xz)+sin(age*3.14159)*(.055+seed.y*seed.y*.43)+.047;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        gl_PointSize=clamp(uSize*(.48+seed.y*.81)*(1.14-age*.52),.85,4.8);
        lifetime=smoothstep(0.,.14,age)*(1.-smoothstep(.59,1.,age))*(seed.y*.66+.34);
      }`,
    fragmentShader:`
      varying float lifetime;
      void main(){
        float edge=1.-smoothstep(.04,.48,length(gl_PointCoord-.5));
        gl_FragColor=vec4(.58,.65,.65,edge*lifetime*.49);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`
  });
  const bowSpray=new THREE.Points(sprayGeometry,sprayMaterial);
  bowSpray.frustumCulled=false;
  scene.add(bowSpray);

  // Low-resolution, embedded derivatives of the linked CC0 texture sets:
  // https://polyhaven.com/a/rusty_metal_sheet
  // https://polyhaven.com/a/wood_floor_worn
  // https://polyhaven.com/a/concrete_wall_003
  // https://polyhaven.com/a/overcast_soil_puresky
  async function decodeSkyEnvironment() {
    const source=await readOceanFile("environment/overcast-hdr.bin");
    const image=new RGBELoader().setDataType(THREE.FloatType).parse(source);
    const samples=[];
    // RGBELoader r133 returns RGB floats, and the half-float texture needs RGBA.
    for(let i=0;i<image.data.length;i+=277*3){
      const brightness=.2126*image.data[i]+.7152*image.data[i+1]+.0722*image.data[i+2];
      if(brightness>0) samples.push(brightness);
    }
    samples.sort((a,b)=>a-b);
    const scale=.76/Math.max(.00001,samples[Math.floor(samples.length*.84)]??1);
    const packed=new Uint16Array(image.width*image.height*4);
    for(let i=0,j=0;i<packed.length;i+=4,j+=3) {
      const r=image.data[j], g=image.data[j+1], b=image.data[j+2];
      const gray=.22*r+.70*g+.08*b;
      packed[i]=THREE.DataUtils.toHalfFloat(Math.min(6.0,(.87*r+.13*gray)*scale));
      packed[i+1]=THREE.DataUtils.toHalfFloat(Math.min(6.0,(.87*g+.13*gray)*scale));
      packed[i+2]=THREE.DataUtils.toHalfFloat(Math.min(6.0,(.87*b+.13*gray)*scale));
      packed[i+3]=THREE.DataUtils.toHalfFloat(1);
    }
    const environment=new THREE.DataTexture(packed,image.width,image.height,THREE.RGBAFormat,THREE.HalfFloatType);
    environment.name="Poly Haven - Overcast Soil (Pure Sky), scaled for storm daylight";
    environment.mapping=THREE.EquirectangularReflectionMapping;
    environment.encoding=THREE.LinearEncoding;
    environment.minFilter=environment.magFilter=THREE.LinearFilter;
    environment.flipY=true;
    environment.needsUpdate=true;
    return environment;
  }

  async function readPhotoSet(name: string){
    const [color,normal,arm]=await Promise.all(["color","normal","surface"].map(role=>
      loadTexture("textures/"+name+"-"+role+".png")
    ));
    for (const [map,role] of [[color,"color"],[normal,"normal"],[arm,"AO roughness metallic"]] as const) {
      map.name=name+" / "+role;
      map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
      map.wrapS=map.wrapT=THREE.RepeatWrapping;
      map.encoding=role==="color"?THREE.sRGBEncoding:THREE.LinearEncoding;
    }
    return {color,normal,arm};
  }
  function tilePhotoSet(maps: PhotoSet,repeatX: number,repeatY: number,offsetX=0,offsetY=0): PhotoSet {
    function tile(texture: THREE.Texture) {
      const variant=texture.clone();
      variant.repeat.set(repeatX,repeatY);
      variant.offset.set(offsetX,offsetY);
      variant.needsUpdate=true;
      textures.add(variant);
      return variant;
    }
    return { color: tile(maps.color), normal: tile(maps.normal), arm: tile(maps.arm) };
  }
  function usePhotoSet(name: string,maps: PhotoSet,settings: PhotoSettings){
    const mat=M[name];
    if(!(mat instanceof THREE.MeshStandardMaterial)) return;
    mat.map=maps.color;
    mat.normalMap=maps.normal;
    mat.normalScale.setScalar(settings.relief??.48);
    mat.bumpMap=null;
    mat.roughnessMap=maps.arm;
    mat.aoMap=maps.arm;
    mat.aoMapIntensity=settings.ao??.45;
    mat.metalnessMap=settings.metalMap?maps.arm:null;
    mat.metalness=settings.metal??0;
    mat.roughness=settings.rough??1.0;
    mat.envMapIntensity=settings.environment??.60;
    mat.color.setHex(settings.tint??0xffffff);
    if(mat instanceof THREE.MeshPhysicalMaterial){
      mat.clearcoat=settings.coat??0.22;
      mat.clearcoatRoughness=settings.coatRough??1.0;
      mat.clearcoatRoughnessMap=maps.arm;
    }
    mat.needsUpdate=true;
  }
  async function applyPhotoMaterials() {
    const [steel,timber,bulkhead]=await Promise.all(["steel","timber","bulkhead"].map(name=>readPhotoSet(name)));
    if (disposed) return;
    const steelStructure=tilePhotoSet(steel,.82,.80,.15,.06);
    const steelHardware=tilePhotoSet(steel,.75,.86,.49,.04);
    const woodBoards=tilePhotoSet(timber,1.37,1.75,.09,.29);
    const woodFurniture=tilePhotoSet(timber,.96,.097,.032,.172);
    const paintWalls=tilePhotoSet(bulkhead,1.38,.81,.055,.42);
    const paintDetails=tilePhotoSet(bulkhead,.58,.66,.38,.28);
    for(const [name,tint,metal,env] of [
      ["marineSteel",0x9ab1bb,.38,.63],["marineLower",0x5e625f,.15,.59],
      ["marinePatch",0xa0adae,.36,.66],["marineGuard",0x819294,.39,.68],
      ["marineDark",0x627173,.36,.61],["marineStrake",0x8a9da4,.37,.66],
    ] as const) usePhotoSet(name,steelStructure,{tint,metal,metalMap:true,rough:.94,relief:.53,environment:env});
    for(const [name,tint,metal] of [
      ["rim",0x6f7979,.43],["repair",0x8e9187,.31],["steelEdge",0xa6a99e,.58],
      ["frame",0x6c7069,.36],["edge",0xa4aaa3,.47],["blue",0x52828b,.34],
      ["growSteel",0x697a63,.42],["growTrim",0x93978a,.40],["bedSteel",0x83877a,.40],
      ["rust",0x8d573d,.18],["brass",0xb09768,.41],["amber",0xc49e62,.22],
    ] as const) usePhotoSet(name,steelHardware,{tint,metal,metalMap:true,rough:.93,environment:.60,relief:.42});
    usePhotoSet("deck",woodBoards,{tint:0xb9bbb3,rough:1,relief:.38,environment:.53});
    usePhotoSet("wetDeck",woodBoards,{tint:0x929082,rough:.84,relief:.41,environment:.81,coat:.38,coatRough:.66});
    usePhotoSet("timber",woodFurniture,{tint:0xb5b6aa,rough:1,relief:.42,environment:.54});
    usePhotoSet("woodEdge",woodFurniture,{tint:0x9c9a8b,rough:1,relief:.32,environment:.49});
    usePhotoSet("wall",paintWalls,{tint:0xa99d85,relief:.42,environment:.43});
    usePhotoSet("greenWall",paintWalls,{tint:0x8b8d72,relief:.46,environment:.42});
    usePhotoSet("clinicWall",paintWalls,{tint:0xb3aa93,relief:.38,environment:.46});
    usePhotoSet("oldCeramic",paintDetails,{tint:0xbcb9a9,relief:.32,rough:.90,environment:.52});
    if (!renderer.capabilities.isWebGL2 && (!renderer.extensions.has('OES_texture_half_float')
      || !renderer.extensions.has('OES_texture_half_float_linear'))) return;
    const environment = await decodeSkyEnvironment();
    if (disposed) { environment.dispose(); return; }
    textures.add(environment);
    scene.environment=environment;
  }


  // Range: Firefly in the Dusk (OpenGameArt), CC0. Cookware: Poly Haven, CC0.
  const galleyFloor=deckProfiles[2].y;
  const galleyCooktop={x:-2.92,z:2.51,y:galleyFloor+.089,angle:.12,sx:1.23,sy:.86,sz:1.10};
  const galleyPotPoint=axis(galleyCooktop.x,galleyCooktop.y,galleyCooktop.z,galleyCooktop.angle)(
    -.285*galleyCooktop.sx,1.078*galleyCooktop.sy,.164*galleyCooktop.sz
  );

  function castIronFinish() {
    const iron=new THREE.MeshStandardMaterial({color:0x545b59,metalness:.46,roughness:.77});
    iron.name="Galley range / worn cast iron";
    iron.onBeforeCompile=shader=>{
      shader.uniforms.ironGrain={value:M.marineSteel.map};
      shader.uniforms.ironSurface={value:M.marineSteel.roughnessMap??M.marineSteel.map};
      shader.vertexShader=shader.vertexShader.replace("#include <common>",`
        #include <common>
        attribute vec3 stovePosition;
        attribute vec3 stoveNormal;
        varying vec3 vStovePosition;
        varying vec3 vStoveNormal;`)
        .replace("#include <begin_vertex>",`
        #include <begin_vertex>
        vStovePosition=stovePosition;
        vStoveNormal=stoveNormal;`);
      shader.fragmentShader=shader.fragmentShader.replace("#include <common>",`
        #include <common>
        uniform sampler2D ironGrain;
        uniform sampler2D ironSurface;
        varying vec3 vStovePosition;
        varying vec3 vStoveNormal;
        vec3 sampleIron(sampler2D source) {
          vec3 w=pow(abs(normalize(vStoveNormal)),vec3(5.0));
          w/=max(.0001,w.x+w.y+w.z);
          vec3 p=vStovePosition*1.72+vec3(.19,.27,.31);
          return texture2D(source,p.zy).rgb*w.x+texture2D(source,p.xz).rgb*w.y+texture2D(source,p.xy).rgb*w.z;
        }`)
        .replace("#include <map_fragment>",`
        #include <map_fragment>
        vec3 wear=sampleIron(ironGrain);
        float ironTint=dot(wear,vec3(.25,.62,.13));
        diffuseColor.rgb*=.53+ironTint*2.29;
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.35,1.01,.73),clamp((wear.r-wear.b)*1.42,0.,.37));`)
        .replace("#include <roughnessmap_fragment>",`
        #include <roughnessmap_fragment>
        roughnessFactor=clamp(.44+sampleIron(ironSurface).g*.47,.44,.89);`);
    };
    iron.customProgramCacheKey=()=>"galley-cast-iron-v1";
    return iron;
  }

  function setRangeMaterial(model: THREE.Object3D) {
    const body=model.getObjectByName("CastIronStove_WithoutDoors");
    if(!body) throw new Error("The galley range is missing its doorless body");
    for(const node of [body,...body.children]){
      if(!(node instanceof THREE.Mesh)) continue;
      const position=node.geometry.getAttribute("position");
      // Keep the cooker dimensions; shorten only the tall section of its flue.
      for(let i=0;i<position.count;i++){
        const y=position.getY(i);
        if(y>1.35) position.setY(i,1.35+(y-1.35)*.36);
      }
      position.needsUpdate=true;
      node.geometry.computeBoundingBox();
      node.geometry.computeBoundingSphere();
    }
    const fireDoor=model.getObjectByName("FireChamberDoor");
    if(fireDoor) fireDoor.rotation.y=-.105;
    model.updateMatrixWorld(true);
    const iron=castIronFinish();
    const fireWindow=new THREE.MeshStandardMaterial({name:"Smoked firebox glass",color:0x1e1a17,
      emissive:0x431d0e,emissiveIntensity:.21,metalness:.10,roughness:.61,side:THREE.DoubleSide});
    const ovenWindow=new THREE.MeshStandardMaterial({name:"Smoked oven glass",color:0x201f1b,
      metalness:.13,roughness:.57,side:THREE.DoubleSide});
    const point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
    model.traverse(node=>{
      if(!isStandardMesh(node)) return;
      if(node.material.name==="StoveGlassMaterial"){ node.material=fireWindow; return; }
      if(node.material.name==="OvenGlassMaterial"){ node.material=ovenWindow; return; }
      const geometry=node.geometry;
      const position=geometry.getAttribute("position");
      const normals=geometry.getAttribute("normal");
      const p=new Float32Array(position.count*3), n=new Float32Array(position.count*3);
      normalMatrix.getNormalMatrix(node.matrixWorld);
      for(let i=0;i<position.count;i++){
        point.fromBufferAttribute(position,i).applyMatrix4(node.matrixWorld).toArray(p,i*3);
        normal.fromBufferAttribute(normals,i).applyNormalMatrix(normalMatrix).toArray(n,i*3);
      }
      geometry.setAttribute("stovePosition",new THREE.BufferAttribute(p,3));
      geometry.setAttribute("stoveNormal",new THREE.BufferAttribute(n,3));
      node.material=iron;
    });
  }

  function galleyProp(name: string,model: THREE.Object3D,at: Point3,span: number,yaw: number){
    const root=new THREE.Group();
    root.name=name;
    const box=new THREE.Box3().setFromObject(model);
    const size=box.getSize(new THREE.Vector3());
    const scale=span/Math.max(size.x,size.z);
    const center=box.getCenter(new THREE.Vector3());
    model.scale.setScalar(scale);
    model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
    root.add(model);
    root.position.set(...at);
    root.rotation.y=yaw;
    return root;
  }

  async function mountGalleyAssets(){
    const results = await Promise.allSettled(["range","pot","jug","spoon"].map(key => readOceanModel("models/galley/" + key + ".glb")));
    const failure = results.find(result => result.status === 'rejected');
    if (disposed || failure) {
      for (const result of results) {
        if (result.status === 'fulfilled') disposeOceanResources(result.value.scene);
      }
      if (failure) throw failure.reason;
      return;
    }
    const [range,pot,jug,spoon] = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
    const detail=new THREE.Group();
    detail.name="03A Galley cookware and range";
    const cook=galleyCooktop;
    setRangeMaterial(range.scene);
    range.scene.name="Cast iron galley range";
    range.scene.position.set(cook.x,cook.y,cook.z);
    range.scene.scale.set(cook.sx,cook.sy,cook.sz);
    range.scene.rotation.y=cook.angle;
    detail.add(range.scene);

    const smallerPot=pot.scene.clone(true);
    const saucepan=galleyProp("Oxidised lidded brass pot",pot.scene,galleyPotPoint,.37,-.43);
    const sparePot=galleyProp("Spare brass pot",smallerPot,
      axis(cook.x,cook.y,cook.z,cook.angle)(.300*cook.sx,1.078*cook.sy,.022),.286,.49);
    // Texture and geometry can be shared, while the smaller pot uses duller patina.
    sparePot.traverse(node=>{
      if(!isStandardMesh(node)) return;
      node.material=node.material.clone();
      node.material.color.multiplyScalar(.73);
      node.material.roughness=Math.min(1,node.material.roughness*1.22);
    });
    const tableHeight=galleyFloor+.872;
    detail.add(saucepan,sparePot,
      galleyProp("Weathered water jug",jug.scene,[-1.64,tableHeight,1.61],.205,-.58),
      galleyProp("Wooden serving spoon",spoon.scene,[-1.15,tableHeight+.033,1.77],.294,1.28)
    );
    detail.traverse(node=>{
      if(!isStandardMesh(node)) return;
      node.castShadow=true;
      node.receiveShadow=true;
      if(node.material.map) node.material.map.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
    });
    vessel.add(detail);
  }

  const orbit = createOceanCamera(camera, rooms, roof, workbenchLook, proportions, pickTargets, onChange);
  let motion = true;
  let time = 0;
  let shadowTime = 0;
  let liveShadowUpdated = false;
  let assetState: 'loading' | 'ready' | 'partial' = 'loading';

  async function loadSceneAssets() {
    let ready = true;
    for (const [label, load] of [
      ['Photo materials', applyPhotoMaterials],
      ['Concept art', installConceptArt],
      ['Galley assets', mountGalleyAssets]
    ] as const) {
      if (disposed) return;
      try {
        await load();
      } catch (error) {
        console.warn(`[Ocean Shelter] ${label} unavailable`, error);
        ready = false;
      }
    }
    if (disposed) return;
    assetState = ready ? 'ready' : 'partial';
    if (assetState === 'ready') console.log('[Ocean Shelter] Ship, crew and galley ready');
    onChange();
  }
  const ready = loadSceneAssets();

  function update(delta: number) {
    const fade = 1 - Math.exp(-delta * 7.5);
    const { yaw, pitch, zoom } = orbit.update(fade);
    const view = orbit.view();
    shadowTime += delta * 1000;
    if (motion) time += delta;
    seaMaterial.uniforms.uTime.value = time;
    seaMaterial.uniforms.uHaze.value = THREE.MathUtils.lerp(
      seaMaterial.uniforms.uHaze.value, view.kind === 'overview' ? 1 : 0, fade);
    sprayMaterial.uniforms.uTime.value = time;
    sprayMaterial.uniforms.uSize.value = renderer.getPixelRatio() * (.95 + zoom * .68);
    deckSheen.uniforms.time.value = time;
    for (const { p, phase, drift } of kitchenSteam) {
      const age = (time * .61 + phase) % 1;
      p.position.set(galleyPotPoint[0] + .098 + drift * age * .18 + Math.sin(age * 4 + phase) * age * .062,
        galleyPotPoint[1] + .296 + age * .306, galleyPotPoint[2] - .023 + age * .039);
      p.scale.set(.14 + age * .20, .14 + age * .18, 1);
      p.material.opacity = Math.sin(age * Math.PI) * .63;
    }
    if (motion) advanceBuoyancy(delta, time);
    const worldToHull = updateShipRigging(delta, motion);
    weatherUniforms.uBearing.value = yaw - .47;
    weatherUniforms.uHorizon.value = .847 + (pitch - .60) * .64 + (zoom - 1) * .21;
    seaToHull.value.copy(worldToHull);
    updateCrewAndLine(yaw, time);
    liveShadowUpdated = prepareCabinLighting(shadowTime, 'roomId' in view ? view.roomId : undefined, motion, worldToHull);
  }

  update(0);

  return {
    camera,
    ready,
    touch: orbit.touch,
    renderSettings: {
      outputEncoding: THREE.sRGBEncoding,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.08,
      physicallyCorrectLights: true
    },
    shadowSettings: { enabled: useShadows, type: THREE.PCFShadowMap, autoUpdate: false, needsUpdate: true },
    view: orbit.view,
    setView(next: OceanView) { orbit.setView(next); },
    moving: () => motion,
    assetState: () => assetState,
    toggleMotion() {
      motion = !motion;
      onChange();
    },
    resize(width: number, height: number) {
      orbit.resize(width, height);
      weatherUniforms.uAspect.value = camera.aspect;
    },
    update,
    afterRender() {
      finishCabinLighting(shadowTime, liveShadowUpdated);
      liveShadowUpdated = false;
    },
    dispose() {
      disposed = true;
      const maps = [...cabinLights.values()].flatMap(entry => entry.cachedMap ? [entry.cachedMap] : []);
      if (liveShadowMap) maps.push(liveShadowMap);
      disposeOceanResources(scene, textures, maps);
    }
  };
}
