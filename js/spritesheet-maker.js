/* ── Sprite Sheet Maker ────────────────────────────────────────────────────
   Turns an 8-frame GIF or a sequence of 8 PNGs (each 800×800, transparent
   background) into a single 6400×800 PNG sprite sheet for the game.
   Everything runs in the browser — no files are uploaded anywhere.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var FRAME = 800;      // each frame must be 800×800
  var FRAMES = 8;       // walk cycles are exactly 8 frames
  var PREVIEW_FPS = 8;  // same speed as the Upload page preview

  var dropZone   = document.getElementById('ssm-drop');
  var fileInput  = document.getElementById('ssm-file');
  var messages   = document.getElementById('ssm-messages');
  var framesWrap = document.getElementById('ssm-frames');
  var confirmBox = document.getElementById('ssm-confirm');
  var buildBtn   = document.getElementById('ssm-build');
  var resetBtn   = document.getElementById('ssm-reset');
  var result     = document.getElementById('ssm-result');
  var previewCv  = document.getElementById('ssm-preview');
  var sheetImg   = document.getElementById('ssm-sheet');
  var downloadA  = document.getElementById('ssm-download');

  var frames = [];       // array of ImageData, in order
  var baseName = 'walk_cycle';
  var sheetUrl = null;
  var previewTimer = null;

  // ── Messages ──────────────────────────────────────────────────────────
  function clearMessages() { messages.innerHTML = ''; }
  function say(kind, html) {
    var p = document.createElement('p');
    p.className = 'ssm-msg ssm-msg--' + kind;
    p.innerHTML = html;
    messages.appendChild(p);
  }

  function updateBuildState() {
    buildBtn.disabled = !(frames.length === FRAMES && confirmBox.checked);
  }

  function resetAll() {
    frames = [];
    framesWrap.innerHTML = '';
    clearMessages();
    result.hidden = true;
    if (previewTimer) { clearInterval(previewTimer); previewTimer = null; }
    if (sheetUrl) { URL.revokeObjectURL(sheetUrl); sheetUrl = null; }
    fileInput.value = '';
    updateBuildState();
  }

  // ── File intake ───────────────────────────────────────────────────────
  function naturalCompare(a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  }

  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);  // copy before resetAll() clears the input
    resetAll();
    if (!files.length) return;

    var gifs = files.filter(function (f) { return /\.gif$/i.test(f.name) || f.type === 'image/gif'; });
    var pngs = files.filter(function (f) { return /\.png$/i.test(f.name) || f.type === 'image/png'; });
    var other = files.length - gifs.length - pngs.length;

    if (other > 0) {
      say('error', 'Only <strong>.png</strong> and <strong>.gif</strong> files are accepted.');
      return;
    }
    if (gifs.length && pngs.length) {
      say('error', 'Please upload <strong>either</strong> one GIF <strong>or</strong> a set of PNGs &mdash; not both at once.');
      return;
    }
    if (gifs.length > 1) {
      say('error', 'Please upload just <strong>one</strong> GIF at a time.');
      return;
    }
    if (pngs.length > FRAMES) {
      say('error', 'You selected <strong>' + pngs.length + ' PNGs</strong>. Walk cycles for the game are exactly 8 frames, so please choose no more than 8.');
      return;
    }

    baseName = files[0].name.replace(/\.(png|gif)$/i, '').replace(/[_\-. ]*0*\d+$/, '') || 'walk_cycle';

    if (gifs.length) {
      loadGif(gifs[0]);
    } else {
      pngs.sort(naturalCompare);
      loadPngs(pngs);
    }
  }

  function loadPngs(pngs) {
    Promise.all(pngs.map(loadPng)).then(function (loaded) {
      var bad = loaded.filter(function (l) { return l.w !== FRAME || l.h !== FRAME; });
      if (bad.length) {
        bad.forEach(function (l) {
          say('error', '<strong>' + escapeHtml(l.name) + '</strong> is ' + l.w + '&times;' + l.h + 'px. Every frame must be exactly 800&times;800px.');
        });
        return;
      }
      acceptFrames(loaded.map(function (l) { return { data: l.data, label: l.name }; }));
    }).catch(function (err) {
      say('error', 'One of those files couldn&rsquo;t be read as a PNG. ' + escapeHtml(String(err && err.message || err)));
    });
  }

  function loadPng(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, data = null;
        if (w === FRAME && h === FRAME) {
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          var cx = cv.getContext('2d');
          cx.drawImage(img, 0, 0);
          data = cx.getImageData(0, 0, w, h);
        }
        URL.revokeObjectURL(url);
        resolve({ name: file.name, w: w, h: h, data: data });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(file.name)); };
      img.src = url;
    });
  }

  function loadGif(file) {
    file.arrayBuffer().then(function (buf) {
      var gif;
      try { gif = decodeGif(new Uint8Array(buf)); }
      catch (e) { say('error', 'That file couldn&rsquo;t be read as a GIF (' + escapeHtml(e.message) + ').'); return; }

      if (gif.width !== FRAME || gif.height !== FRAME) {
        say('error', 'Your GIF is ' + gif.width + '&times;' + gif.height + 'px. It must be exactly 800&times;800px.');
        return;
      }
      if (gif.frames.length > FRAMES) {
        say('error', 'Your GIF has <strong>' + gif.frames.length + ' frames</strong>. Walk cycles for the game are exactly 8 frames &mdash; if your software added held/duplicate frames, re-export with one frame per drawing.');
        return;
      }
      acceptFrames(gif.frames.map(function (d, i) { return { data: d, label: 'GIF frame ' + (i + 1) }; }));
    });
  }

  // ── Validation + thumbnails ───────────────────────────────────────────
  function acceptFrames(list) {
    var opaque = [], cornerWarn = [];
    list.forEach(function (f, i) {
      var t = transparencyInfo(f.data);
      if (!t.anyTransparent) opaque.push(i + 1);
      else if (!t.cornersTransparent) cornerWarn.push(i + 1);
    });

    renderThumbs(list);

    if (opaque.length) {
      say('error', 'Frame' + (opaque.length > 1 ? 's ' : ' ') + opaque.join(', ') + ' ha' + (opaque.length > 1 ? 've' : 's') +
        ' <strong>no transparent pixels</strong>, so the background isn&rsquo;t transparent. Hide your background/paper layer and re-export.');
      return;
    }
    if (list.length < FRAMES) {
      say('error', 'You have <strong>' + list.length + ' of 8 frames</strong>. Walk cycles for the game need exactly 8 &mdash; add the missing frame' + (FRAMES - list.length > 1 ? 's' : '') + ' and try again.');
      return;
    }
    if (cornerWarn.length) {
      say('warn', 'Heads up: the corners of frame' + (cornerWarn.length > 1 ? 's ' : ' ') + cornerWarn.join(', ') +
        ' aren&rsquo;t transparent. That&rsquo;s fine if your character really fills the corners &mdash; otherwise check that your background is hidden.');
    }

    frames = list.map(function (f) { return f.data; });
    say('ok', 'Looks good: 8 frames, 800&times;800px each, with transparency. Check the box below to confirm and build your sprite sheet.');
    updateBuildState();
  }

  function transparencyInfo(img) {
    var d = img.data, w = img.width, h = img.height, any = false;
    for (var i = 3; i < d.length; i += 4) { if (d[i] < 255) { any = true; break; } }
    function a(x, y) { return d[(y * w + x) * 4 + 3]; }
    var corners = a(0, 0) < 255 && a(w - 1, 0) < 255 && a(0, h - 1) < 255 && a(w - 1, h - 1) < 255;
    return { anyTransparent: any, cornersTransparent: corners };
  }

  function renderThumbs(list) {
    framesWrap.innerHTML = '';
    list.forEach(function (f, i) {
      var fig = document.createElement('figure');
      fig.className = 'ssm-thumb';
      var cv = document.createElement('canvas');
      cv.width = FRAME; cv.height = FRAME;
      cv.getContext('2d').putImageData(f.data, 0, 0);
      var cap = document.createElement('figcaption');
      cap.innerHTML = '<strong>' + (i + 1) + '</strong> <span>' + escapeHtml(f.label) + '</span>';
      fig.appendChild(cv);
      fig.appendChild(cap);
      framesWrap.appendChild(fig);
    });
  }

  // ── Build the sheet ───────────────────────────────────────────────────
  function buildSheet() {
    if (frames.length !== FRAMES || !confirmBox.checked) return;
    var sheet = document.createElement('canvas');
    sheet.width = FRAME * FRAMES; sheet.height = FRAME;
    var sx = sheet.getContext('2d');
    frames.forEach(function (f, i) { sx.putImageData(f, i * FRAME, 0); });

    sheet.toBlob(function (blob) {
      if (sheetUrl) URL.revokeObjectURL(sheetUrl);
      sheetUrl = URL.createObjectURL(blob);
      sheetImg.src = sheetUrl;
      downloadA.href = sheetUrl;
      downloadA.download = baseName + '_spritesheet.png';
      result.hidden = false;
      startPreview();
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 'image/png');
  }

  function startPreview() {
    if (previewTimer) clearInterval(previewTimer);
    var cx = previewCv.getContext('2d');
    var tmp = document.createElement('canvas');
    tmp.width = FRAME; tmp.height = FRAME;
    var tx = tmp.getContext('2d');
    var i = 0;
    function draw() {
      tx.putImageData(frames[i], 0, 0);
      cx.clearRect(0, 0, previewCv.width, previewCv.height);
      cx.drawImage(tmp, 0, 0, previewCv.width, previewCv.height);
      i = (i + 1) % FRAMES;
    }
    draw();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      previewTimer = setInterval(draw, 1000 / PREVIEW_FPS);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── Minimal GIF decoder (handles transparency, disposal, interlacing) ──
  function decodeGif(b) {
    if (String.fromCharCode(b[0], b[1], b[2]) !== 'GIF') throw new Error('not a GIF');
    var w = b[6] | (b[7] << 8), h = b[8] | (b[9] << 8);
    var p = 13, gct = null;
    if (b[10] & 0x80) { var n = 2 << (b[10] & 7); gct = b.subarray(p, p + n * 3); p += n * 3; }

    var screen = new Uint8ClampedArray(w * h * 4);
    var out = [];
    var gce = { disposal: 0, transIndex: -1 };

    while (p < b.length) {
      var block = b[p++];
      if (block === 0x3B) break;                     // trailer
      if (block === 0x21) {                          // extension
        var label = b[p++];
        if (label === 0xF9) {
          var packed = b[p + 1];
          gce.disposal = (packed >> 2) & 7;
          gce.transIndex = (packed & 1) ? b[p + 4] : -1;
        }
        while (b[p]) p += b[p] + 1;                  // skip sub-blocks
        p++;
        continue;
      }
      if (block !== 0x2C) throw new Error('unexpected block');

      var ix = b[p] | (b[p + 1] << 8), iy = b[p + 2] | (b[p + 3] << 8);
      var iw = b[p + 4] | (b[p + 5] << 8), ih = b[p + 6] | (b[p + 7] << 8);
      var ip = b[p + 8]; p += 9;
      var ct = gct;
      if (ip & 0x80) { var ln = 2 << (ip & 7); ct = b.subarray(p, p + ln * 3); p += ln * 3; }
      var interlaced = !!(ip & 0x40);
      var minCode = b[p++];

      var chunks = [], total = 0;
      while (b[p]) { chunks.push(b.subarray(p + 1, p + 1 + b[p])); total += b[p]; p += b[p] + 1; }
      p++;
      var data = new Uint8Array(total), off = 0;
      chunks.forEach(function (c) { data.set(c, off); off += c.length; });

      var idx = lzw(minCode, data, iw * ih);
      var saved = gce.disposal === 3 ? screen.slice() : null;

      var rows = rowOrder(ih, interlaced);
      for (var r = 0; r < ih; r++) {
        var y = iy + rows[r];
        if (y >= h) continue;
        for (var c2 = 0; c2 < iw; c2++) {
          var x = ix + c2;
          if (x >= w) continue;
          var ci = idx[r * iw + c2];
          if (ci === gce.transIndex || !ct) continue;
          var o = (y * w + x) * 4;
          screen[o] = ct[ci * 3]; screen[o + 1] = ct[ci * 3 + 1]; screen[o + 2] = ct[ci * 3 + 2]; screen[o + 3] = 255;
        }
      }
      out.push(new ImageData(screen.slice(), w, h));

      if (gce.disposal === 2) {
        for (var yy = iy; yy < Math.min(iy + ih, h); yy++) {
          screen.fill(0, (yy * w + ix) * 4, (yy * w + Math.min(ix + iw, w)) * 4);
        }
      } else if (saved) {
        screen = saved;
      }
      gce = { disposal: 0, transIndex: -1 };
    }
    return { width: w, height: h, frames: out };
  }

  function rowOrder(h, interlaced) {
    var rows = new Array(h), i;
    if (!interlaced) { for (i = 0; i < h; i++) rows[i] = i; return rows; }
    var passes = [[0, 8], [4, 8], [2, 4], [1, 2]], k = 0;
    passes.forEach(function (ps) { for (var y = ps[0]; y < h; y += ps[1]) rows[k++] = y; });
    return rows;
  }

  function lzw(minCodeSize, data, pixelCount) {
    var out = new Uint8Array(pixelCount);
    var clear = 1 << minCodeSize, eoi = clear + 1;
    var codeSize = minCodeSize + 1, codeMask = (1 << codeSize) - 1, next = clear + 2;
    var prefix = new Int16Array(4096), suffix = new Uint8Array(4096), stack = new Uint8Array(4097);
    for (var i = 0; i < clear; i++) { prefix[i] = -1; suffix[i] = i; }
    var old = -1, first = 0, datum = 0, bits = 0, op = 0, pi = 0;

    while (op < pixelCount) {
      while (bits < codeSize) {
        if (pi >= data.length) return out;
        datum |= data[pi++] << bits; bits += 8;
      }
      var code = datum & codeMask;
      datum >>>= codeSize; bits -= codeSize;

      if (code === clear) { codeSize = minCodeSize + 1; codeMask = (1 << codeSize) - 1; next = clear + 2; old = -1; continue; }
      if (code === eoi) break;
      if (old === -1) { out[op++] = suffix[code]; old = code; first = code; continue; }

      var inCode = code, sp = 0;
      if (code >= next) { stack[sp++] = first; code = old; }
      while (code >= clear) { stack[sp++] = suffix[code]; code = prefix[code]; }
      first = suffix[code];
      stack[sp++] = first;

      if (next < 4096) {
        prefix[next] = old; suffix[next] = first; next++;
        if ((next & codeMask) === 0 && next < 4096) { codeSize++; codeMask = (1 << codeSize) - 1; }
      }
      old = inCode;
      while (sp > 0 && op < pixelCount) out[op++] = stack[--sp];
    }
    return out;
  }

  // ── Wire up UI ────────────────────────────────────────────────────────
  fileInput.addEventListener('change', function () { handleFiles(fileInput.files); });
  confirmBox.addEventListener('change', updateBuildState);
  buildBtn.addEventListener('click', buildSheet);
  resetBtn.addEventListener('click', function () { resetAll(); confirmBox.checked = false; updateBuildState(); });

  ['dragenter', 'dragover'].forEach(function (ev) {
    dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.add('is-over'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dropZone.addEventListener(ev, function (e) { e.preventDefault(); dropZone.classList.remove('is-over'); });
  });
  dropZone.addEventListener('drop', function (e) { handleFiles(e.dataTransfer.files); });

  updateBuildState();
})();
