'use strict';
const assert = require('node:assert/strict');
const G = require('../igra/core.js'), F = require('../igra/fieldwork.js'), D = G.dispatch, C = G.community;
let count = 0;
const act = (s, command) => G.act(s, command).state;
function test(name, fn) { fn(); count++; console.log('PASS', name); }
function book(s, id, worker, when) {
  const j = s.dispatch.jobs.find(j => j.id === id);
  while (s.day < j.contactDay) s = G.turn(s).state;
  for (const command of [
    {type: 'job_question', job: id, question: 'details'},
    {type: 'job_quote', job: id, price: Math.floor(D.definition(j).budget * .8)},
    {type: 'job_assign', job: id, worker, ...(when ? {when} : {})}
  ]) s = act(s, command);
  return s;
}
function first() { return book(G.fresh('career'), 2, 'adnan'); }
function driveToClient(s) {
  for (let guard = 0; guard < 200; guard++) {
    const d = s.community.fieldwork.drive, path = F.drivePlan(s, d.job, G.context);
    assert(path?.length, 'Guidance remains on an actual legal road');
    if (path.length === 1) {
      s = act(s, {type: 'field_drive_control', action: 'brake'});
      return act(s, {type: 'field_drive_control', action: 'park'});
    }
    const [a, b] = path, wanted = F.DIRECTIONS.findIndex(v => a[0] + v.dx === b[0] && a[1] + v.dy === b[1]);
    if (wanted !== d.heading) {
      s = act(s, {type: 'field_drive_control', action: 'brake'});
      const diff = (wanted - d.heading + 4) % 4;
      s = act(s, {type: 'field_drive_control', action: diff === 1 ? 'right' : diff === 3 ? 'left' : 'reverse'});
    }
    s = act(s, {type: 'field_drive_control', action: 'forward'});
  }
  throw Error('Route did not reach the actual client');
}
function solvePipes(s) {
  for (let tile = 0; tile < 16; tile++) {
    const turns = (4 - s.community.pipes.tiles[tile].turn) % 4;
    for (let n = 0; n < turns; n++) if (s.community.pipes.status === 'playing') s = act(s, {type: 'pipes_turn', tile});
  }
  return s;
}
function waterWorking() {
  let s = book(G.fresh('career'), 1, 'faris', 'next');
  for (let n = 0; n < 5 && s.dispatch.jobs.find(j => j.id === 1).status !== 'working'; n++) s = G.turn(s).state;
  assert.equal(s.dispatch.jobs.find(j => j.id === 1).status, 'working');
  return s;
}
function ownedElectricWorking() {
  let s = first(); s = book(s, 1, 'faris', 'next');
  for (let n = 0; n < 4; n++) {
    for (const j of s.dispatch.jobs) if (j.status === 'review' && [1, 2].includes(j.id)) s = act(s, {type: 'job_collect', job: j.id});
    if (s.dispatch.stats.completed >= 2 && D.availability(s, 'adnan').available) break;
    s = G.turn(s).state;
  }
  for (const j of s.dispatch.jobs) if (j.status === 'review' && [1, 2].includes(j.id)) s = act(s, {type: 'job_collect', job: j.id});
  assert(s.dispatch.stats.completed >= 2);
  s = act(s, {type: 'pipes_start', worker: 'adnan'}); s = solvePipes(s);
  assert(s.science >= 1);
  for (const command of [{type: 'company_workshop'}, {type: 'company_register'}, {type: 'tool_buy', tool: 'tester'}, {type: 'company_hire', worker: 'lejla'}, {type: 'worker_tools', worker: 'lejla'}]) s = act(s, command);
  s = book(s, 3, 'lejla');
  s = G.turn(s).state;
  assert.equal(s.dispatch.jobs.find(j => j.id === 3).status, 'working');
  return s;
}

test('Driving starts from the real assigned road route and rental is charged once across restart', () => {
  let s = first(); const cash = s.cash, expected = D.siteRoute(s, s.dispatch.jobs.find(j => j.id === 2), s.dispatch.workers.find(w => w.id === 'adnan'), G.context);
  s = act(s, {type: 'field_drive_start', job: 2});
  assert.equal(s.cash, cash - F.RENTAL_PRICE);
  assert.deepEqual(s.community.fieldwork.drive.path, expected);
  assert.deepEqual(s.community.fieldwork.drive.destination, expected.at(-1));
  s = G.unpack(G.pack(s));
  const resumed = act(s, {type: 'field_drive_start', job: 2});
  assert.equal(resumed.cash, s.cash); assert.deepEqual(resumed.community.fieldwork.drive, s.community.fieldwork.drive);
});
test('Actual forward, legal turns, braking and parking finish travel but never create work or payment', () => {
  let s = act(first(), {type: 'field_drive_start', job: 2}), before = G.clone(s);
  assert.throws(() => act(s, {type: 'field_drive_control', action: 'park'}), /prilazu/);
  const start = [s.community.fieldwork.drive.x, s.community.fieldwork.drive.y];
  s = act(s, {type: 'field_drive_control', action: 'forward'});
  assert.equal(Math.abs(start[0] - s.community.fieldwork.drive.x) + Math.abs(start[1] - s.community.fieldwork.drive.y), 1);
  assert.throws(() => act(s, {type: 'field_drive_control', action: 'right'}), /kočnicom/);
  s = driveToClient(s);
  const j = s.dispatch.jobs.find(j => j.id === 2);
  assert.equal(s.community.fieldwork.drive.status, 'arrived'); assert.equal(j.status, 'working'); assert.equal(j.travelLeft, 0);
  assert.equal(j.workLeft, j.totalWork); assert.equal(j.paid, 0); assert.equal(s.cash, before.cash);
  assert.equal(s.dispatch.workers.find(w => w.id === 'adnan').site, j.site);
  assert.deepEqual(G.unpack(G.pack(s)), s);
  assert.throws(() => act(s, {type: 'field_drive_control', action: 'park'}), /aktivnu vožnju/);
});
test('Owned-vehicle trips use real fuel once, including a reservation saved before entering the cockpit', () => {
  let s = G.fresh('career');
  for (const command of [{type: 'company_workshop'}, {type: 'company_van'}, {type: 'company_fuel'}]) s = act(s, command);
  assert.equal(s.community.company.fuel, 6);
  s = book(s, 2, 'adnan');
  assert.equal(s.community.company.fuel, 5); assert.deepEqual(s.community.fieldwork.fuelJobs, [2]);
  s = G.unpack(G.pack(s)); const cash = s.cash;
  s = act(s, {type: 'field_drive_start', job: 2});
  assert.equal(s.community.fieldwork.drive.rented, false); assert.equal(s.cash, cash);
  assert.equal(s.community.company.fuel, 5); assert.deepEqual(s.community.fieldwork.fuelJobs, []);
  s = act(s, {type: 'field_drive_start', job: 2}); assert.equal(s.community.company.fuel, 5);
  let empty = G.fresh('career');
  for (const command of [{type: 'company_workshop'}, {type: 'company_van'}]) empty = act(empty, command);
  empty = book(empty, 2, 'adnan');
  const saved = G.pack(empty); assert.throws(() => act(empty, {type: 'field_drive_start', job: 2}), /gorivo/); assert.equal(G.pack(empty), saved);
});
test('A wrong worker, unsupported controls and non-road movement fail without a state mutation', () => {
  let s = book(G.fresh('career'), 3, 'lejla');
  assert.throws(() => act(s, {type: 'field_drive_start', job: 3}), /svoj ugovoreni/);
  s = act(first(), {type: 'field_drive_start', job: 2});
  const saved = G.pack(s);
  assert.throws(() => act(s, {type: 'field_drive_control', action: 'teleport', x: 0, y: 0}), /komand[au]/);
  assert.equal(G.pack(s), saved);
  let found = false;
  for (const action of ['left', 'right']) {
    try { act(s, {type: 'field_drive_control', action}); }
    catch (e) { assert.match(e.message, /prohodne/); found = true; }
  }
  // At the central crossing both first turns can be legal; a side street is not a new road.
  if (!found) { s = act(s, {type: 'field_drive_control', action: 'forward'}); s = act(s, {type: 'field_drive_control', action: 'brake'}); assert.throws(() => act(s, {type: 'field_drive_control', action: 'left'}), /prohodne/); }
});
test('Normal day progression closes the manual session and preserves the original travel option', () => {
  let s = act(first(), {type: 'field_drive_start', job: 2}); const before = s.cash;
  s = G.turn(s).state;
  assert.equal(s.community.fieldwork.drive.status, 'finished'); assert.equal(s.community.fieldwork.drive.speed, 0);
  assert.equal(s.dispatch.jobs.find(j => j.id === 2).status, 'working'); assert.equal(s.cash, before);
  assert.throws(() => act(s, {type: 'field_drive_control', action: 'forward'}));
});
test('Actual road closures block manual movement and still allow a legal detour to the client', () => {
  let s;
  for (let seed = 1; seed <= 100; seed++) {
    let candidate = G.fresh('career', seed);
    for (let n = 0; n < 3; n++) candidate = G.turn(candidate).state;
    if (candidate.event?.kind === 'road') { s = candidate; break; }
  }
  assert(s, 'A genuine seeded road-closure event is reachable');
  s = act(book(s, 2, 'adnan'), {type: 'field_drive_start', job: 2});
  assert.deepEqual(s.community.fieldwork.drive.start, [10, 10]);
  // The closed edge at (10,7) is a real road three cells north of the depot.
  if (s.community.fieldwork.drive.heading !== 0) s = act(s, {type: 'field_drive_control', action: 'reverse'});
  for (let n = 0; n < 2; n++) s = act(s, {type: 'field_drive_control', action: 'forward'});
  const saved = G.pack(s);
  assert.throws(() => act(s, {type: 'field_drive_control', action: 'forward'}), /prohodne/);
  assert.equal(G.pack(s), saved);
  s = driveToClient(s);
  assert.equal(s.dispatch.jobs.find(j => j.id === 2).status, 'working');
});
test('Water repair has an ordered visible procedure and advances only the actual booked work shift', () => {
  let s = waterWorking(); s = act(s, {type: 'field_repair_start', job: 1});
  const saved = G.pack(s), work = s.dispatch.jobs.find(j => j.id === 1).workLeft, cash = s.cash;
  assert.throws(() => act(s, {type: 'field_repair_action', action: 'test'}), /redom/); assert.equal(G.pack(s), saved);
  for (const action of F.REPAIR_STEPS) { s = act(s, {type: 'field_repair_action', action}); s = G.unpack(G.pack(s)); }
  const j = s.dispatch.jobs.find(j => j.id === 1);
  assert.equal(s.community.fieldwork.repair.status, 'won'); assert.equal(s.community.fieldwork.repair.step, 4);
  assert.equal(j.workLeft, work - 1); assert.equal(j.status, 'review'); assert.equal(j.paid, 0); assert.equal(s.cash, cash);
  assert.throws(() => act(s, {type: 'field_repair_action', action: 'test'}), /aktivnu popravku/);
});
test('A hired electrician uses the reserved company tool and the real work finalizer exactly once', () => {
  let s = ownedElectricWorking(), assignment = s.community.company.jobTools.find(a => a.job === 3), tool = s.community.company.tools.find(t => t.serial === assignment.serial);
  const condition = tool.condition, uses = tool.uses;
  s = act(s, {type: 'field_repair_start', job: 3});
  for (const action of F.REPAIR_STEPS) s = act(s, {type: 'field_repair_action', action});
  tool = s.community.company.tools.find(t => t.serial === assignment.serial);
  assert.equal(tool.condition, condition - C.toolInfo(tool.kind).wear); assert.equal(tool.uses, uses + 1);
  assert.equal(s.dispatch.jobs.find(j => j.id === 3).status, 'review');
  const copy = G.pack(s); assert.throws(() => act(s, {type: 'field_repair_action', action: 'test'})); assert.equal(G.pack(s), copy);
});
test('A real network-outage event prevents unsafe repair while ordinary recovery stays available', () => {
  let s;
  for (const seed of [12345, 73127, 4545343, 234234224]) {
    let candidate = G.fresh('career', seed);
    for (let n = 0; n < 3; n++) candidate = G.turn(candidate).state;
    if (candidate.event?.kind === 'outage') { s = candidate; break; }
  }
  assert(s, 'A genuine seeded network outage is reachable');
  s = book(s, 3, 'lejla'); s = G.turn(s).state;
  assert.equal(s.dispatch.jobs.find(j => j.id === 3).status, 'working');
  assert.equal(s.event.kind, 'outage');
  const saved = G.pack(s);
  assert.throws(() => act(s, {type: 'field_repair_start', job: 3}), /sigurne uslove/);
  assert.equal(G.pack(s), saved);
  s = G.turn(s).state;
  assert.equal(s.dispatch.jobs.find(j => j.id === 3).status, 'review');
});
test('Repair sessions close when ordinary work finishes; malformed or cross-job session data is rejected', () => {
  let s = act(waterWorking(), {type: 'field_repair_start', job: 1});
  s = G.turn(s).state; assert.equal(s.community.fieldwork.repair.status, 'finished');
  const d = act(first(), {type: 'field_drive_start', job: 2});
  for (const corrupt of [x => { x.community.fieldwork.drive.x = 5; x.community.fieldwork.drive.y = 5; }, x => { x.community.fieldwork.drive.heading = 8; }, x => { x.community.fieldwork.drive.path.push([0, 0]); }, x => { x.community.fieldwork.drive.job = 1; }, x => { x.community.fieldwork.drive.rental = 0; }, x => { x.community.fieldwork.drive.privateCode = 'eval()'; }]) {
    const copy = G.clone(d); corrupt(copy); assert.throws(() => G.validateState(copy));
  }
});
console.log('GRAD_FIELDWORK_CHECKS', count);
