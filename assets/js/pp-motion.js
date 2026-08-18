/* pp-motion.js — capa de movimiento del sitio de Pilar Pérsico.
   Todo vive fuera del árbol que renderiza el runtime de DC: los canvas se
   cuelgan del <body> y nada de acá toca el markup del componente, así un
   re-render no pisa el estado de la animación.

   Contiene:
     1. Fondo vivo   — manchas difuminadas + halftone + asteriscos/estrellas
                       que hacen parallax con el mouse y con el scroll.
     2. Tipografías  — el H1 del hero gira como una ruleta: 3 s de cambios
                       que desaceleran y frena en Tropika por 10 s, en loop.
     3. Menú         — bloqueo de scroll, cierre con Escape, click fuera.
     4. Videos       — reels mudos en loop, carga diferida y sonido de a uno.
     5. Detalles     — header con sombra al scrollear, aparición de secciones.

   Respeta prefers-reduced-motion y se pausa con la pestaña oculta. */
(function () {
  'use strict';
  if (window.__ppMotion) return;
  window.__ppMotion = true;

  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COARSE = matchMedia('(pointer: coarse)').matches;

  var INK = [32, 30, 29];
  var MAG = [195, 0, 122];

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ------------------------------------------------------------------ *
   * 1. FONDO VIVO                                                       *
   * ------------------------------------------------------------------ */
  function background() {
    var host = document.createElement('div');
    host.id = 'pp-bg';
    var blobCanvas = document.createElement('canvas');
    blobCanvas.className = 'pp-blobs';
    var artCanvas = document.createElement('canvas');
    artCanvas.className = 'pp-art';
    var spot = document.createElement('div');
    spot.id = 'pp-spot';
    host.appendChild(blobCanvas);
    host.appendChild(artCanvas);
    host.appendChild(spot);

    var grain = document.createElement('div');
    grain.id = 'pp-grain';

    document.body.appendChild(host);
    document.body.appendChild(grain);

    var bctx = blobCanvas.getContext('2d');
    var actx = artCanvas.getContext('2d');
    var W = 0, H = 0, dpr = 1;
    var SCALE = 12; // el canvas de manchas se dibuja chiquito y se estira: barato y suave

    /* --- manchas de color (paleta de la página) --- */
    var BLOBS = [
      { c: [253, 234, 244], r: 0.46, a: 0.60, sx: 0.18, sy: 0.13, px: 0.20, py: 0.24 },
      { c: [195, 0, 122], r: 0.34, a: 0.10, sx: 0.11, sy: 0.17, px: 0.82, py: 0.18 },
      { c: [255, 205, 170], r: 0.40, a: 0.20, sx: 0.15, sy: 0.10, px: 0.14, py: 0.82 },
      { c: [255, 253, 250], r: 0.55, a: 0.92, sx: 0.13, sy: 0.15, px: 0.58, py: 0.62 },
      { c: [242, 183, 216], r: 0.30, a: 0.22, sx: 0.19, sy: 0.12, px: 0.92, py: 0.88 }
    ];

    /* --- trama de puntos tipo impresión (halftone) --- */
    var halftone = (function () {
      var step = 24, n = 8;
      var t = document.createElement('canvas');
      t.width = t.height = step * n;
      var c = t.getContext('2d');
      c.fillStyle = rgba(INK, 1);
      for (var y = 0; y < n; y++) {
        for (var x = 0; x < n; x++) {
          var r = 1.0 + 1.6 * Math.abs(Math.sin(x * 1.7 + y * 2.3));
          c.beginPath();
          c.arc(x * step + step / 2, y * step + step / 2, r, 0, Math.PI * 2);
          c.fill();
        }
      }
      return t;
    })();
    var halftonePattern = actx.createPattern(halftone, 'repeat');

    /* --- formas sueltas: asteriscos, estrellas, fichas, anillos, play --- */
    var KINDS = ['asterisk', 'star', 'card', 'ring', 'dot', 'play', 'asterisk', 'star'];
    var shapes = [];
    function seed() {
      shapes.length = 0;
      var n = COARSE ? 13 : 24;
      for (var i = 0; i < n; i++) {
        var kind = KINDS[i % KINDS.length];
        var depth = rand(0.35, 1);
        shapes.push({
          kind: kind,
          x: Math.random(),
          y: Math.random(),
          size: rand(14, 54) * (0.6 + depth * 0.7),
          rot: rand(0, Math.PI * 2),
          spin: rand(-0.16, 0.16),
          vx: rand(-0.012, 0.012),
          vy: rand(-0.016, -0.003),
          depth: depth,
          mag: Math.random() < 0.42,
          fill: Math.random() < 0.35,
          ox: 0, oy: 0 // desplazamiento elástico cuando el mouse las empuja
        });
      }
    }
    seed();

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      W = window.innerWidth;
      H = window.innerHeight;
      blobCanvas.width = Math.max(1, Math.ceil(W / SCALE));
      blobCanvas.height = Math.max(1, Math.ceil(H / SCALE));
      artCanvas.width = Math.round(W * dpr);
      artCanvas.height = Math.round(H * dpr);
      actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    var resizeTimer = 0;
    addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { resize(); if (REDUCE) draw(0); }, 150);
    }, { passive: true });

    /* --- puntero y scroll --- */
    var tx = 0.5, ty = 0.4, cx = 0.5, cy = 0.4;
    var pxr = -1, pyr = -1; // puntero en px, -1 = fuera
    if (!COARSE) {
      addEventListener('pointermove', function (e) {
        tx = e.clientX / window.innerWidth;
        ty = e.clientY / window.innerHeight;
        pxr = e.clientX; pyr = e.clientY;
      }, { passive: true });
      addEventListener('pointerleave', function () { pxr = pyr = -1; }, { passive: true });
    }
    var scrollY = 0;
    addEventListener('scroll', function () { scrollY = window.scrollY || 0; }, { passive: true });

    /* --- dibujo de cada forma --- */
    // Asterisco gordo: 3 barras macizas cruzadas a 60 grados (6 puntas, punta recta).
    function drawAsterisk(c, s, bars) {
      var n = bars || 3;
      var w = s * 0.46; // grosor de cada barra respecto del radio
      for (var i = 0; i < n; i++) {
        c.save();
        c.rotate((Math.PI / n) * i);
        c.fillRect(-w / 2, -s, w, s * 2);
        c.restore();
      }
    }
    function drawStar(c, s, points) {
      var n = points || 8, inner = s * 0.30;
      c.beginPath();
      for (var i = 0; i < n * 2; i++) {
        var r = i % 2 ? inner : s;
        var a = (Math.PI / n) * i - Math.PI / 2;
        var x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
    }
    function roundRect(c, w, h, r) {
      c.beginPath();
      c.moveTo(-w / 2 + r, -h / 2);
      c.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
      c.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
      c.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
      c.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
      c.closePath();
    }

    function drawShape(sh, t) {
      var color = sh.mag ? MAG : INK;
      var lineA = sh.mag ? 0.20 : 0.11;
      var fillA = sh.mag ? 0.10 : 0.05;
      actx.strokeStyle = rgba(color, lineA * (0.55 + sh.depth * 0.45));
      actx.fillStyle = rgba(color, fillA * (0.55 + sh.depth * 0.45));

      switch (sh.kind) {
        case 'asterisk':
          // va macizo y un poco más presente que el resto: es la firma de la marca
          actx.fillStyle = rgba(color, (sh.mag ? 0.17 : 0.08) * (0.55 + sh.depth * 0.45));
          drawAsterisk(actx, sh.size * 0.62, 3);
          break;
        case 'star':
          drawStar(actx, sh.size * 0.8, 8);
          if (sh.fill) actx.fill(); else { actx.lineWidth = 1.6; actx.stroke(); }
          break;
        case 'card':
          roundRect(actx, sh.size * 1.05, sh.size * 1.35, sh.size * 0.24);
          if (sh.fill) actx.fill(); else { actx.lineWidth = 1.6; actx.stroke(); }
          break;
        case 'ring':
          actx.lineWidth = Math.max(1.4, sh.size * 0.09);
          actx.beginPath();
          actx.arc(0, 0, sh.size * 0.55, 0, Math.PI * 2);
          actx.stroke();
          break;
        case 'dot':
          actx.beginPath();
          actx.arc(0, 0, Math.max(2.5, sh.size * 0.13), 0, Math.PI * 2);
          actx.fill();
          break;
        case 'play':
          actx.beginPath();
          actx.moveTo(-sh.size * 0.42, -sh.size * 0.5);
          actx.lineTo(sh.size * 0.58, 0);
          actx.lineTo(-sh.size * 0.42, sh.size * 0.5);
          actx.closePath();
          actx.lineWidth = 1.8;
          if (sh.fill) actx.fill(); else actx.stroke();
          break;
      }
    }

    /* --- loop --- */
    var last = 0, raf = 0, running = false;

    function draw(dt, t) {
      t = t || 0;
      /* manchas */
      var bw = blobCanvas.width, bh = blobCanvas.height;
      bctx.clearRect(0, 0, bw, bh);
      bctx.fillStyle = '#fbf9f7';
      bctx.fillRect(0, 0, bw, bh);
      for (var i = 0; i < BLOBS.length; i++) {
        var b = BLOBS[i];
        var bx = (b.px + Math.sin(t * b.sx + i * 1.7) * 0.10 + (cx - 0.5) * 0.06) * bw;
        var by = (b.py + Math.cos(t * b.sy + i * 2.3) * 0.09 + (cy - 0.5) * 0.06) * bh
               - (scrollY * 0.00004) * bh;
        var r = b.r * Math.max(bw, bh) * (0.9 + Math.sin(t * 0.2 + i) * 0.08);
        var g = bctx.createRadialGradient(bx, by, 0, bx, by, r);
        g.addColorStop(0, rgba(b.c, b.a));
        g.addColorStop(1, rgba(b.c, 0));
        bctx.fillStyle = g;
        bctx.beginPath();
        bctx.arc(bx, by, r, 0, Math.PI * 2);
        bctx.fill();
      }

      /* halftone + formas */
      actx.clearRect(0, 0, W, H);
      if (halftonePattern) {
        actx.save();
        actx.globalAlpha = 0.075;
        var hx = (cx - 0.5) * -26 + Math.sin(t * 0.06) * 10;
        var hy = (cy - 0.5) * -26 - scrollY * 0.03;
        actx.translate(hx % 192, hy % 192);
        actx.fillStyle = halftonePattern;
        actx.fillRect(-200, -200, W + 400, H + 400);
        actx.restore();
      }

      for (var k = 0; k < shapes.length; k++) {
        var sh = shapes[k];
        var px = sh.x * W + (cx - 0.5) * -46 * sh.depth + sh.ox;
        var py = sh.y * H + (cy - 0.5) * -34 * sh.depth + sh.oy - (scrollY * 0.06 * sh.depth) % (H + 200);
        if (py < -120) py += H + 240;
        actx.save();
        actx.translate(px, py);
        actx.rotate(sh.rot);
        drawShape(sh, t);
        actx.restore();
      }
    }

    function step(now) {
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      var t = now / 1000;

      cx += (tx - cx) * 0.05;
      cy += (ty - cy) * 0.05;
      spot.style.setProperty('--mx', (cx * 100).toFixed(2) + '%');
      spot.style.setProperty('--my', (cy * 100).toFixed(2) + '%');

      for (var i = 0; i < shapes.length; i++) {
        var sh = shapes[i];
        sh.x += sh.vx * dt * (0.4 + sh.depth);
        sh.y += sh.vy * dt * (0.4 + sh.depth);
        sh.rot += sh.spin * dt;
        if (sh.x < -0.08) sh.x = 1.08; else if (sh.x > 1.08) sh.x = -0.08;
        if (sh.y < -0.10) sh.y = 1.10; else if (sh.y > 1.10) sh.y = -0.10;

        // el puntero las empuja y vuelven solas a su lugar
        if (pxr >= 0) {
          var dx = sh.x * W - pxr, dy = sh.y * H - pyr;
          var d2 = dx * dx + dy * dy;
          if (d2 < 26000 && d2 > 1) {
            var d = Math.sqrt(d2);
            var f = (1 - d / 161) * 34 * sh.depth;
            sh.ox += (dx / d) * f * dt * 8;
            sh.oy += (dy / d) * f * dt * 8;
          }
        }
        sh.ox *= 0.94;
        sh.oy *= 0.94;
      }

      draw(dt, t);
      raf = requestAnimationFrame(step);
    }

    function start() {
      if (running || REDUCE) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });

    if (REDUCE) draw(0, 0); else start();
  }

  /* ------------------------------------------------------------------ *
   * 2. TIPOGRAFÍAS QUE ROTAN — "Pilar Pérsico" cambia de fuente cada 0.75 s *
   * ------------------------------------------------------------------ */
  // Cada fuente va con SU peso real. El H1 del markup pide 800 y la mayoría de
  // estas display existen sólo en 400: si no se corrige, el navegador fabrica un
  // bold falso y se ven más gordas y deformes que la muestra real.
  var FONT_CYCLE = [
    { f: '"Bakbak One", sans-serif',          w: 400 },
    { f: '"Archivo Black", sans-serif',       w: 400 },
    { f: '"Instrument Serif", serif',         w: 400 },
    { f: '"Caprasimo", cursive',              w: 400 },
    { f: '"Space Grotesk", sans-serif',       w: 700 },
    { f: '"Bricolage Grotesque", sans-serif', w: 800 }
  ];
  // Fuente en la que frena la ruleta. Caprasimo existe sólo en 400: se fuerza ese
  // peso y el CSS apaga font-synthesis, así el motor no le inventa un bold encima.
  // (Si algún día aparece Tropika.woff2 en ./uploads/, alcanza con ponerla primera.)
  var REST_FONT = { f: '"Caprasimo", cursive', w: 400 };

  function typeCycle() {
    if (REDUCE) return;

    // precarga: sin esto la primera vuelta parpadea con la fuente de fallback
    if (document.fonts && document.fonts.load) {
      FONT_CYCLE.concat([REST_FONT]).forEach(function (font) {
        try { document.fonts.load(font.w + ' 96px ' + font.f.split(',')[0]); } catch (e) { /* da igual */ }
      });
    }

    var SPIN_MS = 3000;   // la ruleta gira 3 s desacelerando
    var HOLD_MS = 10000;  // y descansa 10 s en Tropika
    var FIRST_GAP = 52;   // arranca rápido...
    var EASE = 1.32;      // ...y cada cambio tarda un 32% más que el anterior
    var i = 0;
    var timer = 0;

    function title() { return document.querySelector('h1'); }

    function apply(el, font) {
      el.style.fontFamily = font.f;
      el.style.fontWeight = font.w;              // sin esto el H1 hereda 800 y sale bold falso
      el.style.fontSynthesis = 'none';           // y el motor tampoco lo puede fabricar
      el.style.fontVariationSettings = 'normal'; // las display no tienen ejes variables
    }

    function spin() {
      var el = title();
      if (!el || document.hidden) { timer = setTimeout(spin, 600); return; }

      var gap = FIRST_GAP;
      var elapsed = 0;

      (function step() {
        if (document.hidden) { timer = setTimeout(step, 600); return; }
        apply(el, FONT_CYCLE[i++ % FONT_CYCLE.length]);
        elapsed += gap;
        gap *= EASE;
        if (elapsed < SPIN_MS) {
          timer = setTimeout(step, gap);
        } else {
          apply(el, REST_FONT); // frena acá
          timer = setTimeout(spin, HOLD_MS);
        }
      })();
    }

    timer = setTimeout(spin, 700);
    addEventListener('pagehide', function () { clearTimeout(timer); });
  }

  /* ------------------------------------------------------------------ *
   * 3. MENÚ: scroll bloqueado, Escape, click en el fondo                 *
   * ------------------------------------------------------------------ */
  function menu() {
    function panel() { return document.querySelector('[data-menu-panel]'); }
    function toggle() { return document.querySelector('[data-menu-toggle]'); }
    function isOpen() { var p = panel(); return !!p && p.getAttribute('data-open') === 'open'; }
    function close() { if (isOpen()) { var t = toggle(); if (t) t.click(); } }

    var scrollLock = 0;
    function lock() {
      if (document.body.style.position === 'fixed') return;
      scrollLock = window.scrollY || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = -scrollLock + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
    }
    function unlock() {
      if (document.body.style.position !== 'fixed') return;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      window.scrollTo(0, scrollLock);
    }
    function sync() {
      var open = isOpen();
      if (open) lock(); else unlock();
      var t = toggle();
      if (t) t.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    }

    new MutationObserver(sync).observe(document.body, {
      subtree: true, attributes: true, attributeFilter: ['data-open']
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    document.addEventListener('click', function (e) {
      var p = panel();
      if (!p || !isOpen()) return;

      // click en el vacío del overlay (no en un link ni en el botón)
      if (e.target === p || e.target.classList.contains('pp-menu-inner')) { close(); return; }

      // link interno: con el scroll bloqueado el salto nativo no corre.
      // El propio link ya dispara closeMenu en el componente, así que acá sólo
      // soltamos el scroll y navegamos a mano (llamar a close() de nuevo
      // volvería a abrir el menú: el estado de React todavía no se reflejó).
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || !p.contains(a)) return;
      var id = a.getAttribute('href').slice(1);
      var target = id && document.getElementById(id);
      e.preventDefault();
      unlock();
      setTimeout(function () {
        if (target) {
          target.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
          history.replaceState(null, '', '#' + id);
        } else {
          window.scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' });
        }
      }, 40);
    });
  }

  /* ------------------------------------------------------------------ *
   * 4. VIDEOS DE TRABAJOS                                                *
   *    Reels: mudos, en loop, se reproducen sólo mientras están en        *
   *    pantalla. El mp4 recién se descarga cuando la card se acerca, así  *
   *    el primer render no paga nada. Botón para activar el sonido, uno   *
   *    por vez. Si el archivo no está, la card muestra qué falta.         *
   * ------------------------------------------------------------------ */
  function videos() {
    var list = [];   // videos ya registrados
    var timer = 0;

    function wrapOf(v) { return v.closest('.pp-vid'); }

    function muteAll() {
      list.forEach(function (v) {
        v.muted = true;
        var w = wrapOf(v);
        if (w) w.setAttribute('data-sound', 'off');
      });
    }

    // carga diferida: el src se asigna recién cuando la card se acerca
    var loader = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var v = en.target;
        if (!v.getAttribute('src') && v.dataset.src) {
          v.setAttribute('src', v.dataset.src);
          v.load();
        }
        loader.unobserve(v);
      });
    }, { rootMargin: '400px 0px' });

    // play/pause por visibilidad
    var player = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting && en.intersectionRatio >= 0.4) {
          if (REDUCE) return;
          var pr = v.play();
          if (pr && pr.catch) pr.catch(function () { /* autoplay bloqueado: queda el poster */ });
        } else {
          v.pause();
          if (!v.muted) muteAll(); // si se va de pantalla con sonido, se apaga
        }
      });
    }, { threshold: [0, 0.4, 0.75] });

    // El runtime de DC renderiza después del DOMContentLoaded, así que no alcanza
    // con un querySelectorAll de una sola vez: hay que registrar lo que aparece.
    function scan() {
      document.querySelectorAll('.pp-video').forEach(function (v) {
        if (v.dataset.ppV) return;
        v.dataset.ppV = '1';
        v.muted = true;        // como atributo el runtime lo pisa; como propiedad manda
        v.playsInline = true;
        v.loop = true;
        v.controls = REDUCE;   // sin autoplay, que lo maneje la persona
        v.addEventListener('error', function () {
          var w = wrapOf(v);
          if (w) w.setAttribute('data-missing', '1');
        });
        list.push(v);
        loader.observe(v);
        player.observe(v);
      });
    }
    scan();
    new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(scan, 120);
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.pp-sound');
      if (!btn) return;
      var w = btn.closest('.pp-vid');
      var v = w && w.querySelector('.pp-video');
      if (!v) return;
      var turningOn = v.muted;
      muteAll();                      // el sonido es de a uno
      if (turningOn) {
        v.muted = false;
        w.setAttribute('data-sound', 'on');
        btn.setAttribute('aria-label', 'Silenciar');
        var pr = v.play();
        if (pr && pr.catch) pr.catch(function () {});
      } else {
        btn.setAttribute('aria-label', 'Activar sonido');
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) return;
      muteAll();
      list.forEach(function (v) { v.pause(); });
    });
  }

  /* ------------------------------------------------------------------ *
   * 5. DETALLES: header al scrollear + aparición de secciones            *
   * ------------------------------------------------------------------ */
  function chrome() {
    var root = document.documentElement;
    function onScroll() {
      root.setAttribute('data-pp-scroll', (window.scrollY || 0) > 8 ? '1' : '0');
    }
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (REDUCE || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('pp-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });

    function scan() {
      document.querySelectorAll('section, footer').forEach(function (el) {
        if (el.dataset.ppR) return;
        el.dataset.ppR = '1';
        el.classList.add('pp-r');
        io.observe(el);
      });
    }
    scan();
    var t = 0;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(scan, 120);
    }).observe(document.body, { childList: true, subtree: true });
  }

  ready(function () {
    background();
    typeCycle();
    menu();
    videos();
    chrome();
  });
})();
