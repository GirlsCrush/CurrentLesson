"""Латки для рушіїв уроків: поступова подача (кроки), посилання для учнів у рамці, захист режиму вчителя.

nush4 — рушій прикладу CurrentLesson (ним зібрані уроки 2 класу і урок 9 для 4 класу).
nush3 — рушій уроку 8 для 3 класу.
"""


def _sub(s, old, new, count=1):
    if s.count(old) < 1:
        raise ValueError('Не знайдено фрагмент для латки:\n' + old[:200])
    return s.replace(old, new, count)


NUSH4_RENDER_OLD = """    function renderSlide(targetIndex, fromSync = false) {
      const clamped = Math.max(1, Math.min(totalSlides, targetIndex));
      currentSlide = clamped;
      slides.forEach((s, idx) => {
        s.classList.toggle('active', idx + 1 === currentSlide);
      });
      slideIndicator.textContent = `Слайд ${currentSlide} / ${totalSlides}`;
      progressFill.style.width = `${(currentSlide / totalSlides) * 100}%`;
      updateNavLockUI();

      if (isTeacher && !fromSync) {
        publishState();
      }
    }

    function updateNavLockUI() {
      const lockedForStudent = !isTeacher && followMode;
      btnPrev.disabled = currentSlide === 1 || lockedForStudent;
      btnNext.disabled = currentSlide === totalSlides || lockedForStudent;
"""

NUSH4_RENDER_NEW = """    let currentStep = 0;
    function stepsLeft() { return Math.max(0, LessonSteps.max(slides[currentSlide - 1]) - currentStep); }

    function renderSlide(targetIndex, fromSync = false, step = 0) {
      const clamped = Math.max(1, Math.min(totalSlides, targetIndex));
      currentSlide = clamped;
      slides.forEach((s, idx) => {
        s.classList.toggle('active', idx + 1 === currentSlide);
      });
      const slideEl = slides[currentSlide - 1];
      currentStep = Math.max(0, Math.min(step, LessonSteps.max(slideEl)));
      LessonSteps.show(slideEl, currentStep);
      const left = stepsLeft();
      slideIndicator.textContent = `Слайд ${currentSlide} / ${totalSlides}` + (left ? ` • ще ${left} ⬇` : '');
      progressFill.style.width = `${(currentSlide / totalSlides) * 100}%`;
      updateNavLockUI();

      if (isTeacher && !fromSync) {
        publishState();
      }
    }

    function updateNavLockUI() {
      const lockedForStudent = !isTeacher && followMode;
      const left = stepsLeft();
      btnPrev.disabled = (currentSlide === 1 && currentStep === 0) || lockedForStudent;
      btnNext.disabled = (currentSlide === totalSlides && !left) || lockedForStudent;
      btnNext.textContent = left ? 'Показати ще ⬇' : 'Далі ➡';
      btnNext.classList.toggle('btn-accent', !!left);
      btnNext.classList.toggle('btn-primary', !left);
"""

NUSH4_CHANGE_OLD = """    function changeSlide(delta) {
      if (!isTeacher && followMode) return;
      SoundFX.click();
      renderSlide(currentSlide + delta, false);
    }"""

NUSH4_CHANGE_NEW = """    function changeSlide(delta) {
      if (!isTeacher && followMode) return;
      const max = LessonSteps.max(slides[currentSlide - 1]);
      if (delta > 0 && currentStep < max) { SoundFX.pop(); renderSlide(currentSlide, false, currentStep + 1); return; }
      if (delta < 0 && currentStep > 0) { SoundFX.click(); renderSlide(currentSlide, false, currentStep - 1); return; }
      if ((delta > 0 && currentSlide === totalSlides) || (delta < 0 && currentSlide === 1)) return;
      SoundFX.click();
      renderSlide(currentSlide + delta, false, delta < 0 ? 999 : 0);
    }"""


def patch_nush4(js):
    js = _sub(js, NUSH4_RENDER_OLD, NUSH4_RENDER_NEW)
    js = _sub(js, NUSH4_CHANGE_OLD, NUSH4_CHANGE_NEW)
    js = _sub(js, "const payload = { slide: currentSlide, followMode: followMode, ts: Date.now() };",
              "const payload = { slide: currentSlide, step: currentStep, followMode: followMode, ts: Date.now() };")
    js = _sub(js, "renderSlide(data.slide, true);",
              "renderSlide(data.slide, true, typeof data.step === 'number' ? data.step : 999);")
    # секретний подвійний клік по назві не вмикає режим вчителя всередині головної сторінки
    if "if (!isTeacher && window.top === window) {" not in js:
        js = _sub(js, "document.getElementById('brandBadge').addEventListener('dblclick', () => {\n      if (!isTeacher) {",
                  "document.getElementById('brandBadge').addEventListener('dblclick', () => {\n      if (!isTeacher && window.top === window) {")
    # QR/посилання веде на головну сторінку, якщо урок відкрито в рамці
    if 'function getShareUrl()' not in js:
        js = _sub(js, "    function getCleanStudentUrl() {", """    function getShareUrl() {
      try {
        if (window.top !== window && window.top.location.href) {
          const t = new URL(window.top.location.href);
          t.search = '';
          t.hash = '';
          return t.toString();
        }
      } catch (e) {}
      return getCleanStudentUrl();
    }

    function getCleanStudentUrl() {""")
        js = _sub(js, "const studentUrl = getCleanStudentUrl();", "const studentUrl = getShareUrl();")
        js = _sub(js, "const url = getCleanStudentUrl();", "const url = getShareUrl();")
    return js


def patch_nush3(js):
    js = _sub(js, "    let currentSlide = 0;\n", """    let currentSlide = 0;
    let currentStep = 0;
    function stepsLeft() { return Math.max(0, LessonSteps.max(slides[currentSlide]) - currentStep); }
""")
    js = _sub(js, "slideCounter.textContent = `Слайд ${currentSlide + 1} / ${totalSlides}`;",
              "slideCounter.textContent = `Слайд ${currentSlide + 1} / ${totalSlides}` + (stepsLeft() ? ` • ще ${stepsLeft()} ⬇️` : '');")
    js = _sub(js, """      prevBtn.disabled = lockedForStudent || currentSlide === 0;
      nextBtn.disabled = lockedForStudent || currentSlide === totalSlides - 1;""",
              """      prevBtn.disabled = lockedForStudent || (currentSlide === 0 && currentStep === 0);
      nextBtn.disabled = lockedForStudent || (currentSlide === totalSlides - 1 && !stepsLeft());
      nextBtn.textContent = stepsLeft() ? 'Показати ще ⬇️' : 'Далі ➡️';
      nextBtn.style.background = stepsLeft() ? 'linear-gradient(135deg, #f59e0b, #f97316)' : '';""")
    js = _sub(js, """    function goToSlide(index, broadcast = false) {
      const clamped = Math.max(0, Math.min(totalSlides - 1, index));
      if (clamped !== currentSlide) {
        playClickSound();
      }
      currentSlide = clamped;
      updateNavigationUI();""", """    function goToSlide(index, broadcast = false, step = 0) {
      const clamped = Math.max(0, Math.min(totalSlides - 1, index));
      if (clamped !== currentSlide) {
        playClickSound();
      }
      currentSlide = clamped;
      currentStep = Math.max(0, Math.min(step, LessonSteps.max(slides[currentSlide])));
      LessonSteps.show(slides[currentSlide], currentStep);
      updateNavigationUI();""")
    js = _sub(js, """    function changeSlide(delta) {
      if (!isTeacher && lockStudents) return;
      goToSlide(currentSlide + delta, true);
    }""", """    function changeSlide(delta) {
      if (!isTeacher && lockStudents) return;
      const max = LessonSteps.max(slides[currentSlide]);
      if (delta > 0 && currentStep < max) { playClickSound(); goToSlide(currentSlide, true, currentStep + 1); return; }
      if (delta < 0 && currentStep > 0) { playClickSound(); goToSlide(currentSlide, true, currentStep - 1); return; }
      if ((delta > 0 && currentSlide === totalSlides - 1) || (delta < 0 && currentSlide === 0)) return;
      goToSlide(currentSlide + delta, true, delta < 0 ? 999 : 0);
    }""")
    js = _sub(js, """        slide: currentSlide,
        lock: lockStudents,""", """        slide: currentSlide,
        step: currentStep,
        lock: lockStudents,""")
    js = _sub(js, """      lockStudents = payload.lock !== false;
      if (lockStudents && payload.slide !== currentSlide) {
        currentSlide = Math.max(0, Math.min(totalSlides - 1, payload.slide));
      }
      updateNavigationUI();""", """      lockStudents = payload.lock !== false;
      if (lockStudents) {
        goToSlide(payload.slide, false, typeof payload.step === 'number' ? payload.step : 999);
        return;
      }
      updateNavigationUI();""")
    js = _sub(js, """          const url = new URL(window.location.href);
          url.searchParams.delete('role');""", """          const url = new URL((window.top !== window ? window.top : window).location.href);
          url.search = '';""")
    return js
