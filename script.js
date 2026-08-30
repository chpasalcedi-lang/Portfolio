/* ════════════════════════════════════════════════════════════
   Code With Toushif — Interactive 3D Portfolio
   script.js · Three.js hero · GSAP animations · Particles
   Theme system · Custom cursor · UI interactions
   ════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    /* ── Environment flags & helpers ─────────────────────────── */
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var hasGSAP = typeof window.gsap !== 'undefined';
    var hasST = hasGSAP && typeof window.ScrollTrigger !== 'undefined';

    function isMobile() { return window.innerWidth < 768; }
    function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

    /* Cross-module state (var → safely hoisted) */
    var hero3D = null;               // set by initHero()
    var liquid = null;               // set by initLiquid()
    var particleColors = { dot: '150, 160, 255', line: '0, 212, 255' };

    /* ════════════════════════════════════════════════════════════
       1. Preloader — masked word reveal + counter + curtain exit
          (Broed-style page load · "Code With Toushif")
       ════════════════════════════════════════════════════════════ */
    var preloader = document.getElementById('preloader');
    var loaderCount = document.getElementById('loader-count');
    var loaderFill = document.getElementById('loader-fill');
    var heroIntroPlayed = false;
    var pltStarted = false, pltFinished = false;

    function splitLoaderWords() {
        if (!preloader) return;
        preloader.querySelectorAll('.lw-word').forEach(function (word) {
            var text = word.getAttribute('data-word') || '';
            word.textContent = '';
            for (var i = 0; i < text.length; i++) {
                var mask = document.createElement('span');
                mask.className = 'lw-letter';
                var inner = document.createElement('span');
                inner.textContent = text[i];
                mask.appendChild(inner);
                word.appendChild(mask);
            }
        });
    }

    /* Park the hero elements in their pre-entrance state while the
       curtain is still up. The intro then plays plain to() tweens —
       no from()/immediateRender edge cases, and no flash of the static
       hero the instant the curtain lifts. */
    function prepareHeroIntro() {
        if (!hasGSAP || prefersReduced) return;
        window.gsap.set('.hero-greet, .hero-name, .hero-roles, .hero-desc', { y: 34, opacity: 0 });
        window.gsap.set('.hero-cta .btn', { y: 26, opacity: 0 });
        window.gsap.set('.hero-socials .social-link', { y: 20, opacity: 0 });
        window.gsap.set('.hero-visual', { scale: 0.85, opacity: 0 });
        window.gsap.set('.hero-badge', { scale: 0.6, opacity: 0 });
        window.gsap.set('.scroll-indicator', { opacity: 0, y: -12 });
    }

    function startPreloader() {
        if (pltStarted || !preloader) return;
        pltStarted = true;
        document.body.classList.add('is-loading');
        prepareHeroIntro();
        splitLoaderWords();

        var letters = preloader.querySelectorAll('.lw-letter > span');

        /* Reduced motion: show everything statically, leave quickly */
        if (prefersReduced) {
            preloader.classList.add('plt-static');
            if (loaderCount) loaderCount.textContent = '100';
            if (loaderFill) loaderFill.style.width = '100%';
            window.setTimeout(finishPreloader, 450);
            return;
        }

        /* Staggered letter rise out of their masks */
        letters.forEach(function (l, i) {
            l.style.transitionDelay = (0.15 + i * 0.042).toFixed(3) + 's';
        });
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                preloader.classList.add('plt-in');
            });
        });

        /* Eased counter 0 → 100 + progress line */
        var DURATION = 1900;
        var now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
        var t0 = now();
        (function step() {
            var p = Math.min(1, (now() - t0) / DURATION);
            var e = 1 - Math.pow(1 - p, 3); /* easeOutCubic */
            if (loaderCount) loaderCount.textContent = String(Math.round(e * 100));
            if (loaderFill) loaderFill.style.width = (e * 100).toFixed(1) + '%';
            if (p < 1) {
                window.requestAnimationFrame(step);
            } else {
                window.setTimeout(finishPreloader, 200);
            }
        })();
    }

    function finishPreloader() {
        if (pltFinished || !preloader) return;
        pltFinished = true;

        var exit = function () {
            if (prefersReduced) {
                preloader.classList.add('plt-fade');
            } else {
                /* Letters lift away, then the whole curtain slides up */
                var letters = preloader.querySelectorAll('.lw-letter > span');
                letters.forEach(function (l, i, arr) {
                    l.style.transitionDelay = ((arr.length - 1 - i) * 0.018).toFixed(3) + 's';
                });
                preloader.classList.add('plt-out');
            }
            window.setTimeout(function () {
                preloader.classList.add('hidden');
                preloader.remove();
                document.body.classList.remove('is-loading');
                playHeroIntro();
            }, prefersReduced ? 500 : 950);
        };

        /* Prefer the real load event; bail out after 1.2s so nobody
           waits on a slow third-party asset */
        if (document.readyState === 'complete') {
            window.setTimeout(exit, prefersReduced ? 80 : 220);
        } else {
            var waited = 0;
            var iv = window.setInterval(function () {
                waited += 120;
                if (document.readyState === 'complete' || waited >= 1200) {
                    window.clearInterval(iv);
                    exit();
                }
            }, 120);
        }
    }

    startPreloader();
    /* Safety net — never trap the visitor behind the loader */
    window.setTimeout(finishPreloader, 5000);

    /* ════════════════════════════════════════════════════════════
       2. Theme — dark / light with saved preference
       ════════════════════════════════════════════════════════════ */
    var rootEl = document.documentElement;
    var themeToggle = document.getElementById('theme-toggle');
    var themeIcon = document.getElementById('theme-icon');
    var THEME_KEY = 'cwt-theme';

    function storedTheme() {
        try { return window.localStorage.getItem(THEME_KEY); } catch (e) { return null; }
    }
    function currentTheme() {
        return rootEl.getAttribute('data-theme') || 'dark';
    }

    function applyTheme(theme, save) {
        rootEl.setAttribute('data-theme', theme);
        if (themeIcon) {
            themeIcon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#070812' : '#f3f5fb');
        if (save) {
            try { window.localStorage.setItem(THEME_KEY, theme); } catch (e) { /* private mode */ }
        }
        refreshSceneTheme();
        refreshParticleTheme();
        refreshLiquidTheme();
    }

    function refreshSceneTheme() {
        if (hero3D && typeof hero3D.setTheme === 'function') hero3D.setTheme(currentTheme());
    }
    function refreshParticleTheme() {
        var light = currentTheme() === 'light';
        particleColors.dot = light ? '92, 70, 210' : '150, 160, 255';
        particleColors.line = light ? '0, 150, 180' : '0, 212, 255';
    }
    function refreshLiquidTheme() {
        if (liquid && typeof liquid.setTheme === 'function') liquid.setTheme(currentTheme());
    }

    /* Apply saved → system preference → dark */
    applyTheme(storedTheme() || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'), false);

    /* Animated theme switch —
       1. View Transitions API (Chrome/Edge/Safari 18+/Samsung Internet):
          the new theme is revealed as a circle expanding out of the toggle.
       2. Fallback (no View Transitions): a temporary .theme-anim class
          cross-fades the colors of every element.
       3. prefers-reduced-motion: instant switch, no animation. */
    var THEME_ANIM_MS = 700;

    function setThemeAnimated(theme) {
        if (!prefersReduced && typeof document.startViewTransition === 'function') {
            var vt = document.startViewTransition(function () {
                applyTheme(theme, true);
            });
            if (vt && vt.ready) {
                vt.ready.then(function () {
                    /* Expand the new theme as a circle from the toggle button */
                    var rect = themeToggle.getBoundingClientRect();
                    var x = rect.left + rect.width / 2;
                    var y = rect.top + rect.height / 2;
                    var radius = Math.hypot(
                        Math.max(x, window.innerWidth - x),
                        Math.max(y, window.innerHeight - y)
                    ) + 60;
                    document.documentElement.animate(
                        {
                            clipPath: [
                                'circle(0px at ' + x + 'px ' + y + 'px)',
                                'circle(' + radius + 'px at ' + x + 'px ' + y + 'px)'
                            ]
                        },
                        {
                            duration: THEME_ANIM_MS,
                            easing: 'cubic-bezier(0.45, 0, 0.15, 1)',
                            pseudoElement: '::view-transition-new(root)'
                        }
                    );
                }).catch(function () { /* transition interrupted — nothing to do */ });
            }
        } else if (!prefersReduced) {
            rootEl.classList.add('theme-anim');
            applyTheme(theme, true);
            window.setTimeout(function () {
                rootEl.classList.remove('theme-anim');
            }, THEME_ANIM_MS + 100);
        } else {
            applyTheme(theme, true);
        }
        if (themeIcon) {
            themeIcon.classList.remove('spin');
            void themeIcon.offsetWidth; /* restart the keyframe animation */
            themeIcon.classList.add('spin');
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            setThemeAnimated(currentTheme() === 'dark' ? 'light' : 'dark');
        });
    }

    /* ════════════════════════════════════════════════════════════
       3. Custom cursor (desktop / fine pointers only)
       ════════════════════════════════════════════════════════════ */
    var cursorDot = document.getElementById('cursor-dot');
    var cursorRing = document.getElementById('cursor-ring');

    if (finePointer && !prefersReduced && cursorDot && cursorRing) {
        document.body.classList.add('has-cursor');
        var mx = -100, my = -100, rx = -100, ry = -100;

        window.addEventListener('mousemove', function (e) {
            mx = e.clientX; my = e.clientY;
            cursorDot.style.left = mx + 'px';
            cursorDot.style.top = my + 'px';
        }, { passive: true });

        (function followRing() {
            var prevX = rx, prevY = ry;
            rx += (mx - rx) * 0.16;
            ry += (my - ry) * 0.16;
            cursorRing.style.left = rx + 'px';
            cursorRing.style.top = ry + 'px';
            /* Liquid stretch — ring elongates with cursor speed */
            var speed = Math.hypot(rx - prevX, ry - prevY);
            var sx = 1 + Math.min(speed * 0.09, 0.5);
            cursorRing.style.transform =
                'translate(-50%, -50%) scale(' + sx.toFixed(3) + ', ' + (1 / sx).toFixed(3) + ')';
            window.requestAnimationFrame(followRing);
        })();

        var HOVER_SEL = 'a, button, input, textarea, select, .magnetic';
        document.addEventListener('mouseover', function (e) {
            if (e.target.closest(HOVER_SEL)) document.body.classList.add('cursor-hover');
        });
        document.addEventListener('mouseout', function (e) {
            if (e.target.closest(HOVER_SEL)) document.body.classList.remove('cursor-hover');
        });
        document.documentElement.addEventListener('mouseleave', function () {
            cursorDot.style.opacity = '0';
            cursorRing.style.opacity = '0';
        });
        document.documentElement.addEventListener('mouseenter', function () {
            cursorDot.style.opacity = '';
            cursorRing.style.opacity = '';
        });
    }

    /* ════════════════════════════════════════════════════════════
       4. Navigation — scrolled state, progress, menu, scroll-spy
       ════════════════════════════════════════════════════════════ */
    var header = document.getElementById('header');
    var navMenu = document.getElementById('nav-menu');
    var hamburger = document.getElementById('hamburger');
    var navLinks = document.querySelectorAll('.nav-link');
    var progressBar = document.getElementById('scroll-progress');
    var backToTop = document.getElementById('back-to-top');
    var sections = document.querySelectorAll('main section[id]');

    function onScroll() {
        var y = window.scrollY || window.pageYOffset;
        if (header) header.classList.toggle('scrolled', y > 40);
        if (backToTop) backToTop.classList.toggle('visible', y > 560);
        if (progressBar) {
            var max = document.documentElement.scrollHeight - window.innerHeight;
            progressBar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
        }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    function setMenu(open) {
        if (!navMenu || !hamburger) return;
        navMenu.classList.toggle('open', open);
        hamburger.classList.toggle('open', open);
        hamburger.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('menu-open', open);
    }
    function closeMenu() { setMenu(false); }

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function () {
            setMenu(!navMenu.classList.contains('open'));
        });
        /* Close when tapping outside the menu (mobile) */
        document.addEventListener('click', function (e) {
            if (!navMenu.classList.contains('open')) return;
            if (window.innerWidth > 900) { closeMenu(); return; }
            if (!e.target.closest('.nav-menu') && !e.target.closest('.hamburger')) closeMenu();
        });
        /* Close on Escape */
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeMenu();
        });
        /* Reset when rotating / resizing up to desktop */
        window.addEventListener('resize', function () {
            if (window.innerWidth > 900) closeMenu();
        });
    }

    /* Smooth scrolling for every in-page anchor */
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            var id = link.getAttribute('href');
            if (id === '#') { e.preventDefault(); return; }
            var target = document.querySelector(id);
            if (!target) return;
            e.preventDefault();
            closeMenu();

            var offset = header ? header.offsetHeight + 8 : 0;
            var hasScrollTo = hasGSAP && typeof window.ScrollToPlugin !== 'undefined';

            if (hasScrollTo && !prefersReduced) {
                document.documentElement.style.scrollBehavior = 'auto';
                window.gsap.to(window, {
                    duration: 1.1,
                    scrollTo: { y: target, offsetY: offset },
                    ease: 'power3.inOut',
                    onComplete: function () {
                        document.documentElement.style.scrollBehavior = '';
                    }
                });
            } else {
                var top = target.getBoundingClientRect().top + (window.scrollY || 0) - offset;
                window.scrollTo({ top: top, behavior: prefersReduced ? 'auto' : 'smooth' });
            }
        });
    });

    /* Active section highlighting */
    if ('IntersectionObserver' in window && sections.length) {
        var spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var id = '#' + entry.target.getAttribute('id');
                navLinks.forEach(function (l) {
                    l.classList.toggle('active', l.getAttribute('href') === id);
                });
            });
        }, { rootMargin: '-40% 0px -55% 0px' });
        sections.forEach(function (s) { spy.observe(s); });
    }

    if (backToTop) {
        backToTop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' });
        });
    }

    /* ════════════════════════════════════════════════════════════
       5. Typed roles
       ════════════════════════════════════════════════════════════ */
    var typedEl = document.getElementById('typed');
    var ROLES = [
        'Front-End Developer', 'App Developer',
        'UI/UX Designer', 'Web Designer', 'Web Developer', 'cisco Certified'
    ];

    if (typedEl) {
        if (prefersReduced) {
            typedEl.textContent = ROLES[0];
        } else {
            var roleIndex = 0, charIndex = 0, deleting = false;
            (function tick() {
                var word = ROLES[roleIndex];
                charIndex += deleting ? -1 : 1;
                typedEl.textContent = word.slice(0, charIndex);

                var delay = deleting ? 38 : 78;
                if (!deleting && charIndex === word.length) {
                    delay = 1700; deleting = true;
                } else if (deleting && charIndex === 0) {
                    deleting = false;
                    roleIndex = (roleIndex + 1) % ROLES.length;
                    delay = 420;
                }
                window.setTimeout(tick, delay);
            })();
        }
    }

    /* ════════════════════════════════════════════════════════════
       6. Background particle network (lightweight 2D canvas)
       ════════════════════════════════════════════════════════════ */
    var bgCanvas = document.getElementById('bg-particles');

    if (bgCanvas && bgCanvas.getContext && !prefersReduced && window.innerWidth >= 640) {
        var bgCtx = bgCanvas.getContext('2d');
        var bgW = 0, bgH = 0, bgParts = [], bgRaf = null;

        function buildParticles() {
            var density = isMobile() ? 26000 : 15000; // px² per particle
            var count = clamp(Math.floor((bgW * bgH) / density), 24, 110);
            bgParts = [];
            for (var i = 0; i < count; i++) {
                bgParts.push({
                    x: Math.random() * bgW,
                    y: Math.random() * bgH,
                    vx: (Math.random() - 0.5) * 0.35,
                    vy: (Math.random() - 0.5) * 0.35,
                    r: Math.random() * 1.8 + 0.6,
                    c: Math.random() > 0.75 ? particleColors.line : particleColors.dot
                });
            }
        }

        function resizeBg() {
            bgW = bgCanvas.width = window.innerWidth;
            bgH = bgCanvas.height = window.innerHeight;
            buildParticles();
        }

        function drawBg() {
            bgCtx.clearRect(0, 0, bgW, bgH);
            var linkDist = isMobile() ? 90 : 120;
            for (var i = 0; i < bgParts.length; i++) {
                var p = bgParts[i];
                p.x += p.vx; p.y += p.vy;
                if (p.x < -20) p.x = bgW + 20; else if (p.x > bgW + 20) p.x = -20;
                if (p.y < -20) p.y = bgH + 20; else if (p.y > bgH + 20) p.y = -20;

                bgCtx.beginPath();
                bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                bgCtx.fillStyle = 'rgba(' + p.c + ', 0.55)';
                bgCtx.fill();

                for (var j = i + 1; j < bgParts.length; j++) {
                    var q = bgParts[j];
                    var dx = p.x - q.x, dy = p.y - q.y;
                    var d2 = dx * dx + dy * dy;
                    if (d2 < linkDist * linkDist) {
                        var a = (1 - Math.sqrt(d2) / linkDist) * 0.16;
                        bgCtx.strokeStyle = 'rgba(' + p.c + ', ' + a.toFixed(3) + ')';
                        bgCtx.lineWidth = 1;
                        bgCtx.beginPath();
                        bgCtx.moveTo(p.x, p.y);
                        bgCtx.lineTo(q.x, q.y);
                        bgCtx.stroke();
                    }
                }
            }
            bgRaf = window.requestAnimationFrame(drawBg);
        }

        window.addEventListener('resize', resizeBg);
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                window.cancelAnimationFrame(bgRaf); bgRaf = null;
            } else if (bgRaf === null) {
                drawBg();
            }
        });

        resizeBg();
        drawBg();
    } else if (bgCanvas) {
        bgCanvas.style.display = 'none';
    }

    /* ════════════════════════════════════════════════════════════
       6b. Liquid background — animated WebGL flow-field shader
           A flowing gradient "liquid" that reacts to the cursor,
           scroll and theme. Falls back gracefully (orbs remain).
       ════════════════════════════════════════════════════════════ */
    function initLiquid() {
        var canvas = document.getElementById('liquid-bg');
        if (!canvas) return null;

        var gl = null;
        try {
            gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' }) ||
                canvas.getContext('experimental-webgl');
        } catch (err) { gl = null; }
        if (!gl) return null;

        var VERT = 'attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.0,1.0);}';

        var FRAG = [
            'precision mediump float;',
            'uniform vec2 u_res;',
            'uniform float u_time;',
            'uniform vec2 u_mouse;',
            'uniform float u_scroll;',
            'uniform vec3 u_c1;',
            'uniform vec3 u_c2;',
            'uniform vec3 u_c3;',
            'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
            'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);',
            'return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}',
            'float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(3.1,1.7);a*=0.5;}return v;}',
            'void main(){',
            'float m=min(u_res.x,u_res.y);',
            'vec2 uv=(gl_FragCoord.xy-0.5*u_res)/m;',
            'vec2 mo=(u_mouse-0.5*u_res)/m;',
            'float t=u_time*0.055;',
            'vec2 q=uv*1.35+vec2(t*0.8,-t*0.5);',
            'q+=0.38*vec2(fbm(q+vec2(0.0,u_scroll)),fbm(q+vec2(5.2,1.3)-u_scroll*0.7));',
            'float md=1.0-smoothstep(0.0,0.95,length(uv-mo));',
            'q-=0.22*mo*md;',
            'float f=fbm(q*1.5+vec2(t*0.35,t*0.2));',
            'float f2=fbm(q*2.6-vec2(t*0.18,t*0.4));',
            'vec3 col=mix(u_c1,u_c2,smoothstep(0.2,0.8,f));',
            'col=mix(col,u_c3,smoothstep(0.45,0.95,f2)*0.75);',
            'float vig=smoothstep(1.35,0.3,length(uv));',
            'col*=0.82+0.38*vig;',
            'gl_FragColor=vec4(col,1.0);',
            '}'
        ].join('\n');

        function compile(type, src) {
            var sh = gl.createShader(type);
            gl.shaderSource(sh, src);
            gl.compileShader(sh);
            if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
            return sh;
        }

        var vs = compile(gl.VERTEX_SHADER, VERT);
        var fs = compile(gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) return null;

        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
        gl.useProgram(prog);

        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(prog, 'a_pos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        var U = {
            res: gl.getUniformLocation(prog, 'u_res'),
            time: gl.getUniformLocation(prog, 'u_time'),
            mouse: gl.getUniformLocation(prog, 'u_mouse'),
            scroll: gl.getUniformLocation(prog, 'u_scroll'),
            c1: gl.getUniformLocation(prog, 'u_c1'),
            c2: gl.getUniformLocation(prog, 'u_c2'),
            c3: gl.getUniformLocation(prog, 'u_c3')
        };

        var THEMES = {
            dark: { c1: [0.030, 0.035, 0.080], c2: [0.180, 0.110, 0.420], c3: [0.000, 0.330, 0.430] },
            light: { c1: [0.945, 0.955, 0.985], c2: [0.760, 0.720, 0.990], c3: [0.700, 0.900, 0.970] }
        };
        var theme = currentTheme() === 'light' ? THEMES.light : THEMES.dark;

        var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
        var raf = null;
        var start = (window.performance && performance.now) ? performance.now() : Date.now();

        function resize() {
            var w = window.innerWidth || 1;
            var h = window.innerHeight || 1;
            var dpr = clamp(window.devicePixelRatio || 1, 1, 1.5);
            /* Render at reduced resolution — soft gradients don't need full res */
            var scale = Math.min(0.6, Math.sqrt(620000 / (w * h * dpr * dpr)));
            canvas.width = Math.max(2, Math.floor(w * dpr * scale));
            canvas.height = Math.max(2, Math.floor(h * dpr * scale));
            gl.viewport(0, 0, canvas.width, canvas.height);
        }

        function setUniforms(t) {
            gl.uniform2f(U.res, canvas.width, canvas.height);
            gl.uniform1f(U.time, t);
            gl.uniform2f(U.mouse, mouse.x, canvas.height - mouse.y);
            gl.uniform1f(U.scroll, (window.scrollY || window.pageYOffset || 0) * 0.0016);
            gl.uniform3f(U.c1, theme.c1[0], theme.c1[1], theme.c1[2]);
            gl.uniform3f(U.c2, theme.c2[0], theme.c2[1], theme.c2[2]);
            gl.uniform3f(U.c3, theme.c3[0], theme.c3[1], theme.c3[2]);
        }

        function frame() {
            var now = (window.performance && performance.now) ? performance.now() : Date.now();
            var t = (now - start) * 0.001;

            if (finePointer) {
                mouse.x += (mouse.tx - mouse.x) * 0.045;
                mouse.y += (mouse.ty - mouse.y) * 0.045;
            } else {
                /* Touch devices: autonomous drift */
                mouse.x = canvas.width * 0.5 + Math.sin(t * 0.4) * canvas.width * 0.22;
                mouse.y = canvas.height * 0.5 + Math.cos(t * 0.3) * canvas.height * 0.22;
            }

            setUniforms(t);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            raf = window.requestAnimationFrame(frame);
        }

        window.addEventListener('mousemove', function (e) {
            mouse.tx = e.clientX * (canvas.width / Math.max(1, window.innerWidth));
            mouse.ty = e.clientY * (canvas.height / Math.max(1, window.innerHeight));
        }, { passive: true });

        window.addEventListener('resize', resize);

        resize();

        if (prefersReduced) {
            /* Static single frame — no animation loop */
            mouse.x = canvas.width * 0.5;
            mouse.y = canvas.height * 0.55;
            setUniforms(8);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        } else {
            document.addEventListener('visibilitychange', function () {
                if (document.hidden) {
                    window.cancelAnimationFrame(raf);
                    raf = null;
                } else if (raf === null) {
                    frame();
                }
            });
            frame();
        }

        return {
            setTheme: function (name) {
                theme = name === 'light' ? THEMES.light : THEMES.dark;
                /* Repaint immediately on static (reduced-motion) frames */
                if (prefersReduced) {
                    setUniforms(8);
                    gl.drawArrays(gl.TRIANGLES, 0, 3);
                }
            }
        };
    }

    liquid = initLiquid();

    /* ════════════════════════════════════════════════════════════
       7. Three.js hero — interactive 3D scene
       ════════════════════════════════════════════════════════════ */
    function initHero() {
        var container = document.getElementById('hero-canvas');
        if (!container || typeof window.THREE === 'undefined') return null;

        var W = container.clientWidth || container.offsetWidth;
        var H = container.clientHeight || container.offsetHeight;
        if (!W || !H) { W = 600; H = 600; }

        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
        camera.position.set(0, 0, 7);

        var renderer;
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: !isMobile(),
                alpha: true,
                powerPreference: 'high-performance'
            });
        } catch (err) {
            return null; // WebGL unavailable — page still works without it
        }
        renderer.setPixelRatio(clamp(window.devicePixelRatio || 1, 1, isMobile() ? 1.5 : 2));
        renderer.setSize(W, H);
        container.appendChild(renderer.domElement);

        /* Lights */
        var ambient = new THREE.AmbientLight(0xffffff, 0.55);
        var keyLight = new THREE.PointLight(0x7c5cff, 2.2, 40); keyLight.position.set(6, 6, 6);
        var fillLight = new THREE.PointLight(0x00d4ff, 1.8, 40); fillLight.position.set(-6, -3, 4);
        var rimLight = new THREE.PointLight(0xff6584, 1.1, 40); rimLight.position.set(0, 6, -6);
        scene.add(ambient, keyLight, fillLight, rimLight);

        var group = new THREE.Group();
        scene.add(group);

        /* Main object — torus knot */
        var knotGeo = new THREE.TorusKnotGeometry(1.15, 0.34, isMobile() ? 140 : 220, isMobile() ? 20 : 32);
        /* Liquid-mercury material */
        var knotMat = new THREE.MeshStandardMaterial({
            color: 0x8f7bff, metalness: 0.85, roughness: 0.14,
            emissive: 0x0d0620, emissiveIntensity: 1
        });
        var knot = new THREE.Mesh(knotGeo, knotMat);
        group.add(knot);

        /* Wireframe icosahedron shell */
        var shellMat = new THREE.MeshBasicMaterial({
            color: 0x00d4ff, wireframe: true, transparent: true, opacity: 0.16
        });
        var shell = new THREE.Mesh(new THREE.IcosahedronGeometry(2.35, 1), shellMat);
        group.add(shell);

        /* Orbiting satellites */
        var sats = [];
        var satGeos = [
            new THREE.OctahedronGeometry(0.16),
            new THREE.TetrahedronGeometry(0.16),
            new THREE.BoxGeometry(0.2, 0.2, 0.2)
        ];
        var satMat = new THREE.MeshStandardMaterial({
            color: 0x00d4ff, metalness: 0.6, roughness: 0.3, emissive: 0x0a3a4a
        });
        var SAT_COUNT = isMobile() ? 5 : 9;
        for (var i = 0; i < SAT_COUNT; i++) {
            var s = new THREE.Mesh(satGeos[i % satGeos.length], satMat);
            var angle = (i / SAT_COUNT) * Math.PI * 2;
            var radius = 2.9 + Math.random() * 0.7;
            s.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 1.6, Math.sin(angle) * radius);
            s.userData = { angle: angle, radius: radius, speed: 0.15 + Math.random() * 0.25, rot: (Math.random() - 0.5) * 0.04 };
            group.add(s);
            sats.push(s);
        }

        /* Particle halo */
        var PCOUNT = isMobile() ? 350 : 900;
        var positions = new Float32Array(PCOUNT * 3);
        for (var p = 0; p < PCOUNT; p++) {
            var r = 2.8 + Math.random() * 3.2;
            var theta = Math.random() * Math.PI * 2;
            var phi = Math.acos(2 * Math.random() - 1);
            positions[p * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[p * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[p * 3 + 2] = r * Math.cos(phi);
        }
        var haloGeo = new THREE.BufferGeometry();
        haloGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        var haloMat = new THREE.PointsMaterial({
            color: 0x9d8bff, size: 0.035, transparent: true,
            opacity: 0.75, sizeAttenuation: true, depthWrite: false
        });
        var halo = new THREE.Points(haloGeo, haloMat);
        group.add(halo);

        /* Interaction — mouse parallax + drag with inertia */
        var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
        var dragging = false, lastX = 0, lastY = 0, velX = 0, velY = 0;

        window.addEventListener('mousemove', function (e) {
            mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
        }, { passive: true });

        container.addEventListener('pointerdown', function (e) {
            dragging = true;
            lastX = e.clientX; lastY = e.clientY;
            container.style.cursor = 'grabbing';
        });

        window.addEventListener('pointerup', function () {
            dragging = false;
            container.style.cursor = 'grab';
        });

        window.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            velY = (e.clientX - lastX) * 0.005;
            velX = (e.clientY - lastY) * 0.005;
            group.rotation.y += velY;
            group.rotation.x += velX;
            lastX = e.clientX; lastY = e.clientY;
        });

        /* Render loop */
        var clock = new THREE.Clock();

        function render() {
            var t = clock.getElapsedTime();

            if (!prefersReduced) {
                knot.rotation.x = t * 0.25;
                knot.rotation.y = t * 0.4;
                /* Gooey liquid wobble — non-uniform scale pulsing */
                knot.scale.set(
                    1 + Math.sin(t * 1.7) * 0.045,
                    1 + Math.sin(t * 1.3 + 1.2) * 0.045,
                    1 + Math.sin(t * 2.1 + 2.4) * 0.045
                );
                shell.rotation.y = -t * 0.08;
                shell.rotation.z = t * 0.05;
                halo.rotation.y = t * 0.05;

                for (var i = 0; i < sats.length; i++) {
                    var s = sats[i];
                    s.userData.angle += s.userData.speed * 0.01;
                    s.position.x = Math.cos(s.userData.angle) * s.userData.radius;
                    s.position.z = Math.sin(s.userData.angle) * s.userData.radius;
                    s.rotation.x += s.userData.rot;
                    s.rotation.y += s.userData.rot;
                }

                group.position.y = Math.sin(t * 0.8) * 0.12;

                if (!dragging) {
                    group.rotation.y += velY;
                    group.rotation.x += velX;
                    velY *= 0.95;
                    velX *= 0.95;
                }

                mouse.x += (mouse.tx - mouse.x) * 0.04;
                mouse.y += (mouse.ty - mouse.y) * 0.04;
                camera.position.x = mouse.x * 0.9;
                camera.position.y = -mouse.y * 0.6;
                camera.lookAt(0, 0, 0);
            }

            renderer.render(scene, camera);
        }

        var rafId = null;
        function loop() {
            rafId = window.requestAnimationFrame(loop);
            render();
        }

        if (prefersReduced) {
            render(); // single static frame
        } else {
            loop();
            document.addEventListener('visibilitychange', function () {
                if (document.hidden) {
                    window.cancelAnimationFrame(rafId);
                    rafId = null;
                } else if (rafId === null) {
                    loop();
                }
            });
        }

        /* Responsive resize */
        if (typeof ResizeObserver !== 'undefined') {
            var ro = new ResizeObserver(function () {
                var nw = container.clientWidth, nh = container.clientHeight;
                if (!nw || !nh) return;
                camera.aspect = nw / nh;
                camera.position.z = nw / nh < 0.85 ? 8.6 : 7; /* pull back on tall/narrow screens */
                camera.updateProjectionMatrix();
                renderer.setSize(nw, nh);
            });
            ro.observe(container);
        }
        window.addEventListener('resize', function () {
            var nw = container.clientWidth || window.innerWidth;
            var nh = container.clientHeight || window.innerHeight;
            if (!nw || !nh) return;
            camera.aspect = nw / nh;
            camera.position.z = nw / nh < 0.85 ? 8.6 : 7; /* pull back on tall/narrow screens */
            camera.updateProjectionMatrix();
            renderer.setSize(nw, nh);
        });

        container.style.cursor = 'grab';

        /* Theme-aware colors */
        return {
            setTheme: function (theme) {
                var light = theme === 'light';
                knotMat.color.set(light ? 0x5a3df0 : 0x8f7bff);
                knotMat.emissive.set(light ? 0x18102e : 0x0d0620);
                shellMat.color.set(light ? 0x0090b8 : 0x00d4ff);
                shellMat.opacity = light ? 0.22 : 0.16;
                haloMat.color.set(light ? 0x6b74b8 : 0x9d8bff);
                ambient.intensity = light ? 0.75 : 0.55;
            }
        };
    }

    hero3D = initHero();

    /* ════════════════════════════════════════════════════════════
       8. GSAP animations (graceful fallback if GSAP is missing)
       ════════════════════════════════════════════════════════════ */
    if (hasGSAP && typeof window.ScrollToPlugin !== 'undefined') {
        window.gsap.registerPlugin(window.ScrollToPlugin);
    }

    function playHeroIntro() {
        if (heroIntroPlayed) return;
        heroIntroPlayed = true;
        if (!hasGSAP || prefersReduced) return;

        var targets = '.hero-greet, .hero-name, .hero-roles, .hero-desc, .hero-cta .btn, .hero-socials .social-link, .hero-visual, .hero-badge, .scroll-indicator';

        /* Plain to() tweens from the states parked by prepareHeroIntro() —
           deterministic, no from()/immediateRender ordering surprises. */
        var tl = window.gsap.timeline({
            defaults: { ease: 'power3.out' },
            onComplete: function () {
                /* Hand every element back to its natural CSS state so later
                   effects (magnetic hover, theme swaps) start clean */
                window.gsap.set(targets, { clearProps: 'all' });
            }
        });
        tl.to('.hero-greet, .hero-name, .hero-roles, .hero-desc',
            { y: 0, opacity: 1, duration: 0.9, stagger: 0.12 })
            .to('.hero-cta .btn',
                { y: 0, opacity: 1, duration: 0.7, stagger: 0.12 }, '-=0.5')
            .to('.hero-socials .social-link',
                { y: 0, opacity: 1, duration: 0.55, stagger: 0.08 }, '-=0.45')
            .to('.hero-visual',
                { scale: 1, opacity: 1, duration: 1.1, ease: 'power2.out' }, 0.15)
            .to('.hero-badge',
                { scale: 1, opacity: 1, duration: 0.7, stagger: 0.15, ease: 'back.out(1.8)' }, '-=0.55')
            .to('.scroll-indicator',
                { opacity: 1, y: 0, duration: 0.6 }, '-=0.3');

        /* Hard net — the intro finishes ~2.6s after the curtain lifts. If
           anything interrupted it (throttled rAF, backgrounded tab, an
           extension), any hero element still invisible 4s in is force-
           restored to its natural state. A healthy intro is untouched. */
        window.setTimeout(function () {
            document.querySelectorAll(targets).forEach(function (el) {
                if (parseFloat(window.getComputedStyle(el).opacity) < 0.99) {
                    window.gsap.set(el, { y: 0, scale: 1, opacity: 1, clearProps: 'opacity,transform' });
                }
            });
        }, 4000);
    }

    function setupReveals() {
        if (!hasST || prefersReduced) return;
        var ST = window.ScrollTrigger;

        /* Explicit initial state — no from()-immediateRender surprises */
        window.gsap.utils.toArray('.reveal').forEach(function (el) {
            window.gsap.set(el, { y: 46, opacity: 0 });
        });
        window.gsap.utils.toArray('.stagger').forEach(function (wrap) {
            window.gsap.set(wrap.children, { y: 42, opacity: 0 });
        });

        /* Reveal once, then the trigger is done for good */
        window.gsap.utils.toArray('.reveal').forEach(function (el) {
            window.gsap.to(el, {
                y: 0, opacity: 1, duration: 0.95, ease: 'power3.out',
                scrollTrigger: { trigger: el, start: 'top 88%', once: true }
            });
        });
        window.gsap.utils.toArray('.stagger').forEach(function (wrap) {
            window.gsap.to(wrap.children, {
                y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: 'power3.out',
                scrollTrigger: { trigger: wrap, start: 'top 86%', once: true }
            });
        });

        /* Recalculate trigger positions once webfonts settle
           (late font swaps shift every section and breaks stale triggers) */
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () { ST.refresh(); }).catch(function () { });
        }
    }

    /* True when the element is at or above the bottom edge of the
       viewport — i.e. by now it should already be visible */
    function inView(el) {
        return el.getBoundingClientRect().top < window.innerHeight + 40;
    }

    /* Bullet-proof visibility failsafe: anything that should already
       be on screen but is still hidden (trigger drift, font reflow,
       fast scrolling) gets force-revealed. Content visibility is
       guaranteed no matter what ScrollTrigger computes. */
    function visibilityFailsafe() {
        document.querySelectorAll('.reveal, .stagger > *, .hero-cta .btn, .hero-socials .social-link, .hero-greet, .hero-name, .hero-roles, .hero-desc, .hero-badge, .hero-visual, .scroll-indicator').forEach(function (el) {
            if (!inView(el)) return;
            if (parseFloat(window.getComputedStyle(el).opacity) < 0.99) {
                if (hasGSAP) {
                    window.gsap.to(el, { y: 0, scale: 1, opacity: 1, duration: 0.6, ease: 'power2.out', clearProps: 'transform,opacity' });
                } else {
                    el.style.opacity = '1';
                    el.style.transform = 'none';
                }
            }
        });
        document.querySelectorAll('.bar-fill').forEach(function (bar) {
            if (!inView(bar)) return;
            if ((parseFloat(bar.style.width) || 0) < 1) {
                bar.style.width = clamp(parseInt(bar.getAttribute('data-percent') || '0', 10), 0, 100) + '%';
            }
        });
        document.querySelectorAll('.counter').forEach(function (c) {
            if (!inView(c)) return;
            var txt = (c.textContent || '').trim();
            if (txt === '' || txt === '0') {
                c.textContent = parseInt(c.getAttribute('data-count') || '0', 10).toLocaleString('en-US');
            }
        });
    }

    function animateBars(bars) {
        bars.forEach(function (bar, i) {
            var pct = clamp(parseInt(bar.getAttribute('data-percent') || '0', 10), 0, 100);
            if (hasST && !prefersReduced) {
                window.gsap.to(bar, {
                    width: pct + '%', duration: 1.2, ease: 'power3.out', delay: i * 0.06,
                    scrollTrigger: { trigger: bar, start: 'top 92%', once: true }
                });
            } else {
                bar.style.width = pct + '%';
            }
        });
    }

    function animateCounters(counters) {
        counters.forEach(function (el) {
            var target = parseInt(el.getAttribute('data-count') || '0', 10);
            if (hasST && !prefersReduced) {
                var obj = { v: 0 };
                window.gsap.to(obj, {
                    v: target, duration: 1.8, ease: 'power2.out',
                    scrollTrigger: { trigger: el, start: 'top 92%', once: true },
                    onUpdate: function () {
                        el.textContent = Math.round(obj.v).toLocaleString('en-US');
                    },
                    onComplete: function () {
                        el.textContent = target.toLocaleString('en-US');
                    }
                });
            } else {
                el.textContent = target.toLocaleString('en-US');
            }
        });
    }

    /* ════════════════════════════════════════════════════════════
       8b. Liquid sheen tracking + project filtering
       ════════════════════════════════════════════════════════════ */
    /* Liquid sheen — buttons glow toward the cursor */
    document.addEventListener('pointermove', function (e) {
        var t = e.target.closest ? e.target.closest('.btn, .filter-btn, .social-link') : null;
        if (!t) return;
        var r = t.getBoundingClientRect();
        t.style.setProperty('--x', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
        t.style.setProperty('--y', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
    }, { passive: true });

    /* Project filters — show/hide cards with a liquid stagger */
    var filterBtns = document.querySelectorAll('.filter-btn');
    var projectCards = document.querySelectorAll('.project-card');

    filterBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            filterBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');

            var f = btn.getAttribute('data-filter');
            var shown = [];
            projectCards.forEach(function (card) {
                var show = f === 'all' || card.getAttribute('data-category') === f;
                card.classList.toggle('is-hidden', !show);
                if (show) shown.push(card);
            });

            if (hasGSAP && !prefersReduced && shown.length) {
                window.gsap.fromTo(shown,
                    { y: 26, opacity: 0, scale: 0.97 },
                    { y: 0, opacity: 1, scale: 1, duration: 0.5, stagger: 0.06, ease: 'power3.out', clearProps: 'transform,opacity' });
            }
            if (hasST) window.ScrollTrigger.refresh();
        });
    });

    /* ════════════════════════════════════════════════════════════
       9. Magnetic buttons (desktop only)
       ════════════════════════════════════════════════════════════ */
    if (finePointer && !prefersReduced) {
        document.querySelectorAll('.magnetic').forEach(function (el) {
            el.addEventListener('mousemove', function (e) {
                var r = el.getBoundingClientRect();
                var x = e.clientX - r.left - r.width / 2;
                var y = e.clientY - r.top - r.height / 2;
                el.style.transform = 'translate(' + (x * 0.18) + 'px,' + (y * 0.18) + 'px)';
            });
            el.addEventListener('mouseleave', function () {
                el.style.transform = '';
            });
        });
    }

    /* ════════════════════════════════════════════════════════════
       10. Contact form (client-side validation + demo feedback)
       ════════════════════════════════════════════════════════════ */
    var form = document.getElementById('contact-form');
    var formStatus = document.getElementById('form-status');

    function setStatus(text, ok) {
        if (!formStatus) return;
        formStatus.textContent = text;
        formStatus.className = 'form-status ' + (ok ? 'success' : 'error');
    }

    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var fields = form.elements;
            var name = fields['name'].value.trim();
            var email = fields['email'].value.trim();
            var message = fields['message'].value.trim();
            var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

            if (!name || !email || !message) {
                setStatus('Please fill in your name, email and message.', false);
                return;
            }
            if (!emailOk) {
                setStatus('Please enter a valid email address.', false);
                return;
            }

            setStatus('Sending…', true);
            /* Demo only — connect your backend / form service here */
            window.setTimeout(function () {
                setStatus('✓ Thanks ' + name + '! Your message has been sent — I will reply soon.', true);
                form.reset();
            }, 900);
        });
    }

    /* ════════════════════════════════════════════════════════════
       11. Misc + init
       ════════════════════════════════════════════════════════════ */
    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    setupReveals();
    animateBars(Array.prototype.slice.call(document.querySelectorAll('.bar-fill')));
    animateCounters(Array.prototype.slice.call(document.querySelectorAll('.counter')));

    /* Recalculate trigger positions once everything settles, then run
       the visibility failsafe a couple of times as extra insurance */
    window.addEventListener('load', function () {
        if (hasST) window.ScrollTrigger.refresh();
        window.setTimeout(visibilityFailsafe, 2500);
        window.setTimeout(visibilityFailsafe, 7000);
    });






})();
