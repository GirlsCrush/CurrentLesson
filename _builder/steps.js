
    /* =====================================================================
       0. ПОСТУПОВА ПОДАЧА: елементи з data-step відкриває вчитель кнопкою «Далі»
       (для старих уроків кроки задаються через window.STEP_RULES)
       ===================================================================== */
    const LessonSteps = (() => {
      const allSlides = () => Array.from(document.querySelectorAll('section.slide'));
      function applyRules(rules) {
        const sl = allSlides();
        Object.keys(rules || {}).forEach(n => {
          const s = sl[+n - 1];
          if (!s) return;
          rules[n].forEach((sel, i) => s.querySelectorAll(sel).forEach(el => {
            if (!el.dataset.step) el.dataset.step = String(i + 1);
          }));
        });
      }
      function max(slideEl) {
        let m = 0;
        if (slideEl) slideEl.querySelectorAll('[data-step]').forEach(e => { m = Math.max(m, parseInt(e.dataset.step, 10) || 0); });
        return m;
      }
      function show(slideEl, step) {
        if (!slideEl) return;
        slideEl.querySelectorAll('[data-step]').forEach(e => {
          const hide = (parseInt(e.dataset.step, 10) || 0) > step;
          if (hide) {
            e.classList.add('step-hidden');
            e.classList.remove('step-in');
          } else if (e.classList.contains('step-hidden')) {
            e.classList.remove('step-hidden');
            e.classList.add('step-in');
          }
        });
      }
      applyRules(window.STEP_RULES);
      allSlides().forEach(s => show(s, 0));
      return { max, show, applyRules };
    })();
