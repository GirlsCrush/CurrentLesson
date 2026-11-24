    /* =====================================================================
       1. SAFE STORAGE & ROLE DETECTION (Default = Student; ?role=teacher / #teacher = Teacher)
       ===================================================================== */
    function safeStorageGet(key, fallback) {
      try { return window.localStorage.getItem(key) ?? fallback; } catch (e) { return fallback; }
    }
    function safeStorageSet(key, val) {
      try { window.localStorage.setItem(key, val); } catch (e) {}
    }

    let isTeacher = false;
    try {
      const params = new URLSearchParams(window.location.search || '');
      const hash = (window.location.hash || '').toLowerCase();
      if (params.get('role') === 'teacher' || hash.includes('teacher')) {
        isTeacher = true;
      }
    } catch (e) {}

    if (isTeacher) {
      document.body.classList.add('is-teacher');
    }

    // Secret double-click on badge to switch to teacher mode if opened locally without params
    document.getElementById('brandBadge').addEventListener('dblclick', () => {
      if (!isTeacher && window.top === window) {
        try {
          window.location.hash = 'teacher';
          window.location.reload();
        } catch (e) {}
      }
    });

    // Посилання для учнів: якщо урок відкрито всередині головної сторінки — даємо адресу головної сторінки
    function getShareUrl() {
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

    function getCleanStudentUrl() {
      try {
        const u = new URL(window.location.href);
        u.search = '';
        u.hash = '';
        return u.toString();
      } catch (e) {
        return (window.location.href || '').split('?')[0].split('#')[0];
      }
    }

    /* =====================================================================
       2. WEB AUDIO API SOUND EFFECTS (Zero external audio files)
       ===================================================================== */
    const SoundFX = (() => {
      let ctx = null;
      let enabled = safeStorageGet('nush4_sound', '1') !== '0';

      function getCtx() {
        try {
          if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) ctx = new AC();
          }
          if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
        } catch (e) {}
        return ctx;
      }

      function tone(freq, endFreq, duration, type = 'sine', gainVal = 0.14, delay = 0) {
        if (!enabled) return;
        try {
          const c = getCtx();
          if (!c) return;
          const now = c.currentTime + delay;
          const osc = c.createOscillator();
          const gain = c.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, now);
          if (endFreq && endFreq !== freq) {
            osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
          }
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(gainVal, now + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
          osc.connect(gain);
          gain.connect(c.destination);
          osc.start(now);
          osc.stop(now + duration + 0.02);
        } catch (e) {}
      }

      return {
        isEnabled: () => enabled,
        toggle: () => {
          enabled = !enabled;
          safeStorageSet('nush4_sound', enabled ? '1' : '0');
          if (enabled) SoundFX.click();
          return enabled;
        },
        click: () => tone(540, 720, 0.07, 'sine', 0.11),
        pop: () => {
          tone(420, 960, 0.09, 'triangle', 0.15, 0);
          tone(1180, 1560, 0.11, 'sine', 0.09, 0.04);
        },
        success: () => {
          tone(523.25, 523.25, 0.12, 'triangle', 0.14, 0);
          tone(659.25, 659.25, 0.12, 'triangle', 0.14, 0.09);
          tone(783.99, 783.99, 0.14, 'triangle', 0.14, 0.18);
          tone(1046.5, 1046.5, 0.28, 'sine', 0.16, 0.27);
        },
        error: () => {
          tone(280, 210, 0.18, 'sawtooth', 0.08, 0);
          tone(220, 175, 0.22, 'sawtooth', 0.08, 0.14);
        },
        tick: () => tone(880, 880, 0.05, 'sine', 0.08),
        firework: () => {
          if (!enabled) return;
          try {
            const c = getCtx();
            if (!c) return;
            // Whistle + Boom + Sparkles
            tone(450, 1250, 0.22, 'sine', 0.07, 0);
            tone(140, 42, 0.45, 'triangle', 0.22, 0.20);
            [1320, 1580, 1860, 2100].forEach((f, idx) => {
              tone(f, f * 0.75, 0.16, 'sine', 0.07, 0.24 + idx * 0.05);
            });
          } catch (e) {}
        }
      };
    })();

    const btnSoundToggle = document.getElementById('btnSoundToggle');
    function updateSoundBtn() {
      btnSoundToggle.textContent = SoundFX.isEnabled() ? '🔊 Звук' : '🔇 Без звуку';
    }
    updateSoundBtn();
    btnSoundToggle.addEventListener('click', () => {
      SoundFX.toggle();
      updateSoundBtn();
    });

    /* =====================================================================
       3. FALLING THEMATIC EMOJIS & CLICK-TO-EXPLODE + FIREWORKS CANVAS
       ===================================================================== */
    const bgCanvas = document.getElementById('emojiBgCanvas');
    const bgCtx = bgCanvas.getContext('2d');
    const fxCanvas = document.getElementById('fxCanvas');
    const fxCtx = fxCanvas.getContext('2d');

    let W = window.innerWidth;
    let H = window.innerHeight;
    function resizeCanvases() {
      W = bgCanvas.width = fxCanvas.width = window.innerWidth;
      H = bgCanvas.height = fxCanvas.height = window.innerHeight;
    }
    resizeCanvases();
    window.addEventListener('resize', resizeCanvases);

    const LESSON_EMOJIS = __EMOJIS__;
    const SPARK_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#a855f7', '#ec4899'];

    const fallingEmojis = [];
    const particles = [];
    const flashes = [];

    function spawnFallingEmoji(randomY = false) {
      const size = 24 + Math.random() * 14;
      fallingEmojis.push({
        char: LESSON_EMOJIS[Math.floor(Math.random() * LESSON_EMOJIS.length)],
        x: 30 + Math.random() * Math.max(100, W - 60),
        y: randomY ? Math.random() * H : -40 - Math.random() * 120,
        vy: 0.45 + Math.random() * 0.65,
        vx: (Math.random() - 0.5) * 0.35,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.015 + Math.random() * 0.02,
        rot: (Math.random() - 0.5) * 0.5,
        vrot: (Math.random() - 0.5) * 0.012,
        size: size,
        radius: size * 0.72,
        alpha: 0.34 + Math.random() * 0.22
      });
    }

    const initialEmojiCount = Math.min(20, Math.max(11, Math.floor(W / 75)));
    for (let i = 0; i < initialEmojiCount; i++) {
      spawnFallingEmoji(true);
    }

    function createExplosion(x, y, count = 24, isBigFirework = false) {
      flashes.push({
        x, y,
        r: 6,
        maxR: isBigFirework ? 95 : 52,
        alpha: 0.95,
        color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)]
      });
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = (isBigFirework ? 3.2 : 1.8) + Math.random() * (isBigFirework ? 5.5 : 3.4);
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (isBigFirework ? 1.5 : 0.6),
          gravity: 0.11,
          drag: 0.96,
          size: (isBigFirework ? 4.5 : 3.2) + Math.random() * 3,
          color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
          alpha: 1,
          decay: 0.018 + Math.random() * 0.014
        });
      }
    }

    // Listen to pointerdown globally without blocking slide UI
    document.addEventListener('pointerdown', (e) => {
      const px = e.clientX;
      const py = e.clientY;
      // Check if user hit any falling emoji
      for (let i = fallingEmojis.length - 1; i >= 0; i--) {
        const em = fallingEmojis[i];
        const dist = Math.hypot(em.x - px, em.y - py);
        if (dist <= em.radius * 1.45) {
          fallingEmojis.splice(i, 1);
          createExplosion(em.x, em.y, 26, false);
          SoundFX.pop();
          setTimeout(() => spawnFallingEmoji(false), 900);
          break;
        }
      }
    }, { passive: true });

    function launchFireworksBurst(broadcastToClass = false) {
      SoundFX.firework();
      const bursts = 6;
      for (let b = 0; b < bursts; b++) {
        setTimeout(() => {
          const bx = W * (0.18 + Math.random() * 0.64);
          const by = H * (0.18 + Math.random() * 0.45);
          createExplosion(bx, by, 44, true);
          if (b % 2 === 1) SoundFX.firework();
        }, b * 260);
      }
      if (broadcastToClass && isTeacher) {
        publishFireworks();
      }
    }

    function animateCanvases() {
      // 1. Falling Emojis
      bgCtx.clearRect(0, 0, W, H);
      for (let i = 0; i < fallingEmojis.length; i++) {
        const em = fallingEmojis[i];
        em.wobble += em.wobbleSpeed;
        em.x += em.vx + Math.sin(em.wobble) * 0.35;
        em.y += em.vy;
        em.rot += em.vrot;

        if (em.y > H + 50) {
          em.y = -40;
          em.x = 30 + Math.random() * Math.max(100, W - 60);
        }

        bgCtx.save();
        bgCtx.translate(em.x, em.y);
        bgCtx.rotate(em.rot);
        bgCtx.globalAlpha = em.alpha;
        bgCtx.font = `${em.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
        bgCtx.textAlign = 'center';
        bgCtx.textBaseline = 'middle';
        bgCtx.fillText(em.char, 0, 0);
        bgCtx.restore();
      }

      // 2. Flashes & Spark Particles
      fxCtx.clearRect(0, 0, W, H);
      for (let i = flashes.length - 1; i >= 0; i--) {
        const fl = flashes[i];
        fl.r += (fl.maxR - fl.r) * 0.22;
        fl.alpha -= 0.055;
        if (fl.alpha <= 0) {
          flashes.splice(i, 1);
          continue;
        }
        fxCtx.save();
        fxCtx.beginPath();
        fxCtx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2);
        fxCtx.strokeStyle = fl.color;
        fxCtx.lineWidth = 4;
        fxCtx.globalAlpha = fl.alpha;
        fxCtx.stroke();
        fxCtx.restore();
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        fxCtx.save();
        fxCtx.globalAlpha = p.alpha;
        fxCtx.fillStyle = p.color;
        fxCtx.beginPath();
        fxCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        fxCtx.fill();
        fxCtx.restore();
      }

      requestAnimationFrame(animateCanvases);
    }
    requestAnimationFrame(animateCanvases);

    /* =====================================================================
       4. SLIDE NAVIGATION & TEACHER/STUDENT REAL-TIME SYNC (MQTT + BroadcastChannel)
       ===================================================================== */
    const slides = Array.from(document.querySelectorAll('.slide'));
    const totalSlides = slides.length;
    let currentSlide = 1;
    let followMode = true; // When true, teacher leads the class (students cannot flip slides)

    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const slideIndicator = document.getElementById('slideIndicator');
    const progressFill = document.getElementById('progressFill');
    const syncDot = document.getElementById('syncDot');
    const syncText = document.getElementById('syncText');
    const btnFollowToggle = document.getElementById('btnFollowToggle');

    function renderSlide(targetIndex, fromSync = false) {
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

      if (isTeacher) {
        btnFollowToggle.textContent = followMode ? '🔒 Вести клас за собою' : '🔓 Вільний перегляд';
        btnFollowToggle.className = followMode ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
      } else {
        if (followMode) {
          syncDot.className = 'status-dot locked';
          syncText.textContent = 'Керує вчитель';
        } else {
          syncDot.className = 'status-dot online';
          syncText.textContent = 'Вільний перегляд';
        }
      }
    }

    function changeSlide(delta) {
      if (!isTeacher && followMode) return;
      SoundFX.click();
      renderSlide(currentSlide + delta, false);
    }

    document.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
      if (!isTeacher && followMode) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') changeSlide(1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') changeSlide(-1);
    });

    if (btnFollowToggle) {
      btnFollowToggle.addEventListener('click', () => {
        if (!isTeacher) return;
        followMode = !followMode;
        SoundFX.click();
        updateNavLockUI();
        publishState();
      });
    }

    document.getElementById('btnClassFireworks').addEventListener('click', () => {
      launchFireworksBurst(true);
    });

    // Build a deterministic unique channel for this exact lesson deployment (no 4-digit codes!)
    function computeLessonTopic() {
      let basis = '__TOPIC__';
      try {
        const clean = getCleanStudentUrl().replace(/\/index\.html$/i, '/');
        if (clean && !clean.startsWith('file:')) {
          basis = clean;
        }
      } catch (e) {}
      let hash = 2166136261;
      for (let i = 0; i < basis.length; i++) {
        hash ^= basis.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return '__TOPIC___' + (hash >>> 0).toString(36);
    }

    const LESSON_TOPIC = computeLessonTopic();
    const STATE_TOPIC = LESSON_TOPIC + '/state';
    const FW_TOPIC = LESSON_TOPIC + '/fireworks';
    const PRESENCE_PREFIX = LESSON_TOPIC + '/presence/';
    const clientId = (isTeacher ? 't_' : 's_') + Math.random().toString(36).slice(2, 10);

    let mqttClient = null;
    let bcChannel = null;
    const onlineStudents = new Map(); // id -> lastSeenTs
    let lastFireworkId = '';

    function refreshStudentCounter() {
      const now = Date.now();
      for (const [id, ts] of onlineStudents.entries()) {
        if (now - ts > 45000) onlineStudents.delete(id);
      }
      const el = document.getElementById('studentCounter');
      if (el) el.textContent = `👨‍🎓 Учнів онлайн: ${onlineStudents.size}`;
    }
    setInterval(refreshStudentCounter, 5000);

    function handleIncomingState(data) {
      if (!data || typeof data !== 'object') return;
      if (typeof data.followMode === 'boolean') {
        followMode = data.followMode;
      }
      if (!isTeacher && typeof data.slide === 'number') {
        renderSlide(data.slide, true);
      } else {
        updateNavLockUI();
      }
    }

    function handleIncomingFirework(data) {
      if (!data || !data.id || data.id === lastFireworkId) return;
      lastFireworkId = data.id;
      launchFireworksBurst(false);
    }

    function publishState() {
      const payload = { slide: currentSlide, followMode: followMode, ts: Date.now() };
      try {
        if (bcChannel) bcChannel.postMessage({ type: 'state', payload });
      } catch (e) {}
      try {
        if (mqttClient && mqttClient.connected) {
          mqttClient.publish(STATE_TOPIC, JSON.stringify(payload), { qos: 1, retain: true });
        }
      } catch (e) {}
    }

    function publishFireworks() {
      const payload = { id: Date.now() + '_' + Math.random().toString(36).slice(2, 6) };
      lastFireworkId = payload.id;
      try {
        if (bcChannel) bcChannel.postMessage({ type: 'fireworks', payload });
      } catch (e) {}
      try {
        if (mqttClient && mqttClient.connected) {
          mqttClient.publish(FW_TOPIC, JSON.stringify(payload), { qos: 0, retain: false });
        }
      } catch (e) {}
    }

    function publishPresence() {
      if (isTeacher) return;
      const payload = { id: clientId, ts: Date.now() };
      try {
        if (bcChannel) bcChannel.postMessage({ type: 'presence', payload });
      } catch (e) {}
      try {
        if (mqttClient && mqttClient.connected) {
          mqttClient.publish(PRESENCE_PREFIX + clientId, JSON.stringify(payload), { qos: 0, retain: true });
        }
      } catch (e) {}
    }

    // 1) Local BroadcastChannel (works offline between tabs too!)
    try {
      if ('BroadcastChannel' in window) {
        bcChannel = new BroadcastChannel(LESSON_TOPIC);
        bcChannel.onmessage = (ev) => {
          const msg = ev.data || {};
          if (msg.type === 'state') handleIncomingState(msg.payload);
          if (msg.type === 'fireworks') handleIncomingFirework(msg.payload);
          if (msg.type === 'presence' && isTeacher && msg.payload && msg.payload.id) {
            onlineStudents.set(msg.payload.id, Date.now());
            refreshStudentCounter();
            publishState();
          }
          if (msg.type === 'hello' && isTeacher) {
            publishState();
          }
        };
        if (!isTeacher) {
          bcChannel.postMessage({ type: 'hello' });
          publishPresence();
        }
      }
    } catch (e) {}

    // 2) Asynchronous MQTT over WSS with primary + fallback brokers & CDNs
    const BROKERS = [
      'wss://broker.emqx.io:8084/mqtt',
      'wss://broker.hivemq.com:8884/mqtt',
      'wss://test.mosquitto.org:8081/mqtt'
    ];
    let brokerIdx = 0;

    function connectMqttBroker() {
      try {
        if (!window.mqtt || typeof window.mqtt.connect !== 'function') return;
        const url = BROKERS[brokerIdx % BROKERS.length];
        const opts = {
          clientId: clientId,
          clean: true,
          connectTimeout: 6000,
          reconnectPeriod: 4000
        };
        if (!isTeacher) {
          opts.will = {
            topic: PRESENCE_PREFIX + clientId,
            payload: '',
            qos: 0,
            retain: true
          };
        }

        mqttClient = window.mqtt.connect(url, opts);

        mqttClient.on('connect', () => {
          if (isTeacher) {
            syncDot.className = 'status-dot online';
            syncText.textContent = 'Онлайн • Клас підключено';
            mqttClient.subscribe(PRESENCE_PREFIX + '+');
            publishState();
          } else {
            mqttClient.subscribe(STATE_TOPIC);
            mqttClient.subscribe(FW_TOPIC);
            publishPresence();
            updateNavLockUI();
          }
        });

        mqttClient.on('message', (topic, message) => {
          try {
            const raw = message ? message.toString() : '';
            if (topic === STATE_TOPIC && raw) {
              handleIncomingState(JSON.parse(raw));
            } else if (topic === FW_TOPIC && raw) {
              handleIncomingFirework(JSON.parse(raw));
            } else if (topic.startsWith(PRESENCE_PREFIX) && isTeacher) {
              const sid = topic.slice(PRESENCE_PREFIX.length);
              if (!raw) {
                onlineStudents.delete(sid);
              } else {
                onlineStudents.set(sid, Date.now());
              }
              refreshStudentCounter();
            }
          } catch (e) {}
        });

        mqttClient.on('error', () => {
          try { mqttClient.end(true); } catch (e) {}
          brokerIdx++;
          if (brokerIdx < BROKERS.length * 2) {
            setTimeout(connectMqttBroker, 1500);
          }
        });
      } catch (e) {}
    }

    setInterval(() => {
      if (!isTeacher) publishPresence();
      else publishState();
    }, 15000);

    function loadMqttScriptAsync(urls, idx = 0) {
      if (idx >= urls.length) return;
      try {
        const s = document.createElement('script');
        s.src = urls[idx];
        s.async = true;
        s.onload = () => connectMqttBroker();
        s.onerror = () => loadMqttScriptAsync(urls, idx + 1);
        document.head.appendChild(s);
      } catch (e) {}
    }

    loadMqttScriptAsync([
      'https://unpkg.com/mqtt/dist/mqtt.min.js',
      'https://cdn.jsdelivr.net/npm/mqtt/dist/mqtt.min.js'
    ]);

    /* =====================================================================
       5. EMBEDDED STANDARD QR CODE GENERATOR ON CANVAS (Zero external libs!)
       Supports QR Model 2, Versions 1..9, Byte Mode, Reed-Solomon ECC Level L
       ===================================================================== */
    const QRCanvas = (() => {
      // GF(256) log/exp tables with primitive polynomial 0x11D
      const EXP = new Uint8Array(512);
      const LOG = new Uint8Array(256);
      let x = 1;
      for (let i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d;
      }
      for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

      function gfMul(a, b) {
        if (a === 0 || b === 0) return 0;
        return EXP[LOG[a] + LOG[b]];
      }

      function rsGeneratorPoly(degree) {
        let poly = [1];
        for (let i = 0; i < degree; i++) {
          const next = new Array(poly.length + 1).fill(0);
          const root = EXP[i];
          for (let j = 0; j < poly.length; j++) {
            next[j] ^= poly[j];
            next[j + 1] ^= gfMul(poly[j], root);
          }
          poly = next;
        }
        return poly;
      }

      function rsRemainder(dataBytes, eccLen) {
        const gen = rsGeneratorPoly(eccLen);
        const res = new Uint8Array(dataBytes.length + eccLen);
        res.set(dataBytes);
        for (let i = 0; i < dataBytes.length; i++) {
          const coef = res[i];
          if (coef !== 0) {
            for (let j = 1; j < gen.length; j++) {
              res[i + j] ^= gfMul(gen[j], coef);
            }
          }
        }
        return res.slice(dataBytes.length);
      }

      // Versions 1..9 Level L specs: [version, totalDataCodewords, eccPerBlock, numBlocks, alignCoords]
      const VERSIONS = [
        null,
        [1, 19, 7, 1, []],
        [2, 34, 10, 1, [6, 18]],
        [3, 55, 15, 1, [6, 22]],
        [4, 80, 20, 1, [6, 26]],
        [5, 108, 26, 1, [6, 30]],
        [6, 136, 18, 2, [6, 34]],
        [7, 156, 20, 2, [6, 22, 38]],
        [8, 194, 24, 2, [6, 24, 42]],
        [9, 232, 30, 2, [6, 26, 46]]
      ];

      function encodeBytes(text) {
        try {
          return new TextEncoder().encode(text);
        } catch (e) {
          const arr = [];
          for (let i = 0; i < text.length; i++) arr.push(text.charCodeAt(i) & 0xff);
          return new Uint8Array(arr);
        }
      }

      function draw(canvas, text) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const bytes = encodeBytes(text);
        let spec = null;
        for (let v = 1; v < VERSIONS.length; v++) {
          // Byte mode overhead: 4 bits mode + 8 bits length + 4 bits terminator = 2 bytes
          if (bytes.length + 2 <= VERSIONS[v][1]) {
            spec = VERSIONS[v];
            break;
          }
        }
        if (!spec) spec = VERSIONS[9];

        const [ver, totalData, eccPerBlock, numBlocks, align] = spec;
        const size = ver * 4 + 17;

        // Build bit stream (Mode 0100 = Byte)
        const bits = [];
        const pushBits = (val, len) => {
          for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
        };
        pushBits(0b0100, 4);
        const maxPayload = totalData - 2;
        const payload = bytes.slice(0, maxPayload);
        pushBits(payload.length, 8);
        for (let b of payload) pushBits(b, 8);
        pushBits(0, Math.min(4, totalData * 8 - bits.length));
        while (bits.length % 8 !== 0) bits.push(0);

        const dataCodewords = new Uint8Array(totalData);
        for (let i = 0; i < bits.length / 8; i++) {
          let byteVal = 0;
          for (let j = 0; j < 8; j++) byteVal = (byteVal << 1) | bits[i * 8 + j];
          dataCodewords[i] = byteVal;
        }
        const pads = [0xec, 0x11];
        for (let i = bits.length / 8, p = 0; i < totalData; i++, p++) {
          dataCodewords[i] = pads[p % 2];
        }

        // Split into blocks & compute Reed-Solomon ECC
        const blockLen = Math.floor(totalData / numBlocks);
        const dataBlocks = [];
        const eccBlocks = [];
        for (let b = 0; b < numBlocks; b++) {
          const slice = dataCodewords.slice(b * blockLen, (b + 1) * blockLen);
          dataBlocks.push(slice);
          eccBlocks.push(rsRemainder(slice, eccPerBlock));
        }

        // Interleave data & ECC codewords
        const finalCodewords = [];
        for (let i = 0; i < blockLen; i++) {
          for (let b = 0; b < numBlocks; b++) finalCodewords.push(dataBlocks[b][i]);
        }
        for (let i = 0; i < eccPerBlock; i++) {
          for (let b = 0; b < numBlocks; b++) finalCodewords.push(eccBlocks[b][i]);
        }

        // Create matrix (-1 = empty, 0 = white, 1 = black) & reserved map
        const mat = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
        const res = Array.from({ length: size }, () => new Uint8Array(size));

        function setMod(r, c, val, isReserved = true) {
          if (r >= 0 && r < size && c >= 0 && c < size) {
            mat[r][c] = val ? 1 : 0;
            if (isReserved) res[r][c] = 1;
          }
        }

        function placeFinder(r0, c0) {
          for (let r = -1; r <= 7; r++) {
            for (let c = -1; c <= 7; c++) {
              const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
              const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
              const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
              setMod(r0 + r, c0 + c, inOuter && (isBorder || isCenter), true);
            }
          }
        }

        placeFinder(0, 0);
        placeFinder(0, size - 7);
        placeFinder(size - 7, 0);

        // Alignment patterns
        for (let r of align) {
          for (let c of align) {
            if (res[r][c]) continue;
            for (let dr = -2; dr <= 2; dr++) {
              for (let dc = -2; dc <= 2; dc++) {
                const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
                setMod(r + dr, c + dc, dark, true);
              }
            }
          }
        }

        // Timing patterns
        for (let i = 8; i < size - 8; i++) {
          if (!res[6][i]) setMod(6, i, i % 2 === 0, true);
          if (!res[i][6]) setMod(i, 6, i % 2 === 0, true);
        }

        // Dark module & reserve format info areas
        setMod(size - 8, 8, 1, true);
        for (let i = 0; i < 9; i++) {
          if (i !== 6) { res[8][i] = 1; res[i][8] = 1; }
        }
        for (let i = 0; i < 8; i++) {
          res[8][size - 1 - i] = 1;
          res[size - 1 - i][8] = 1;
        }
        if (ver >= 7) {
          for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 3; j++) {
              res[size - 11 + j][i] = 1;
              res[i][size - 11 + j] = 1;
            }
          }
        }

        // Place data bits in zig-zag with Mask 0: (r + c) % 2 === 0
        const allBits = [];
        for (let cw of finalCodewords) {
          for (let b = 7; b >= 0; b--) allBits.push((cw >>> b) & 1);
        }

        let bitIdx = 0;
        let up = true;
        for (let col = size - 1; col > 0; col -= 2) {
          if (col === 6) col--;
          for (let step = 0; step < size; step++) {
            const r = up ? size - 1 - step : step;
            for (let dx = 0; dx < 2; dx++) {
              const c = col - dx;
              if (!res[r][c]) {
                const rawBit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
                const masked = ((r + c) % 2 === 0) ? (rawBit ^ 1) : rawBit;
                mat[r][c] = masked;
              }
            }
          }
          up = !up;
        }

        // Format Info for Level L (01) + Mask 0 (000) = 0x77C4 (111011111000100)
        const fmt = 0x77c4;
        for (let i = 0; i < 6; i++) setMod(8, i, (fmt >>> (14 - i)) & 1, true);
        setMod(8, 7, (fmt >>> 8) & 1, true);
        setMod(8, 8, (fmt >>> 7) & 1, true);
        setMod(7, 8, (fmt >>> 6) & 1, true);
        for (let i = 0; i < 6; i++) setMod(5 - i, 8, (fmt >>> (5 - i)) & 1, true);

        for (let i = 0; i < 8; i++) setMod(8, size - 1 - i, (fmt >>> i) & 1, true);
        for (let i = 0; i < 7; i++) setMod(size - 7 + i, 8, (fmt >>> (14 - i)) & 1, true);

        // Version Info for Ver >= 7
        const VER_BITS = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99 };
        if (ver >= 7 && VER_BITS[ver]) {
          const vb = VER_BITS[ver];
          for (let i = 0; i < 18; i++) {
            const bit = (vb >>> i) & 1;
            const r = Math.floor(i / 3);
            const c = size - 11 + (i % 3);
            setMod(r, c, bit, true);
            setMod(c, r, bit, true);
          }
        }

        // Render onto Canvas with quiet zone
        const quiet = 3;
        const totalCells = size + quiet * 2;
        const pxSize = canvas.width;
        const cell = pxSize / totalCells;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pxSize, pxSize);
        ctx.fillStyle = '#1e1b4b';
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (mat[r][c] === 1) {
              ctx.fillRect(
                Math.floor((c + quiet) * cell),
                Math.floor((r + quiet) * cell),
                Math.ceil(cell),
                Math.ceil(cell)
              );
            }
          }
        }
      }

      return { draw };
    })();

    // Teacher Share Modal handlers
    const shareModal = document.getElementById('shareModal');
    document.getElementById('btnOpenShare').addEventListener('click', () => {
      SoundFX.click();
      const studentUrl = getShareUrl();
      document.getElementById('studentUrlText').textContent = studentUrl;
      document.getElementById('copyFeedback').textContent = '';
      QRCanvas.draw(document.getElementById('qrCanvas'), studentUrl);
      shareModal.classList.add('open');
    });

    function closeShareModal() {
      SoundFX.click();
      shareModal.classList.remove('open');
    }

    function copyStudentUrl() {
      const url = getShareUrl();
      const fb = document.getElementById('copyFeedback');
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(() => {
            SoundFX.success();
            fb.textContent = '✅ Посилання скопійовано у буфер обміну!';
          }).catch(() => fallbackCopy(url, fb));
          return;
        }
      } catch (e) {}
      fallbackCopy(url, fb);
    }

    function fallbackCopy(text, fb) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        SoundFX.success();
        fb.textContent = '✅ Посилання скопійовано!';
      } catch (e) {
        fb.textContent = 'Виділіть посилання вище та натисніть Ctrl+C';
      }
    }
