/* Original, bounded road driving and on-site work rules for the fictional game. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GradFieldwork = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const COMMANDS = Object.freeze(['field_drive_start', 'field_drive_control', 'field_repair_start', 'field_repair_action']);
  const DIRECTIONS = Object.freeze([
    Object.freeze({dx: 0, dy: -1, name: 'Sjever'}),
    Object.freeze({dx: 1, dy: 0, name: 'Istok'}),
    Object.freeze({dx: 0, dy: 1, name: 'Jug'}),
    Object.freeze({dx: -1, dy: 0, name: 'Zapad'})
  ]);
  const REPAIR_STEPS = Object.freeze(['isolate', 'diagnose', 'repair', 'test']);
  const REPAIR_SKILLS = Object.freeze(['water', 'electric']);
  const RENTAL_PRICE = 12;
  const clone = value => JSON.parse(JSON.stringify(value));
  const samePoint = (a, b) => a[0] === b[0] && a[1] === b[1];
  const int = (n, low, high) => Number.isSafeInteger(n) && n >= low && n <= high;
  const plain = value => value && Object.getPrototypeOf(value) === Object.prototype;
  const keys = (value, allowed) => plain(value) && Object.keys(value).length === allowed.length && Object.keys(value).every(k => allowed.includes(k));

  function create() { return {schema: 1, fuelJobs: [], drive: null, repair: null}; }
  function job(state, id) {
    const found = state.dispatch.jobs.find(j => j.id === id);
    if (!found) throw Error('Posao više nije u aktivnom dnevniku.');
    return found;
  }
  function worker(state, id) {
    const found = state.dispatch.workers.find(w => w.id === id);
    if (!found) throw Error('Majstor ne postoji.');
    return found;
  }
  function blocked(state) { return state.event?.kind === 'road' ? state.event.blocked : null; }
  function legal(state, ctx, x, y) { return ctx.road(x, y) && x + ',' + y !== blocked(state); }
  function heading(a, b) { return DIRECTIONS.findIndex(d => b[0] - a[0] === d.dx && b[1] - a[1] === d.dy); }
  function logJob(j, state, text) {
    j.messages.push({from: 'system', text, day: state.day, kind: 'status'});
    j.messages = j.messages.slice(-24);
    j.read = false;
  }

  /* Recompute guidance from the actual road position. No progress timer invents a route. */
  function drivePlan(state, request, ctx) {
    const j = typeof request === 'number' ? job(state, request) : request;
    if (!j) return null;
    const d = state.community.fieldwork?.drive;
    if (d?.job === j.id && d.status === 'driving') return ctx.routePoint(ctx.dispatch.sites(ctx)[j.site], blocked(state), [d.x, d.y]);
    return ctx.dispatch.siteRoute(state, j, worker(state, j.worker), ctx);
  }

  function startDrive(state, command, ctx) {
    const j = job(state, command.job), w = worker(state, j.worker), f = state.community.fieldwork;
    if (j.status !== 'travelling' || j.worker !== 'adnan' || w.active !== j.id) throw Error('Voziš samo svoj ugovoreni posao dok je Adnan na putu.');
    if (f.drive?.status === 'driving') {
      if (f.drive.job !== j.id) throw Error('Prvo završi ili nastavi trenutnu vožnju.');
      return {text: 'Nastavljaš istu vožnju; najam nije ponovo naplaćen.', quiet: true};
    }
    const path = ctx.dispatch.siteRoute(state, j, w, ctx);
    if (!path?.length) throw Error('Trenutno nema prohodne ceste do adrese. Pregledaj radove ili potvrdi redovan putni dan.');
    const rented = !state.community.company.van;
    if (rented && state.cash < RENTAL_PRICE) throw Error('Najam servisnog kombija za ovu vožnju traži 12 novčića. Redovan putni dan ostaje dostupan.');
    if (rented) state.cash -= RENTAL_PRICE;
    else {
      const prepaid = f.fuelJobs.includes(j.id);
      if (!prepaid && state.community.company.fuel < 1) throw Error('Vlastito vozilo traži gorivo. Dopuni rezervoar ili završi redovan putni dan.');
      if (!prepaid) state.community.company.fuel--;
      f.fuelJobs = f.fuelJobs.filter(id => id !== j.id);
    }
    const start = path[0], next = path[1];
    f.drive = {
      job: j.id, worker: 'adnan', site: j.site, day: state.day, status: 'driving',
      x: start[0], y: start[1], heading: next ? heading(start, next) : 0, speed: 0,
      steps: 0, maxSteps: Math.min(800, Math.max(40, path.length * 6)),
      destination: [...path[path.length - 1]], path: clone(path), start: [...start], rented, rental: rented ? RENTAL_PRICE : 0
    };
    return {text: rented ? 'Servisni kombi je unajmljen za 12 novčića. Prati stvarnu cestu do klijenta.' : 'Voziš svoje vozilo. Dodatni najam se ne naplaćuje; koristi se već ugovoreni izlazak.'};
  }

  function drive(state, command, ctx) {
    const d = state.community.fieldwork.drive;
    if (!d || d.status !== 'driving' || d.day !== state.day) throw Error('Otvori aktivnu vožnju svog majstora.');
    const j = job(state, d.job), w = worker(state, d.worker);
    if (j.status !== 'travelling' || j.worker !== d.worker || w.active !== j.id) throw Error('Ovaj posao više nije u putnoj fazi.');
    if (!['forward', 'left', 'right', 'reverse', 'brake', 'park'].includes(command.action)) throw Error('Odaberi komandu volana, gasa, kočnice ili parkiranja.');
    if (command.action === 'brake') { d.speed = 0; return {text: 'Vozilo je zaustavljeno.', quiet: true}; }
    if (command.action === 'park') {
      if (d.speed !== 0) throw Error('Prvo pritisni kočnicu, zatim parkiraj.');
      if (!samePoint([d.x, d.y], d.destination)) throw Error('Još nisi na prilazu klijenta. Prati rutu do označene adrese.');
      d.status = 'arrived'; j.travelLeft = 0; j.status = 'working'; j.waitReason = ''; w.site = j.site;
      logJob(j, state, 'Adnan je vlastitom vožnjom stigao na adresu i parkirao. Sada počinje ugovoreni rad.');
      return {text: 'Parkirao si kod klijenta. Put je završen; alat i ugovoreni posao čekaju na adresi.'};
    }
    let direction = d.heading;
    if (command.action !== 'forward') {
      if (d.speed !== 0) throw Error('Prije skretanja zaustavi vozilo kočnicom.');
      direction = (d.heading + (command.action === 'left' ? 3 : command.action === 'right' ? 1 : 2)) % 4;
    }
    const vector = DIRECTIONS[direction], x = d.x + vector.dx, y = d.y + vector.dy;
    if (!legal(state, ctx, x, y)) throw Error('U tom smjeru nema prohodne ceste. Koči i izaberi legalno skretanje.');
    if (command.action !== 'forward') {
      d.heading = direction;
      return {text: 'Smjer vožnje: ' + vector.name + '.', quiet: true};
    }
    if (d.steps >= d.maxSteps) throw Error('Dosegnut je broj pomaka ove vožnje. Možeš završiti put redovnim radnim danom.');
    d.x = x; d.y = y; d.steps++; d.speed = 20;
    return {text: 'Vozilo je napredovalo jednom pozicijom stvarne ceste.', quiet: true};
  }

  function repairSafety(state, j, w, ctx) {
    const skill = ctx.dispatch.definition(j).skill;
    if (skill === 'electric' && state.event?.kind === 'outage' && w.equipment < 2) throw Error('Elektro rad čeka sigurne uslove zbog kvara mreže. Otkloni kvar ili sačekaj obnovu.');
    const assignment = state.community.company.jobTools.find(a => a.job === j.id);
    const owned = state.community.company.career && w.id === 'adnan' || state.community.company.employees.includes(w.id);
    if (owned && !assignment) throw Error('Za ovaj rad treba rezervisan odgovarajući alat tvoje firme.');
    if (assignment) {
      const tool = state.community.company.tools.find(t => t.serial === assignment.serial), info = tool && ctx.community.toolInfo(tool.kind);
      if (!tool || !info || !info.skills.includes(skill) || tool.condition < info.wear) throw Error('Alat je istrošen ili ne odgovara poslu. Provjeri i servisiraj ga prije rada u prostoru klijenta.');
    }
  }

  function startRepair(state, command, ctx) {
    const j = job(state, command.job), skill = ctx.dispatch.definition(j).skill, w = worker(state, j.worker), f = state.community.fieldwork;
    if (j.status !== 'working' || w.active !== j.id || !REPAIR_SKILLS.includes(skill)) throw Error('Rad u prostoru dostupan je za ugovoreni vodoinstalaterski ili elektro posao kada je majstor na adresi.');
    if (!j.diagnosed) throw Error('Prije ulaska u popravku utvrdi opis kvara u razgovoru s klijentom.');
    if (f.repair?.status === 'playing') {
      if (f.repair.job !== j.id) throw Error('Prvo dovrši otvorenu popravku ili nastavi redovan radni dan.');
      return {text: 'Nastavljaš pripremljenu popravku.', quiet: true};
    }
    if (f.repair?.day === state.day) throw Error('Današnji pokušaj popravke je završen. Preostali rad nastavlja se redovnim radnim danom.');
    repairSafety(state, j, w, ctx);
    f.repair = {job: j.id, worker: j.worker, site: j.site, skill, day: state.day, status: 'playing', step: 0, workBefore: j.workLeft};
    return {text: skill === 'water' ? 'Ušao si u prostor klijenta. Prvo zatvori vodu, zatim pregledaj spoj.' : 'Ušao si u prostor klijenta. Prvo izoluj rasvjetni krug, zatim provjeri kvar.'};
  }

  function repair(state, command, ctx) {
    const r = state.community.fieldwork.repair;
    if (!r || r.status !== 'playing' || r.day !== state.day) throw Error('Otvori aktivnu popravku na adresi.');
    const j = job(state, r.job), w = worker(state, r.worker);
    if (j.status !== 'working' || j.worker !== r.worker || j.workLeft !== r.workBefore) throw Error('Stanje posla se promijenilo. Pregledaj ugovoreni rad prije nastavka.');
    if (command.action !== REPAIR_STEPS[r.step]) throw Error('Postupak ide redom: izolacija, pregled, popravka, pa završna provjera.');
    repairSafety(state, j, w, ctx);
    if (command.action === 'test') {
      const before = j.workLeft;
      ctx.dispatch.workStep(state, j, w, 6);
      if (j.workLeft >= before) throw Error('Rad nije napredovao; provjeri alat prije završne provjere.');
      r.step = 4; r.status = 'won';
      return {text: 'Popravka je provjerena. Upotrijebljen je stvarni pribor i završena jedna ugovorena radna smjena. Naplata ide tek nakon predaje klijentu.'};
    }
    r.step++;
    return {text: [null, r.skill === 'water' ? 'Voda je zatvorena. Prostor je pripremljen za pregled.' : 'Rasvjetni krug je izolovan. Prostor je pripremljen za pregled.', 'Kvar je pregledan. Sada primijeni odgovarajući alat.', 'Spoj je popravljen. Preostala je završna provjera.'][r.step]};
  }

  function act(state, command, ctx) {
    const start = ['field_drive_start', 'field_repair_start'].includes(command?.type);
    if (!keys(command, start ? ['type', 'job'] : ['type', 'action'])) throw Error('Terenska komanda sadrži nepodržana polja.');
    switch (command.type) {
      case 'field_drive_start': return startDrive(state, command, ctx);
      case 'field_drive_control': return drive(state, command, ctx);
      case 'field_repair_start': return startRepair(state, command, ctx);
      case 'field_repair_action': return repair(state, command, ctx);
      default: throw Error('Nepodržana terenska komanda.');
    }
  }

  function sync(state, ctx, before, command) {
    const f = state.community.fieldwork;
    if (!f) return;
    if (command?.type === 'job_assign') {
      const j = state.dispatch.jobs.find(j => j.id === command.job);
      if (j?.worker === 'adnan' && before?.community.company.van && before.community.company.fuel > state.community.company.fuel && !f.fuelJobs.includes(j.id)) f.fuelJobs.push(j.id);
    }
    f.fuelJobs = f.fuelJobs.filter(id => state.dispatch.jobs.some(j => j.id === id && j.worker === 'adnan' && ['scheduled', 'travelling'].includes(j.status)));
    if (f.drive?.status === 'driving') {
      const j = state.dispatch.jobs.find(j => j.id === f.drive.job);
      if (f.drive.day !== state.day || !j || j.status !== 'travelling' || j.worker !== f.drive.worker) { f.drive.status = 'finished'; f.drive.speed = 0; }
    }
    if (f.repair?.status === 'playing') {
      const j = state.dispatch.jobs.find(j => j.id === f.repair.job);
      if (f.repair.day !== state.day || !j || j.status !== 'working' || j.worker !== f.repair.worker || j.workLeft !== f.repair.workBefore) f.repair.status = 'finished';
    }
  }

  function validate(f, day, ctx) {
    const err = () => { throw Error('Neispravni podaci vožnje ili popravke.'); };
    const point = p => Array.isArray(p) && p.length === 2 && p.every(n => int(n, 0, 20)) && ctx.road(...p);
    if (!keys(f, ['schema', 'fuelJobs', 'drive', 'repair']) || f.schema !== 1 || !Array.isArray(f.fuelJobs) || f.fuelJobs.length > 40 || new Set(f.fuelJobs).size !== f.fuelJobs.length || f.fuelJobs.some(id => !int(id, 1, 999999))) err();
    if (f.drive !== null) {
      const d = f.drive;
      if (!keys(d, ['job', 'worker', 'site', 'day', 'status', 'x', 'y', 'heading', 'speed', 'steps', 'maxSteps', 'destination', 'path', 'start', 'rented', 'rental']) || !int(d.job, 1, 999999) || d.worker !== 'adnan' || !int(d.site, 0, 20) || !int(d.day, 1, day) || !['driving', 'arrived', 'finished'].includes(d.status) || !point([d.x, d.y]) || !int(d.heading, 0, 3) || ![0, 20].includes(d.speed) || !int(d.steps, 0, d.maxSteps) || !int(d.maxSteps, 40, 800) || !point(d.start) || !point(d.destination) || !Array.isArray(d.path) || !d.path.length || d.path.length > 128 || !d.path.every(point) || typeof d.rented !== 'boolean' || d.rental !== (d.rented ? RENTAL_PRICE : 0)) err();
      if (!samePoint(d.start, d.path[0]) || !samePoint(d.destination, d.path.at(-1)) || d.maxSteps !== Math.min(800, Math.max(40, d.path.length * 6)) || d.path.some((p, i) => i && Math.abs(p[0] - d.path[i - 1][0]) + Math.abs(p[1] - d.path[i - 1][1]) !== 1) || new Set(d.path.map(p => p.join(','))).size !== d.path.length) err();
      if (Math.abs(d.x - d.start[0]) + Math.abs(d.y - d.start[1]) > d.steps || (Math.abs(d.x - d.start[0]) + Math.abs(d.y - d.start[1])) % 2 !== d.steps % 2 || (d.status !== 'driving' && d.speed !== 0) || (d.status === 'arrived' && !samePoint([d.x, d.y], d.destination))) err();
    }
    if (f.repair !== null) {
      const r = f.repair;
      if (!keys(r, ['job', 'worker', 'site', 'skill', 'day', 'status', 'step', 'workBefore']) || !int(r.job, 1, 999999) || !ctx.dispatch.person(r.worker) || !int(r.site, 0, 20) || !REPAIR_SKILLS.includes(r.skill) || !int(r.day, 1, day) || !['playing', 'won', 'finished'].includes(r.status) || !int(r.step, 0, 4) || !int(r.workBefore, 1, 30) || (r.status === 'won' && r.step !== 4) || (r.status === 'playing' && r.step > 3)) err();
    }
    return true;
  }

  function validateState(state, ctx) {
    const f = state.community.fieldwork;
    validate(f, state.day, ctx);
    if (f.drive) {
      const d = f.drive, destination = ctx.dispatch.sites(ctx)[d.site];
      if (d.job >= state.dispatch.nextId || Math.abs(d.destination[0] - destination.x) + Math.abs(d.destination[1] - destination.y) !== 1) throw Error('Odredište vožnje ne odgovara prilazu stvarnog klijenta.');
    }
    if (f.repair && f.repair.job >= state.dispatch.nextId) throw Error('Popravka navodi nepostojeći posao.');
    for (const id of f.fuelJobs) { const j = state.dispatch.jobs.find(j => j.id === id); if (!state.community.company.van || !j || j.worker !== 'adnan' || !['scheduled', 'travelling'].includes(j.status)) throw Error('Rezervisano gorivo ne odgovara stvarnom putu.'); }
    if (f.drive?.status === 'driving') {
      const d = f.drive, j = state.dispatch.jobs.find(j => j.id === d.job), w = state.dispatch.workers.find(w => w.id === d.worker);
      if (d.day !== state.day || !j || j.status !== 'travelling' || j.worker !== d.worker || j.site !== d.site || w?.active !== j.id) throw Error('Vožnja ne odgovara aktivnom putu majstora.');
    }
    if (f.repair?.status === 'playing') {
      const r = f.repair, j = state.dispatch.jobs.find(j => j.id === r.job), w = state.dispatch.workers.find(w => w.id === r.worker);
      if (r.day !== state.day || !j || j.status !== 'working' || j.worker !== r.worker || j.site !== r.site || ctx.dispatch.definition(j).skill !== r.skill || j.workLeft !== r.workBefore || w?.active !== j.id) throw Error('Popravka ne odgovara radu majstora na adresi.');
    }
    return true;
  }

  return Object.freeze({COMMANDS, DIRECTIONS, REPAIR_STEPS, REPAIR_SKILLS, RENTAL_PRICE, create, drivePlan, act, sync, validate, validateState});
});
