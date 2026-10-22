/* Original cockpit and work-site views. Inputs execute validated game commands. */
(function () {
  'use strict';
  const G = window.GradMajstora, D = G.dispatch, F = window.GradFieldwork;
  const DIR = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}];
  const ACTIONS = [['left','↶ Lijevo'],['forward','↑ Gas'],['right','Desno ↷'],['reverse','↺ Okreni'],['brake','↓ Kočnica'],['park','P · Parkiraj']];
  const REPAIR = {
    water: {title:'Vodoinstalaterski zahvat',actions:['Zatvori dovod','Pregledaj spoj','Učvrsti spoj alatom','Provjeri pod pritiskom'],texts:['Prvo zaustavi dovod.','Pronađi spoj koji propušta.','Upotrijebi pripremljeni pribor na označenom spoju.','Otvori provjeru i pregledaj da li spoj drži.']},
    electric: {title:'Elektro zahvat',actions:['Isključi napajanje','Provjeri stanje kruga','Učvrsti kontakt alatom','Izvrši završnu provjeru'],texts:['Prvo izoluj napajanje u igri.','Provjeri pokazivač na radnoj ploči.','Popravi označeni kontakt pripremljenim priborom.','Završi provjeru prije predaje rada.']}
  };
  class FieldworkUI {
    constructor(port) {
      this.p=port; this.mode='drive'; this.active=false; this.paused=false;
      this.lastMoveAt=-1000; this.held=null; this.holdTimer=0; this.raf=0;
      this.frames=0; this.state=null; this.previous=null; this.transition=null;
      this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const media=matchMedia('(prefers-reduced-motion: reduce)');
      media.addEventListener('change',e=>{this.reduced=e.matches;this.transition=null;this.stopHeld();this.draw();});
      this.onKeyDown=e=>this.key(e,true); this.onKeyUp=e=>this.key(e,false);
      window.addEventListener('keydown',this.onKeyDown);
      window.addEventListener('keyup',this.onKeyUp);
      window.addEventListener('blur',()=>this.stopHeld());
      document.addEventListener('visibilitychange',()=>{if(document.hidden){this.stopHeld();cancelAnimationFrame(this.raf);this.raf=0;}else this.draw();});
    }
    reset(){this.stopHeld();this.mode='drive';this.paused=false;this.previous=null;this.transition=null;cancelAnimationFrame(this.raf);this.raf=0;}
    setActive(value){this.active=Boolean(value);if(!this.active){this.stopHeld();cancelAnimationFrame(this.raf);this.raf=0;}else this.draw();}
    startDrive(job){const result=this.p.perform({type:'field_drive_start',job});if(!result)return;this.mode='drive';this.paused=false;this.p.selectTab('drive');this.render(this.p.state());}
    startRepair(job){const result=this.p.perform({type:'field_repair_start',job});if(!result)return;this.mode='repair';this.p.selectTab('drive');this.render(this.p.state());}
    root(){return document.getElementById('fieldwork-root');}
    build(){
      const root=this.root();if(!root||this.shell)return;
      const {el,button}=this.p;
      this.shell=el('div',undefined,'fieldwork-shell');
      const intro=el('div',undefined,'fieldwork-heading');
      intro.append(el('span','TVOJ RADNI DAN IZBLIZA','eyebrow'),el('h2','Od puta do pravog zahvata.'),el('p','Vozi kroz grad do ugovorene adrese. Na radnom mjestu koristi postupak i alat koji pripadaju tom poslu. Naplata je tek nakon predaje rezultata.'));
      this.launchers=el('div',undefined,'fieldwork-launchers');this.launchers.id='fieldwork-launchers';
      this.switcher=el('div',undefined,'fieldwork-switcher');
      this.driveSwitch=button('Za volanom',()=>{this.mode='drive';this.render(this.p.state());});
      this.repairSwitch=button('Radni prostor',()=>{this.mode='repair';this.render(this.p.state());});
      this.switcher.append(this.driveSwitch,this.repairSwitch);
      this.drivePanel=el('section',undefined,'cockpit-panel');this.drivePanel.id='drive-panel';
      const driveHeading=el('div',undefined,'cockpit-heading');this.driveTitle=el('h3');this.driveSummary=el('p');this.driveSummary.id='drive-summary';driveHeading.append(this.driveTitle,this.driveSummary);
      this.driveStage=el('div',undefined,'cockpit-stage');this.driveCanvas=el('canvas');this.driveCanvas.id='drive-scene';this.driveCanvas.setAttribute('role','img');this.driveCanvas.setAttribute('aria-label','Pogled iz kabine i navigacija po stvarnim cestama grada');
      this.pauseOverlay=el('div','Vožnja je pauzirana.','cockpit-paused');this.pauseOverlay.hidden=true;this.driveStage.append(this.driveCanvas,this.pauseOverlay);
      this.instruction=el('p',undefined,'drive-instruction');this.instruction.id='drive-instruction';this.instruction.setAttribute('aria-live','polite');
      this.routeText=el('p',undefined,'drive-route-text');this.routeText.id='drive-route-text';
      this.controls=el('div',undefined,'drive-controls');this.controlButtons={};
      for(const [action,label] of ACTIONS){
        const control=button(label,e=>{if(action==='forward'){if(e.detail===0)this.control(action);}else this.control(action);},action==='forward'?'primary':'secondary');
        control.dataset.driveAction=action;this.controlButtons[action]=control;
        if(action==='forward'){
          control.addEventListener('pointerdown',e=>{if(e.button!==0||control.disabled)return;e.preventDefault();control.setPointerCapture(e.pointerId);this.beginHeld('pointer');});
          for(const type of ['pointerup','pointercancel','lostpointercapture'])control.addEventListener(type,()=>this.stopHeld());
        }
        this.controls.append(control);
      }
      const bottom=el('div',undefined,'drive-bottom');
      this.pauseButton=button('Pauziraj vožnju',()=>{this.paused=!this.paused;this.stopHeld();this.render(this.p.state());});
      this.destinationButton=button('Otvori radnu lokaciju',()=>{const d=this.state?.community.fieldwork?.drive;if(d)this.p.openField();},'primary');
      bottom.append(this.pauseButton,this.destinationButton);
      const how=el('p','Gas pomjera vozilo za jednu poziciju ceste. Drži za nastavak. Zakoči prije skretanja ili parkiranja. Strelice / WASD upravljaju vozilom; P parkira, R okreće vozilo.','fieldwork-help');
      this.drivePanel.append(driveHeading,this.driveStage,this.instruction,this.routeText,this.controls,bottom,how);
      this.repairPanel=el('section',undefined,'repair-panel');this.repairPanel.id='repair-panel';
      this.repairTitle=el('h3');this.repairSummary=el('p');this.repairSummary.id='repair-summary';
      this.repairStage=el('div',undefined,'repair-stage');this.repairCanvas=el('canvas');this.repairCanvas.id='repair-scene';this.repairCanvas.setAttribute('role','img');this.repairCanvas.setAttribute('aria-label','Radna prostorija: stanje instalacije i stvarni koraci popravke');this.repairStage.append(this.repairCanvas);
      this.repairInstruction=el('p',undefined,'repair-instruction');this.repairInstruction.id='repair-instruction';this.repairInstruction.setAttribute('aria-live','polite');this.repairTool=el('p',undefined,'repair-tool');this.repairTool.id='repair-tool';
      this.repairControls=el('div',undefined,'repair-controls');this.repairButtons={};
      for(const action of ['isolate','diagnose','repair','test']){const b=button('',()=>this.p.perform({type:'field_repair_action',action}));b.dataset.repairAction=action;this.repairButtons[action]=b;this.repairControls.append(b);}
      this.repairJob=button('Pogledaj stvarni status posla',()=>{const r=this.state?.community.fieldwork?.repair;if(r)this.p.openJob(r.job);},'primary');
      this.repairPanel.append(this.repairTitle,this.repairSummary,this.repairStage,this.repairInstruction,this.repairTool,this.repairControls,this.repairJob);
      this.shell.append(intro,this.launchers,this.switcher,this.drivePanel,this.repairPanel);root.append(this.shell);
      this.resize=new ResizeObserver(()=>this.draw());this.resize.observe(this.driveStage);this.resize.observe(this.repairStage);
    }
    render(s){
      this.state=s;this.build();if(!this.shell)return;
      const field=s.community.fieldwork;if(!field){this.shell.hidden=true;return;}this.shell.hidden=false;
      const d=field.drive,r=field.repair;
      if(d){const now={x:d.x,y:d.y,heading:d.heading};if(this.previous&&(now.x!==this.previous.x||now.y!==this.previous.y||now.heading!==this.previous.heading))this.transition=this.reduced?null:{from:this.previous,to:now,start:performance.now()};this.previous=now;}
      else this.previous=null;
      this.renderLaunchers(s);
      this.switcher.hidden=!d&&!r;
      this.driveSwitch.hidden=!d;this.repairSwitch.hidden=!r;
      if(!d&&r)this.mode='repair';if(!r&&d)this.mode='drive';
      this.driveSwitch.setAttribute('aria-pressed',String(this.mode==='drive'));this.repairSwitch.setAttribute('aria-pressed',String(this.mode==='repair'));
      this.drivePanel.hidden=!d||this.mode!=='drive';this.repairPanel.hidden=!r||this.mode!=='repair';
      if(d)this.renderDrive(s,d);if(r)this.renderRepair(s,r);
      this.draw();
    }
    renderLaunchers(s){
      const {el,button}=this.p;this.launchers.replaceChildren();
      const travelling=s.dispatch.jobs.filter(j=>j.status==='travelling'&&j.worker==='adnan');
      const working=s.dispatch.jobs.filter(j=>j.status==='working'&&['water','electric'].includes(D.definition(j).skill));
      const active=s.community.fieldwork;
      for(const j of travelling){const card=el('div',undefined,'fieldwork-offer'),site=D.sites(G.context)[j.site];card.append(el('span','VOŽNJA DO KLIJENTA','eyebrow'),el('h3',site.name+' · '+D.definition(j).title),el('p',s.community.company.van?'Vlastiti kombi, bez najma. Koristi se gorivo ugovorenog puta ili 1 gorivo pri polasku.':'Najam servisnog kombija: 12 novčića jednom za ovu vožnju.'));const current=active.drive?.job===j.id&&active.drive.status==='driving',b=button(current?'Nastavi vožnju':'Sjedni za volan',()=>current?(this.mode='drive',this.render(this.p.state())):this.startDrive(j.id),'primary');b.dataset.startDrive=j.id;b.disabled=!current&&active.drive?.status==='driving';card.append(b);this.launchers.append(card);}
      for(const j of working){const card=el('div',undefined,'fieldwork-offer'),site=D.sites(G.context)[j.site];card.append(el('span','EKIPA JE NA ADRESI','eyebrow'),el('h3',site.name+' · '+D.definition(j).title),el('p',D.person(j.worker).name+' radi na ugovorenom poslu. Pregledaj prostor, izoluj instalaciju, popravi i testiraj zahvat.'));const current=active.repair?.job===j.id&&active.repair.status==='playing',b=button(current?'Nastavi zahvat':'Uđi u radni prostor',()=>current?(this.mode='repair',this.render(this.p.state())):this.startRepair(j.id),'primary');b.dataset.startRepair=j.id;b.disabled=!current&&(active.repair?.status==='playing'||active.repair?.day===s.day);card.append(b);if(!current&&active.repair?.day===s.day)card.append(el('p','Današnji pokušaj je završen. Preostali rad napreduje redovnim radnim danom.'));this.launchers.append(card);}
      if(!travelling.length&&!working.length&&!active.drive&&!active.repair){const empty=el('div',undefined,'fieldwork-empty');empty.append(el('h3','Prvo ugovori izlazak.'),el('p','Za vlastitu vožnju dodijeli posao Adnanu i pošalji ga na adresu. Radni prostor se otvara kada vodoinstalater ili električar stvarno stigne na posao.'),button('Otvori poslove',()=>this.p.selectTab('jobs'),'primary'));this.launchers.append(empty);}
    }
    renderDrive(s,d){
      const site=D.sites(G.context)[d.site],j=s.dispatch.jobs.find(j=>j.id===d.job);this.driveTitle.textContent='Adnan za volanom · '+site.name;
      this.driveSummary.textContent=site.address+' · '+(d.rented?'Iznajmljeni servisni kombi':'Tvoje vozilo')+' · pređeno '+d.steps+' pozicija ceste.';
      const route=(j?F.drivePlan(s,j,G.context):null)||[],next=route[1];
      let text='Vožnja je završena.';
      if(d.status==='driving'){
        if(d.x===d.destination[0]&&d.y===d.destination[1])text=d.speed?'Stigao si do adrese. Zakoči, zatim parkiraj.':'Adresa je ispred tebe. Parkiraj da počneš ugovoreni rad.';
        else if(next){const heading=DIR.findIndex(v=>v.x===next[0]-d.x&&v.y===next[1]-d.y),diff=(heading-d.heading+4)%4;
          text=diff===0?'Nastavi pravo prema klijentu.':d.speed?'Zakoči prije skretanja.':diff===1?'Sljedeći potez: skreni desno.':diff===3?'Sljedeći potez: skreni lijevo.':'Okreni vozilo na prohodnu rutu.';
        }else text='Trenutna ruta nije prohodna. Provjeri stanje ceste ili nastavi redovni obračun dana.';
      } else if(d.status==='arrived')text='Parkiran si kod klijenta. Dolazak je evidentiran; sada slijedi stvarni rad.';
      this.instruction.textContent=text;
      this.routeText.textContent='Položaj '+d.x+', '+d.y+' · '+F.DIRECTIONS[d.heading].name+' · preostalo '+Math.max(0,route.length-1)+' pozicija do adrese.';
      const disabled=d.status!=='driving'||this.paused;
      for(const [action,b]of Object.entries(this.controlButtons)){b.disabled=disabled||(action==='park'&&(d.x!==d.destination[0]||d.y!==d.destination[1]||d.speed!==0));}
      this.pauseButton.hidden=d.status!=='driving';this.pauseButton.textContent=this.paused?'Nastavi upravljanje':'Pauziraj vožnju';
      this.pauseOverlay.hidden=!this.paused;this.destinationButton.hidden=d.status!=='arrived';
      if(d.status!=='driving')this.stopHeld();
    }
    renderRepair(s,r){
      const site=D.sites(G.context)[r.site],j=s.dispatch.jobs.find(j=>j.id===r.job),info=REPAIR[r.skill];
      this.repairTitle.textContent=info.title+' · '+site.name;
      this.repairSummary.textContent=D.person(r.worker).name+' · '+(j?D.definition(j).title:'Zabilježeni zahvat')+' · korak '+Math.min(r.step+1,4)+' / 4.';
      this.repairInstruction.textContent=r.status==='won'?(j?.status==='review'?'Zahvat je završen. Pregledaj kvalitet i predaj posao klijentu.':'Ova radna smjena je završena. Preostale smjene vidiš u stvarnom statusu posla.'):r.status==='finished'?'Radni prostor je zatvoren jer se promijenio dan ili status posla.':info.texts[r.step];
      const assignment=s.community.company.jobTools.find(a=>a.job===r.job),tool=assignment&&s.community.company.tools.find(t=>t.serial===assignment.serial);
      this.repairTool.textContent=tool?'Odabrani alat: '+G.community.toolInfo(tool.kind).name+' #'+tool.serial+' · stanje '+tool.condition+'%.':'Pribor donosi '+D.person(r.worker).name+'. Završetak zahvata koristi isti stvarni obračun radne smjene.';
      Object.entries(this.repairButtons).forEach(([action,b],i)=>{b.textContent=(i<r.step?'✓ ':'')+(i+1)+'. '+info.actions[i];b.disabled=r.status!=='playing'||i!==r.step;});
    }
    control(action){
      if(!this.active||document.hidden||document.querySelector('dialog[open]')||this.paused||this.mode!=='drive')return;
      const d=this.state?.community.fieldwork?.drive;if(!d||d.status!=='driving')return;
      if(action==='forward'){const now=performance.now();if(now-this.lastMoveAt<550)return;this.lastMoveAt=now;}
      const result=this.p.perform({type:'field_drive_control',action});
      if(!result&&action==='forward')this.stopHeld();
      return result;
    }
    beginHeld(source){this.stopHeld();if(this.paused||document.querySelector('dialog[open]'))return;this.held=source;const result=this.control('forward');if(!result||!this.held)return;this.holdTimer=setInterval(()=>{if(!this.active||document.hidden||document.querySelector('dialog[open]')||this.mode!=='drive')this.stopHeld();else this.control('forward');},570);}
    stopHeld(){clearInterval(this.holdTimer);this.holdTimer=0;this.held=null;}
    key(e,down){
      if(!this.active||document.hidden||document.querySelector('dialog[open]')||this.mode!=='drive'||this.drivePanel?.hidden||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
      const action={ArrowUp:'forward',w:'forward',W:'forward',ArrowDown:'brake',s:'brake',S:'brake',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',p:'park',P:'park',r:'reverse',R:'reverse'}[e.key];
      if(!action)return;e.preventDefault();if(!down){if(action==='forward')this.stopHeld();return;}if(e.repeat)return;
      if(action==='forward')this.beginHeld('keyboard');else{this.stopHeld();this.control(action);}
    }
    canvasContext(canvas){const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return null;const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}const c=canvas.getContext('2d');c.setTransform(w/1000,0,0,h/620,0,0);return c;}
    draw(){
      cancelAnimationFrame(this.raf);this.raf=0;if(!this.active||document.hidden||!this.state||!this.shell)return;
      const d=this.state.community.fieldwork?.drive,r=this.state.community.fieldwork?.repair;let again=false;
      if(d&&this.mode==='drive'&&!this.drivePanel.hidden){const c=this.canvasContext(this.driveCanvas);if(c){this.drawDrive(c,d);this.frames++;again=!this.reduced&&this.transition&&performance.now()-this.transition.start<240;}}
      if(r&&this.mode==='repair'&&!this.repairPanel.hidden){const c=this.canvasContext(this.repairCanvas);if(c){this.drawRoom(c,r);this.frames++;again=!this.reduced&&r.status==='playing'&&r.skill==='water'&&r.step===0;}}
      if(again){const start=performance.now();const frame=()=>{if(performance.now()-start<42){this.raf=requestAnimationFrame(frame);return;}this.draw();};this.raf=requestAnimationFrame(frame);}
    }
    round(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
    polygon(c,points,fill){c.beginPath();c.moveTo(...points[0]);points.slice(1).forEach(p=>c.lineTo(...p));c.closePath();c.fillStyle=fill;c.fill();}
    text(c,text,x,y,size=14,color='#fff',align='left'){c.fillStyle=color;c.font='600 '+size+'px system-ui';c.textAlign=align;c.fillText(text,x,y);}
    drawDrive(c,d){
      c.clearRect(0,0,1000,620);const sky=c.createLinearGradient(0,0,0,410);sky.addColorStop(0,'#6bacc3');sky.addColorStop(.65,'#d6e4cc');sky.addColorStop(1,'#a2b07d');c.fillStyle=sky;c.fillRect(0,0,1000,620);
      this.polygon(c,[[0,190],[90,145],[200,173],[310,126],[440,169],[570,136],[720,180],[850,140],[1000,190],[1000,300],[0,300]],'#799892');
      let x=d.x,y=d.y,angle=d.heading*Math.PI/2;
      if(this.transition&&!this.reduced){const t=Math.min(1,(performance.now()-this.transition.start)/240),e=1-(1-t)**3;const a=this.transition.from,b=this.transition.to;x=a.x+(b.x-a.x)*e;y=a.y+(b.y-a.y)*e;let da=(b.heading-a.heading+4)%4;if(da>2)da-=4;angle=(a.heading+da*e)*Math.PI/2;}
      const forward={x:Math.sin(angle),y:-Math.cos(angle)},right={x:Math.cos(angle),y:Math.sin(angle)};
      const project=(xx,yy,raise=0)=>{const dx=xx-x,dy=yy-y,depth=dx*forward.x+dy*forward.y+1.1,side=dx*right.x+dy*right.y;if(depth<.23)return null;const scale=240/depth;return {x:500+side*scale,y:183+175/depth-raise*scale,scale,depth};};
      c.fillStyle='#99ab76';c.fillRect(0,188,1000,280);
      const cells=[];for(let yy=0;yy<21;yy++)for(let xx=0;xx<21;xx++){const q=project(xx,yy);if(q&&q.depth<11)cells.push({x:xx,y:yy,p:q});}cells.sort((a,b)=>b.p.depth-a.p.depth);
      for(const cell of cells){const {x:xx,y:yy,p}=cell;if(!G.road(xx,yy))continue;const points=[[xx-.5,yy-.5],[xx+.5,yy-.5],[xx+.5,yy+.5],[xx-.5,yy+.5]].map(q=>project(...q));if(points.some(q=>!q))continue;this.polygon(c,points.map(q=>[q.x,q.y]),'#687473');const inner=[[xx-.43,yy-.43],[xx+.43,yy-.43],[xx+.43,yy+.43],[xx-.43,yy+.43]].map(q=>project(...q));if(inner.every(Boolean))this.polygon(c,inner.map(q=>[q.x,q.y]),'#48595b');if(p.depth<8){c.fillStyle='#d7d5ae';c.fillRect(p.x-1,p.y-1,Math.max(2,p.scale*.017),Math.max(2,p.scale*.034));}}
      const sites=D.sites(G.context),art=this.p.art?.();for(const cell of cells){if(G.road(cell.x,cell.y))continue;const target=sites.find(v=>Math.abs(v.x-cell.x)<.55&&Math.abs(v.y-cell.y)<.55),building=this.state.buildings.find(b=>{const p=G.PLOTS[b.plot];return p.x===cell.x&&p.y===cell.y;});if(target||building){const type=target?.type||building.type,level=target?G.community.level(this.state,target.id):building.level,w=Math.min(230,cell.p.scale*.85);if(art?.ready)art.draw(c,type,cell.p.x,cell.p.y,level,{width:w,npc:!!target,preview:true});else{this.round(c,cell.p.x-w*.35,cell.p.y-w*.8,w*.7,w*.8,4,'#c6b78f');this.polygon(c,[[cell.p.x-w*.45,cell.p.y-w*.8],[cell.p.x,cell.p.y-w],[cell.p.x+w*.45,cell.p.y-w*.8]],'#7a6b59');}}
        else if((cell.x*13+cell.y*7)%9===0&&cell.p.depth<8){c.fillStyle='#5f6d43';c.fillRect(cell.p.x-2,cell.p.y-cell.p.scale*.3,4,cell.p.scale*.3);c.fillStyle='#507551';c.beginPath();c.ellipse(cell.p.x,cell.p.y-cell.p.scale*.4,cell.p.scale*.15,cell.p.scale*.22,0,0,Math.PI*2);c.fill();}}
      const dest=project(d.destination[0],d.destination[1],.16);if(dest&&dest.depth<9){this.round(c,dest.x-31,dest.y-35,62,36,8,'#e5c377','#fff0b5');this.text(c,'ADRESA',dest.x,dest.y-12,11,'#20363e','center');}
      this.round(c,42,34,220,41,12,'#153340e8','#86b3bb');this.text(c,'BRZO I LOKALNO · TEREN',152,60,12,'#f1ddb1','center');
      this.drawMiniMap(c,d);
      // Windshield frame, hood and dashboard are original procedural shapes.
      this.polygon(c,[[0,0],[55,0],[140,420],[112,466],[0,457]],'#132731');this.polygon(c,[[1000,0],[945,0],[860,420],[888,466],[1000,457]],'#132731');
      c.strokeStyle='#41575a';c.lineWidth=13;c.beginPath();c.moveTo(35,0);c.lineTo(123,430);c.moveTo(965,0);c.lineTo(877,430);c.stroke();
      this.round(c,386,10,228,54,12,'#1e343c','#8a9e9b');const mirror=c.createLinearGradient(400,20,600,54);mirror.addColorStop(0,'#9dbdbb');mirror.addColorStop(1,'#5c797e');this.round(c,397,18,206,35,5,mirror);c.fillStyle='#d5d6b7';c.fillRect(487,39,26,3);
      this.polygon(c,[[155,407],[845,407],[933,473],[68,473]],'#b4b29b');this.polygon(c,[[175,407],[825,407],[880,448],[120,448]],'#8d9994');
      const dash=c.createLinearGradient(0,433,0,620);dash.addColorStop(0,'#374b4c');dash.addColorStop(.2,'#172e38');dash.addColorStop(1,'#091d29');this.round(c,0,444,1000,220,55,dash);c.strokeStyle='#82908a';c.lineWidth=3;c.beginPath();c.moveTo(52,456);c.quadraticCurveTo(500,420,948,456);c.stroke();
      this.round(c,75,468,274,96,26,'#091f2b','#506a6e');this.gauge(c,151,522,36,d.speed/40,'BRZINA',String(d.speed));this.gauge(c,271,522,36,Math.max(0,1-d.steps/d.maxSteps),'REZERVA',Math.max(0,d.maxSteps-d.steps)+'');
      this.round(c,662,474,255,93,17,'#102d3a','#5e7778');this.text(c,D.sites(G.context)[d.site].name,789,498,16,'#ffe3aa','center');this.text(c,d.status==='arrived'?'PARKIRAN KOD KLIJENTA':this.paused?'PAUZA':d.speed?'SPORA VOŽNJA':'VOZILO MIRUJE',789,527,11,'#bfd9d5','center');this.text(c,'POZICIJA '+d.x+' : '+d.y+'  ·  '+F.DIRECTIONS[d.heading].name,789,549,10,'#95b7be','center');
      c.save();c.translate(498,543);const steering=this.transition&&!this.reduced?(this.transition.to.heading-this.transition.from.heading)*.22:0;c.rotate(steering);c.strokeStyle='#071c27';c.lineWidth=20;c.beginPath();c.arc(0,0,85,0,Math.PI*2);c.stroke();c.strokeStyle='#637977';c.lineWidth=4;c.beginPath();c.arc(0,0,85,0,Math.PI*2);c.stroke();c.strokeStyle='#243e47';c.lineWidth=18;for(const a of [-.3,Math.PI+.3,Math.PI/2]){c.beginPath();c.moveTo(Math.cos(a)*28,Math.sin(a)*28);c.lineTo(Math.cos(a)*77,Math.sin(a)*77);c.stroke();}this.round(c,-37,-27,74,54,18,'#183642','#8a997f');this.text(c,'BL',0,8,23,'#f4d89d','center');c.restore();
      this.round(c,399,520,24,49,9,'#c6a681');this.round(c,576,520,24,49,9,'#c6a681');this.polygon(c,[[370,620],[396,555],[424,560],[430,620]],'#284b55');this.polygon(c,[[570,620],[576,560],[604,555],[630,620]],'#284b55');
    }
    gauge(c,x,y,r,value,label,text){c.strokeStyle='#45636b';c.lineWidth=5;c.beginPath();c.arc(x,y,r,Math.PI*.85,Math.PI*2.15);c.stroke();c.strokeStyle='#e7c17c';c.beginPath();c.arc(x,y,r,Math.PI*.85,Math.PI*(.85+1.3*Math.min(1,value)));c.stroke();this.text(c,text,x,y+6,23,'#eddfbc','center');this.text(c,label,x,y+27,8,'#a5c3c8','center');}
    drawMiniMap(c,d){
      const sx=748,sy=53,size=182,scale=size/22;this.round(c,sx-12,sy-15,size+24,size+43,15,'#102d3bea','#9caf92');
      c.lineWidth=3.8;c.strokeStyle='#6a8681';for(let y=0;y<21;y++)for(let x=0;x<21;x++)if(G.road(x,y)){for(const [dx,dy]of [[1,0],[0,1]])if(G.road(x+dx,y+dy)){c.beginPath();c.moveTo(sx+(x+1)*scale,sy+(y+1)*scale);c.lineTo(sx+(x+dx+1)*scale,sy+(y+dy+1)*scale);c.stroke();}}
      const j=this.state.dispatch.jobs.find(j=>j.id===d.job),path=(j?F.drivePlan(this.state,j,G.context):null)||[];c.strokeStyle='#efd17d';c.lineWidth=3;c.beginPath();path.forEach(([x,y],i)=>i?c.lineTo(sx+(x+1)*scale,sy+(y+1)*scale):c.moveTo(sx+(x+1)*scale,sy+(y+1)*scale));c.stroke();
      c.fillStyle='#edb65d';c.beginPath();c.arc(sx+(d.destination[0]+1)*scale,sy+(d.destination[1]+1)*scale,5,0,Math.PI*2);c.fill();
      const xx=sx+(d.x+1)*scale,yy=sy+(d.y+1)*scale;c.save();c.translate(xx,yy);c.rotate(d.heading*Math.PI/2);this.polygon(c,[[0,-7],[-5,5],[0,2],[5,5]],'#a3e3dc');c.restore();this.text(c,'STVARNA RUTA KROZ GRAD',sx+size/2,sy+size+20,8,'#d3dfcf','center');
    }
    drawRoom(c,r){
      c.clearRect(0,0,1000,620);const wall=c.createLinearGradient(0,0,1000,500);wall.addColorStop(0,r.skill==='water'?'#aec4b7':'#abb5ae');wall.addColorStop(1,'#718d84');c.fillStyle=wall;c.fillRect(0,0,1000,620);
      this.polygon(c,[[0,0],[85,57],[85,480],[0,570]],'#59796f');this.polygon(c,[[1000,0],[915,57],[915,480],[1000,570]],'#c6c8b0');this.polygon(c,[[0,570],[85,480],[915,480],[1000,570],[1000,620],[0,620]],'#766c53');
      c.strokeStyle='#d9dfc24d';c.lineWidth=2;for(let x=85;x<930;x+=83){c.beginPath();c.moveTo(x,57);c.lineTo(x,480);c.stroke();}for(let y=65;y<480;y+=67){c.beginPath();c.moveTo(85,y);c.lineTo(915,y);c.stroke();}
      this.round(c,120,89,175,160,11,'#315460','#e3e1c4');this.round(c,130,99,155,140,5,'#9cc0bd');c.fillStyle='#d9dfca';c.fillRect(203,100,8,140);c.fillRect(130,165,155,7);this.polygon(c,[[130,230],[285,230],[262,240],[130,240]],'#6c947f');
      this.round(c,625,82,249,50,10,'#1c3c43','#e3c889');this.text(c,r.skill==='water'?'VODA · RADNI PROSTOR':'STRUJA · RADNI PROSTOR',749,113,13,'#f8dfaa','center');
      if(r.skill==='water')this.waterRoom(c,r);else this.electricRoom(c,r);
      this.round(c,43,535,288,62,13,'#173743','#7a9992');this.text(c,D.person(r.worker).name+' · '+(r.status==='won'?'PROVJERA ZAVRŠENA':'KORAK '+Math.min(4,r.step+1)+' / 4'),187,561,13,'#f2dcaa','center');this.text(c,REPAIR[r.skill].actions[Math.min(3,r.step)],187,582,10,'#c4dad8','center');
      this.round(c,692,525,263,73,13,'#233c3d','#c3ab72');this.text(c,'PRIPREMLJENI ALAT',823,548,10,'#e3c791','center');this.tool(c,756,573,r.skill,1);this.text(c,r.skill==='water'?'Vodoinstalaterski set':'Elektro set',845,578,12,'#dbe6d9','center');
    }
    waterRoom(c,r){
      this.round(c,325,290,370,210,10,'#9d8864','#4e655c');this.round(c,345,317,330,168,5,'#423f33');c.strokeStyle='#b4c1ad';c.lineWidth=14;c.lineJoin='round';c.beginPath();c.moveTo(420,290);c.lineTo(420,387);c.lineTo(500,387);c.lineTo(500,443);c.lineTo(598,443);c.lineTo(598,360);c.stroke();c.strokeStyle='#789082';c.lineWidth=4;c.beginPath();c.moveTo(415,292);c.lineTo(415,390);c.lineTo(497,390);c.stroke();
      this.round(c,300,269,418,38,11,'#dbd9bd','#68877e');c.fillStyle='#a5bab0';c.beginPath();c.ellipse(505,279,128,19,0,0,Math.PI*2);c.fill();c.fillStyle='#496e70';c.beginPath();c.ellipse(505,278,92,12,0,0,Math.PI*2);c.fill();c.strokeStyle='#dde5cb';c.lineWidth=11;c.beginPath();c.moveTo(597,274);c.lineTo(597,216);c.quadraticCurveTo(597,202,574,202);c.lineTo(550,202);c.stroke();
      c.strokeStyle=r.step>=1?'#80b58f':'#db945c';c.lineWidth=9;c.beginPath();c.arc(420,347,20,0,Math.PI*2);c.stroke();c.lineWidth=4;c.beginPath();c.moveTo(420-(r.step>=1?0:18),347-(r.step>=1?18:0));c.lineTo(420+(r.step>=1?0:18),347+(r.step>=1?18:0));c.stroke();
      const repaired=r.step>=3;c.strokeStyle=repaired?'#74b18a':'#e6bd63';c.lineWidth=8;c.beginPath();c.moveTo(482,377);c.lineTo(517,377);c.stroke();if(!repaired){if(r.step===0){c.strokeStyle='#8bdded';c.lineWidth=3;c.beginPath();c.moveTo(500,391);c.quadraticCurveTo(530,404,526,445);c.stroke();const phase=this.reduced?0:performance.now()/620;for(let i=0;i<4;i++){const yy=403+((phase*30+i*15)%56);c.fillStyle='#9bdfeb';c.beginPath();c.ellipse(524,yy,3,5,0,0,Math.PI*2);c.fill();}}c.fillStyle='#67adbc55';c.beginPath();c.ellipse(527,472,36,7,0,0,Math.PI*2);c.fill();}
      if(r.step===2){c.strokeStyle='#ffe29a';c.lineWidth=3;c.setLineDash([6,5]);c.beginPath();c.arc(500,386,37,0,Math.PI*2);c.stroke();c.setLineDash([]);this.tool(c,552,387,'water',1.6);}
      if(r.step>=4){this.round(c,423,148,164,44,12,'#365b43','#bad29e');this.text(c,'SPOJ DRŽI ✓',505,177,17,'#f0e5b4','center');}else this.text(c,r.step>=1?'DOVOD ZATVOREN':'DOVOD OTVOREN',505,176,13,'#2f4f51','center');
    }
    electricRoom(c,r){
      this.round(c,348,151,323,346,17,'#4b625e','#d0d2b4');this.round(c,365,168,288,310,10,'#193f4a');this.round(c,379,183,260,55,8,r.step>=1?'#172d35':'#714637','#a0a884');this.text(c,r.step>=1?'NAPAJANJE IZOLIRANO':'NAPAJANJE U IGRI',509,216,13,r.step>=1?'#bdd9c1':'#ffd5a7','center');
      const colors=['#bc7957','#d7c795','#79aab4'];for(let i=0;i<3;i++){c.strokeStyle=colors[i];c.lineWidth=8;c.beginPath();c.moveTo(413+i*93,244);c.lineTo(413+i*93,303+i*16);c.lineTo(450+i*62,303+i*16);c.lineTo(450+i*62,409);c.stroke();this.round(c,395+i*93,249,37,38,7,'#9da99a','#d7ddc3');this.round(c,444+i*62,395,17,30,4,'#8b9d92');}
      const fixed=r.step>=3;this.round(c,479,305,60,37,7,fixed?'#a1c69b':'#d6aa63','#e8d69d');c.fillStyle='#294c4a';c.fillRect(502,314,fixed?17:7,17);c.strokeStyle='#4f6e65';c.lineWidth=2;c.beginPath();c.moveTo(509,314);c.lineTo(fixed?509:517,331);c.stroke();
      this.round(c,705,273,112,167,15,'#b39254','#f1d490');this.round(c,720,290,81,57,7,'#c2d3ac');this.text(c,r.step>=4?'✓':r.step>=2?'0':'—',760,329,26,'#355948','center');c.fillStyle='#233c42';c.beginPath();c.arc(760,384,23,0,Math.PI*2);c.fill();c.strokeStyle='#edd39b';c.lineWidth=3;c.beginPath();c.moveTo(760,384);c.lineTo(774,369);c.stroke();
      if(r.step===2){c.strokeStyle='#ffe29a';c.lineWidth=3;c.setLineDash([6,5]);c.beginPath();c.arc(510,324,43,0,Math.PI*2);c.stroke();c.setLineDash([]);this.tool(c,580,337,'electric',1.8);}
      if(r.step>=4){this.round(c,406,91,207,40,10,'#365b43','#bad29e');this.text(c,'PROVJERA USPIJEŠNA ✓',509,118,13,'#eee6bb','center');}
    }
    tool(c,x,y,skill,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);c.rotate(-.35);if(skill==='water'){c.strokeStyle='#d0c89f';c.lineWidth=7;c.beginPath();c.moveTo(-17,13);c.lineTo(12,-10);c.stroke();c.strokeStyle='#b9c7b7';c.lineWidth=5;c.beginPath();c.moveTo(8,-17);c.lineTo(9,-8);c.lineTo(18,-7);c.lineTo(25,-14);c.stroke();}else{this.round(c,-14,-19,28,40,5,'#ddb66d','#f2dba8');this.round(c,-9,-13,18,12,3,'#9db9a3');c.fillStyle='#2e4b4c';c.beginPath();c.arc(0,8,7,0,Math.PI*2);c.fill();}c.restore();}
    diagnostics(){return {active:this.active,mode:this.mode,frames:this.frames,held:!!this.held,paused:this.paused,position:this.state?.community.fieldwork?.drive?{x:this.state.community.fieldwork.drive.x,y:this.state.community.fieldwork.drive.y}:null,repairStep:this.state?.community.fieldwork?.repair?.step??null};}
  }
  window.GradFieldworkUI=FieldworkUI;
})();
