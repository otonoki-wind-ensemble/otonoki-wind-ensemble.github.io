/*
 * 楽団 音ノ樹 HP  表示プログラム
 * ・HP管理シート（Apps Script）からデータを読み込み、ページに表示する
 * ・読み込めないときは、index.html に書いてある基本情報がそのまま表示される
 * ・安全のため、シートの文字は必ず「ただの文字」として表示する（HTMLとしては解釈しない）
 */
(function () {
  'use strict';

  var CONFIG = window.OTONOKI_CONFIG || {};

  /* ---------- 小さな道具 ---------- */
  function $(id) { return document.getElementById(id); }

  // 要素を作る：el('p', {class:'x'}, ['文字', 子要素])
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    });
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === '') return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  // 改行を <br> にして文字として入れる
  function setMultiline(node, text) {
    node.textContent = '';
    String(text).split('\n').forEach(function (line, i) {
      if (i) node.appendChild(document.createElement('br'));
      node.appendChild(document.createTextNode(line));
    });
  }

  // 改行と https のURLだけをリンクにして入れる（それ以外は文字として）
  function setLinked(node, text) {
    node.textContent = '';
    String(text).split('\n').forEach(function (line, i) {
      if (i) node.appendChild(document.createElement('br'));
      line.split(/(https:\/\/[^\s"'<>]+)/).forEach(function (part) {
        if (/^https:\/\//.test(part)) node.appendChild(el('a', { href: part, target: '_blank', rel: 'noopener', text: part }));
        else if (part) node.appendChild(document.createTextNode(part));
      });
    });
  }

  function lines(text) {
    return String(text || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  // https のURLだけ通す
  function safeUrl(u) {
    u = String(u || '').trim();
    return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '';
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---------- メニュー（スマホ） ---------- */
  var menuBtn = $('menuBtn'), menu = $('menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* ---------- トップの背景写真 ---------- */
  if (CONFIG.heroImage && /^[\w\-.\/]+$/.test(CONFIG.heroImage)) {
    var hero = document.querySelector('.hero');
    hero.style.backgroundImage = 'url("images/' + CONFIG.heroImage.replace(/^images\//, '') + '")';
    hero.classList.add('has-photo');
  }

  /* ---------- 読み込み ---------- */
  var MAIN = $('main');
  if (!CONFIG.dataUrl) { showError('データの読み込み先（config.js）が未設定です。'); return; }

  var url = CONFIG.dataUrl + (CONFIG.dataUrl.indexOf('?') < 0 ? '?' : '&') + 'format=json';
  var ctrl = ('AbortController' in window) ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);

  fetch(url, ctrl ? { signal: ctrl.signal } : {})
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      clearTimeout(timer);
      if (!data || !data.ok) throw new Error('data not ok');
      render(data);
      MAIN.classList.remove('is-loading');
      $('status').hidden = true;
    })
    .catch(function (err) {
      clearTimeout(timer);
      if (window.console) console.warn('音ノ樹HP: 読み込み失敗', err);
      showError('情報を読み込めませんでした。時間をおいて、ページを再読み込みしてください。');
    });

  // 読み込めなかったときは、メッセージだけを出す（古い情報を出さない）
  function showError(msg) {
    MAIN.classList.remove('is-loading');
    MAIN.classList.add('is-error');
    var st = $('status');
    st.classList.add('error');
    $('statusText').textContent = msg;
  }

  var PAST_SHOW = 5; // 過去の演奏会を最初に見せる件数（新しい順）

  /* ---------- 表示 ---------- */
  function render(d) {
    var tasks = [renderInfo, renderInfoGroups, renderContact, renderLinks, renderHero, renderStats, renderHistory, renderVoices,
      renderParts, renderNext, renderPast, renderVideo, renderGallery, renderFaq, renderFooter, renderHeadings];
    tasks.forEach(function (fn) {
      try { fn(d); } catch (e) { if (window.console) console.warn('音ノ樹HP: 表示エラー', fn.name, e); }
    });
  }

  // 基本情報：data-info="項目名" の中身をシートの値で置き換える（空ならHTMLの初期値のまま）
  function renderInfo(d) {
    var info = d.info || {};
    var labels = d.labels || {};
    // data-info="団費|月額団費" のように「|」区切りで別名も書ける（先に見つかった方を使う）
    function pick(keys) {
      var list = keys.split('|');
      for (var i = 0; i < list.length; i++) { if (info[list[i]]) return info[list[i]]; }
      return '';
    }
    // 見出し：シートの「項目」をそのまま表示。中身が空なら見出しごと隠す
    document.querySelectorAll('[data-label]').forEach(function (node) {
      var id = node.getAttribute('data-label');
      if (labels[id]) node.textContent = labels[id];
      if (d.labels && !info[id]) node.hidden = true;
    });
    document.querySelectorAll('[data-info]').forEach(function (node) {
      var v = pick(node.getAttribute('data-info'));
      if (!v) { node.hidden = true; return; }
      setMultiline(node, v); // シートの改行をそのまま反映
    });
    document.querySelectorAll('[data-info-list]').forEach(function (node) {
      var items = lines(pick(node.getAttribute('data-info-list')));
      if (!items.length) return;
      clear(node);
      items.forEach(function (t) { node.appendChild(el('li', { text: t })); });
    });
  }

  // 「練習」「費用」などの枠：シートの「区分」ごとに、「項目：内容」を上から順に並べる
  function renderInfoGroups(d) {
    var box = $('infoGroups');
    clear(box);
    (d.infoGroups || []).forEach(function (g) {
      var dl = el('dl', { class: 'dl' });
      g.rows.forEach(function (r) {
        var dd = el('dd');
        setMultiline(dd, r.value);
        dl.appendChild(el('dt', { text: r.label }));
        dl.appendChild(dd);
      });
      box.appendChild(el('div', { class: 'info-card' }, [el('h3', { class: 'sub-title', text: g.title }), dl]));
    });
    box.hidden = !box.children.length;
  }

  // お問い合わせ：フォームのURLがあればフォームへ。なければメール（アドレスは画面に出さない）
  function renderContact(d) {
    var info = d.info || {};
    var a = $('mailLink');
    var form = safeUrl(info['お問い合わせフォームURL']);
    var mail = info['メールアドレス'];
    if (form) {
      a.textContent = 'お問い合わせフォーム';
      a.setAttribute('href', form);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    } else if (mail && /^[^\s@<>"'()]+@[^\s@<>"'()]+\.[^\s@<>"'()]+$/.test(mail)) {
      a.textContent = 'メールで問い合わせる';
      a.setAttribute('href', 'mailto:' + mail);
    } else {
      return;
    }
    $('contact').hidden = false;
  }

  // 見学フォーム・メール
  function renderLinks(d) {
    var info = d.info || {};
    var form = safeUrl(info['見学フォームURL']);
    if (form) {
      document.querySelectorAll('[data-form-link], #formBtn').forEach(function (a) {
        a.setAttribute('href', form);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
      });
    }
    var yt = safeUrl(info['YouTube URL']);
    if (yt) { $('ytLink').setAttribute('href', yt); $('ytLine').hidden = false; }
  }

  function renderHero(d) {
    if (d.next) {
      var n = d.next;
      var box = $('heroNext');
      clear(box);
      box.appendChild(el('p', { class: 'lbl', text: headingTitle(d, 'concerts-next', '次回の演奏会') }));
      box.appendChild(el('p', { class: 'nm', text: n.name }));
      box.appendChild(el('p', { class: 'dt', text: n.date + timeText(n) }));
      box.appendChild(el('p', { class: 'dt', text: n.venue }));
      box.appendChild(el('a', { href: '#concerts', text: '詳しく見る →' }));
      box.hidden = false;
    }
    var open = (d.parts || []).filter(function (p) { return p.status !== '募集停止'; });
    if (open.length) {
      var hp = $('heroParts');
      clear(hp);
      hp.appendChild(el('p', { class: 'lbl', text: '団員募集中のパート' }));
      var chips = el('div', { class: 'chips' });
      open.forEach(function (p) {
        var hot = p.status === '急募';
        chips.appendChild(el('a', { class: 'chip' + (hot ? ' hot' : ''), href: '#recruit', title: hot ? '急募' : null },
          [p.part, hot ? el('span', { class: 'sr-only', text: '（急募）' }) : null]));  // 色の違いだけで示す（読み上げでは「急募」と伝える）
      });
      hp.appendChild(chips);
      hp.hidden = false;
    }
  }

  function timeText(c) {
    var t = [c.open && '開場 ' + c.open, c.start && '開演 ' + c.start].filter(Boolean).join('／');
    if (c.end) t += '（' + c.end + '終演予定）';
    return t ? '　' + t : '';
  }

  function renderStats(d) {
    var past = d.past || [];
    $('statConcerts').textContent = String(past.length);
    var max = 0;
    past.forEach(function (c) { var n = parseInt(String(c.audience).replace(/[^\d]/g, ''), 10); if (n > max) max = n; });
    if (max) $('statAudience').textContent = String(max);
    else $('statAudience').closest('.stat').hidden = true;
  }

  function renderHistory(d) {
    if (!d.history || !d.history.length) return;
    var ol = $('timeline');
    clear(ol);
    d.history.forEach(function (h) {
      var sub = [h.venue, h.audience ? '来場 ' + h.audience + '名' : ''].filter(Boolean).join('　');
      var ttl = el('span', { class: 'ttl' }, [h.title, h.planned ? el('span', { class: 'plan', text: '予定' }) : null]);
      var subNode = sub ? el('span', { class: 'sub', text: sub }) : null;
      var li = el('li', { class: h.kind }, [el('span', { class: 'when', text: h.when })]);
      if (h.kind === 'concert') li.appendChild(el('span', { class: 'box' }, [ttl, subNode]));
      else { li.appendChild(ttl); if (subNode) li.appendChild(subNode); }
      ol.appendChild(li);
    });
  }

  function renderVoices(d) {
    if (!d.voices || !d.voices.length) return;
    var box = $('voiceList');
    clear(box);
    d.voices.forEach(function (v) {
      var p = el('p');
      setMultiline(p, v.comment);
      box.appendChild(el('article', { class: 'voice' }, [p,
        el('p', { class: 'who', text: v.name + '（' + v.part + (v.year ? '・' + v.year + '年入団' : '') + '）' })]));
    });
    $('voices').hidden = false;
  }

  function renderParts(d) {
    var parts = d.parts || [];
    var wrap = $('partsWrap');
    clear(wrap);
    if (!parts.length) { wrap.appendChild(el('p', { class: 'muted', text: '準備中です。' })); return; }
    var hasMembers = parts.some(function (p) { return p.members !== ''; });
    var hasNote = parts.some(function (p) { return p.note !== ''; });
    var badge = { '急募': 'badge hot', '募集中': 'badge', '募集停止': 'badge off' };
    var head = ['楽器', '状況', '募集'].concat(hasMembers ? ['在籍'] : [], ['条件'], hasNote ? ['備考'] : []);
    var thead = el('thead', {}, [el('tr', {}, head.map(function (h, i) {
      return el('th', { scope: 'col', text: h });
    }))]);
    var tbody = el('tbody');
    parts.forEach(function (p) {
      var stop = p.status === '募集停止';
      var cells = [
        el('th', { scope: 'row', text: p.part }),
        el('td', {}, [el('span', { class: badge[p.status] || 'badge', text: p.status })]),
        el('td', { class: 'num', text: stop ? '—' : (p.count ? p.count + '名' : '若干名') }),
      ];
      if (hasMembers) cells.push(el('td', { class: 'num', text: p.members ? p.members + '名' : '' }));
      cells.push(el('td', { text: stop ? '' : p.condition }));
      if (hasNote) cells.push(el('td', { class: 'wrap', text: p.note }));
      tbody.appendChild(el('tr', { class: stop ? 'stopped' : null }, cells));
    });
    wrap.appendChild(el('table', { class: 'parts' }, [thead, tbody]));
  }

  function flyerNode(c) {
    if (!c.flyer || !safeUrl(c.flyer.thumb)) return null;
    return el('a', { class: 'flyer', href: safeUrl(c.flyer.full), target: '_blank', rel: 'noopener' }, [
      el('img', { src: safeUrl(c.flyer.thumb), alt: c.name + ' チラシ', loading: 'lazy', referrerpolicy: 'no-referrer' }),
    ]);
  }

  function programNode(list) {
    var ul = el('ul', { class: 'program' });
    list.forEach(function (p) {
      var by = [p.composer && '作曲：' + p.composer, p.arranger && '編曲：' + p.arranger].filter(Boolean).join('／');
      var u = safeUrl(p.url);
      var title = u
        ? el('a', { href: u, target: '_blank', rel: 'noopener' }, [el('span', { class: 't', text: p.title }), el('span', { class: 'yt', text: '▶ 動画' })])
        : el('span', { text: p.title });
      ul.appendChild(el('li', {}, [title, by ? el('span', { class: 'by', text: by }) : null]));
    });
    return ul;
  }

  function badgeClass(kind) { return 'badge' + (kind === 'fest' ? ' fest' : kind === 'event' ? ' event' : ''); }

  function renderNext(d) {
    var box = $('nextConcert');
    clear(box);
    if (!d.next) { box.appendChild(el('p', { class: 'muted', text: '決まり次第お知らせします。' })); return; }
    var n = d.next;
    var dl = el('dl', { class: 'dl' }, [
      el('dt', { text: '日時' }), el('dd', { text: n.date + timeText(n) }),
      el('dt', { text: '会場' }), el('dd', { text: n.venue }),
    ]);
    if (n.fee) { dl.appendChild(el('dt', { text: '入場料' })); dl.appendChild(el('dd', { text: n.fee })); }
    if (n.notice) { var dd = el('dd', { class: 'notice' }); setLinked(dd, n.notice); dl.appendChild(el('dt', { text: 'ご案内' })); dl.appendChild(dd); }
    var right = el('div', {}, [dl]);
    if (n.program.length) { right.appendChild(el('p', { class: 'prog-title', text: '曲目' })); right.appendChild(programNode(n.program)); }
    else right.appendChild(el('p', { class: 'muted', text: '曲目は決まり次第お知らせします。' }));
    var fl = flyerNode(n);
    box.appendChild(el('div', { class: 'concert-card ' + n.kind }, [
      el('h4', { class: 'c-name', text: n.name }),
      el('div', { class: 'c-body' + (fl ? '' : ' noflyer') }, [fl, right]),
    ]));
    // 次回以降の予定
    var up = $('upcoming');
    clear(up);
    if (d.upcoming && d.upcoming.length) {
      up.className = 'upcoming-list';
      up.appendChild(el('p', { class: 'prog-title', text: 'その後の予定' }));
      d.upcoming.forEach(function (c) {
        up.appendChild(el('div', { class: 'item' }, [el('strong', { text: c.name }), '　' + c.date + '　' + c.venue]));
      });
    }
  }

  function renderPast(d) {
    var box = $('pastList');
    clear(box);
    var past = d.past || [];
    if (!past.length) { box.appendChild(el('p', { class: 'muted', text: 'まだありません。' })); return; }
    past.forEach(function (c, i) {
      var meta = [c.date, c.venue, c.audience ? '来場 ' + c.audience + '名' : ''].filter(Boolean).join('　');
      var fl = flyerNode(c);
      var body = el('div', { class: 'pbody' }, [
        el('p', { class: 'meta', text: meta }),
        el('div', { class: 'c-body' + (fl ? '' : ' noflyer') }, [fl,
          c.program.length ? programNode(c.program) : el('p', { class: 'muted', text: '曲目は準備中です。' })]),
      ]);
      var det = el('details', { class: c.kind }, [
        el('summary', {}, [el('span', { class: 'pdate', text: c.ym }), el('span', { class: 'pname', text: c.name })]),
        body,
      ]);
      // 閉じたとき、見出しが画面の外なら見出しまで戻る
      det.addEventListener('toggle', function () {
        if (!det.open) {
          var top = det.getBoundingClientRect().top;
          if (top < 0) window.scrollBy(0, top - 70);
        }
      });
      if (i >= PAST_SHOW) det.hidden = true;   // 6件目以降は「もっと見る」で開く
      box.appendChild(det);
    });
    // 件数が多いときは、最新の数件だけ見せて「もっと見る」
    var line = $('pastMoreLine'), btn = $('pastMore');
    var rest = past.length - PAST_SHOW;
    if (rest > 0) {
      var open = false;
      var label = function () {
        btn.textContent = open ? '閉じる' : 'すべて見る（あと' + rest + '件）';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      label();
      line.hidden = false;
      btn.onclick = function () {
        open = !open;
        Array.prototype.forEach.call(box.children, function (det, i) { if (i >= PAST_SHOW) det.hidden = !open; });
        label();
        if (!open) {   // 閉じたら一覧の頭に戻る
          var top = box.getBoundingClientRect().top;
          if (top < 0) window.scrollBy(0, top - 80);
        }
      };
    }
  }

  /* ---------- 横に流れる一覧（演奏動画・活動の様子で共通） ----------
   * よく使われる良い作りに合わせる：
   *  ・指でスワイプ／トラックパッドで横に動かせる（ボタンが無くても操作できる）
   *  ・自動で次へ進むが、「一時停止」ボタンでいつでも止められる（WCAG 2.2.2）
   *  ・マウスを乗せている間・キーボードで選んでいる間は止まる
   *  ・指で触った・ボタンを押したなど、自分で操作したら自動送りはやめる
   *  ・画面に見えていない間は進まない
   *  ・端末の「視差効果を減らす（動きを減らす）」が有効なら、自動では動かさない
   *  ・左右の ‹ › は、マウスで操作する端末だけに、目立たない透明な文字で出す
   */
  var REDUCE_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function makeScroller(box, track, opt) {
    opt = opt || {};
    var items = function () { return Array.prototype.slice.call(track.children); };
    var current = 0, timer = null, stopped = false, hovering = false, focused = false, visible = true;
    var onChange = opt.onChange || function () {};

    // いま一番左（または中央）に来ているものの番号
    function nearest() {
      var x = track.scrollLeft, best = 0, bestD = Infinity;
      items().forEach(function (it, i) {
        var d = Math.abs(it.offsetLeft - x);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    }
    function atEnd() { return track.scrollLeft + track.clientWidth >= track.scrollWidth - 4; }

    function go(i, wrap) {
      var list = items();
      if (!list.length) return;
      if (wrap && i >= list.length) i = 0;
      if (wrap && i < 0) i = list.length - 1;
      i = Math.max(0, Math.min(list.length - 1, i));
      current = i;
      track.scrollTo({ left: list[i].offsetLeft, behavior: REDUCE_MOTION ? 'auto' : 'smooth' });
      onChange(current);
    }
    function next() {
      // 最後まで見えていたら最初に戻る
      if (atEnd()) go(0); else go(nearest() + 1);
    }
    function prev() {
      if (track.scrollLeft <= 4) go(items().length - 1); else go(nearest() - 1);
    }

    var scrollTimer;
    track.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var i = nearest();
        if (i !== current) { current = i; onChange(current); }
      }, 120);
    }, { passive: true });

    // ---- 自動送り ----
    var canAuto = !REDUCE_MOTION && items().length > 1;
    var pauseBtn = null;
    function scrollable() { return track.scrollWidth > track.clientWidth + 4; }
    function tick() { if (!hovering && !focused && visible && scrollable()) next(); }
    function start() { if (!stopped && canAuto && !timer) timer = setInterval(tick, opt.interval || 6000); }
    // 全部が1画面に収まっているときは、‹ › と一時停止ボタンを隠す（写真の読み込み後・画面の幅が変わったときに見直す）
    function refresh() {
      var on = scrollable();
      box.classList.toggle('is-static', !on);
      if (pauseBtn) pauseBtn.hidden = !on;
    }
    window.addEventListener('resize', refresh);
    function pause() { clearInterval(timer); timer = null; }
    function stop() {
      stopped = true; pause();
      if (pauseBtn) { pauseBtn.setAttribute('aria-pressed', 'true'); pauseBtn.querySelector('.pp-label').textContent = '自動送りを再開'; }
    }
    function resume() {
      stopped = false;
      if (pauseBtn) { pauseBtn.setAttribute('aria-pressed', 'false'); pauseBtn.querySelector('.pp-label').textContent = '自動送りを一時停止'; }
      start();
    }

    if (items().length > 1) {
      // ‹ › （マウスの端末だけに出す。CSS で切り替え）
      var pv = el('button', { class: 'c-nav c-prev', type: 'button', 'aria-label': opt.prevLabel || '前へ' }, ['‹']);
      var nx = el('button', { class: 'c-nav c-next', type: 'button', 'aria-label': opt.nextLabel || '次へ' }, ['›']);
      pv.addEventListener('click', function () { stop(); prev(); });
      nx.addEventListener('click', function () { stop(); next(); });
      box.appendChild(pv);
      box.appendChild(nx);

      box.addEventListener('mouseenter', function () { hovering = true; });
      box.addEventListener('mouseleave', function () { hovering = false; });
      box.addEventListener('focusin', function () { focused = true; });
      box.addEventListener('focusout', function () { focused = false; });
      // 指で触ったら、その人のペースで見てもらう（自動送りはやめる）
      track.addEventListener('touchstart', function () { stop(); }, { passive: true });
      track.addEventListener('wheel', function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) stop(); }, { passive: true });

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }, { threshold: 0.3 }).observe(track);
      }
    }

    if (canAuto) {
      pauseBtn = el('button', { class: 'c-pause', type: 'button', 'aria-pressed': 'false' }, [
        el('span', { class: 'pp-icon', 'aria-hidden': 'true' }),
        el('span', { class: 'pp-label', text: '自動送りを一時停止' }),
      ]);
      pauseBtn.addEventListener('click', function () { if (stopped) resume(); else stop(); });
      start();
    }
    setTimeout(refresh, 0);

    return { go: go, next: next, prev: prev, stop: stop, refresh: refresh, pauseBtn: pauseBtn };
  }

  // トップの演奏動画：1本ずつ横に切り替える
  function renderVideo(d) {
    var list = (d.topVideos && d.topVideos.length ? d.topVideos : (d.topVideo ? [d.topVideo] : []))
      .filter(function (v) { return v && /^[A-Za-z0-9_-]{11}$/.test(v.id); });
    if (!list.length) return;
    var box = $('videoBox');
    clear(box);
    var track = el('div', { class: 'c-track' });
    var dots = el('div', { class: 'c-dots' });
    var sc;

    list.forEach(function (v, i) {
      var slide = el('div', { class: 'c-slide', role: 'group', 'aria-roledescription': 'slide', 'aria-label': (i + 1) + ' / ' + list.length });
      slide.appendChild(thumb(v, slide));
      track.appendChild(slide);
      if (list.length > 1) {
        var dot = el('button', { class: 'c-dot', type: 'button', 'aria-label': (i + 1) + '本目の動画へ' });
        dot.addEventListener('click', function () { sc.stop(); sc.go(i); });
        dots.appendChild(dot);
      }
    });
    box.appendChild(track);
    $('video').hidden = false;   // 幅を測れるように、先に表示する

    // サムネイル（押すと再生）。ページを軽くするため、最初は画像だけ出す
    function thumb(v, slide) {
      var b = el('button', { class: 'c-thumb', type: 'button', 'aria-label': v.title + ' を再生' }, [
        el('img', { src: 'https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg', alt: '', loading: 'lazy' }),
        el('span', { class: 'c-play', 'aria-hidden': 'true' }),
        v.title ? el('span', { class: 'c-title', text: v.title }) : null,
      ]);
      b.addEventListener('click', function () {
        if (sc) sc.stop();
        var src = 'https://www.youtube-nocookie.com/embed/' + v.id + '?autoplay=1' + (v.start ? '&start=' + parseInt(v.start, 10) : '');
        var frame = el('div', { class: 'frame' }, [el('iframe', {
          src: src, title: v.title, allowfullscreen: '',
          allow: 'autoplay; accelerometer; encrypted-media; gyroscope; picture-in-picture',
        })]);
        slide.replaceChild(frame, b);
        slide._video = v;
      });
      return b;
    }

    // 再生中の動画は、別の動画に切り替えたら止める（サムネイルに戻す）
    function onChange(cur) {
      Array.prototype.forEach.call(dots.children, function (dt, i) { dt.classList.toggle('on', i === cur); });
      Array.prototype.forEach.call(track.children, function (s, i) {
        if (i !== cur && s._video) {
          var v = s._video; s._video = null;
          clear(s); s.appendChild(thumb(v, s));
        }
      });
    }

    sc = makeScroller(box, track, { interval: 6000, onChange: onChange, prevLabel: '前の動画', nextLabel: '次の動画' });
    if (list.length > 1) {
      var bar = el('div', { class: 'c-bar' }, [dots, sc.pauseBtn]);
      box.appendChild(bar);
      onChange(0);
    }
  }

  // 活動の様子：写真を元の形（縦長・横長）のまま横に並べ、ゆっくり自動で送る。タップで大きく表示
  function renderGallery(d) {
    if (!d.photos || !d.photos.length) return;
    var box = $('galleryList');
    clear(box);
    var track = el('div', { class: 'g-track' });
    var photos = [], sc = null;
    d.photos.forEach(function (p) {
      var thumbUrl = safeUrl(p.thumb);
      if (!thumbUrl) return;
      var idx = photos.length;
      photos.push({ thumb: thumbUrl, large: safeUrl(p.large) || thumbUrl, caption: p.caption || '' });
      var img = el('img', { src: thumbUrl, alt: p.caption || '活動の様子', loading: idx < 3 ? 'eager' : 'lazy', referrerpolicy: 'no-referrer', decoding: 'async' });
      img.addEventListener('load', function () { fig.classList.add('loaded'); if (sc) sc.refresh(); });
      var btn = el('button', { class: 'g-open', type: 'button', 'aria-label': (p.caption || '写真') + ' を大きく表示' }, [img]);
      btn.addEventListener('click', function () { sc.stop(); openLightbox(photos, idx, btn); });
      var fig = el('figure', { class: 'g-item' }, [btn, p.caption ? el('figcaption', { class: 'g-cap', text: p.caption }) : null]);
      track.appendChild(fig);
    });
    if (!photos.length) return;
    box.appendChild(track);
    $('gallery').hidden = false;
    sc = makeScroller(box, track, { interval: 4000, prevLabel: '前の写真', nextLabel: '次の写真' });
    if (sc.pauseBtn) box.appendChild(el('div', { class: 'c-bar g-bar' }, [sc.pauseBtn]));
  }

  /* ---------- 写真を大きく見る画面（ライトボックス） ----------
   * ・画面いっぱいに暗くして、写真だけを元の形のまま大きく表示
   * ・閉じる：× ボタン／Esc キー／写真の外側をタップ／下にスワイプ
   * ・前後の写真：‹ › ボタン／← → キー／左右にスワイプ
   * ・「3 / 8」のように何枚目かを表示。説明があれば下に表示
   * ・開いている間は、うしろのページが動かない。閉じたら元の写真に戻る
   */
  var LB = null;
  function openLightbox(photos, index, opener) {
    if (!LB) LB = buildLightbox();
    LB.photos = photos; LB.opener = opener;
    LB.show(index);
    document.documentElement.classList.add('lb-open');
    if (LB.dlg.showModal) LB.dlg.showModal(); else LB.dlg.setAttribute('open', '');
    LB.closeBtn.focus();
  }
  function buildLightbox() {
    var img = el('img', { class: 'lb-img', alt: '', referrerpolicy: 'no-referrer' });
    var cap = el('p', { class: 'lb-cap' });
    var count = el('p', { class: 'lb-count', 'aria-live': 'polite' });
    var closeBtn = el('button', { class: 'lb-close', type: 'button', 'aria-label': '閉じる' }, ['×']);
    var pv = el('button', { class: 'lb-nav lb-prev', type: 'button', 'aria-label': '前の写真' }, ['‹']);
    var nx = el('button', { class: 'lb-nav lb-next', type: 'button', 'aria-label': '次の写真' }, ['›']);
    var stage = el('div', { class: 'lb-stage' }, [img]);
    var dlg = el('dialog', { class: 'lightbox', 'aria-label': '写真を大きく表示' }, [
      el('div', { class: 'lb-top' }, [count, closeBtn]), stage, pv, nx, cap,
    ]);
    document.body.appendChild(dlg);
    var lb = { dlg: dlg, closeBtn: closeBtn, photos: [], i: 0, opener: null };

    lb.show = function (i) {
      var n = lb.photos.length;
      lb.i = (i + n) % n;
      var p = lb.photos[lb.i];
      // まず軽い画像を出し、大きい画像が届いたら差し替える
      img.src = p.thumb;
      img.alt = p.caption || '活動の様子';
      if (p.large && p.large !== p.thumb) {
        var big = new Image();
        big.referrerPolicy = 'no-referrer';
        big.onload = function () { if (lb.photos[lb.i] === p) img.src = p.large; };
        big.src = p.large;
      }
      cap.textContent = p.caption || '';
      cap.hidden = !p.caption;
      count.textContent = n > 1 ? (lb.i + 1) + ' / ' + n : '';
      pv.hidden = nx.hidden = n < 2;
      // 前後の写真を先に読んでおく（めくったときに待たない）
      [lb.i + 1, lb.i - 1].forEach(function (k) {
        var q = lb.photos[(k + n) % n];
        if (q && q.large) { var pre = new Image(); pre.referrerPolicy = 'no-referrer'; pre.src = q.large; }
      });
    };
    function close() { if (dlg.open) { if (dlg.close) dlg.close(); else { dlg.removeAttribute('open'); onClosed(); } } }
    function onClosed() {
      document.documentElement.classList.remove('lb-open');
      if (lb.opener) lb.opener.focus({ preventScroll: true });
    }
    dlg.addEventListener('close', onClosed);
    closeBtn.addEventListener('click', close);
    pv.addEventListener('click', function () { lb.show(lb.i - 1); });
    nx.addEventListener('click', function () { lb.show(lb.i + 1); });
    // 写真の外側（暗いところ）をタップしたら閉じる
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target === stage) close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); lb.show(lb.i - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); lb.show(lb.i + 1); }
    });
    // スワイプ：左右でめくる、下で閉じる
    var sx = 0, sy = 0, touching = false;
    dlg.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { touching = false; return; }   // 2本指（拡大）のときは何もしない
      touching = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    dlg.addEventListener('touchend', function (e) {
      if (!touching) return;
      touching = false;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && lb.photos.length > 1) lb.show(lb.i + (dx < 0 ? 1 : -1));
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) close();
    }, { passive: true });
    return lb;
  }

  function renderFaq(d) {
    if (!d.faq || !d.faq.length) return;
    var box = $('faqList');
    clear(box);
    d.faq.forEach(function (f) {
      var p = el('p');
      setMultiline(p, f.a);
      box.appendChild(el('details', {}, [el('summary', { text: f.q }), p]));
    });
  }

  function headingTitle(d, id, fallback) {
    var h = d.headings && d.headings.items && d.headings.items[id];
    return (h && h.title) || fallback;
  }

  // 見出し：シートの「見出し」タブの名前を、各セクションとメニューに反映（同じ名前になる）
  function renderHeadings(d) {
    var items = (d.headings && d.headings.items) || {};
    document.querySelectorAll('[data-heading]').forEach(function (node) {
      var h = items[node.getAttribute('data-heading')];
      if (!h) return;
      clear(node);
      if (h.en) node.appendChild(el('span', { class: 'en', text: h.en }));
      node.appendChild(document.createTextNode(h.title));
    });
    var menuIds = d.headings && d.headings.menu;
    if (!menuIds || !menuIds.length) return;
    var menu = $('menu'), cta = menu.querySelector('.cta-link');
    Array.prototype.slice.call(menu.querySelectorAll('a:not(.cta-link)')).forEach(function (a) { menu.removeChild(a); });
    menuIds.forEach(function (id) {
      var sec = $(id);
      if (!sec || sec.hidden || !items[id]) return;   // 表示していないセクションはメニューに出さない
      menu.insertBefore(el('a', { href: '#' + id, text: items[id].title }), cta);
    });
  }

  // SNSリンク：images/sns-x.png などがあればアイコン、なければ文字で表示
  var SNS = [
    ['X', 'X URL', 'sns-x.png'],
    ['Instagram', 'Instagram URL', 'sns-instagram.png'],
    ['YouTube', 'YouTube URL', 'sns-youtube.png'],
  ];
  function snsInto(box, info) {
    clear(box);
    SNS.forEach(function (s) {
      var u = safeUrl(info[s[1]]);
      if (!u) return;
      var img = el('img', { src: 'images/' + s[2], alt: s[0], width: '24', height: '24' });
      var a = el('a', { href: u, target: '_blank', rel: 'noopener', 'aria-label': s[0] + '（新しいタブで開く）', title: s[0] }, [img]);
      img.addEventListener('error', function () { a.textContent = s[0]; a.classList.add('text'); });
      box.appendChild(a);
    });
  }

  function renderFooter(d) {
    var info = d.info || {};
    snsInto($('sns'), info);
    snsInto($('navSns'), info);
  }
})();
