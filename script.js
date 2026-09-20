'use strict';

(function () {
  /* ---------- ユーティリティ ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const nf = (x, sig = 4) =>
    Number(x).toLocaleString('ja-JP', { maximumSignificantDigits: sig });
  const trimNum = (x, digits) => String(Number(x.toFixed(digits)));

  /** 秒 → 「2分30秒」などの読みやすい文字列 */
  function fmtTime(s) {
    if (!isFinite(s)) return '—';
    if (s < 0.001) return '0.001秒より短い';
    if (s < 1) return trimNum(s, s < 0.01 ? 3 : 2) + '秒';
    const r = Math.round(s * 10) / 10;
    if (r < 60) return trimNum(r, 1) + '秒';
    const t = Math.round(s);
    const d = Math.floor(t / 86400);
    const h = Math.floor((t % 86400) / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = t % 60;
    if (t < 3600) return m + '分' + (sec ? sec + '秒' : '');
    if (t < 86400) return h + '時間' + (m ? m + '分' : '');
    return d + '日' + (h ? h + '時間' : '');
  }

  /** MB → 「4 MB」「10 KB」「2 GB」 */
  function fmtData(mb) {
    if (mb < 1) return nf(mb * 1000, 3) + ' KB';
    if (mb >= 1e6) return nf(mb / 1e6, 3) + ' TB';
    if (mb >= 1000) return nf(mb / 1000, 3) + ' GB';
    return nf(mb, 3) + ' MB';
  }

  /** Mbps → 「56 kbps」「30 Mbps」「1 Gbps」 */
  function fmtSpeed(mbps) {
    if (mbps < 1) return nf(mbps * 1000, 3) + ' kbps';
    if (mbps >= 1000) return nf(mbps / 1000, 3) + ' Gbps';
    return nf(mbps, 3) + ' Mbps';
  }

  /* =========================================================
     A. 8個のスイッチ（1バイト）
     ========================================================= */
  function initBits() {
    const box = $('#bits');
    if (!box) return;
    const weights = [128, 64, 32, 16, 8, 4, 2, 1];
    let value = 65; // 'A'

    box.innerHTML = weights
      .map(
        (w) =>
          `<div class="bit"><button type="button" class="sw" data-w="${w}"></button><span>${w}</span></div>`
      )
      .join('');
    const buttons = $$('.sw', box);

    function describeChar(v) {
      if (v === 32) return '（空白）';
      if (v > 32 && v < 127) return String.fromCharCode(v);
      if (v < 32 || v === 127) return '（制御用の記号）';
      return '（この表にはない）';
    }

    function update() {
      buttons.forEach((b) => {
        const w = Number(b.dataset.w);
        const on = (value & w) !== 0;
        b.textContent = on ? '1' : '0';
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', `${w}の位、いま${on ? 'ON（1）' : 'OFF（0）'}`);
      });
      $('#roBin').textContent = value.toString(2).padStart(8, '0');
      $('#roDec').textContent = String(value);
      $('#roChar').textContent = describeChar(value);
    }

    box.addEventListener('click', (e) => {
      const b = e.target.closest('.sw');
      if (!b) return;
      value ^= Number(b.dataset.w);
      update();
    });
    update();
  }

  /* =========================================================
     B. 単位の換算
     ========================================================= */
  const UNITS = ['bit', 'B', 'KB', 'MB', 'GB', 'TB'];
  // 各単位が何bitか（base = 1000 または 1024）
  const bitsPer = (i, base) => (i === 0 ? 1 : 8 * Math.pow(base, i - 1));

  function initConverter() {
    const val = $('#cvVal');
    if (!val) return;
    const from = $('#cvFrom');
    const to = $('#cvTo');
    const out = $('#cvOut');
    const path = $('#cvPath');

    const opts = UNITS.map((u, i) => `<option value="${i}">${u}</option>`).join('');
    from.innerHTML = opts;
    to.innerHTML = opts;
    from.value = '3'; // MB
    to.value = '0'; // bit

    function run() {
      const v = parseFloat(val.value);
      const base = Number($('input[name="base"]:checked').value);
      const f = Number(from.value);
      const t = Number(to.value);

      if (!isFinite(v) || v < 0) {
        out.textContent = '0以上の数を入れてください';
        path.textContent = '';
        return;
      }
      const res = (v * bitsPer(f, base)) / bitsPer(t, base);
      out.textContent = `${nf(Number(res.toPrecision(12)), 12)} ${UNITS[t]}`;

      let text = UNITS[f];
      if (f > t) {
        for (let j = f; j > t; j--) {
          text += ` ─×${nf(bitsPer(j, base) / bitsPer(j - 1, base))}→ ${UNITS[j - 1]}`;
        }
      } else if (f < t) {
        for (let j = f; j < t; j++) {
          text += ` ─÷${nf(bitsPer(j + 1, base) / bitsPer(j, base))}→ ${UNITS[j + 1]}`;
        }
      } else {
        text = '同じ単位なので、そのままです。';
      }
      path.textContent = text;
    }

    [val, from, to].forEach((el) => el.addEventListener('input', run));
    $$('input[name="base"]').forEach((el) => el.addEventListener('change', run));
    run();
  }

  /* =========================================================
     C. ダウンロード体験シミュレーター
     ========================================================= */
  const FILES = [
    { id: 'mail', icon: '✉️', name: 'メール（文字だけ）', mb: 0.01 },
    { id: 'photo', icon: '📷', name: '写真1枚', mb: 4 },
    { id: 'music', icon: '🎵', name: '音楽1曲', mb: 5 },
    { id: 'video', icon: '🎬', name: '動画（1分）', mb: 100 },
    { id: 'movie', icon: '🍿', name: '映画1本', mb: 2000 },
    { id: 'game', icon: '🎮', name: 'ゲーム', mb: 8000 },
  ];
  const LINES = [
    { id: 'dial', name: 'むかしの電話回線', mbps: 0.056 },
    { id: '3g', name: '3G', mbps: 3 },
    { id: '4g', name: '4G', mbps: 30 },
    { id: '5g', name: '5G', mbps: 300 },
    { id: 'fiber', name: '光ファイバー', mbps: 1000 },
  ];

  // スライダー（0〜1000）⇔ 速さ（0.05〜2000 Mbps）の対数変換
  const LMIN = Math.log10(0.05);
  const LMAX = Math.log10(2000);
  const sliderToSpeed = (v) => Math.pow(10, LMIN + (v / 1000) * (LMAX - LMIN));
  const speedToSlider = (s) => Math.round(((Math.log10(s) - LMIN) / (LMAX - LMIN)) * 1000);

  // アニメーションの長さ（秒）。長い時間は早送りで見せる
  function animDuration(sec) {
    if (sec <= 0.8) return 0.8;
    if (sec <= 4) return sec;
    return 4 + 3 * clamp(Math.log10(sec / 4) / 5, 0, 1);
  }

  function initLab() {
    const stage = $('#stage');
    if (!stage) return;

    const el = {
      fileChips: $('#fileChips'),
      lineChips: $('#lineChips'),
      fileNum: $('#fileNum'),
      fileUnit: $('#fileUnit'),
      fileMsg: $('#fileMsg'),
      speedRange: $('#speedRange'),
      speedOut: $('#speedOut'),
      timeBig: $('#timeBig'),
      timeSub: $('#timeSub'),
      goBtn: $('#goBtn'),
      status: $('#status'),
      water: $('#water'),
      stream: $('#stream'),
      hoseIn: $('#hoseIn'),
      hoseOut: $('#hoseOut'),
      capLine: $('#capLine'),
      capFile: $('#capFile'),
      calcSteps: $('#calcSteps'),
      cmp: $('#cmp'),
    };

    const state = { mb: 4, fileName: '写真1枚', mbps: 30 };
    let raf = 0;

    /* ----- チップ（ラジオボタン）をつくる ----- */
    el.fileChips.innerHTML = FILES.map(
      (f) =>
        `<label class="chip"><input type="radio" name="file" value="${f.id}"><span class="chip-face"><span class="chip-main">${f.icon} ${f.name}</span><small>${fmtData(f.mb)}</small></span></label>`
    ).join('');
    el.lineChips.innerHTML = LINES.map(
      (l) =>
        `<label class="chip"><input type="radio" name="line" value="${l.id}"><span class="chip-face"><span class="chip-main">${l.name}</span><small>${fmtSpeed(l.mbps)}</small></span></label>`
    ).join('');

    const setChecked = (name, id) =>
      $$(`input[name="${name}"]`).forEach((r) => (r.checked = r.value === id));

    /* ----- 入力欄・スライダーの同期 ----- */
    function setFileInputs(mb) {
      let unit = 1;
      if (mb < 1) unit = 0.001;
      else if (mb >= 1e6) unit = 1e6;
      else if (mb >= 1000) unit = 1000;
      el.fileUnit.value = String(unit);
      el.fileNum.value = String(Number((mb / unit).toPrecision(6)));
    }

    /* ----- 表示の更新 ----- */
    function render() {
      const mbs = state.mbps / 8; // MB/秒
      const sec = state.mb / mbs;

      el.timeBig.textContent = fmtTime(sec);
      el.timeSub.textContent = sec >= 60 ? `＝ ${nf(Math.round(sec), 12)} 秒` : '';
      el.speedOut.textContent = fmtSpeed(state.mbps);
      el.capFile.textContent = `${state.fileName} ＝ ${fmtData(state.mb)}`;
      el.capLine.textContent = fmtSpeed(state.mbps);

      // ホースの太さ：速いほど太い
      const w = 6 + 24 * clamp((Math.log10(state.mbps) + 1.3) / 4.6, 0, 1);
      el.hoseIn.setAttribute('stroke-width', w.toFixed(1));
      el.hoseOut.setAttribute('stroke-width', (w + 6).toFixed(1));
      el.stream.setAttribute('stroke-width', Math.max(4, w * 0.55).toFixed(1));

      // 計算のようす
      const dataText = fmtData(state.mb);
      const mbText = `${nf(state.mb)} MB`;
      const speedNote =
        state.mbps < 1 || state.mbps >= 1000
          ? `${fmtSpeed(state.mbps)} ＝ ${nf(state.mbps)} Mbps ÷ 8`
          : `${nf(state.mbps)} Mbps ÷ 8`;
      el.calcSteps.innerHTML = `
        <li><span class="cs-label">ファイルの大きさを MB にそろえる</span>
            <span class="cs-eq">${dataText === mbText ? mbText : `${dataText} ＝ ${mbText}`}</span></li>
        <li><span class="cs-label">回線の速さ（Mbps）を 8 でわって、1秒に何MBか出す</span>
            <span class="cs-eq">${speedNote} ＝ ${nf(mbs)} MB/秒</span></li>
        <li><span class="cs-label">データ量 ÷ 1秒に送れる量 ＝ 時間</span>
            <span class="cs-eq cs-eq--answer">${nf(state.mb)} ÷ ${nf(mbs)} ＝ ${nf(sec)} 秒</span></li>`;

      // ほかの回線とくらべる
      el.cmp.innerHTML = LINES.map((l) => {
        const t = state.mb / (l.mbps / 8);
        const p = clamp((Math.log10(t) + 2) / 8, 0.02, 1) * 100;
        const cur = l.mbps === state.mbps ? ' is-current' : '';
        return `<li class="cmp-row${cur}"><span class="cmp-name">${l.name}<small>${fmtSpeed(l.mbps)}</small></span><span class="cmp-bar"><i style="width:${p.toFixed(1)}%"></i></span><span class="cmp-time">${fmtTime(t)}</span></li>`;
      }).join('');
    }

    /* ----- 水のアニメーション ----- */
    function setLevel(p) {
      const h = 124 * p; // バケツの中の高さ
      const y = 292 - h;
      el.water.setAttribute('y', y.toFixed(1));
      el.water.setAttribute('height', h.toFixed(1));
      el.stream.setAttribute('y2', y.toFixed(1));
    }

    function stopAnim() {
      cancelAnimationFrame(raf);
      stage.classList.remove('is-running');
      setLevel(0);
      el.goBtn.disabled = false;
      el.goBtn.textContent = 'ダウンロードスタート';
      el.status.textContent = '';
    }

    function finish(sec) {
      cancelAnimationFrame(raf);
      stage.classList.remove('is-running');
      setLevel(1);
      el.goBtn.disabled = false;
      el.goBtn.textContent = 'もういちど';
      el.status.textContent = `かんりょう！ ほんとうは ${fmtTime(sec)} かかるよ。`;
    }

    function start() {
      cancelAnimationFrame(raf);
      const sec = state.mb / (state.mbps / 8);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finish(sec);
        return;
      }
      const dur = animDuration(sec) * 1000;
      const ratio = sec / (dur / 1000);
      const mode = ratio > 1.5 ? '早送り' : ratio < 0.67 ? 'スロー再生' : 'ほぼ本物の速さ';

      stage.classList.add('is-running');
      el.goBtn.disabled = true;
      el.goBtn.textContent = 'ダウンロード中…';
      const t0 = performance.now();

      const tick = (now) => {
        const p = clamp((now - t0) / dur, 0, 1);
        setLevel(p);
        el.status.textContent = `たまった量 ${Math.floor(p * 100)}%　けいかした時間 ${fmtTime(sec * p)}（${mode}）`;
        if (p < 1) raf = requestAnimationFrame(tick);
        else finish(sec);
      };
      raf = requestAnimationFrame(tick);
    }

    function changed() {
      stopAnim();
      render();
    }

    /* ----- イベント ----- */
    el.fileChips.addEventListener('change', (e) => {
      const f = FILES.find((x) => x.id === e.target.value);
      if (!f) return;
      state.mb = f.mb;
      state.fileName = f.name;
      el.fileMsg.textContent = '';
      setFileInputs(f.mb);
      changed();
    });

    el.lineChips.addEventListener('change', (e) => {
      const l = LINES.find((x) => x.id === e.target.value);
      if (!l) return;
      state.mbps = l.mbps;
      el.speedRange.value = String(speedToSlider(l.mbps));
      changed();
    });

    function onFileInput() {
      const n = parseFloat(el.fileNum.value);
      const u = parseFloat(el.fileUnit.value);
      if (!(n > 0)) {
        el.fileMsg.textContent = '0より大きい数を入れてね';
        return;
      }
      el.fileMsg.textContent = '';
      setChecked('file', '');
      state.mb = n * u;
      state.fileName = 'じぶんで入力';
      changed();
    }
    el.fileNum.addEventListener('input', onFileInput);
    el.fileUnit.addEventListener('change', onFileInput);

    el.speedRange.addEventListener('input', () => {
      const sp = Number(sliderToSpeed(Number(el.speedRange.value)).toPrecision(3));
      setChecked('line', '');
      state.mbps = sp;
      changed();
    });

    el.goBtn.addEventListener('click', start);

    /* ----- 初期状態 ----- */
    setChecked('file', 'photo');
    setChecked('line', '4g');
    setFileInputs(state.mb);
    el.speedRange.value = String(speedToSlider(state.mbps));
    setLevel(0);
    render();
  }

  /* ---------- 起動 ---------- */
  initBits();
  initConverter();
  initLab();
})();
