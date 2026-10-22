/* Original Canvas 2D city art, projection, picking and route presentation. */
(function(){'use strict';const G=window.GradMajstora;
class City{
 constructor(canvas,onPick,onClient){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onPick=onPick;this.onClient=onClient;this.effects=[];this.workEffects=[];this.completionCount=0;this.readOnly=false;this.seenRevision=-1;this.art=new GradArtwork(()=>{this.draw();window.dispatchEvent(new Event('grad-art-ready'));});this.living=true;this.ambient=[];this.ambientKey='';this.lastFrame=0;this.observer=new IntersectionObserver(es=>{this.visible=es[0].isIntersecting;if(!this.visible){cancelAnimationFrame(this.raf);this.raf=0;}else this.draw();},{threshold:.05});this.observer.observe(canvas);this.state=G.fresh();this.zone=0;this.selected=null;this.zoom=1;this.cx=0;this.cy=320;this.raf=0;this.routes=[];this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const media=matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener('change',e=>{this.reduced=e.matches;this.routes=[];this.effects=[];this.workEffects=[];cancelAnimationFrame(this.raf);this.draw();});this.pointer=null;this.pointers=new Map();this.pinch=0;this.visible=true;this.resize=new ResizeObserver(()=>this.fit());this.resize.observe(canvas);canvas.addEventListener('pointerdown',e=>this.down(e));canvas.addEventListener('pointermove',e=>this.move(e));canvas.addEventListener('pointerup',e=>this.up(e));canvas.addEventListener('pointercancel',()=>this.cancelGesture());canvas.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId))this.cancelGesture();});canvas.addEventListener('wheel',e=>{e.preventDefault();this.scale(e.deltaY<0?1.1:1/1.1);},{passive:false});canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();this.cx+=({ArrowLeft:-65,ArrowRight:65}[e.key]||0)/this.zoom;this.cy+=({ArrowUp:-65,ArrowDown:65}[e.key]||0)/this.zoom;this.draw();}});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(this.raf);this.raf=0;this.routes=[];this.cancelGesture();}else this.draw();});this.fit();}
 iso(x,y){return [(x-y)*32,(x+y)*16];}
 fit(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;const dpr=Math.min(devicePixelRatio||1,1.75);this.w=r.width;this.h=r.height;this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.dpr=dpr;this.zoom=Math.max(.3,Math.min(this.zoom||1,2.2));this.draw();}
 set(state,selected){
  const changed=this.seenRevision>=0&&state.revision!==this.seenRevision;
  if(changed&&!this.reduced&&!this.readOnly){
   const now=performance.now(),old=new Map(this.state.buildings.map(b=>[b.plot,b.level]));
   for(const b of state.buildings)if(old.get(b.plot)!==b.level&&(!old.has(b.plot)||old.get(b.plot)<b.level)){this.effects=this.effects.filter(e=>e.plot!==b.plot);this.effects.push({plot:b.plot,fromLevel:old.get(b.plot)||0,start:now});}
   const previous=new Map(this.state.dispatch.jobs.map(j=>[j.id,j]));
   for(const j of state.dispatch.jobs){const before=previous.get(j.id);if(!before)continue;let kind=null;if(j.status==='review'&&before.status!=='review')kind='finished';else if(j.status==='completed'&&before.status!=='completed')kind='paid';if(kind){this.workEffects.push({job:j.id,site:j.site,kind,paid:j.paid||0,quality:j.quality||0,start:this.visible&&!document.hidden?now:null});this.completionCount++;}}
   const oldCompany=this.state.community?.company,nextCompany=state.community?.company;
   if(nextCompany?.career&&nextCompany.workshop>(oldCompany?.workshop||0))this.workEffects.push({kind:'company',level:nextCompany.workshop,start:this.visible&&!document.hidden?now:null});
   this.workEffects=this.workEffects.slice(-12);
  }
  if(this.readOnly)this.workEffects=[];
  this.seenRevision=state.revision;this.state=state;this.selected=selected;this.prepareTraffic();this.draw();
 }
 focus(zone){this.zone=zone;const z=G.ZONES[zone];[this.cx,this.cy]=this.iso(z.x+3,z.y+3);this.zoom=this.w<500?1.02:1.35;this.draw();}
 scale(f){this.zoom=Math.max(.3,Math.min(2.2,this.zoom*f));this.draw();}
 down(e){
  if(this.pointers.size>=2)return;
  this.pointers.set(e.pointerId,[e.clientX,e.clientY]);this.canvas.setPointerCapture(e.pointerId);
  if(this.pointers.size===2){const a=[...this.pointers.values()],r=this.canvas.getBoundingClientRect(),mx=(a[0][0]+a[1][0])/2-r.left,my=(a[0][1]+a[1][1])/2-r.top;this.pinch=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);this.pinchAnchor={x:this.cx+(mx-this.w/2)/this.zoom,y:this.cy+(my-this.h/2)/this.zoom};if(this.pointer)this.pointer.moved=true;}
  else this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY,ox:this.cx,oy:this.cy,moved:false};
 }
 move(e){
  if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(this.pointers.size===2){const a=[...this.pointers.values()],d=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]);if(this.pinch>10){const r=this.canvas.getBoundingClientRect(),mx=(a[0][0]+a[1][0])/2-r.left,my=(a[0][1]+a[1][1])/2-r.top;this.zoom=Math.max(.3,Math.min(2.2,this.zoom*d/this.pinch));this.cx=Math.max(-700,Math.min(700,this.pinchAnchor.x-(mx-this.w/2)/this.zoom));this.cy=Math.max(-100,Math.min(800,this.pinchAnchor.y-(my-this.h/2)/this.zoom));}this.pinch=d;this.draw();return;}
  if(!this.pointer||this.pointer.id!==e.pointerId)return;const dx=e.clientX-this.pointer.x,dy=e.clientY-this.pointer.y;if(Math.hypot(dx,dy)>5)this.pointer.moved=true;
  if(this.pointer.moved){this.cx=Math.max(-700,Math.min(700,this.pointer.ox-dx/this.zoom));this.cy=Math.max(-100,Math.min(800,this.pointer.oy-dy/this.zoom));this.draw();}
 }
 cancelGesture(){this.pointer=null;this.pointers.clear();this.pinch=0;this.pinchAnchor=null;}
 up(e){
  if(!this.pointers.has(e.pointerId))return;
  this.pointers.delete(e.pointerId);const p=this.pointer;this.pointer=null;this.pinch=0;this.pinchAnchor=null;
  if(this.readOnly||!p||p.moved||p.id!==e.pointerId)return;
  const r=this.canvas.getBoundingClientRect(),sx=(e.clientX-r.left-this.w/2)/this.zoom+this.cx,sy=(e.clientY-r.top-this.h/2)/this.zoom+this.cy,company=this.state.community?.company;
  if(company?.career&&company.workshop){const [x,y]=this.iso(7.6,7.5);if(this.art.hit('workshop',company.workshop,sx-x,sy-y,{width:96})){this.onCompany?.();return;}}
  const sprites=[...this.state.buildings.map(b=>({kind:'plot',id:b.plot,type:b.type,level:b.level,...G.PLOTS[b.plot]})),...G.dispatch.sites(G.context).filter(site=>site.zone<G.unlocked(this.state)).map(site=>({...site,kind:'client',level:G.community.level(this.state,site.id)}))].sort((a,b)=>b.x+b.y-a.x-a.y);
  for(const item of sprites){const [x,y]=this.iso(item.x,item.y);if(this.art.hit(item.type,item.level,sx-x,sy-y,{npc:item.kind==='client',...(item.kind==='client'?{width:84}:{})})){if(item.kind==='client')this.onClient?.(item.id);else this.onPick(item.id);return;}}
  let best=null,score=1e9;for(const plot of G.PLOTS){const [x,y]=this.iso(plot.x,plot.y),d=Math.hypot(sx-x,(sy-y)*1.5);if(d<34&&d<score){score=d;best=plot;}}if(best)this.onPick(best.id);
 }
 focusSite(id){const site=G.dispatch.sites(G.context).find(s=>s.id===id);if(!site||site.zone>=G.unlocked(this.state))return false;this.zone=site.zone;[this.cx,this.cy]=this.iso(site.x,site.y);this.cy-=25;this.zoom=this.w<500?1.35:1.7;this.draw();return true;}
 diagnostics(){const company=this.state.community?.company;return {zoom:this.zoom,camera:{x:this.cx,y:this.cy},selectedPlot:this.selected,pointers:this.pointers.size,zone:this.zone,completionEffects:this.workEffects.length,completionCount:this.completionCount,workSites:this.state.dispatch.jobs.filter(j=>j.status==='working').length,companyWorkshop:company?.career?company.workshop:0,companyVan:company?.career?company.van:0,readOnly:this.readOnly,terrainBuilds:this.terrainBuilds||0};}

 polygon(points,fill,stroke){const c=this.ctx;c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
 tile(x,y,color,edge){const [px,py]=this.iso(x,y);this.polygon([[px,py-16],[px+32,py],[px,py+16],[px-32,py]],color,edge);}
 block(x,y,w,d,h,color,roof){const [px,py]=this.iso(x,y),a=[px,py],b=[px+w*32,py+w*16],cc=[px+(w-d)*32,py+(w+d)*16],dd=[px-d*32,py+d*16];this.polygon([a,b,[b[0],b[1]-h],[a[0],a[1]-h]],color);this.polygon([b,cc,[cc[0],cc[1]-h],[b[0],b[1]-h]],'#183448');this.polygon([cc,dd,[dd[0],dd[1]-h],[cc[0],cc[1]-h]],'#294a5b');this.polygon([[a[0],a[1]-h],[b[0],b[1]-h],[cc[0],cc[1]-h],[dd[0],dd[1]-h]],roof||color);return [px,py];}
 tree(x,y,seed=0){const [px,py]=this.iso(x,y),c=this.ctx;c.fillStyle='#102e23aa';c.beginPath();c.ellipse(px+3,py+4,13,6,0,0,7);c.fill();c.fillStyle='#705037';c.fillRect(px-2,py-20,4,23);c.strokeStyle='#80613d';c.lineWidth=2;c.beginPath();c.moveTo(px,py-6);c.lineTo(px-7,py-18);c.moveTo(px,py-10);c.lineTo(px+7,py-23);c.stroke();const shades=['#64985a','#79aa67','#4e854b'];for(let i=0;i<6;i++){const cx=px+Math.sin(i*2.4+seed)*8,cy=py-21-Math.cos(i*1.7)*8,r=8+i%3;const leaf=c.createRadialGradient(cx-3,cy-4,1,cx,cy,r);leaf.addColorStop(0,shades[i%3]);leaf.addColorStop(.6,'#3d7042');leaf.addColorStop(1,'#244e35');c.fillStyle=leaf;c.beginPath();c.arc(cx,cy,r,0,7);c.fill();}c.fillStyle='#c6cb8238';for(let i=0;i<8;i++){c.beginPath();c.arc(px+Math.sin(i*3.1+seed)*11,py-23+Math.cos(i*2.3)*9,1.4,0,7);c.fill();}}

 building(b){const p=G.PLOTS[b.plot],t=G.TYPES[b.type],c=this.ctx;const [x,y]=this.iso(p.x,p.y);c.save();if(this.art.ready){const effect=this.effects.find(e=>e.plot===b.plot),progress=effect?Math.min(1,(performance.now()-effect.start)/1800):1;this.art.draw(c,b.type,x,y,b.level,{progress,fromLevel:effect?.fromLevel||0});if(this.selected===b.plot){c.strokeStyle='#ffe0a3';c.lineWidth=2;c.beginPath();c.ellipse(x,y+11,38,19,0,0,7);c.stroke();}c.restore();return;}if(b.type==='garden'){this.tile(p.x,p.y,'#266c51','#5d9e73');this.tree(p.x-.2,p.y-.1);this.tree(p.x+.4,p.y+.2,1);c.fillStyle='#c0af7e';c.fillRect(x-14,y+2,17,3);}else if(b.type==='solar'){this.block(p.x-.4,p.y-.4,.8,.8,9,'#475f68','#536b71');for(let i=0;i<3;i++){const px=x-18+i*11;this.polygon([[px,y-19],[px+9,y-15],[px+2,y-6],[px-7,y-10]],'#1566a1','#66b6d6');}}else{const h=(b.type==='home'?30:23)+(b.level-1)*16;this.block(p.x-.45,p.y-.45,.9,.9,h,t.color,t.color);if(['home','workshop','bakery','cafe','culture'].includes(b.type)){this.polygon([[x-29,y-h],[x,y-h-19],[x+29,y-h],[x,y-h+11]],b.type==='workshop'?'#506a7a':'#8c6a60');this.polygon([[x,y-h-19],[x+29,y-h],[x+29,y-h+6],[x,y-h-11]],'#364c5c');}else this.block(p.x-.3,p.y-.3,.6,.6,h+7,t.color,'#bfd4cb');for(let row=0;row<b.level;row++){for(let col=0;col<3;col++){c.fillStyle=(col+row+b.plot)%3===0?'#ffe1a0':'#80c3ce';c.fillRect(x-20+col*7,y-13-row*14+col*3,4,6);c.fillStyle='#6a98a4';c.fillRect(x+4+col*6,y-4-row*14-col*3,3,5);}}c.fillStyle='#102b3e';c.fillRect(x-4,y-4,8,12);if(['cafe','market','bakery'].includes(b.type)){this.polygon([[x-28,y-11],[x,y+3],[x,y+9],[x-28,y-5]],'#ffcf91');for(let i=0;i<5;i++)this.polygon([[x-28+i*5,y-11+i*2.5],[x-25+i*5,y-9.5+i*2.5],[x-25+i*5,y-3.5+i*2.5],[x-28+i*5,y-5+i*2.5]],'#c26b59');}if(b.type==='depot'){c.fillStyle='#091e2b';c.fillRect(x+6,y-12,14,12);c.fillStyle='#76bdd7';c.fillRect(x+8,y-10,10,2);}if(b.type==='clinic'){c.fillStyle='#a0f0df';c.fillRect(x-3,y-h-5,6,15);c.fillRect(x-7,y-h,14,5);}}
 if(this.selected===b.plot){c.strokeStyle='#9ee9ff';c.lineWidth=2;const [px,py]=this.iso(p.x,p.y);c.beginPath();c.ellipse(px,py+9,35,18,0,0,7);c.stroke();}c.restore();}
 resetPresentation(){cancelAnimationFrame(this.raf);this.raf=0;this.effects=[];this.workEffects=[];this.completionCount=0;this.routes=[];this.seenRevision=-1;this.ambientKey='';this.cancelGesture();}
 setLiving(value){this.living=Boolean(value);if(!this.living){cancelAnimationFrame(this.raf);this.raf=0;}this.draw();}
 prepareTraffic(){const stamp=G.unlocked(this.state)+':'+(this.state.event?.kind||'')+':'+this.state.buildings.map(b=>b.plot).join(',');if(stamp===this.ambientKey)return;this.ambientKey=stamp;const sites=G.dispatch.sites(G.context).filter(s=>s.zone<G.unlocked(this.state)),roads=sites.map(s=>G.routePoint(s,this.state.event?.kind==='road'?this.state.event.blocked:null)).filter(p=>p&&p.length>2);this.ambient=roads.slice(0,8).map((path,i)=>({path,offset:i*.137,color:['#e0b46e','#79a6b7','#e6dfc8','#b1bdbb','#b56852','#6b96c8'][i%6],kind:i%3===2?'person':'car'}));}
 actors(now){const actors=[];if(this.reduced)return actors;if(this.living)for(let index=0;index<this.ambient.length;index++){const a=this.ambient[index],phase=(now/18000+a.offset)%2,back=phase>=1,t=back?2-phase:phase,at=t*(a.path.length-1),i=Math.min(a.path.length-2,Math.floor(at)),f=at-i,p=a.path[i],q=a.path[i+1],dx=q[0]-p[0],dy=q[1]-p[1],lane=(a.kind==='person'?.26:.12)*(back?-1:1),xx=p[0]+dx*f-dy*lane,yy=p[1]+dy*f+dx*lane;actors.push({kind:'actor',actor:a.kind,x:xx,y:yy,depth:xx+yy+.01,color:a.color,angle:Math.atan2((dx+dy)*16,(dx-dy)*32)+(back?Math.PI:0)});}for(let k=0;k<this.routes.length;k++){const r=this.routes[k],v=Math.min(.999,Math.max(0,(now-r.start)/4000)),at=v*(r.path.length-1),i=Math.floor(at),f=at-i,a=r.path[i],b=r.path[Math.min(i+1,r.path.length-1)],x=a[0]+(b[0]-a[0])*f,y=a[1]+(b[1]-a[1])*f;actors.push({kind:'actor',actor:'worker',x,y,depth:x+y+.02,color:r.worker?(G.dispatch.person(r.worker)?.color||'#ffc265'):'#9db4c4',step:Math.sin(now/90+k)*1.8});}return actors;}
 actor(item){
  const c=this.ctx,[x,y]=this.iso(item.x,item.y);c.save();c.translate(x,y);
  if(!['car','van'].includes(item.actor)){
   c.fillStyle='#29453a55';c.beginPath();c.ellipse(1,5,4.5,2.2,0,0,7);c.fill();const step=item.step??(this.reduced?0:Math.sin(performance.now()/140+item.x)*1.1);c.strokeStyle='#274553';c.lineWidth=1.7;c.beginPath();c.moveTo(-1,2);c.lineTo(-2+step,6);c.moveTo(1,2);c.lineTo(2-step,6);c.stroke();c.fillStyle=item.color;c.beginPath();c.roundRect(-2.8,-6,5.6,8.5,1.5);c.fill();c.strokeStyle=item.color;c.lineWidth=1.5;c.beginPath();c.moveTo(-2,-3);c.lineTo(-4-step,-.5);c.moveTo(2,-3);c.lineTo(4+step,-.5);c.stroke();c.fillStyle='#e7bd9b';c.beginPath();c.arc(0,-8,2.7,0,7);c.fill();if(item.actor==='worker'){c.fillStyle='#f7c56e';c.beginPath();c.roundRect(-4,-12,8,3,1);c.fill();c.fillStyle='#8e673e';c.beginPath();c.roundRect(3,-1,4,4,1);c.fill();c.strokeStyle='#d8b26c';c.lineWidth=.7;c.strokeRect(4,-2,2,1.5);}
  }else{
   const van=item.actor==='van';c.rotate(item.angle||0);c.translate(0,3);c.fillStyle='#27403555';c.beginPath();c.ellipse(1,4,van?15:12,6,0,0,7);c.fill();c.fillStyle='#263740';for(const xx of [-7,6])for(const yy of [-6,4]){c.beginPath();c.roundRect(xx-1,yy,4,3,1);c.fill();}c.fillStyle='#47606a';c.beginPath();c.roundRect(van?-14:-11,-3,van?29:23,9,3);c.fill();c.fillStyle=item.color||'#e0bd7a';c.beginPath();c.roundRect(van?-14:-11,-6,van?29:23,10,3);c.fill();c.fillStyle='#edf3e5';c.beginPath();c.roundRect(van?-11:-5,-5,van?17:12,8,2);c.fill();c.fillStyle='#527987';c.beginPath();c.roundRect(van?5:3,-4,4,6,1);c.fill();if(!van){c.fillStyle='#2f5260';c.fillRect(-5,-3,3,6);}else{c.strokeStyle='#9e9f86';c.lineWidth=.8;c.strokeRect(-10,-3,11,4);c.fillStyle='#b89b61';c.fillRect(-5,-2,1,4);c.fillRect(-8,-.5,7,1);}c.fillStyle='#fff3b7';c.fillRect(van?13:10,-4,2,2);c.fillRect(van?13:10,1,2,2);c.fillStyle='#b8664a';c.fillRect(van?-14:-11,-4,1.5,2);c.fillRect(van?-14:-11,1,1.5,2);c.fillStyle='#d5d9ca';c.fillRect(van?14:11,-1,1,2);
  }
  c.restore();
 }

 roadTile(x,y){
  const c=this.ctx,[px,py]=this.iso(x,y),neighbors=[[x,y-1],[x+1,y],[x,y+1],[x-1,y]],corners=[[px,py-16],[px+32,py],[px,py+16],[px-32,py]];
  this.tile(x,y,'#65767b');
  c.lineCap='butt';for(let i=0;i<4;i++)if(!G.road(...neighbors[i])){const a=corners[i],b=corners[(i+1)%4];c.strokeStyle='#e2dbc1';c.lineWidth=4.2;c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();c.strokeStyle='#8d9d8a';c.lineWidth=.8;c.beginPath();c.moveTo(a[0]+(px-a[0])*.12,a[1]+(py-a[1])*.12);c.lineTo(b[0]+(px-b[0])*.12,b[1]+(py-b[1])*.12);c.stroke();}
  const vertical=[3,10,17].includes(x),horizontal=[3,10,17].includes(y);
  if(vertical&&horizontal){for(let i=-2;i<=2;i++){this.polygon([[px-20+i*4,py-4+i*2],[px-16+i*4,py-6+i*2],[px-11+i*4,py-3.5+i*2],[px-15+i*4,py-1.5+i*2]],'#e7e6d6');}return;}
  c.strokeStyle='#e1d19a';c.lineWidth=1.2;c.beginPath();if(vertical){c.moveTo(px-8,py+4);c.lineTo(px+8,py-4);}else{c.moveTo(px-8,py-4);c.lineTo(px+8,py+4);}c.stroke();
  if(y===6){c.strokeStyle='#d7e7df';c.lineWidth=2;c.beginPath();c.moveTo(px-29,py-2);c.lineTo(px+1,py-17);c.moveTo(px-1,py+17);c.lineTo(px+29,py+2);c.stroke();}
 }
 terrain(){
  const unlocked=G.unlocked(this.state);if(this.terrainKey===unlocked&&this.terrainCanvas)return;
  this.terrainKey=unlocked;this.terrainBuilds=(this.terrainBuilds||0)+1;const canvas=this.terrainCanvas||(this.terrainCanvas=document.createElement('canvas'));canvas.width=1400;canvas.height=760;const original=this.ctx,c=canvas.getContext('2d');this.ctx=c;c.setTransform(1,0,0,1,700,40);
  try{for(let sum=0;sum<41;sum++)for(let x=0;x<21;x++){const y=sum-x;if(y<0||y>=21)continue;const road=G.road(x,y),river=y===6&&!road,z=G.ZONES.find(z=>x>=z.x&&x<z.x+7&&y>=z.y&&y<z.y+7),locked=z&&z.id>=unlocked;if(road){this.roadTile(x,y);continue;}const [px,py]=this.iso(x,y);this.tile(x,y,river?'#5cabb5':locked?'#9eafa0':(x+y)%3?'#a1b983':'#adc18e');if(river){c.strokeStyle='#d0f1e8aa';c.lineWidth=1;c.beginPath();c.moveTo(px-16,py+2);c.lineTo(px+10,py+2);c.moveTo(px-5,py-5);c.lineTo(px+12,py-5);c.stroke();}else if(!locked){c.fillStyle='#6d946b55';for(let i=0;i<3;i++){const gx=px-16+(x*19+y*7+i*11)%34,gy=py-4+(x*3+y*13+i*7)%9;c.fillRect(gx,gy,1.4,1.4);}}}
  }finally{this.ctx=original;}
 }
 parcel(x,y,selected=false,locked=false){const c=this.ctx,[px,py]=this.iso(x,y);this.polygon([[px-32,py],[px,py-16],[px+32,py],[px,py+16]],locked?'#b5bfa8':selected?'#e8d298':'#d1c6a5',locked?'#9eac9b':'#f0e2ba');this.polygon([[px-32,py],[px,py+16],[px+32,py],[px+32,py+3],[px,py+19],[px-32,py+3]],locked?'#a0ad98':'#8a9d82');if(!locked){c.strokeStyle='#b6ac90';c.lineWidth=.8;c.beginPath();c.moveTo(px-20,py-10);c.lineTo(px+12,py+6);c.moveTo(px-12,py-6);c.lineTo(px+20,py+10);c.stroke();}}
 company(){const company=this.state.community?.company;if(!company?.career||!company.workshop)return;const c=this.ctx,[x,y]=this.iso(7.6,7.5);this.parcel(7.6,7.5);this.art.draw(c,'workshop',x,y,company.workshop,{width:96});c.fillStyle='#1d4650ee';c.strokeStyle='#f1c276';c.lineWidth=1;c.beginPath();c.roundRect(x-43,y+17,86,17,5);c.fill();c.stroke();c.fillStyle='#fff2ce';c.textAlign='center';c.font='bold 8px system-ui';c.fillText('TVOJA RADIONICA '+company.workshop,x,y+29);if(company.van){this.actor({actor:'van',x:8.05,y:7.13,angle:.45,color:'#e6ba61',parked:true});}}
 workSite(site,job,now){
  const c=this.ctx,[x,y]=this.iso(site.x,site.y),level=G.community.level(this.state,site.id),bounds=this.art.bounds(site.type,level,{npc:true,width:84}),height=bounds?.height||60;
  if(job.status==='working'){
   const left=x-35,right=x+35,top=y-height*.68;c.save();c.strokeStyle='#b68b51';c.lineWidth=2;c.beginPath();c.moveTo(left,y+10);c.lineTo(left,top);c.moveTo(right,y+10);c.lineTo(right,top);c.moveTo(left,top);c.lineTo(right,top);c.moveTo(left,y-5);c.lineTo(right,y-5);c.stroke();for(let i=0;i<3;i++){c.fillStyle=i%2?'#f2dc9e':'#b47748';c.fillRect(left+5+i*18,y+11,15,4);}const p=Math.max(0,Math.min(1,(job.totalWork-job.workLeft)/Math.max(1,job.totalWork)));c.fillStyle='#214b52';c.beginPath();c.roundRect(x-26,y+21,52,5,2);c.fill();c.fillStyle='#efbe64';c.fillRect(x-25,y+22,50*p,3);c.restore();
   this.actor({actor:'worker',x:site.x+.38,y:site.y+.26,color:G.dispatch.person(job.worker)?.color||'#d9a24e',step:this.reduced?0:Math.sin(now/170)*1.4});
  }
  const markerY=y-height-4;c.save();c.fillStyle=job.status==='review'?'#54a786':job.status==='working'?'#e4ad57':'#6c9fb7';c.strokeStyle='#fff0c9';c.lineWidth=1.5;c.beginPath();c.arc(x,markerY,10,0,7);c.fill();c.stroke();c.fillStyle='#102b39';c.font='bold 11px system-ui';c.textAlign='center';c.fillText(job.status==='review'?'✓':job.status==='working'?'⚒':'→',x,markerY+4);const name=G.dispatch.person(job.worker)?.name||'';c.fillStyle='#163846f2';c.beginPath();c.roundRect(x-30,markerY-30,60,16,5);c.fill();c.fillStyle='#fff0cc';c.font='bold 8px system-ui';c.fillText(name,x,markerY-19);c.restore();
 }
 completion(effect,now){
  const c=this.ctx,site=effect.kind==='company'?{x:7.6,y:7.5}:G.dispatch.sites(G.context).find(s=>s.id===effect.site);if(!site)return;const t=Math.max(0,Math.min(1,(now-effect.start)/2100)),[x,y]=this.iso(site.x,site.y),fade=Math.min(1,t*8,(1-t)*5);c.save();c.globalAlpha*=fade;
  c.strokeStyle=effect.kind==='paid'?'#fff2a4':'#bfffe2';c.lineWidth=2.4*(1-t)+.7;c.beginPath();c.ellipse(x,y+12,30+t*32,15+t*16,0,0,7);c.stroke();for(let i=0;i<7;i++){const angle=i*Math.PI*2/7,r=20+t*44;c.fillStyle=i%2?'#fff3bc':'#87e6bd';c.fillRect(x+Math.cos(angle)*r-1,y-20+Math.sin(angle)*r*.6-t*20,2.5,2.5);}const label=effect.kind==='company'?'RADIONICA · NIVO '+effect.level:effect.kind==='paid'?'PREDANO · +'+effect.paid+' NOV.':'RAD JE ZAVRŠEN';c.font='bold 9px system-ui';const width=c.measureText(label).width+22,top=y-93-t*13;c.fillStyle='#173b48f2';c.strokeStyle='#e7d09b';c.lineWidth=1;c.beginPath();c.roundRect(x-width/2,top,width,23,7);c.fill();c.stroke();c.fillStyle='#fff0bf';c.textAlign='center';c.fillText(label,x,top+15);c.restore();
 }

 draw(){
  if(!this.w||!this.h)return;
  const now=performance.now();this.effects=this.effects.filter(e=>now-e.start<1800);if(this.visible&&!document.hidden)for(const e of this.workEffects)if(e.start===null)e.start=now;this.workEffects=this.workEffects.filter(e=>e.start===null||now-e.start<2100);this.routes=this.routes.filter(r=>now-r.start<5000);this.frames=(this.frames||0)+1;this.lastFrame=now;
  const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,this.w,this.h);const glow=c.createRadialGradient(this.w*.48,this.h*.4,20,this.w*.5,this.h*.45,this.w*.85);glow.addColorStop(0,'#dbe8ce');glow.addColorStop(.65,'#a9c3b3');glow.addColorStop(1,'#648594');c.fillStyle=glow;c.fillRect(0,0,this.w,this.h);
  c.save();c.translate(this.w/2,this.h/2);c.scale(this.zoom,this.zoom);c.translate(-this.cx,-this.cy);this.terrain();c.drawImage(this.terrainCanvas,-700,-40);
  const occupied=new Map(this.state.buildings.map(b=>[b.plot,b])),items=this.actors(now),unlocked=G.unlocked(this.state);
  for(const z of G.ZONES){const locked=z.id>=unlocked;for(let i=0;i<4;i++){const x=z.x+(i<2?.45:5.7),y=z.y+(i%2?.6:5.7);items.push({depth:x+y,kind:'tree',x,y,locked});}for(const p of G.PLOTS.filter(p=>p.zone===z.id))items.push({depth:p.x+p.y,kind:'plot',p,locked});items.push({depth:z.x+z.y+7.7,kind:'lamp',x:z.x+3.4,y:z.y+3.8,locked});if(this.state.stage>=(z.id+1)*5)items.push({depth:z.x+z.y+8,kind:'project',x:z.x+4,y:z.y+4,zone:z.id,locked:false});}
  for(const site of G.dispatch.sites(G.context))items.push({depth:site.x+site.y,kind:'client',site,locked:site.zone>=unlocked});
  if(this.state.community?.company?.career&&this.state.community.company.workshop)items.push({depth:15.1,kind:'company',locked:false});
  items.sort((a,b)=>a.depth-b.depth);
  for(const item of items){c.globalAlpha=item.locked?.28:1;
   if(item.kind==='actor'){this.actor(item);continue;}
   if(item.kind==='company'){this.company();continue;}
   if(item.kind==='lamp'){const [x,y]=this.iso(item.x,item.y);c.strokeStyle='#587372';c.lineWidth=2;c.beginPath();c.moveTo(x,y+2);c.lineTo(x,y-27);c.lineTo(x+6,y-30);c.stroke();c.fillStyle='#f6d699';c.beginPath();c.roundRect(x+3,y-33,7,5,2);c.fill();c.strokeStyle='#6b7968';c.lineWidth=1;c.stroke();continue;}
   if(item.kind==='client'){const site=item.site,[x,y]=this.iso(site.x,site.y);this.parcel(site.x,site.y,false,item.locked);if(!this.art.draw(c,site.type,x,y,G.community.level(this.state,site.id),{npc:true,width:84}))this.block(site.x-.3,site.y-.3,.6,.6,25,'#d1b68c','#89755d');const job=this.state.dispatch.jobs.find(j=>j.site===site.id&&['scheduled','travelling','working','review'].includes(j.status));if(job&&!item.locked){c.globalAlpha=1;this.workSite(site,job,now);}continue;}
   if(item.kind==='project'){const [x,y]=this.iso(item.x,item.y);this.parcel(item.x,item.y);c.fillStyle='#5d9dac';c.beginPath();c.ellipse(x,y,14,7,0,0,7);c.fill();c.strokeStyle='#c7f5ec';c.lineWidth=2;c.beginPath();c.moveTo(x,y-16);c.lineTo(x,y);c.stroke();c.fillStyle='#f6d190';c.beginPath();c.arc(x,y-17,4,0,7);c.fill();continue;}
   if(item.kind==='tree'){this.tree(item.x,item.y,1);continue;}
   const p=item.p,[x,y]=this.iso(p.x,p.y),b=occupied.get(p.id);this.parcel(p.x,p.y,this.selected===p.id,item.locked);
   if(b)this.building(b);else{c.font='bold 14px system-ui';c.textAlign='center';c.fillStyle=item.locked?'#728c7a':this.selected===p.id?'#503e23':'#536c50';c.fillText(item.locked?'·':'+',x,y+6);}
  }
  c.globalAlpha=1;
  for(const z of G.ZONES){const [x,y]=this.iso(z.x+3,z.y+6.15),locked=z.id>=unlocked,label=(locked?'▣ ':'')+z.name;c.font='bold 9px system-ui';const width=Math.max(88,c.measureText(label).width+24);c.fillStyle=locked?'#58726cdd':'#244b54ef';c.beginPath();c.roundRect(x-width/2,y-11,width,25,8);c.fill();c.strokeStyle=locked?'#a8b5a0':'#e8ce91';c.lineWidth=1;c.stroke();c.fillStyle=locked?'#d7dfcb':'#fff1cf';c.textAlign='center';c.fillText(label,x,y+5);}
  if(this.state.event?.kind==='road'){const [x,y]=this.iso(10,7);this.polygon([[x,y-12],[x+18,y],[x,y+12],[x-18,y]],'#b56e3e');c.strokeStyle='#f5dfb1';c.lineWidth=3;c.beginPath();c.moveTo(x-18,y-3);c.lineTo(x+18,y+12);c.stroke();c.fillStyle='#fff0c8';c.font='bold 18px system-ui';c.fillText('!',x,y+6);}
  for(const e of this.workEffects)if(e.start!==null)this.completion(e,now);
  c.restore();
  if((this.routes.length||this.effects.length||this.workEffects.some(e=>e.start!==null)||this.living)&&this.visible&&!document.hidden&&!this.reduced){cancelAnimationFrame(this.raf);const frame=()=>{if(performance.now()-this.lastFrame<42){this.raf=requestAnimationFrame(frame);return;}this.draw();};this.raf=requestAnimationFrame(frame);}
 }

 animate(routes,jobs=[]){const requested=jobs.length?jobs:routes;this.routes=this.reduced?[]:requested.filter(r=>r.path.length>1).slice(0,12).map(r=>({...r,start:performance.now()}));this.draw();}
 image(){return this.canvas.toDataURL('image/png');}
}
window.GradCity=City;
})();
