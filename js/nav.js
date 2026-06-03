/* Navigation: mobile toggle + dropdown */
(function () {
  const toggle = document.getElementById('nav-toggle');
  const links  = document.getElementById('nav-links');

  // Hamburger open/close
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      const open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
      toggle.textContent = open ? '✕' : '☰';
    });

    // Close when a link is clicked (mobile)
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
      });
    });
  }

  // Dropdown buttons
  document.querySelectorAll('.nav-parent').forEach(function (btn) {
    const dropdown = btn.nextElementSibling;
    if (!dropdown) return;

    btn.addEventListener('click', function () {
      const open = dropdown.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!btn.parentElement.contains(e.target)) {
        dropdown.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        dropdown.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Mark active nav link
  var path = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    var href = a.getAttribute('href');
    if (href && path.endsWith(href.replace(/^\.\.\//, '').replace(/^\.\//, ''))) {
      a.classList.add('active');
    }
  });
})();
