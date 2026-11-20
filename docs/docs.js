/**
 * KittenTTS-Studio — Documentation Platform Enhancements
 * 1. Fast Sidebar Search Filter with Keyword Expansion & Keyboard Shortcut ("/")
 * 2. On-This-Page Scrollspy (IntersectionObserver)
 * 3. Tactile Brutalist Code Copy Buttons (Terminal Blocks & Pre Blocks)
 * 4. Responsive Mobile Navigation Drawer & Keyboard Handling (Esc)
 * 100% Vanilla JS • Zero External Dependencies • Offline Sovereign
 */

(function () {
  'use strict';

  // Topic keywords & page aliases for intuitive real-time filtering
  const PAGE_ALIASES = {
    'index.html': 'overview audition laboratory showcase soundboard demo oscilloscope metrics telemetry',
    'quickstart.html': 'quickstart install setup deploy run boot script uv pip docker systemd daemon containerization',
    'architecture.html': 'architecture engine model slm ternary bitnet pipeline cuda avx2 ffmpeg vector schematic',
    'hardware.html': 'hardware benchmark rtf ram memory budget cpu gpu telemetry vram self-healing allocation',
    'syntax.html': 'syntax prosody emotion tags laugh whisper event emphasis punctuation composition dialogue',
    'api.html': 'api rest curl endpoints schemas routes json python client integration synthesize telemetry'
  };

  document.addEventListener('DOMContentLoaded', () => {
    initSidebarFilter();
    initScrollspy();
    initCodeCopyButtons();
    initMobileDrawer();
  });

  /* ==========================================================================
     1. SIDEBAR FILTER & KEYBOARD SHORTCUT ("/")
     ========================================================================== */
  function initSidebarFilter() {
    const filterInput = document.getElementById('sidebarFilter');
    const sidebar = document.getElementById('docsSidebar');
    if (!filterInput || !sidebar) return;

    const links = sidebar.querySelectorAll('.sidebar-link');
    const groups = sidebar.querySelectorAll('.sidebar-group');

    filterInput.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();

      if (!q) {
        links.forEach((l) => (l.style.display = ''));
        groups.forEach((g) => (g.style.display = ''));
        return;
      }

      groups.forEach((group) => {
        const groupLinks = group.querySelectorAll('.sidebar-link');
        let groupHasMatch = false;

        groupLinks.forEach((link) => {
          const text = link.textContent.toLowerCase();
          const href = (link.getAttribute('href') || '').toLowerCase();
          const extra = (PAGE_ALIASES[href] || '').toLowerCase();
          const match = text.includes(q) || href.includes(q) || extra.includes(q);

          link.style.display = match ? '' : 'none';
          if (match) groupHasMatch = true;
        });

        group.style.display = groupHasMatch ? '' : 'none';
      });
    });

    // Pressing "/" focuses the documentation search input
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== filterInput && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        filterInput.focus();
        filterInput.select();
      }
    });
  }

  /* ==========================================================================
     2. ON-THIS-PAGE SCROLLSPY (INTERSECTION OBSERVER)
     ========================================================================== */
  function initScrollspy() {
    const toc = document.getElementById('docsToc');
    if (!toc) return;

    const tocLinks = toc.querySelectorAll('.toc-link');
    if (!tocLinks.length) return;

    // Collect targeted headings or sections
    const targets = [];
    tocLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        const targetEl = document.querySelector(href);
        if (targetEl) {
          targets.push({ id: href.slice(1), el: targetEl, link: link });
        }
      }
    });

    if (!targets.length) return;

    // Use IntersectionObserver to track visible sections
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            tocLinks.forEach((l) => {
              if (l.getAttribute('href') === '#' + id) {
                l.classList.add('active');
                l.setAttribute('aria-current', 'true');
              } else {
                l.classList.remove('active');
                l.removeAttribute('aria-current');
              }
            });
          }
        });
      },
      {
        root: null,
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0
      }
    );

    targets.forEach((t) => observer.observe(t.el));

    // Smooth scroll handling with header offset
    tocLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            const topOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - topOffset;

            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });

            if (history.pushState) {
              history.pushState(null, null, href);
            } else {
              window.location.hash = href;
            }
          }
        }
      });
    });
  }

  /* ==========================================================================
     3. TACTILE BRUTALIST CODE COPY BUTTONS
     ========================================================================== */
  function initCodeCopyButtons() {
    // 1. Dynamic buttons for pre blocks
    const preBlocks = document.querySelectorAll('.docs-content pre');
    preBlocks.forEach((pre) => {
      if (pre.querySelector('.copy-code-btn') || pre.closest('.terminal-block')) return;

      const btn = document.createElement('button');
      btn.className = 'copy-code-btn';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Copy code snippet to clipboard');
      btn.textContent = 'COPY';

      btn.addEventListener('click', () => {
        const codeEl = pre.querySelector('code');
        const codeText = codeEl ? codeEl.innerText : pre.innerText;
        copyTextWithFeedback(codeText, btn);
      });

      pre.style.position = 'relative';
      pre.appendChild(btn);
    });

    // 2. Existing static .copy-btn buttons (in terminal blocks and tables)
    const staticBtns = document.querySelectorAll('.copy-btn');
    staticBtns.forEach((btn) => {
      // Avoid attaching listeners multiple times
      if (btn.dataset.copyInit) return;
      btn.dataset.copyInit = 'true';

      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          copyTextWithFeedback(targetEl.innerText.trim(), btn);
        }
      });
    });
  }

  async function copyTextWithFeedback(text, btn) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      const orig = btn.innerText;
      btn.innerText = 'COPIED!';
      btn.classList.add('copied');
      btn.style.color = '#00ff88';

      setTimeout(() => {
        btn.innerText = orig;
        btn.classList.remove('copied');
        btn.style.color = '';
      }, 1800);
    } catch (err) {
      btn.innerText = 'FAILED';
      setTimeout(() => {
        btn.innerText = 'COPY';
      }, 1800);
    }
  }

  /* ==========================================================================
     4. RESPONSIVE MOBILE DRAWER & KEYBOARD (ESC)
     ========================================================================== */
  function initMobileDrawer() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('docsSidebar');
    if (!toggleBtn || !sidebar) return;

    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    function openDrawer() {
      sidebar.classList.add('open');
      backdrop.classList.add('active');
      toggleBtn.setAttribute('aria-expanded', 'true');
    }

    function closeDrawer() {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }

    toggleBtn.addEventListener('click', () => {
      if (sidebar.classList.contains('open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    backdrop.addEventListener('click', closeDrawer);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) {
        closeDrawer();
      }
    });
  }
})();
