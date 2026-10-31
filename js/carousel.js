/* ── Photo/video carousels (events.html) ───────────────────────────────────
   Markup: .carousel > .carousel__viewport > .carousel__track > .carousel__slide
   The track is a horizontal scroll-snap strip, so swiping works natively on
   phones; the arrow buttons, arrow keys and counter are layered on top.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  document.querySelectorAll('.carousel').forEach(function (car) {
    var track  = car.querySelector('.carousel__track');
    var slides = Array.prototype.slice.call(car.querySelectorAll('.carousel__slide'));
    var prev   = car.querySelector('.carousel__btn--prev');
    var next   = car.querySelector('.carousel__btn--next');
    var count  = car.querySelector('.carousel__count');
    var current = 0;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function show(i) {
      current = i;
      count.textContent = (i + 1) + ' / ' + slides.length;
      // Pause any video that is no longer the visible slide
      slides.forEach(function (s, k) {
        var v = s.querySelector('video');
        if (v && k !== i && !v.paused) v.pause();
      });
    }

    function goTo(i) {
      i = (i + slides.length) % slides.length;   // wrap around at either end
      show(i);  // update right away so quick repeat clicks keep advancing
      track.scrollTo({ left: slides[i].offsetLeft, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    // Keep the counter in sync when someone swipes or scrolls the strip directly
    var settle;
    function update() {
      clearTimeout(settle);
      settle = setTimeout(function () {
        var i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== current) show(i);
      }, 120);
    }

    prev.addEventListener('click', function () { goTo(current - 1); });
    next.addEventListener('click', function () { goTo(current + 1); });
    track.addEventListener('scroll', update, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goTo(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
    });
  });
})();
