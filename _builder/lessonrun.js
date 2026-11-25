
    /* =====================================================================
       7. ПРОВЕДЕННЯ УРОКУ: підготовка (вибір слайдів), завдання на оцінку,
          завершення уроку з оцінкою за 12-бальною шкалою
       ---------------------------------------------------------------------
       Стан, який учитель розсилає учням разом зі слайдом (publishState):
         run      — ідентифікатор проведення уроку (новий після «Почати урок»)
         phase    — 'setup' | 'live' | 'done'
         hidden   — номери слайдів, які вчитель прибрав
         ungraded — id завдань, які вчитель не зараховує в оцінку
         resets   — {id завдання: n} — учитель дозволив «почати знову» всім учням
       Відповіді учня зберігаються лише в його браузері (localStorage) і
       переживають перезавантаження сторінки — тест не можна перепройти.
       ===================================================================== */
    var LessonRun = (() => {
      const P = new URLSearchParams(location.search || '');
      const PREVIEW = isTeacher && P.get('preview') === '1';
      const WANT_SETUP = P.get('setup') === '1';
      const KEY_T = 'lr_t_' + LESSON_TOPIC;
      const KEY_PREF = 'lr_pref_' + LESSON_TOPIC;
      const MAX_AGE = 8 * 3600 * 1000;

      let run = null, phase = 'live', hidden = [], ungraded = [], resets = {};
      const tests = new Map(); // id -> { id, max, rebuild, slide }
      let shownResultFor = '';

      const jget = (k, fb) => { try { const v = JSON.parse(safeStorageGet(k, 'null')); return v == null ? fb : v; } catch (e) { return fb; } };
      const jset = (k, v) => safeStorageSet(k, JSON.stringify(v));
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

      /* ---------- Слайди ---------- */
      function slideTitle(n) {
        const s = slides[n - 1];
        if (!s) return '';
        const h = s.querySelector('.slide-title, h1, h2, h3') || s.querySelector('.slide-tag');
        return h ? h.textContent.replace(/\s+/g, ' ').trim() : 'Слайд ' + n;
      }
      const isHidden = (n) => hidden.indexOf(n) !== -1;
      function visibleList() {
        const v = [];
        for (let i = 1; i <= totalSlides; i++) if (!isHidden(i)) v.push(i);
        return v.length ? v : [1];
      }
      function nextVisible(cur, delta) {
        for (let i = cur + delta; i >= 1 && i <= totalSlides; i += delta) if (!isHidden(i)) return i;
        return null;
      }
      function fixSlide(n) {
        if (!isHidden(n)) return n;
        return nextVisible(n, 1) || nextVisible(n, -1) || n;
      }
      function label(n) {
        const v = visibleList();
        const idx = v.indexOf(n) + 1 || n;
        return `Слайд ${idx} / ${v.length}`;
      }
      function progress(n) {
        const v = visibleList();
        return (v.indexOf(n) + 1 || n) / v.length;
      }

      /* ---------- Завдання на оцінку ---------- */
      const resKey = () => 'lr_res_' + LESSON_TOPIC + '_' + (run || 'solo');
      const loadRes = () => jget(resKey(), {});
      function saveRec(id, rec) { const all = loadRes(); all[id] = rec; jset(resKey(), all); }
      const resetN = (id) => resets[id] || 0;
      function validRec(id) {
        const r = loadRes()[id];
        return r && r.r === resetN(id) && r.answered > 0 ? r : null;
      }
      const counts = (id) => {
        const t = tests.get(id);
        return t && !isHidden(t.slide) && ungraded.indexOf(id) === -1;
      };

      function banner(id, root) {
        let b = document.querySelector(`.test-warn[data-for="${id}"]`);
        if (!b) {
          b = document.createElement('div');
          b.className = 'test-warn';
          b.dataset.for = id;
          // У заголовку слайда праворуч є вільне місце — так слайд не стає вищим
          const sl = root.closest('section.slide');
          const hdr = sl && sl.querySelector('.slide-header');
          if (hdr) { b.classList.add('in-header'); hdr.appendChild(b); }
          else root.parentNode.insertBefore(b, root);
        }
        const t = tests.get(id);
        if (isTeacher) {
          b.innerHTML = `<div><b>📝 Завдання на оцінку</b> • макс. ${t.max} б.</div>
            <button class="btn btn-sm btn-secondary" type="button">🔄 Почати знову для всіх учнів</button>`;
          b.querySelector('button').onclick = () => resetTest(id);
        } else {
          b.innerHTML = '<div><b>⚠️ Завдання на оцінку!</b></div><div>Уважно прочитай завдання і виконай з першого разу.</div>';
        }
        return b;
      }
      function removeBanner(id) {
        const b = document.querySelector(`.test-warn[data-for="${id}"]`);
        if (b) b.remove();
      }

      // Викликається віджетом. Повертає:
      //   null      — звичайна вправа (не на оцінку): поводиться як раніше
      //   'locked'  — учень уже виконував це завдання: показано результат, віджет не будується
      //   {point(ok), done(), teacher} — завдання на оцінку
      function begin(id, max, opts, rebuild) {
        if (opts && opts.graded === false) return null;
        const root = document.getElementById(id);
        if (!root) return null;
        const slideEl = root.closest('section.slide');
        tests.set(id, { id, max, rebuild, slide: slides.indexOf(slideEl) + 1 });
        if (ungraded.indexOf(id) !== -1) { removeBanner(id); return null; }
        banner(id, root);
        if (isTeacher) return { point() {}, done() {}, teacher: true };
        const rec = validRec(id);
        if (rec) { renderLocked(root, rec); return 'locked'; }
        const cur = { got: 0, answered: 0, max, done: false, r: resetN(id) };
        return {
          teacher: false,
          point(ok) { cur.answered++; if (ok) cur.got++; saveRec(id, cur); },
          done() { cur.done = true; saveRec(id, cur); }
        };
      }

      function renderLocked(root, rec) {
        root.innerHTML = `<div class="test-locked">
          <div style="font-size:3rem;">${rec.done ? '✅' : '📝'}</div>
          <div>${rec.done ? 'Завдання виконано!' : 'Завдання вже зараховано.'} Твій результат: <b>${rec.got} з ${rec.max}</b></div>
          <div class="test-locked-note">Пройти ще раз можна лише тоді, коли дозволить учитель.</div></div>`;
      }

      function rebuild(id) {
        const t = tests.get(id);
        if (!t) return;
        try { t.rebuild(); } catch (e) {}
      }

      function resetTest(id) {
        if (!isTeacher) return;
        if (!confirm('Дозволити ВСІМ учням пройти це завдання знову? Їхні попередні відповіді на нього не зарахуються.')) return;
        resets[id] = resetN(id) + 1;
        saveT();
        publishState();
        SoundFX.click();
        rebuild(id);
      }

      /* ---------- Оцінка ---------- */
      function grade(got, max) {
        if (!max) return null;
        const g = Math.max(1, Math.min(12, Math.round(got / max * 12)));
        const lv = g <= 3 ? ['П', 'Початковий'] : g <= 6 ? ['С', 'Середній'] : g <= 9 ? ['Д', 'Достатній'] : ['В', 'Високий'];
        return { g, code: lv[0], name: lv[1] };
      }
      function summary() {
        const rows = [];
        let got = 0, max = 0;
        const all = loadRes();
        tests.forEach(t => {
          if (!counts(t.id)) return;
          const r = all[t.id];
          const g = r && r.r === resetN(t.id) ? r.got : 0;
          rows.push({ title: slideTitle(t.slide), got: g, max: t.max, done: !!(r && r.r === resetN(t.id) && r.answered) });
          got += g;
          max += t.max;
        });
        return { rows, got, max, grade: grade(got, max) };
      }

      /* ---------- Стан для синхронізації ---------- */
      function statePart() {
        return { run, phase, hidden: hidden.slice(), ungraded: ungraded.slice(), resets: Object.assign({}, resets) };
      }
      function saveT() {
        if (!isTeacher || PREVIEW) return;
        jset(KEY_T, { run, phase, hidden, ungraded, resets, ts: Date.now() });
        jset(KEY_PREF, { hidden, ungraded });
      }

      function onState(d) {
        if (isTeacher || !d) return;
        let all = false;
        const changed = new Set();
        if ('run' in d && d.run !== run) { run = d.run || null; all = true; }
        if (Array.isArray(d.hidden) && !same(d.hidden, hidden)) {
          hidden = d.hidden.slice();
          tests.forEach(t => changed.add(t.id));
        }
        if (Array.isArray(d.ungraded) && !same(d.ungraded, ungraded)) {
          new Set(ungraded.concat(d.ungraded)).forEach(id => {
            if ((ungraded.indexOf(id) === -1) !== (d.ungraded.indexOf(id) === -1)) changed.add(id);
          });
          ungraded = d.ungraded.slice();
        }
        if (d.resets && typeof d.resets === 'object') {
          const nr = d.resets;
          new Set(Object.keys(resets).concat(Object.keys(nr))).forEach(id => {
            if ((nr[id] || 0) !== (resets[id] || 0)) changed.add(id);
          });
          resets = Object.assign({}, nr);
        }
        if (all) tests.forEach(t => rebuild(t.id));
        else changed.forEach(id => { if (!isHidden((tests.get(id) || {}).slide)) rebuild(id); });
        if (typeof d.phase === 'string') setPhase(d.phase);
      }

      /* ---------- Екрани поверх слайдів ---------- */
      function overlay(id) {
        let o = document.getElementById(id);
        if (!o) {
          o = document.createElement('div');
          o.id = id;
          o.className = 'lr-overlay';
          document.body.appendChild(o);
        }
        return o;
      }
      function closeOverlay(id) {
        const o = document.getElementById(id);
        if (o) o.classList.remove('open');
      }

      function setPhase(p) {
        phase = p;
        if (isTeacher) return;
        if (p === 'setup') {
          const o = overlay('lrWait');
          o.innerHTML = `<div class="lr-card lr-center"><div class="lr-big">🧑‍🏫</div>
            <h2>Урок скоро почнеться</h2><p>Учитель готує урок. Зачекай трошки!</p></div>`;
          o.classList.add('open');
        } else closeOverlay('lrWait');
        if (p === 'done') showStudentResult();
        else { closeOverlay('lrDone'); shownResultFor = ''; }
      }

      function gradeHtml(s) {
        if (!s.grade) return `<p class="lr-muted">На цьому уроці не було завдань на оцінку.</p>`;
        return `<div class="lr-points">Правильних відповідей: <b>${s.got} з ${s.max}</b></div>
          <div class="lr-grade lv-${s.grade.code}">
            <div class="lr-grade-num">${s.grade.g}<span> / 12</span></div>
            <div class="lr-grade-lv">${s.grade.name} рівень (${s.grade.code})</div>
          </div>`;
      }

      function showStudentResult() {
        const s = summary();
        const o = overlay('lrDone');
        o.innerHTML = `<div class="lr-card lr-center">
          <div class="lr-big">🏁</div>
          <h2>Урок завершено!</h2>
          <p>Твоя оцінка за урок:</p>
          ${gradeHtml(s)}
          ${s.rows.length ? `<div class="lr-rows">${s.rows.map(r => `<div class="lr-row"><span>${esc(r.title)}</span><b>${r.got} з ${r.max}</b></div>`).join('')}</div>` : ''}
          <p class="lr-muted">Дякуємо за урок! 🌟</p></div>`;
        o.classList.add('open');
        const key = run + '|' + s.got;
        if (shownResultFor !== key) { shownResultFor = key; if (s.grade && s.grade.g >= 7) launchFireworksBurst(false); }
      }

      function scaleHtml() {
        return `<div class="lr-scale">
          <span class="lv-П">П — 1–3</span><span class="lv-С">С — 4–6</span>
          <span class="lv-Д">Д — 7–9</span><span class="lv-В">В — 10–12</span></div>`;
      }

      function showTeacherDone() {
        const s = summary();
        const o = overlay('lrDone');
        o.innerHTML = `<div class="lr-card lr-center">
          <div class="lr-big">🏁</div>
          <h2>Урок завершено</h2>
          <p>Кожен учень зараз бачить на своєму екрані свої бали й оцінку.</p>
          ${s.rows.length ? `<div class="lr-rows">${s.rows.map(r => `<div class="lr-row"><span>${esc(r.title)}</span><b>макс. ${r.max} б.</b></div>`).join('')}
            <div class="lr-row lr-total"><span>Разом</span><b>${s.max} б. = 12 балів</b></div></div>` : '<p class="lr-muted">У цьому уроці немає завдань на оцінку.</p>'}
          ${scaleHtml()}
          <div class="lr-actions">
            <button class="btn btn-secondary" type="button" id="lrResume">↩ Повернутися до слайдів</button>
            <button class="btn btn-primary" type="button" id="lrRestart">🔁 Провести урок заново</button>
          </div></div>`;
        o.classList.add('open');
        o.querySelector('#lrResume').onclick = () => { phase = 'live'; saveT(); closeOverlay('lrDone'); publishState(); };
        o.querySelector('#lrRestart').onclick = () => {
          if (!confirm('Почати урок заново? Усі відповіді учнів на цьому уроці обнуляться.')) return;
          closeOverlay('lrDone');
          openSetup(true);
        };
      }

      /* ---------- Підготовка уроку (вчитель) ---------- */
      function openSetup(isStart) {
        if (!isTeacher) return;
        if (isStart) { phase = 'setup'; saveT(); publishState(); }
        const o = overlay('lrSetup');
        o.classList.add('lr-setup');
        const draw = () => {
          const v = visibleList().length;
          let nt = 0, pts = 0;
          tests.forEach(t => { if (counts(t.id)) { nt++; pts += t.max; } });
          let cards = '';
          for (let n = 1; n <= totalSlides; n++) {
            const off = isHidden(n);
            const ts = [];
            tests.forEach(t => { if (t.slide === n) ts.push(t); });
            cards += `<div class="lr-slide${off ? ' off' : ''}" data-n="${n}">
              <button class="lr-check" type="button" data-n="${n}" title="Показувати цей слайд">${off ? '' : '✓'}</button>
              <div class="lr-slide-txt"><div class="lr-slide-num">Слайд ${n}</div><div class="lr-slide-ttl">${esc(slideTitle(n))}</div>
              ${ts.map(t => `<button class="lr-test${ungraded.indexOf(t.id) === -1 ? ' on' : ''}" type="button" data-t="${t.id}" ${off ? 'disabled' : ''}>
                 ${ungraded.indexOf(t.id) === -1 ? '📝 На оцінку' : '🎲 Без оцінки'} • ${t.max} б.</button>`).join('')}
              </div></div>`;
          }
          o.innerHTML = `<div class="lr-card lr-wide">
            <div class="lr-head"><div><h2>🧭 Підготовка уроку</h2>
              <p>Приберіть позначку ✓ зі слайдів, які на цьому уроці не потрібні — учні їх не побачать.
              Натискайте «📝 На оцінку», щоб вирішити, які завдання рахуються в оцінку.</p></div>
              ${isStart ? '' : '<button class="btn btn-sm btn-secondary" type="button" id="lrClose">✕</button>'}</div>
            <div class="lr-grid">${cards}</div>
            <div class="lr-foot">
              <div class="lr-sum">Слайдів: <b>${v} з ${totalSlides}</b> • Завдань на оцінку: <b>${nt}</b> • Усього балів: <b>${pts}</b></div>
              <div class="lr-actions">
                <button class="btn btn-secondary" type="button" id="lrAll">✅ Усі слайди</button>
                <button class="btn btn-success lr-go" type="button" id="lrGo">${isStart ? '▶ Почати урок' : '💾 Зберегти'}</button>
              </div></div></div>`;
          o.querySelectorAll('.lr-check').forEach(b => b.onclick = () => {
            const n = +b.dataset.n;
            if (isHidden(n)) hidden = hidden.filter(x => x !== n);
            else if (visibleList().length > 1) hidden = hidden.concat([n]).sort((a, c) => a - c);
            SoundFX.click();
            draw();
          });
          o.querySelectorAll('.lr-test').forEach(b => b.onclick = () => {
            const id = b.dataset.t;
            ungraded = ungraded.indexOf(id) === -1 ? ungraded.concat([id]) : ungraded.filter(x => x !== id);
            SoundFX.click();
            draw();
          });
          o.querySelector('#lrAll').onclick = () => { hidden = []; SoundFX.click(); draw(); };
          o.querySelector('#lrGo').onclick = () => (isStart ? start() : apply());
          const c = o.querySelector('#lrClose');
          if (c) c.onclick = () => apply();
        };
        draw();
        o.classList.add('open');
      }

      function apply() {
        closeOverlay('lrSetup');
        saveT();
        tests.forEach(t => rebuild(t.id));
        renderSlide(fixSlide(currentSlide), false, currentStep);
      }

      function start() {
        run = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        phase = 'live';
        resets = {};
        saveT();
        closeOverlay('lrSetup');
        closeOverlay('lrDone');
        tests.forEach(t => rebuild(t.id));
        SoundFX.success();
        renderSlide(fixSlide(1), false, 0);
      }

      function finish(ask) {
        if (!isTeacher) return;
        if (ask !== false && !confirm('Завершити урок? Показ слайдів зупиниться, і кожен учень побачить свою оцінку.')) return;
        closeOverlay('lrSetup');
        phase = 'done';
        saveT();
        publishState();
        showTeacherDone();
        SoundFX.success();
      }

      /* ---------- Старт ---------- */
      function init() {
        if (!isTeacher) return;
        const bs = document.getElementById('btnSlidesSetup');
        const bf = document.getElementById('btnFinishLesson');
        if (bs) bs.onclick = () => { SoundFX.click(); openSetup(phase === 'setup'); };
        if (bf) bf.onclick = () => finish(true);
        if (PREVIEW) { run = 'preview'; phase = 'live'; return; }
        const st = jget(KEY_T, null);
        if (!WANT_SETUP && st && st.run && Date.now() - (st.ts || 0) < MAX_AGE) {
          run = st.run;
          phase = st.phase || 'live';
          hidden = st.hidden || [];
          ungraded = st.ungraded || [];
          resets = st.resets || {};
        } else {
          const pref = jget(KEY_PREF, {});
          hidden = (pref.hidden || []).filter(n => n >= 1 && n <= totalSlides);
          ungraded = pref.ungraded || [];
          run = null;
          resets = {};
          phase = 'setup';
        }
        ungraded.forEach(id => rebuild(id));
        if (phase === 'setup') openSetup(true);
        if (phase === 'done') showTeacherDone();
      }

      return {
        init, begin, onState, statePart, finish, openSetup,
        nextVisible, fixSlide, label, progress, summary, grade,
        get noPublish() { return PREVIEW; },
        get phase() { return phase; }
      };
    })();
