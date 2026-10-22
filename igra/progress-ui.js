/* Original guidance, factual job outcomes and read-only recorded city views. */
(function () {
  'use strict';
  const G = window.GradMajstora, D = G.dispatch;

  class ProgressUI {
    constructor(port) {
      this.p = port;
      this.queue = [];
      this.current = null;
      this.historyDay = null;
      this.historyCity = null;
      this.outcomesShown = 0;
      document.getElementById('history-day').addEventListener('input', e => {
        const frames = this.frames(this.p.state());
        this.historyDay = frames[Number(e.target.value)]?.day ?? null;
        this.renderHistory(this.p.state());
      });
      document.getElementById('history-before').onclick = () => this.step(-1);
      document.getElementById('history-after').onclick = () => this.step(1);
      document.getElementById('history-live').onclick = () => this.p.liveMap();
    }

    frames(s) { return s.community.history?.days || []; }

    reset() {
      this.queue = [];
      this.current = null;
      this.historyDay = null;
      this.outcomesShown = 0;
      this.historyCity?.resetPresentation();
      document.getElementById('job-outcome').hidden = true;
    }

    render(s) {
      this.guide(s);
      if (!document.getElementById('tab-history').hidden) this.renderHistory(s);
    }

    guide(s) {
      const root = document.getElementById('first-task');
      root.replaceChildren();
      root.hidden = s.mode !== 'career' || s.dispatch.stats.completed > 0;
      if (root.hidden) return;
      const {el, button} = this.p, j = s.dispatch.jobs.find(j => j.id === 2);
      const stages = ['Poziv', 'Dogovor', 'Priprema', 'Put', 'Rad', 'Predaja'];
      let at = 0, title = 'Haris čeka tvoj odgovor.', text = 'Javi se klijentu i saznaj šta treba popraviti. Prvi posao vodi te od poziva do naplate.', run = () => this.p.openJob(2);
      if (!j || ['expired', 'cancelled'].includes(j.status)) {
        title = 'Prvi zahtjev je zatvoren.';
        text = 'U poslovima odaberi otvoren zahtjev. Razgovor, dogovor, alat i predaja ostaju isti princip.';
        run = this.p.openJobs;
      } else if (!j.diagnosed) {
        const call = s.community.calls.find(c => c.job === j.id && c.status !== 'answered');
        run = call ? () => this.p.answer(call.id) : () => this.p.openJob(j.id);
      } else if (!j.agreed) {
        at = 1; title = 'Dogovori cijenu police.';
        text = 'Opis je poznat. U razgovoru upiši ponudu do Harisovog budžeta i pošalji je.';
      } else if (j.status === 'quoted') {
        at = 2; title = 'Pošalji sebe i svoj alat.';
        text = 'Adnan je tvoj lik. Provjeri cijenu rada, materijal i bušilicu pa potvrdi izlazak na adresu.';
      } else if (['scheduled', 'travelling'].includes(j.status)) {
        at = 3; title = j.status === 'travelling' ? 'Sjedni za volan i vozi do Harisa.' : 'Potvrdi dogovoreni termin.';
        text = j.status === 'travelling' ? 'Prati rutu iz kabine kombija, skreni na pravoj ulici i parkiraj kod klijenta. Možeš i potvrditi redovan putni dan.' : 'Ekipa kreće kada dogovoreni termin dođe na red. Pregledaj obračun radnog dana.';
        run = j.status === 'travelling' ? () => this.p.openDrive(j.id) : this.p.forecast;
      } else if (j.status === 'working') {
        at = 4; title = 'Stigao si. Napravi policu.';
        text = 'Otvori stolarsku klupu, označi mjere i učvrsti nosače. Možeš i potvrditi redovnu radnu smjenu.';
        run = this.p.openField;
      } else if (j.status === 'review') {
        at = 5; title = 'Pregledaj rezultat i naplati.';
        text = 'Rad je gotov. Vrati se razgovoru s Harisom, pregledaj kvalitet i predaj posao.';
      }
      const copy = el('div');
      copy.append(el('span', 'TVOJ PRVI POSAO · HARISOVA POLICA', 'eyebrow'), el('h2', title), el('p', text));
      const steps = el('ol', undefined, 'first-task-steps');
      steps.setAttribute('aria-label', 'Koraci prvog posla');
      stages.forEach((name, i) => {
        const item = el('li', (i < at ? '✓ ' : (i + 1) + '. ') + name, i === at ? 'current' : i < at ? 'done' : '');
        if (i === at) item.setAttribute('aria-current', 'step');
        steps.append(item);
      });
      copy.append(steps);
      const next = button('Nastavi prvi zadatak →', run, 'primary'); next.id = 'first-task-next';
      root.append(copy, next);
    }

    observe(before, after) {
      for (const j of after.dispatch.jobs) {
        const old = before.dispatch.jobs.find(x => x.id === j.id);
        if (!old) continue;
        if (old.status !== 'review' && j.status === 'review') this.queue.push({job: j.id, site: j.site, kind: 'finished', title: D.definition(j).title, quality: j.quality, paid: 0});
        else if (old.status !== 'completed' && j.status === 'completed') {this.queue=this.queue.filter(x=>x.job!==j.id);if(this.current?.job===j.id)this.current=null;this.queue.push({job: j.id, site: j.site, kind: 'paid', title: D.definition(j).title, quality: j.quality, paid: j.paid});}
      }
      this.queue = this.queue.slice(-12);
      if (!this.current) this.showNext();
    }

    showNext() {
      const root = document.getElementById('job-outcome');let item;while(this.queue.length){const candidate=this.queue.shift(),job=this.p.state().dispatch.jobs.find(j=>j.id===candidate.job);if(job&&(candidate.kind==='paid'?job.status==='completed':job.status==='review')){item=candidate;break;}}
      this.current = item || null;
      root.replaceChildren(); root.hidden = !item;
      if (!item) return;
      this.outcomesShown++;
      const {el, button} = this.p, site = D.sites(G.context)[item.site];
      root.dataset.job = item.job;
      root.dataset.kind = item.kind;
      const mark = el('span', '✓', 'outcome-seal'); mark.setAttribute('aria-hidden', 'true');
      const copy = el('div');
      copy.append(el('span', item.kind === 'paid' ? 'POSAO PREDAN · NAPLATA POTVRĐENA' : 'RAD JE ZAVRŠEN · ČEKA PREDAJU', 'eyebrow'),
        el('h2', item.title), el('p', site.name + ' · kvalitet ' + item.quality + '%' + (item.kind === 'paid' ? ' · naplaćeno ' + item.paid + ' novčića.' : '. Pregledaj rad i predaj ga klijentu.')));
      const controls = el('div', undefined, 'outcome-actions');
      controls.append(button('Pogledaj rezultat na mapi', () => this.p.focusSite(item.site)),
        button(item.kind === 'paid' ? 'Zatvori rezultat' : 'Otvori predaju posla', () => item.kind === 'paid' ? this.showNext() : this.p.openJob(item.job), 'primary'));
      if (item.kind !== 'paid') controls.append(button('Sakrij obavijest', () => this.showNext(), 'quiet'));
      root.append(mark, copy, controls);
    }

    openHistory() { this.renderHistory(this.p.state()); }

    step(delta) {
      const frames = this.frames(this.p.state());
      const i = frames.findIndex(f => f.day === this.historyDay);
      this.historyDay = frames[Math.max(0, Math.min(frames.length - 1, i + delta))]?.day ?? null;
      this.renderHistory(this.p.state());
    }

    renderHistory(s) {
      const frames = this.frames(s); if (!frames.length) return;
      let i = this.historyDay === null ? frames.length - 1 : frames.findIndex(f => f.day === this.historyDay);
      if (i < 0) i = 0;
      const f = frames[i], prior = frames[i - 1], {el} = this.p;
      this.historyDay = f.day;
      const range = document.getElementById('history-day');
      range.min = 0; range.max = frames.length - 1; range.value = i;
      range.disabled = frames.length < 2;
      range.setAttribute('aria-valuetext', 'Zabilježeni dan ' + f.day);
      document.getElementById('history-before').disabled = i === 0;
      document.getElementById('history-after').disabled = i === frames.length - 1;
      document.getElementById('history-label').textContent = 'Dan ' + f.day + (f.day === s.day ? ' · današnji zapis' : ' · sačuvani razvoj');
      document.getElementById('history-origin').textContent = (s.community.history.origin === 'imported' ? 'Raniji snimak je učitan na dan ' + s.community.history.startedDay + '; zapis počinje od tog dana. ' : '') + 'Prikazujemo posljednjih ' + G.community.HISTORY_LIMIT + ' zabilježenih dana. Pregled ne mijenja tvoj napredak.';
      const stats = document.getElementById('history-statistics'); stats.replaceChildren();
      for (const [value, label] of [[f.completed, 'predanih poslova'], [f.company.workshop + '/3', 'radionica'], [f.company.employees.length, 'zaposlenika'], [f.cash, 'novčića'], [f.materials, 'materijala'], [f.trust+'%', 'povjerenja']]) {
        const n = el('div'); n.append(el('strong', value), el('span', label)); stats.append(n);
      }
      const list = document.getElementById('history-changes'); list.replaceChildren();
      const lines = [];
      if (!prior) lines.push('Početak dostupnog zapisa: ' + f.buildings.length + ' izgrađenih objekata i ' + f.completed + ' predanih poslova.');
      else {
        const jobs = f.completed - prior.completed;
        if (jobs) lines.push('Predano poslova: +' + jobs + '.');
        for (const b of f.buildings) {
          const old = prior.buildings.find(x => x.plot === b.plot);
          if (!old || old.type !== b.type || old.level !== b.level) lines.push(G.TYPES[b.type].name + ' · nivo ' + b.level + ' · parcela ' + (b.plot + 1) + '.');
        }
        for(const old of prior.buildings)if(!f.buildings.some(b=>b.plot===old.plot))lines.push('Uklonjen objekt: '+G.TYPES[old.type].name+' · parcela '+(old.plot+1)+'.');
        if (f.company.workshop !== prior.company.workshop) lines.push('Tvoja radionica: nivo ' + f.company.workshop + '.');
        if (f.company.level !== prior.company.level) lines.push('Razvoj firme: faza ' + (f.company.level + 1) + '.');
        if (f.company.van > prior.company.van) lines.push('Nabavljeno vlastito vozilo za teren.');
        if (f.company.employees.length > prior.company.employees.length) lines.push('Zaposlenici: ' + f.company.employees.length + '.');
        if (f.company.branches.length > prior.company.branches.length) lines.push('Tržišta: ' + f.company.branches.length + '.');
        f.services.forEach((n, site) => { if (n > prior.services[site]) lines.push('Uspješan rad kod klijenta ' + D.sites(G.context)[site].name + ' · ukupno ' + n + '.'); });
        if (!lines.length) lines.push('Nema promjene objekata ili predanih poslova u ovom zapisu. Novac, zalihe i aktivni radovi prikazani su prema tom danu.');
      }
      lines.slice(0, 12).forEach(line => list.append(el('li', line)));
      if (!this.historyCity) {
        this.historyCity = new GradCity(document.getElementById('history-city'), () => {}, () => {});
        this.historyCity.readOnly = true;
        this.historyCity.setLiving(false);
      }
      const view = {...s,community:{...s.community,company:{...s.community.company}},dispatch:{...s.dispatch,stats:{...s.dispatch.stats}}};
      for (const key of ['day', 'cash', 'materials', 'trust', 'xp', 'stage', 'buildings', 'event']) view[key] = G.clone(f[key]);
      view.community.company = {...view.community.company, ...G.clone(f.company)};
      view.community.services = G.clone(f.services);
      view.dispatch.jobs = G.clone(f.jobs);
      view.dispatch.stats.completed = f.completed;
      this.historyCity.resetPresentation();
      this.historyCity.set(view, null);
      this.historyCity.fit();
      if (this.historyCity.zone !== this.p.zone()) this.historyCity.focus(this.p.zone());
    }

    diagnostics() { return {outcomesShown: this.outcomesShown, outcome: this.current ? {...this.current} : null, historyDay: this.historyDay, historyAvailable: this.frames(this.p.state()).length,historyWorld:this.historyCity?.diagnostics()||null}; }
  }
  window.GradProgressUI = ProgressUI;
})();
