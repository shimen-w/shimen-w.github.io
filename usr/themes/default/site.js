/* 站点交互：评论异步提交、搜索框保留关键词、代码块复制。
   渐进增强 —— 禁用 JS 时表单仍可正常提交（服务端 303 回跳）。 */
(function () {
  'use strict';

  // 1) header search → route to the client-side search page
  var searchForm = document.getElementById('search');
  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = searchForm.querySelector('input[name=s]') || searchForm.querySelector('input');
      var q = input ? input.value.trim() : '';
      location.href = '/search/' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
  }

  // 2) keep the search term visible in the input
  var params = new URLSearchParams(location.search);
  var q = params.get('s');
  if (q) {
    var box = document.getElementById('s');
    if (box) box.value = q;
  }

  // 3) async comment submission
  var form = document.getElementById('comment-form');
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var status = document.getElementById('comment-status');
      var btn = form.querySelector('button[type=submit]');
      var payload = {
        author: form.author.value.trim(),
        mail: form.mail.value.trim(),
        url: form.url.value.trim(),
        text: form.text.value.trim(),
        parent: form.parent ? form.parent.value : 0,
      };
      if (!payload.author || !payload.text) {
        show(status, '称呼和内容不能为空。', false);
        return;
      }
      btn.disabled = true;
      var original = btn.textContent;
      btn.textContent = '提交中…';
      try {
        var res = await fetch(location.pathname.replace(/\/$/, '') + '/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) throw new Error(data.message || '提交失败');
        show(status, '评论已发布，正在刷新…', true);
        form.reset();
        setTimeout(function () { location.hash = 'comments'; location.reload(); }, 600);
      } catch (err) {
        show(status, err.message || '提交失败，请稍后再试。', false);
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  function show(el, msg, ok) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'comment-status ' + (ok ? 'ok' : 'bad');
    el.hidden = false;
  }

  // 3) copy button on code blocks
  document.querySelectorAll('.post-content pre').forEach(function (pre) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.textContent = '复制';
    btn.style.cssText = 'position:absolute;top:.5rem;right:.5rem;font-size:.75rem;padding:.2rem .5rem;'
      + 'border:1px solid rgba(255,255,255,.35);border-radius:4px;background:rgba(255,255,255,.12);'
      + 'color:#e6edf5;cursor:pointer;opacity:0;transition:opacity .15s';
    pre.style.position = 'relative';
    pre.addEventListener('mouseenter', function () { btn.style.opacity = '1'; });
    pre.addEventListener('mouseleave', function () { btn.style.opacity = '0'; });
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(pre.innerText).then(function () {
        btn.textContent = '已复制';
        setTimeout(function () { btn.textContent = '复制'; }, 1500);
      });
    });
    pre.appendChild(btn);
  });

  // 4) smooth-scroll to the comment form when arriving with #respond
  if (location.hash.indexOf('respond') === 0) {
    var t = document.getElementById(location.hash.slice(1));
    if (t) setTimeout(function () { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120);
  }

  // 5) auto-height the embedded lecture iframe (same-origin, so we can read its size)
  document.querySelectorAll('.lesson-frame').forEach(function (frame) {
    function resize() {
      var win, doc, h;
      try {
        win = frame.contentWindow;
        doc = frame.contentDocument || (win && win.document);
        h = doc ? (doc.documentElement.scrollHeight || doc.body.scrollHeight) : 0;
      } catch (e) { return 0; }
      if (h) frame.style.height = Math.max(h, 480) + 'px';
      return h;
    }
    var settled = 0;
    var iv = setInterval(function () {
      resize();
      var win;
      try { win = frame.contentWindow; } catch (e) { clearInterval(iv); return; }
      // the lecture flips window.__mathjaxReady after MathJax finishes; settle a beat after that
      if (win && win.__mathjaxReady) { settled++; if (settled >= 3) clearInterval(iv); }
      else settled = 0;
    }, 350);
    frame.addEventListener('load', function () { resize(); });
    setTimeout(function () { clearInterval(iv); resize(); }, 30000); // hard safety cap
  });

  // 6) learning path: completion toggles (localStorage) + progress bar + "继续学习"
  var items = document.querySelectorAll('.lp-item');
  if (items.length) {
    var KEY = 'lp-done';
    var done;
    try { done = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { done = []; }
    var total = items.length;
    var fill = document.getElementById('lp-progress-fill');
    var text = document.getElementById('lp-progress-text');

    function refresh() {
      var n = 0;
      items.forEach(function (li) {
        var id = li.getAttribute('data-id');
        var on = done.indexOf(id) !== -1;
        li.classList.toggle('is-done', on);
        var btn = li.querySelector('.lp-toggle');
        if (btn) { btn.textContent = on ? '✓ 已完成' : '标记完成'; btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
        if (on) n++;
      });
      if (fill) fill.style.width = (total ? (n / total) * 100 : 0) + '%';
      if (text) text.textContent = n + ' / ' + total;
    }

    items.forEach(function (li) {
      var btn = li.querySelector('.lp-toggle');
      if (btn) btn.addEventListener('click', function () {
        var id = li.getAttribute('data-id');
        var i = done.indexOf(id);
        if (i === -1) done.push(id); else done.splice(i, 1);
        try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {}
        refresh();
      });
    });

    refresh();

    // continue-learning hint
    var last;
    try { last = JSON.parse(localStorage.getItem('lp-last') || 'null'); } catch (e) { last = null; }
    var lastEl = document.getElementById('lp-last');
    if (last && lastEl && last.title && last.id) {
      lastEl.innerHTML = '上次学到：<a href="/index.php/archives/' + last.id + '/">' + esc(last.title) + '</a>';
      lastEl.hidden = false;
    }
  }

  // 7) record "last visited" on any curriculum post (drives the continue-learning hint)
  var curNav = document.querySelector('.curriculum-nav');
  if (curNav) {
    var postTitle = (document.querySelector('.post-title') || {}).textContent || '';
    var postId = (location.pathname.match(/archives\/(\d+)/) || [])[1];
    if (postId && postTitle) {
      try { localStorage.setItem('lp-last', JSON.stringify({ id: postId, title: postTitle.trim() })); } catch (e) {}
    }
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
