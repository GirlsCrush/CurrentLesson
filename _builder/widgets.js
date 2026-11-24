
    /* =====================================================================
       6. СПІЛЬНІ ІНТЕРАКТИВНІ ВІДЖЕТИ (для всіх уроків)
       ===================================================================== */
    const $id = (id) => document.getElementById(id);
    function shuffleArr(arr) {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }

    // --- Чек-лист готовності ---
    function toggleMission(el) {
      el.classList.toggle('done');
      SoundFX.click();
      const box = el.closest('.mission-box');
      const total = box.querySelectorAll('.mission-item').length;
      const done = box.querySelectorAll('.mission-item.done').length;
      const st = box.querySelector('.mission-status');
      if (done === total) {
        SoundFX.success();
        st.innerHTML = '🎉 Усі готові! Тисни «Далі ➡»!';
        st.style.color = '#059669';
      } else {
        st.textContent = `Виконано: ${done} з ${total}`;
        st.style.color = '#4f46e5';
      }
    }

    // --- Картки, що перевертаються ---
    function flipCard(card) {
      card.classList.toggle('flipped');
      SoundFX.click();
    }

    // --- Плитка з поясненням "Чому?" ---
    function openTile(tile) {
      if (tile.classList.contains('open')) return;
      tile.classList.add('open');
      SoundFX.success();
    }

    // --- Кнопка-відповідь (data-answer) ---
    function reveal(btn) {
      if (btn.classList.contains('revealed')) return;
      btn.classList.add('revealed');
      btn.innerHTML = btn.dataset.answer;
      SoundFX.success();
    }

    // --- Покрокове розкриття (.step всередині контейнера) ---
    function revealStep(btn, containerId) {
      const next = document.querySelector(`#${containerId} .step:not(.shown)`);
      if (next) { next.classList.add('shown'); SoundFX.pop(); }
      if (!document.querySelector(`#${containerId} .step:not(.shown)`)) {
        btn.disabled = true;
        btn.textContent = '✅ Усе розкрито!';
      }
    }

    // --- Вікторина з одним правильним варіантом ---
    function makeQuiz(id, questions, opts = {}) {
      const root = $id(id);
      root.classList.add('quiz-box');
      let i = 0, score = 0;
      function render() {
        if (i >= questions.length) {
          root.innerHTML = `<div class="quiz-done"><div style="font-size:3.5rem;">🏆</div>
            <div>Молодці! З першої спроби: <b>${score} з ${questions.length}</b></div>
            <button class="btn btn-secondary">🔄 Пройти ще раз</button></div>`;
          root.querySelector('button').onclick = () => { i = 0; score = 0; SoundFX.click(); render(); };
          launchFireworksBurst(false);
          return;
        }
        const q = questions[i];
        let firstTry = true, locked = false;
        root.innerHTML = `
          <span class="feedback-pill" style="background:#e0e7ff;color:#3730a3;">${opts.label || 'Питання'} ${i + 1} з ${questions.length}</span>
          ${q.emoji ? `<div class="quiz-emoji">${q.emoji}</div>` : ''}
          <div class="quiz-q">${q.q}</div>
          <div class="quiz-opts"></div>
          <div class="quiz-fb"></div>`;
        const box = root.querySelector('.quiz-opts');
        const fb = root.querySelector('.quiz-fb');
        const options = opts.options || q.options;
        options.forEach((o, k) => {
          const b = document.createElement('button');
          b.className = 'opt-btn' + (opts.big ? ' big' : '');
          b.innerHTML = o;
          b.onclick = () => {
            if (locked) return;
            if (k === q.correct) {
              locked = true;
              b.classList.add('correct');
              if (firstTry) score++;
              SoundFX.success();
              fb.className = 'quiz-fb ok';
              fb.innerHTML = '✅ ' + (q.explain || 'Правильно!') + '<br>';
              const nx = document.createElement('button');
              nx.className = 'btn btn-primary';
              nx.textContent = i + 1 < questions.length ? 'Наступне ➡' : 'Результат 🏆';
              nx.onclick = () => { i++; SoundFX.click(); render(); };
              fb.appendChild(nx);
            } else {
              firstTry = false;
              b.classList.add('wrong');
              b.disabled = true;
              SoundFX.error();
              fb.className = 'quiz-fb bad';
              fb.innerHTML = '🤔 ' + (q.hint || 'Подумай ще раз!');
            }
          };
          box.appendChild(b);
        });
      }
      render();
    }

    // --- Сортування по кошиках: натисни картку, потім кошик ---
    function makeSorter(id, items, buckets) {
      const root = $id(id);
      let active = null, placed = 0;
      root.innerHTML = `<div class="sort-pool"></div>
        <div class="sort-buckets" style="grid-template-columns:repeat(${buckets.length},1fr);margin-top:12px;"></div>
        <div class="sort-status" style="margin-top:10px;"><span class="st"></span><button class="btn btn-sm btn-secondary">🔄 Спочатку</button></div>`;
      const pool = root.querySelector('.sort-pool');
      const bw = root.querySelector('.sort-buckets');
      const st = root.querySelector('.st');
      root.querySelector('.sort-status button').onclick = () => { SoundFX.click(); makeSorter(id, items, buckets); };
      const upd = () => { st.textContent = `Розкладено: ${placed} з ${items.length}`; };
      shuffleArr(items).forEach(it => {
        const b = document.createElement('button');
        b.className = 'word-chip';
        b.innerHTML = it.t;
        b.dataset.b = it.b;
        b.onclick = (e) => {
          e.stopPropagation();
          if (b.classList.contains('placed')) return;
          SoundFX.click();
          pool.querySelectorAll('.word-chip').forEach(c => c.classList.remove('picked'));
          b.classList.add('picked');
          active = b;
        };
        pool.appendChild(b);
      });
      buckets.forEach(bk => {
        const d = document.createElement('div');
        d.className = 'sort-bucket2';
        d.style.background = bk.bg;
        d.style.borderColor = bk.border;
        d.innerHTML = `<div class="bucket-title" style="color:${bk.color}">${bk.label}</div><div class="bucket-items"></div>`;
        d.onclick = () => {
          if (!active) { st.textContent = '👆 Спочатку натисни на картку зверху!'; return; }
          if (active.dataset.b === bk.id) {
            SoundFX.success();
            active.classList.remove('picked');
            active.classList.add('placed');
            d.querySelector('.bucket-items').appendChild(active);
            active = null;
            placed++;
            upd();
            if (placed === items.length) {
              st.textContent = '🎉 Усе розкладено правильно!';
              launchFireworksBurst(false);
            }
          } else {
            SoundFX.error();
            const a = active;
            a.classList.add('shake');
            setTimeout(() => a.classList.remove('shake'), 420);
          }
        };
        bw.appendChild(d);
      });
      upd();
    }

    // --- Сцена: знайди об'єкти / порушення ---
    function makeScene(id, spots, opts = {}) {
      const root = $id(id);
      const fb = $id(opts.fb);
      const counter = $id(opts.counter);
      const need = spots.filter(s => s.target !== false).length;
      let found = 0;
      root.querySelectorAll('.hotspot').forEach(h => h.remove());
      const upd = () => { if (counter) counter.textContent = `${opts.counterText || 'Знайдено'}: ${found} / ${need}`; };
      spots.forEach(s => {
        const b = document.createElement('button');
        b.className = 'hotspot';
        b.style.left = s.x + '%';
        b.style.top = s.y + '%';
        if (s.size) b.style.fontSize = s.size;
        b.innerHTML = s.e;
        b.onclick = () => {
          if (fb) fb.innerHTML = s.msg || '';
          if (s.target === false) { SoundFX.click(); b.classList.add('good'); return; }
          if (b.dataset.done) return;
          b.dataset.done = 1;
          b.classList.add(opts.mode === 'good' ? 'good' : opts.mode === 'remove' ? 'removed' : 'found');
          if (s.label) b.insertAdjacentHTML('beforeend', `<span class="lbl">${s.label}</span>`);
          found++;
          SoundFX.success();
          upd();
          if (found === need) {
            launchFireworksBurst(false);
            if (opts.onDone) opts.onDone();
          }
        };
        root.appendChild(b);
      });
      upd();
    }

    // --- Загадка-слово з полями для літер ---
    function buildRiddle(containerId, word, onSolved) {
      const box = $id(containerId);
      box.innerHTML = '';
      const letters = word.split('');
      const inputs = [];
      let solved = false;
      letters.forEach((ch, idx) => {
        const inp = document.createElement('input');
        inp.className = 'letter-input';
        inp.maxLength = 1;
        inp.addEventListener('input', () => {
          const val = (inp.value || '').trim().toUpperCase();
          if (val === ch) {
            inp.classList.remove('bad');
            inp.classList.add('ok');
            SoundFX.click();
            if (inputs[idx + 1]) inputs[idx + 1].focus();
            if (!solved && inputs.every((el, i) => (el.value || '').trim().toUpperCase() === letters[i])) {
              solved = true;
              SoundFX.success();
              if (onSolved) onSolved();
            }
          } else if (val) {
            inp.classList.add('bad');
            SoundFX.error();
          } else {
            inp.classList.remove('bad', 'ok');
          }
        });
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace' && !inp.value && inputs[idx - 1]) inputs[idx - 1].focus();
        });
        inputs.push(inp);
        box.appendChild(inp);
      });
      return {
        showAnswer() {
          inputs.forEach((el, i) => { el.value = letters[i]; el.classList.remove('bad'); el.classList.add('ok'); });
          if (!solved) { solved = true; SoundFX.success(); if (onSolved) onSolved(); }
        }
      };
    }

    // --- Фізкультхвилинка: таймер ---
    let timerTotal = 60, timerSec = 60, timerInterval = null, timerOnTick = null;
    function updateTimerUI() {
      $id('timerText').textContent = timerSec;
      $id('timerCircle').style.setProperty('--deg', Math.round((timerSec / timerTotal) * 360) + 'deg');
    }
    function startBreakTimer() {
      if (timerInterval) return;
      SoundFX.click();
      timerInterval = setInterval(() => {
        if (timerSec > 0) {
          timerSec--;
          updateTimerUI();
          if (timerOnTick) timerOnTick(timerSec);
          if (timerSec <= 3 && timerSec > 0) SoundFX.tick();
        } else {
          pauseBreakTimer();
          SoundFX.success();
          launchFireworksBurst(false);
        }
      }, 1000);
    }
    function pauseBreakTimer() {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }
    function resetBreakTimer() {
      pauseBreakTimer();
      timerSec = timerTotal;
      updateTimerUI();
      SoundFX.click();
    }

    // --- Вкладки на слайді (кнопки з data-tab) ---
    function showTab(btn, groupId, tabId) {
      SoundFX.click();
      btn.parentElement.querySelectorAll('[data-tabbtn]').forEach(b => b.className = 'btn btn-sm btn-secondary');
      btn.className = 'btn btn-sm btn-primary';
      document.querySelectorAll(`#${groupId} [data-tab]`).forEach(t => t.style.display = t.dataset.tab === tabId ? '' : 'none');
    }

    // --- Малювалка ---
    let dCtx = null, drawing = false, brushColor = '#4f46e5', drawCanvas = null;
    function initDraw(canvasId, templateFn) {
      drawCanvas = $id(canvasId);
      if (!drawCanvas) return;
      dCtx = drawCanvas.getContext('2d');
      clearDrawCanvas(true);
      if (templateFn) templateFn(dCtx, drawCanvas);
      const pos = (e) => {
        const r = drawCanvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * drawCanvas.width / r.width, y: (e.clientY - r.top) * drawCanvas.height / r.height };
      };
      drawCanvas.addEventListener('pointerdown', (e) => { drawing = true; const p = pos(e); dCtx.beginPath(); dCtx.moveTo(p.x, p.y); });
      drawCanvas.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        const p = pos(e);
        dCtx.lineTo(p.x, p.y);
        dCtx.strokeStyle = brushColor;
        dCtx.lineWidth = 6;
        dCtx.lineCap = 'round';
        dCtx.lineJoin = 'round';
        dCtx.stroke();
      });
      window.addEventListener('pointerup', () => { drawing = false; });
    }
    function setBrushColor(col, dot) {
      brushColor = col;
      SoundFX.click();
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      if (dot) dot.classList.add('active');
    }
    function stampSticker(text) {
      if (!dCtx) return;
      SoundFX.pop();
      dCtx.save();
      dCtx.font = '900 40px Nunito, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
      dCtx.fillStyle = brushColor;
      dCtx.fillText(text, 30 + Math.random() * (drawCanvas.width - 110), 50 + Math.random() * (drawCanvas.height - 70));
      dCtx.restore();
    }
    function clearDrawCanvas(silent) {
      if (!dCtx) return;
      if (!silent) SoundFX.click();
      dCtx.fillStyle = '#ffffff';
      dCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
    }
    function downloadDrawing(name) {
      SoundFX.success();
      try {
        const a = document.createElement('a');
        a.download = (name || 'malyunok') + '.png';
        a.href = drawCanvas.toDataURL('image/png');
        a.click();
      } catch (e) {}
    }

    // --- Рефлексія ---
    function pickReflection(btn, label) {
      SoundFX.success();
      btn.parentElement.querySelectorAll('.btn').forEach(b => b.classList.remove('btn-success'));
      btn.classList.add('btn-success');
      $id('reflectionReply').textContent = `Дякуємо! «${label}» 🌟 Ти чудово попрацював(-ла) на уроці!`;
      launchFireworksBurst(false);
    }

    // --- Розстав кроки по порядку: натискай кроки в правильній послідовності ---
    function makeOrder(id, steps, opts = {}) {
      const root = $id(id);
      let next = 0;
      root.innerHTML = `<div class="order-list"></div><div class="sort-pool order-pool" style="margin-top:12px;"></div>
        <div class="sort-status" style="margin-top:10px;"><span class="st"></span><button class="btn btn-sm btn-secondary">🔄 Спочатку</button></div>`;
      const list = root.querySelector('.order-list');
      const pool = root.querySelector('.order-pool');
      const st = root.querySelector('.st');
      root.querySelector('.sort-status button').onclick = () => { SoundFX.click(); makeOrder(id, steps, opts); };
      const upd = () => { st.textContent = next < steps.length ? `Який крок №${next + 1}? Натисни на нього!` : '🎉 Усе по порядку!'; };
      steps.forEach((t, i) => {
        const slot = document.createElement('div');
        slot.className = 'order-slot';
        slot.innerHTML = `<span class="order-num">${i + 1}</span><span class="order-text">…</span>`;
        list.appendChild(slot);
      });
      shuffleArr(steps.map((t, i) => ({ t, i }))).forEach(it => {
        const b = document.createElement('button');
        b.className = 'word-chip';
        b.innerHTML = it.t;
        b.onclick = () => {
          if (it.i === next) {
            SoundFX.success();
            const slot = list.children[next];
            slot.classList.add('filled');
            slot.querySelector('.order-text').innerHTML = it.t;
            b.remove();
            next++;
            upd();
            if (next === steps.length) { launchFireworksBurst(false); if (opts.onDone) opts.onDone(); }
          } else {
            SoundFX.error();
            b.classList.add('shake');
            setTimeout(() => b.classList.remove('shake'), 420);
          }
        };
        pool.appendChild(b);
      });
      upd();
    }
