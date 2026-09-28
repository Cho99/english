// ===== Trạng thái (lưu trong localStorage) =====
const LEVELS = ["A1", "A2", "B1", "B2"];
const KEY = "english-app-v1";
const DAILY = 10;
const INTERVALS = [1, 2, 4, 7, 15, 30, 60]; // ngày, lặp lại ngắt quãng (Leitner)

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
let S = Object.assign({ level: "A1", learned: {}, days: {}, quizzes: [], writings: [], streak: 0, lastDay: null, readDone: {} }, load());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} renderStats(); };

const today = () => new Date().toLocaleDateString("sv"); // YYYY-MM-DD
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toLocaleDateString("sv"); };
const pid = (lv, i) => `${lv}-${i}`;
const WORD_LV = {}; LEVELS.forEach(lv => WORDS[lv].forEach(w => WORD_LV[w] = lv));
const wid = w => "W:" + w;
const isWord = id => id.startsWith("W:");
const getP = id => {
  if (isWord(id)) { const w = id.slice(2), m = (S.wm || {})[w] || {}; return { id, lv: WORD_LV[w] || "B2", en: w, vi: m.vi || "", ex: m.ex || w, word: true }; }
  const [lv, i] = id.split("-"); const p = PHRASES[lv][+i]; return { id, lv, en: p[0], vi: p[1], ex: p[2] };
};
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => s.toLowerCase().replace(/[^a-z0-9' ]/g, "").replace(/\s+/g, " ").trim();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = s => document.querySelector(s);

// ===== Phát âm (Text-to-Speech) =====
function speak(text, rate = 0.9) {
  if (!window.speechSynthesis) return alert("Trình duyệt không hỗ trợ đọc giọng nói.");
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US"; u.rate = rate;
  const v = speechSynthesis.getVoices().find(v => v.lang.startsWith("en"));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
window.speechSynthesis && speechSynthesis.getVoices();

// ===== 10 cụm từ + N từ mới mỗi ngày =====
function pickWords(n, assignedSet) {
  const out = [];
  for (let li = LEVELS.indexOf(S.wordLevel || S.level); li < LEVELS.length && out.length < n; li++)
    for (const w of WORDS[LEVELS[li]]) { if (out.length >= n) break; const id = wid(w); if (!S.learned[id] && !assignedSet.has(id)) out.push(id); }
  return out;
}
const assignedSet = () => new Set(Object.values(S.days).flatMap(x => x.ids));
function todaysPhrases() {
  const d = today();
  if (!S.days[d]) {
    const picked = [];
    for (let li = LEVELS.indexOf(S.level); li < LEVELS.length && picked.length < DAILY; li++) {
      const lv = LEVELS[li];
      PHRASES[lv].forEach((_, i) => {
        const id = pid(lv, i);
        if (picked.length < DAILY && !S.learned[id] && !assignedSet().has(id)) picked.push(id);
      });
    }
    picked.push(...pickWords(S.wordsPerDay ?? 10, assignedSet()));
    S.days[d] = { ids: picked, done: [] };
    save();
  }
  return S.days[d];
}

function markLearned(id) {
  const d = today();
  if (!S.learned[id]) S.learned[id] = { box: 0, due: addDays(d, 1), date: d, right: 0, wrong: 0 };
  const day = S.days[d];
  if (day && !day.done.includes(id)) day.done.push(id);
  // chuỗi ngày học
  if (S.lastDay !== d) { S.streak = S.lastDay === addDays(d, -1) ? S.streak + 1 : 1; S.lastDay = d; }
  // tự lên trình độ khi học hết cụm từ của level hiện tại
  const lv = S.level;
  if (PHRASES[lv].every((_, i) => S.learned[pid(lv, i)]) && LEVELS.indexOf(lv) < 3) S.level = LEVELS[LEVELS.indexOf(lv) + 1];
  save();
}

function grade(id, ok) {
  const L = S.learned[id]; if (!L) return;
  if (ok) { L.box = Math.min(L.box + 1, INTERVALS.length - 1); L.right++; }
  else { L.box = 0; L.wrong++; }
  L.due = addDays(today(), INTERVALS[L.box]);
  save();
}

// ===== Giao diện =====
function renderStats() {
  const n = Object.keys(S.learned).length;
  const due = Object.values(S.learned).filter(l => l.due <= today()).length;
  $("#stats").innerHTML = `<span class="chip"><span class="badge ${S.level}">${S.level}</span> Trình độ</span>
    <span class="chip">🔥 ${S.streak} ngày</span><span class="chip">📚 ${n.toLocaleString()} đã học</span>`;
  $("#dueBadge").textContent = due || "";
  const day = S.days[today()], done = day ? day.done.length : 0, tot = day ? day.ids.length : 0;
  $("#sideCard").innerHTML = `Mục tiêu hôm nay<b>${done}/${tot}</b><div class="bar"><div style="width:${tot ? done / tot * 100 : 0}%"></div></div>
    <div style="margin-top:8px;opacity:.9">🔁 ${due} mục cần ôn</div>`;
}
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1800);
}
const TITLES = {
  today: ["Hôm nay", "Bài học mỗi ngày của bạn"], review: ["Ôn tập", "Lặp lại ngắt quãng giúp nhớ lâu"], vocab: ["Từ vựng", "Thống kê, kho từ & tra từ online"],
  listen: ["Luyện nghe", "Nghe & chép chính tả"], speak: ["Luyện nói", "Phát âm & nói tự do"], read: ["Luyện đọc", "Bài đọc theo trình độ"],
  write: ["Luyện viết", "Viết mỗi ngày, nhận xét tự động"], grammar: ["Ngữ pháp", "Điểm ngữ pháp trọng tâm A1–B2"],
  quiz: ["Kiểm tra tuần", "Bài kiểm tra cuối tuần"], progress: ["Tiến độ", "Hành trình học của bạn"]
};

const views = {};
let current = "today";
function show(tab) {
  current = tab;
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  $("#pageTitle").textContent = TITLES[tab][0]; $("#pageSub").textContent = TITLES[tab][1];
  window.scrollTo({ top: 0 });
  speechSynthesis && speechSynthesis.cancel();
  views[tab]($("#view"));
}
document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => show(b.dataset.tab));

// ----- Hôm nay -----
views.today = async el => {
  const day = todaysPhrases();
  const need = day.ids.filter(id => isWord(id) && !(S.wm || {})[id.slice(2)]?.vi);
  if (need.length) {
    el.innerHTML = `<div class="card">⏳ Đang tải nghĩa & ví dụ của ${need.length} từ mới từ internet...<div class="bar" style="margin-top:10px"><div style="width:60%"></div></div></div>`;
    await Promise.all(need.map(id => enrich(id.slice(2))));
    if (current !== "today") return;
  }
  const isWeekend = [0, 6].includes(new Date().getDay());
  const pct = day.ids.length ? Math.round(day.done.length / day.ids.length * 100) : 0;
  const due = Object.values(S.learned).filter(l => l.due <= today()).length;
  const h = new Date().getHours(), hello = h < 11 ? "Chào buổi sáng" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const tile = (tab, ic, t, sub) => `<button class="tile" data-go="${tab}"><span class="t-ic">${ic}</span><b>${t}</b><span>${sub}</span></button>`;
  el.innerHTML = `
    <div class="card hero">
      <div class="ring" style="--p:${pct}"><div><b>${pct}%</b><small>${day.done.length}/${day.ids.length}</small></div></div>
      <div class="hero-body">
        <h2>${hello}! 👋</h2>
        <p>Hôm nay: <b>${day.ids.filter(id => !isWord(id)).length} cụm từ</b> + <b>${day.ids.filter(isWord).length} từ mới</b> · 🔥 chuỗi ${S.streak} ngày</p>
        ${isWeekend ? `<p>🏆 Cuối tuần rồi — <a href="#" id="goquiz" style="color:#fff;font-weight:700">làm bài kiểm tra tuần</a>!</p>` : ""}
        <div class="row" style="margin-top:10px">
          <label>Trình độ</label><select id="lvl">${LEVELS.map(l => `<option ${l === S.level ? "selected" : ""}>${l}</option>`).join("")}</select>
          <label>Từ mới/ngày</label><select id="wpd">${[0, 5, 10, 15, 20, 30].map(n => `<option ${n === (S.wordsPerDay ?? 10) ? "selected" : ""}>${n}</option>`).join("")}</select>
        </div>
      </div>
    </div>
    <div class="tiles">
      ${tile("review", "🔁", "Ôn tập", due ? `${due} mục đến hạn` : "Không có mục đến hạn")}
      ${tile("listen", "🎧", "Nghe", "Chép chính tả")}
      ${tile("speak", "🎤", "Nói", "Chấm phát âm")}
      ${tile("read", "📖", "Đọc", "Bài đọc + câu hỏi")}
      ${tile("write", "✍️", "Viết", "Đề hôm nay")}
    </div>
    <div class="section-title"><h2>📅 Bài học hôm nay</h2>
      <div class="row"><button class="primary" id="flash">🃏 Flashcard</button><button id="more">➕ Thêm 10 từ</button></div></div>
    <p class="muted" style="margin-top:-4px">Cách học: nghe 🔊 → đọc to theo → đọc ví dụ → tự đặt 1 câu → bấm <b>Đã thuộc</b>.</p>
    ${day.ids.length ? "" : `<div class="card">🎉 Bạn đã học hết! Hãy tiếp tục ôn tập.</div>`}
    <div class="lesson-grid">
    ${day.ids.map((id, n) => { const p = getP(id); const done = day.done.includes(id); return `
      <div class="card lesson ${done ? "done" : ""}" id="c-${esc(id)}">
        <div class="row between">
          <span class="row"><span class="num">#${n + 1}</span><span class="badge ${p.lv}">${p.lv}</span><span class="tag">${p.word ? "Từ vựng" : "Cụm từ"}</span></span>
          <span class="row"><button class="icon" data-say="${esc(p.en)}" title="Nghe">🔊</button><button class="icon" data-slow="${esc(p.en)}" title="Nghe chậm">🐢</button></span>
        </div>
        <div class="phrase">${esc(p.en)}</div>
        <div class="vi">🇻🇳 ${esc(p.vi || "⚠️ chưa lấy được nghĩa (kiểm tra mạng)")}</div>
        ${p.word && S.wm[p.en].pos ? `<div class="pos">${esc(S.wm[p.en].pos)}</div>` : ""}
        ${p.ex !== p.en ? `<div class="ex"><span>“${esc(p.ex)}”</span><button class="icon" data-say="${esc(p.ex)}">🔊</button></div>` : ""}
        ${infoBox(p.en)}
        <input type="text" placeholder="✏️ Tự đặt một câu..." data-own="${id}" value="${esc((S.own || {})[id] || "")}">
        <div class="actions"><button class="${done ? "success" : "primary"}" style="width:100%" data-learn="${id}" ${done ? "disabled" : ""}>${done ? "✅ Đã thuộc" : "Đánh dấu đã thuộc"}</button></div>
      </div>`; }).join("")}
    </div>`;
  el.querySelectorAll("[data-go]").forEach(b => b.onclick = () => show(b.dataset.go));
  el.querySelector("#wpd").onchange = e => { S.wordsPerDay = +e.target.value; save(); };
  el.querySelector("#more").onclick = () => { day.ids.push(...pickWords(10, assignedSet())); save(); toast("➕ Đã thêm 10 từ mới"); show("today"); };
  el.querySelector("#lvl").onchange = e => {
    if (confirm("Đổi trình độ? Cụm từ mới từ ngày mai (hoặc ngay nếu hôm nay chưa học) sẽ theo trình độ này.")) {
      S.level = S.wordLevel = e.target.value;
      const d = S.days[today()];
      if (d && !d.done.length) delete S.days[today()];
      save();
    }
    show("today");
  };
  el.querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(b.dataset.say));
  el.querySelectorAll("[data-slow]").forEach(b => b.onclick = () => speak(b.dataset.slow, 0.6));
  el.querySelectorAll("[data-learn]").forEach(b => b.onclick = () => {
    markLearned(b.dataset.learn);
    b.disabled = true; b.className = "success"; b.textContent = "✅ Đã thuộc";
    b.closest(".lesson").classList.add("done");
    const p2 = Math.round(day.done.length / day.ids.length * 100);
    el.querySelector(".ring").style.setProperty("--p", p2);
    el.querySelector(".ring b").textContent = p2 + "%";
    el.querySelector(".ring small").textContent = `${day.done.length}/${day.ids.length}`;
    toast(day.done.length === day.ids.length ? "🎉 Hoàn thành bài học hôm nay!" : `👍 Đã thuộc ${day.done.length}/${day.ids.length}`);
  });
  el.querySelectorAll("[data-own]").forEach(i => i.onchange = () => { S.own = S.own || {}; S.own[i.dataset.own] = i.value; save(); });
  bindWordInfo(el);
  el.querySelector("#flash").onclick = () => flashcards(el, day.ids);
  const gq = el.querySelector("#goquiz"); if (gq) gq.onclick = e => { e.preventDefault(); show("quiz"); };
};

function flashcards(el, ids, onGrade) {
  ids = shuffle(ids); let i = 0, flipped = false;
  const draw = () => {
    if (i >= ids.length) { el.innerHTML = `<div class="card"><h2>🎉 Xong!</h2><p>Bạn đã xem hết ${ids.length} thẻ.</p><button class="primary" id="back">Quay lại</button></div>`; el.querySelector("#back").onclick = () => show(current); return; }
    const p = getP(ids[i]);
    el.innerHTML = `<div class="card" style="max-width:640px;margin:0 auto">
      <div class="row between"><span class="muted">Thẻ ${i + 1}/${ids.length}</span><span class="badge ${p.lv}">${p.lv}</span></div>
      <div class="bar" style="margin-top:8px"><div style="width:${i / ids.length * 100}%"></div></div>
      <div class="flash-wrap"><div class="card flash" id="fc" title="Bấm để lật">${flipped ? `<div class="phrase">${esc(p.en)}</div><i>${esc(p.ex)}</i>${famLine(p.en)}` : `<div class="phrase">${esc(p.vi || p.en)}</div><div class="muted">👆 Bấm để lật — tiếng Anh là gì?</div>`}</div></div>
      <div class="row" style="justify-content:center">${flipped ? `<button id="no" style="flex:1">❌ Chưa nhớ</button><button class="icon" id="say">🔊</button><button class="primary" id="yes" style="flex:1">✅ Nhớ rồi</button>` : `<button class="primary" id="flip" style="flex:1">Lật thẻ</button>`}</div>
      <div style="text-align:center;margin-top:12px"><a href="#" id="exit" class="muted">Thoát</a></div></div>`;
    el.querySelector("#exit").onclick = e => { e.preventDefault(); show(current); };
    const flip = () => { flipped = true; draw(); speak(p.en); };
    el.querySelector("#fc").onclick = flip;
    if (!flipped) el.querySelector("#flip").onclick = flip;
    else {
      el.querySelector("#say").onclick = () => speak(p.en);
      el.querySelector("#yes").onclick = () => { onGrade && onGrade(p.id, true); i++; flipped = false; draw(); };
      el.querySelector("#no").onclick = () => { onGrade && onGrade(p.id, false); if (!onGrade) ids.push(p.id); i++; flipped = false; draw(); };
    }
  };
  draw();
}

const famLine = en => contentWords(en).map(w => { const f = familyOf(w); return f ? `<div class="muted">${esc(w)}: ${Object.entries(f).map(([k, v]) => `${k}. ${esc(v)}`).join(" · ")}</div>` : ""; }).join("");

// ----- Ôn tập (lặp lại ngắt quãng) -----
views.review = el => {
  const due = Object.keys(S.learned).filter(id => S.learned[id].due <= today());
  el.innerHTML = `<div class="card"><h2>🔁 Ôn tập ngắt quãng</h2>
    <p>Có <b>${due.length}</b> cụm từ đến hạn ôn hôm nay. Nhớ đúng → khoảng cách ôn tăng dần (1, 2, 4, 7, 15, 30, 60 ngày). Quên → quay lại từ đầu.</p>
    <button class="primary" id="go" ${due.length ? "" : "disabled"}>Bắt đầu ôn</button>
    <button id="all" ${Object.keys(S.learned).length ? "" : "disabled"}>Ôn tất cả (không tính lịch)</button></div>`;
  el.querySelector("#go").onclick = () => flashcards(el, due, grade);
  el.querySelector("#all").onclick = () => flashcards(el, Object.keys(S.learned));
};

// Nguồn câu luyện nghe/nói: ví dụ của cụm từ đã học (nếu chưa có thì dùng level hiện tại)
function practicePool() {
  const ids = Object.keys(S.learned);
  const good = ids.filter(id => !isWord(id) || getP(id).ex.includes(" "));
  return good.length >= 5 ? good : PHRASES[S.level].map((_, i) => pid(S.level, i));
}

// ----- Nghe (chép chính tả) -----
views.listen = el => {
  const p = getP(shuffle(practicePool())[0]);
  el.innerHTML = `<div class="card"><h2>🎧 Nghe & chép chính tả</h2>
    <p class="muted">Nghe câu rồi gõ lại chính xác. Có thể nghe chậm nhiều lần.</p>
    <div class="row"><button class="primary" id="play">▶️ Nghe</button><button id="slow">🐢 Nghe chậm</button></div>
    <input type="text" id="ans" placeholder="Gõ câu bạn nghe được..." style="margin:10px 0" autocomplete="off">
    <div class="row"><button class="primary" id="check">Kiểm tra</button><button id="next">Câu khác ➜</button></div>
    <div id="res" style="margin-top:10px"></div></div>
    <div class="card"><h2>🎧 Nghe hiểu đoạn văn</h2><p class="muted">Vào tab 📖 Đọc, bấm "🔊 Nghe cả bài" và thử trả lời câu hỏi trước khi đọc văn bản.</p></div>`;
  el.querySelector("#play").onclick = () => speak(p.ex);
  el.querySelector("#slow").onclick = () => speak(p.ex, 0.6);
  el.querySelector("#next").onclick = () => show("listen");
  el.querySelector("#check").onclick = () => {
    const a = norm(el.querySelector("#ans").value).split(" "), t = norm(p.ex).split(" ");
    const marked = t.map((w, i) => a[i] === w ? `<span class="ok">${w}</span>` : `<u class="bad">${w}</u>`).join(" ");
    const score = t.filter((w, i) => a[i] === w).length;
    el.querySelector("#res").innerHTML = `<b>${score}/${t.length} từ đúng</b><br>Đáp án: ${marked}<br><span class="muted">Cụm từ: ${esc(p.en)} — ${esc(p.vi)}</span>`;
  };
  el.querySelector("#ans").onkeydown = e => e.key === "Enter" && el.querySelector("#check").click();
};

// ----- Nói (nhận diện giọng nói) -----
views.speak = el => {
  const p = getP(shuffle(practicePool())[0]);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  el.innerHTML = `<div class="card"><h2>🎤 Luyện nói & phát âm</h2>
    <p class="muted">Nghe mẫu → bấm micro → đọc to câu dưới đây. App sẽ so sánh với câu gốc.
    ${SR ? "" : "<br><b class='bad'>Trình duyệt không hỗ trợ nhận diện giọng nói — hãy dùng Chrome/Edge. Bạn vẫn có thể nghe mẫu và tự đọc theo (shadowing).</b>"}</p>
    <p class="phrase">${esc(p.ex)}</p><p class="muted">${esc(p.en)} — ${esc(p.vi)}</p>
    <div class="row"><button id="play">🔊 Nghe mẫu</button><button class="primary" id="mic" ${SR ? "" : "disabled"}>🎙️ Nói</button><button id="next">Câu khác ➜</button></div>
    <div id="res" style="margin-top:10px"></div></div>
    <div class="card"><h2>💬 Chủ đề nói tự do (${S.level})</h2><p id="topic"></p>
    <p class="muted">Nói 1–2 phút, cố gắng dùng các cụm từ đã học. Có thể dùng micro ở trên hoặc tự ghi âm bằng điện thoại để nghe lại.</p><button id="nt">Chủ đề khác</button></div>`;
  const topics = { A1: ["Introduce yourself.", "Describe your house.", "What do you do every morning?", "Talk about your best friend."], A2: ["What did you do last weekend?", "Describe your last holiday.", "What are your plans for next year?", "Talk about your favourite film."], B1: ["Is social media good or bad?", "Describe a challenge you overcame.", "Would you rather live in a city or the countryside? Why?", "How do you deal with stress?"], B2: ["Should university education be free?", "How will AI change jobs in the future?", "Is tourism good for local communities?", "What makes a good leader?"] };
  const nt = () => el.querySelector("#topic").textContent = shuffle(topics[S.level])[0];
  nt(); el.querySelector("#nt").onclick = nt;
  el.querySelector("#play").onclick = () => speak(p.ex);
  el.querySelector("#next").onclick = () => show("speak");
  if (SR) el.querySelector("#mic").onclick = () => {
    const r = new SR(); r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1;
    const res = el.querySelector("#res"); res.textContent = "🎙️ Đang nghe...";
    r.onresult = e => {
      const said = e.results[0][0].transcript;
      const s = new Set(norm(said).split(" ")), t = norm(p.ex).split(" ");
      const hit = t.filter(w => s.has(w)).length, pct = Math.round(hit / t.length * 100);
      res.innerHTML = `Bạn nói: <i>${esc(said)}</i><br>${t.map(w => s.has(w) ? `<span class="ok">${w}</span>` : `<u class="bad">${w}</u>`).join(" ")}<br><b>${pct}%</b> ${pct >= 90 ? "🎉 Xuất sắc!" : pct >= 70 ? "👍 Khá tốt!" : "💪 Thử lại nhé!"}`;
    };
    r.onerror = e => res.textContent = "Lỗi micro: " + e.error;
    r.start();
  };
};

// ----- Đọc -----
views.read = el => {
  el.innerHTML = LEVELS.map(lv => READINGS[lv].map((r, ri) => { const k = lv + ri; return `
    <div class="card"><h2>📖 ${esc(r.title)} <span class="muted">(${lv}) ${S.readDone[k] != null ? "✅ " + S.readDone[k] + "/" + r.qs.length : ""}</span></h2>
    <details ${lv === S.level ? "open" : ""}><summary>Mở bài đọc</summary>
    <div class="row" style="margin:8px 0"><button data-say="${k}">🔊 Nghe cả bài</button><button data-hide="${k}">🙈 Ẩn/hiện văn bản (luyện nghe)</button></div>
    <p id="t${k}">${esc(r.text)}</p>
    ${r.qs.map((q, qi) => `<p><b>${qi + 1}. ${esc(q[0])}</b>${q[1].map((o, oi) => `<button class="opt" data-q="${k}|${qi}|${oi}">${esc(o)}</button>`).join("")}</p>`).join("")}
    </details></div>`; }).join("")).join("");
  const find = k => READINGS[k.slice(0, 2)][+k.slice(2)];
  el.querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(find(b.dataset.say).text));
  el.querySelectorAll("[data-hide]").forEach(b => b.onclick = () => { const t = el.querySelector("#t" + b.dataset.hide); t.style.visibility = t.style.visibility === "hidden" ? "" : "hidden"; });
  const answered = {};
  el.querySelectorAll("[data-q]").forEach(b => b.onclick = () => {
    const [k, qi, oi] = b.dataset.q.split("|"); const r = find(k);
    if (answered[k + qi]) return; answered[k + qi] = true;
    const right = r.qs[qi][2];
    el.querySelectorAll(`[data-q^="${k}|${qi}|"]`).forEach(x => { const o = +x.dataset.q.split("|")[2]; if (o === right) x.classList.add("correct"); else if (o === +oi) x.classList.add("wrong"); });
    answered[k] = (answered[k] || 0) + (+oi === right);
    if (r.qs.every((_, i) => answered[k + i])) { S.readDone[k] = answered[k]; save(); }
  });
};

// ----- Viết -----
views.write = el => {
  const day = todaysPhrases();
  const prompts = WRITING[S.level];
  const prompt = prompts[new Date().getDate() % prompts.length];
  el.innerHTML = `<div class="card"><h2>✍️ Luyện viết (${S.level})</h2>
    <p><b>Đề hôm nay:</b> ${esc(prompt)}</p>
    <p class="muted">Thử dùng ít nhất 3 cụm từ hôm nay: ${day.ids.map(id => `<code>${esc(getP(id).en)}</code>`).join(", ")}</p>
    <textarea id="txt" placeholder="Write here..."></textarea>
    <div class="row" style="margin-top:8px"><span id="wc" class="muted">0 từ</span><button class="primary" id="save">💾 Lưu bài</button><button id="speakit">🔊 Nghe lại bài viết</button></div>
    <div id="fb" style="margin-top:10px"></div></div>
    <div class="card"><h3>✅ Tự kiểm tra trước khi lưu</h3><ul class="muted">
    <li>Mỗi câu có chủ ngữ + động từ? Chia động từ đúng thì?</li><li>Viết hoa đầu câu, dấu chấm cuối câu?</li>
    <li>Dùng từ nối (and, but, because, however, although...)?</li><li>Bố cục: mở bài – thân bài – kết luận?</li></ul></div>
    <div class="card"><h3>📂 Bài đã viết (${S.writings.length})</h3>${S.writings.slice().reverse().map(w => `<details><summary>${w.date} · ${w.words} từ · ${esc(w.prompt.slice(0, 50))}...</summary><p style="white-space:pre-wrap">${esc(w.text)}</p></details>`).join("") || "<p class='muted'>Chưa có bài nào.</p>"}</div>`;
  const txt = el.querySelector("#txt");
  const count = () => txt.value.trim().split(/\s+/).filter(Boolean).length;
  const feedback = () => {
    const low = txt.value.toLowerCase();
    const used = day.ids.map(getP).filter(p => low.includes(p.en.toLowerCase().split(/[\/.(?]/)[0].trim()));
    const linkers = ["and", "but", "because", "so", "however", "although", "then", "also", "moreover", "in addition", "as a result"].filter(w => new RegExp(`\\b${w}\\b`).test(low));
    const sentences = txt.value.split(/[.!?]+/).filter(s => s.trim());
    const noCap = sentences.filter(s => /^[a-z]/.test(s.trim())).length;
    return `<b>Nhận xét tự động:</b><br>• ${count()} từ, ${sentences.length} câu.<br>• Cụm từ hôm nay đã dùng: ${used.length ? used.map(p => `<span class="ok">${esc(p.en)}</span>`).join(", ") : "<span class='bad'>chưa có</span>"}<br>• Từ nối: ${linkers.join(", ") || "<span class='bad'>chưa có</span>"}<br>${noCap ? `• <span class="bad">${noCap} câu chưa viết hoa chữ cái đầu</span>` : "• Viết hoa đầu câu ✅"}`;
  };
  txt.oninput = () => { el.querySelector("#wc").textContent = count() + " từ"; el.querySelector("#fb").innerHTML = feedback(); };
  el.querySelector("#speakit").onclick = () => speak(txt.value);
  el.querySelector("#save").onclick = () => { if (!count()) return; S.writings.push({ date: today(), prompt, text: txt.value, words: count() }); save(); show("write"); };
};

// ----- Ngữ pháp -----
views.grammar = el => {
  el.innerHTML = LEVELS.map(lv => `<div class="card"><h2>📐 Ngữ pháp ${lv}</h2>${GRAMMAR[lv].map(g => `
    <details ${lv === S.level ? "open" : ""}><summary><b>${esc(g[0])}</b></summary><p>${esc(g[1])}<br><i>${esc(g[2])}</i> <button data-say="${esc(g[2])}">🔊</button></p></details>`).join("")}</div>`).join("");
  el.querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(b.dataset.say));
};

// ----- Kiểm tra cuối tuần -----
function weekStart(d = new Date()) { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x.toLocaleDateString("sv"); }
views.quiz = el => {
  const ws = weekStart(), isWeekend = [0, 6].includes(new Date().getDay());
  const weekIds = Object.keys(S.learned).filter(id => S.learned[id].date >= ws);
  const done = S.quizzes.find(q => q.week === ws);
  el.innerHTML = `<div class="card"><h2>📝 Bài kiểm tra cuối tuần</h2>
    <p>Tuần này (từ ${ws}) bạn đã học <b>${weekIds.length}</b> cụm từ.</p>
    <p>${isWeekend ? "🎯 Hôm nay là cuối tuần — đây là lúc làm bài kiểm tra chính thức!" : "📅 Bài kiểm tra chính thức mở vào <b>Thứ 7 & Chủ nhật</b>. Bạn vẫn có thể làm thử."}</p>
    ${done ? `<p>Kết quả tuần này: <b>${done.score}/${done.total}</b></p>` : ""}
    <p class="muted">Gồm 3 dạng: chọn nghĩa, nghe chọn cụm từ, điền cụm từ vào câu. Câu sai sẽ được đưa lại vào lịch ôn tập.</p>
    <button class="primary" id="start" ${weekIds.length >= 4 ? "" : "disabled"}>${isWeekend ? "Làm bài kiểm tra" : "Làm thử"}</button>
    ${weekIds.length < 4 ? "<p class='muted'>Cần học ít nhất 4 cụm từ trong tuần.</p>" : ""}</div>
    <div class="card"><h3>Lịch sử</h3>${S.quizzes.map(q => `<div>${q.week}: <b>${q.score}/${q.total}</b> (${Math.round(q.score / q.total * 100)}%)</div>`).join("") || "<p class='muted'>Chưa có.</p>"}</div>`;
  el.querySelector("#start").onclick = () => runQuiz(el, weekIds, isWeekend ? ws : null);
};

function runQuiz(el, ids, week) {
  const pool = (Object.keys(S.learned).length >= 4 ? Object.keys(S.learned) : ids).filter(id => getP(id).vi);
  const qs = shuffle(ids).slice(0, 20).map((id, n) => {
    const p = getP(id); let type = n % 3; if (!p.vi) type = 1;
    const wrong = shuffle(pool.filter(x => x !== id)).slice(0, 3).map(getP);
    if (type === 0) return { id, type, q: `“${p.en}” nghĩa là gì?`, opts: shuffle([p, ...wrong]).map(x => x.vi), ans: p.vi };
    if (type === 1) return { id, type, q: "🔊 Nghe và chọn cụm từ đúng", say: p.en, opts: shuffle([p, ...wrong]).map(x => x.en), ans: p.en };
    const key = p.en.split(/[\/.(?]/)[0].trim();
    const blank = p.ex.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "_____");
    return blank === p.ex ? { id, type: 0, q: `“${p.en}” nghĩa là gì?`, opts: shuffle([p, ...wrong]).map(x => x.vi), ans: p.vi }
      : { id, type, q: `Điền vào chỗ trống: ${blank}<br><span class="muted">(${p.vi})</span>`, input: true, ans: key };
  });
  let i = 0, score = 0;
  const draw = () => {
    if (i >= qs.length) {
      if (week) { S.quizzes = S.quizzes.filter(q => q.week !== week); S.quizzes.push({ week, score, total: qs.length }); }
      save();
      el.innerHTML = `<div class="card"><h2>Kết quả: ${score}/${qs.length}</h2><p>${score / qs.length >= .8 ? "🎉 Rất tốt!" : "💪 Hãy ôn lại các cụm từ sai trong tab Ôn tập."}</p><button class="primary" id="b">Quay lại</button></div>`;
      el.querySelector("#b").onclick = () => show("quiz"); return;
    }
    const q = qs[i];
    el.innerHTML = `<div class="card"><div class="muted">Câu ${i + 1}/${qs.length} · Điểm ${score}</div><h3>${q.input ? q.q : esc(q.q).replace(/&lt;br&gt;/g, "<br>")}</h3>
      ${q.say ? `<button id="say">🔊 Nghe lại</button>` : ""}
      ${q.input ? `<input type="text" id="in" autocomplete="off"><button class="primary" id="ok" style="margin-top:8px">Trả lời</button>` : q.opts.map(o => `<button class="opt">${esc(o)}</button>`).join("")}
      <div id="fb"></div></div>`;
    if (q.say) { speak(q.say); el.querySelector("#say").onclick = () => speak(q.say); }
    const finish = ok => {
      if (ok) score++;
      grade(q.id, ok);
      el.querySelector("#fb").innerHTML = `<p class="${ok ? "ok" : "bad"}">${ok ? "✅ Đúng" : "❌ Sai — đáp án: " + esc(q.ans)}</p><button class="primary" id="nx">Tiếp ➜</button>`;
      el.querySelector("#nx").onclick = () => { i++; draw(); };
    };
    if (q.input) {
      const inp = el.querySelector("#in"); inp.focus();
      const go = () => { el.querySelector("#ok").disabled = true; inp.disabled = true; finish(norm(inp.value) === norm(q.ans)); };
      el.querySelector("#ok").onclick = go; inp.onkeydown = e => e.key === "Enter" && !inp.disabled && go();
    } else el.querySelectorAll(".opt").forEach(b => b.onclick = () => {
      if (el.querySelector(".correct")) return;
      el.querySelectorAll(".opt").forEach(x => { if (x.textContent === q.ans) x.classList.add("correct"); });
      if (b.textContent !== q.ans) b.classList.add("wrong");
      finish(b.textContent === q.ans);
    });
  };
  draw();
}

// ----- Tiến độ -----
views.progress = el => {
  el.innerHTML = `<div class="card"><h2>📊 Tiến độ</h2>
    ${levelBars()}
    <p>🔥 Chuỗi ngày học: <b>${S.streak}</b> · ✍️ Bài viết: <b>${S.writings.length}</b> · 📖 Bài đọc: <b>${Object.keys(S.readDone).length}</b> · 📝 Bài kiểm tra: <b>${S.quizzes.length}</b></p>
    <p class="muted">Dữ liệu được lưu trên trình duyệt của bạn. Hãy sao lưu để chuyển sang máy khác.</p>
    <div class="row"><button id="exp">⬇️ Sao lưu</button><label class="row"><button id="impb">⬆️ Khôi phục</button><input type="file" id="imp" accept=".json" hidden></label><button id="reset">🗑️ Xóa dữ liệu</button></div></div>
    <div class="card"><h3>Cụm từ đã học</h3>${Object.keys(S.learned).map(getP).map(p => `<div>${esc(p.en)} — <span class="muted">${esc(p.vi)} · ôn lại ${S.learned[p.id].due}</span></div>`).join("") || "<p class='muted'>Chưa có.</p>"}</div>`;
  el.querySelector("#exp").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" })); a.download = `english-backup-${today()}.json`; a.click(); };
  el.querySelector("#impb").onclick = () => el.querySelector("#imp").click();
  el.querySelector("#imp").onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { S = JSON.parse(t); save(); show("progress"); alert("Đã khôi phục!"); } catch { alert("File không hợp lệ"); } }); };
  el.querySelector("#reset").onclick = () => { if (confirm("Xóa toàn bộ tiến độ?")) { localStorage.removeItem(KEY); location.reload(); } };
};


// ===== Tra từ online + họ từ (danh/động/tính/trạng từ) =====
const STOP = new Set("a an the i you me my your he she it we they is are am be been was were to of in on at for with by and or but so what how where why do does don't can could would will i'm i'd it's let's that there this these up out off down about as from into if no not all any some one very much many our their its his her us them s your's something someone".split(" "));
const POS_VI = { n: "Danh từ (n)", v: "Động từ (v)", adj: "Tính từ (adj)", adv: "Trạng từ (adv)", prep: "Giới từ (prep)" };
const POS_EN = { noun: "n", verb: "v", adjective: "adj", adverb: "adv", preposition: "prep" };
const dictCache = {}; // chỉ cache trong phiên — luôn lấy dữ liệu mới từ mạng khi mở app

function contentWords(phrase) {
  return [...new Set(phrase.toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter(w => w && !STOP.has(w) && w.length > 2))];
}
function familyOf(w) {
  const cands = [w, w.replace(/s$/, ""), w.replace(/es$/, ""), w.replace(/ed$/, ""), w.replace(/d$/, ""), w.replace(/ing$/, ""), w.replace(/ing$/, "e"), w.replace(/ied$/, "y"), w.replace(/ies$/, "y")];
  for (const c of cands) if (FAMILY[c]) return FAMILY[c];
  return null;
}
async function lookup(w) {
  if (!dictCache[w]) dictCache[w] = fetch("https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(w), { cache: "no-store" })
    .then(r => r.ok ? r.json() : null).catch(() => null);
  return dictCache[w];
}
async function wordInfoHTML(phrase) {
  const words = /\s/.test(phrase.trim()) ? contentWords(phrase) : [phrase.trim().toLowerCase()];
  if (!words.length) return "<p class='muted'>Cụm từ này chủ yếu gồm từ chức năng (giới từ, đại từ...).</p>";
  const blocks = await Promise.all(words.map(async w => {
    const data = await lookup(w);
    const fam = Object.assign({}, familyOf(w) || {});
    let ipa = "", audio = "", defs = "";
    if (data && data[0]) {
      const e = data[0];
      ipa = e.phonetic || (e.phonetics.find(p => p.text) || {}).text || "";
      audio = (e.phonetics.find(p => p.audio) || {}).audio || "";
      const meanings = data.flatMap(x => x.meanings);
      meanings.forEach(m => { const k = POS_EN[m.partOfSpeech]; if (k && !fam[k]) fam[k] = e.word; });
      defs = meanings.slice(0, 4).map(m => `<li><b>${esc(m.partOfSpeech)}</b>: ${esc(m.definitions[0].definition)}${m.definitions[0].example ? ` <i class="muted">— ${esc(m.definitions[0].example)}</i>` : ""}</li>`).join("");
    }
    const famRows = ["n", "v", "adj", "adv", "prep"].filter(k => fam[k]).map(k => `<tr><td>${POS_VI[k]}</td><td><b>${esc(fam[k])}</b></td></tr>`).join("");
    return `<div style="margin:8px 0;padding:8px;border-left:3px solid var(--accent)">
      <div class="row"><b style="font-size:1.05rem">${esc(w)}</b> <span class="muted">${esc(ipa)}</span>
      ${audio ? `<button data-audio="${esc(audio)}">🔊 giọng thật</button>` : `<button data-say="${esc(w)}">🔊</button>`}</div>
      ${famRows ? `<table class="fam">${famRows}</table>` : "<p class='muted'>Không có dữ liệu họ từ.</p>"}
      ${defs ? `<ul>${defs}</ul>` : `<p class="muted">${data === null ? "⚠️ Không lấy được dữ liệu online (kiểm tra kết nối mạng)." : ""}</p>`}
    </div>`;
  }));
  return blocks.join("") + `<p class="muted">Nguồn online: dictionaryapi.dev</p>`;
}
function bindWordInfo(root) {
  root.querySelectorAll("details[data-info]").forEach(d => d.addEventListener("toggle", async () => {
    if (!d.open || d.dataset.loaded) return;
    d.dataset.loaded = 1;
    const box = d.querySelector(".info");
    box.innerHTML = "⏳ Đang tải từ điển online...";
    box.innerHTML = await wordInfoHTML(d.dataset.info);
    box.querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(b.dataset.say));
    box.querySelectorAll("[data-audio]").forEach(b => b.onclick = () => new Audio(b.dataset.audio).play());
  }));
}
const infoBox = en => `<details data-info="${esc(en)}"><summary>📖 Từ loại · phiên âm · nghĩa (online)</summary><div class="info"></div></details>`;

// ----- Thống kê từ vựng -----
views.vocab = el => {
  const ids = Object.keys(S.learned), L = S.learned, t = today(), ws = weekStart();
  const tot = ids.reduce((a, id) => [a[0] + L[id].right, a[1] + L[id].wrong], [0, 0]);
  const acc = tot[0] + tot[1] ? Math.round(tot[0] / (tot[0] + tot[1]) * 100) : 0;
  const mastered = ids.filter(id => L[id].box >= 3).length;
  const weak = ids.filter(id => L[id].wrong > L[id].right || (L[id].wrong && L[id].box === 0));
  // 14 ngày gần nhất
  const days = [...Array(14)].map((_, i) => addDays(t, i - 13));
  const perDay = days.map(d => ids.filter(id => L[id].date === d).length);
  const max = Math.max(1, ...perDay);
  const filter = S.vocabFilter || "all";
  const list = ids.filter(id => filter === "all" || (filter === "weak" ? weak.includes(id) : filter === "week" ? L[id].date >= ws : getP(id).lv === filter))
    .sort((a, b) => L[b].date.localeCompare(L[a].date));
  el.innerHTML = `<div class="card"><h2>📚 Thống kê từ vựng</h2>
    <div class="grid">
      <div class="stat"><b>${ids.length}</b><span>Tổng đã học</span></div>
      <div class="stat"><b>${ids.filter(id => L[id].date === t).length}</b><span>Hôm nay</span></div>
      <div class="stat"><b>${ids.filter(id => L[id].date >= ws).length}</b><span>Tuần này</span></div>
      <div class="stat"><b>${mastered}</b><span>Đã thuộc chắc</span></div>
      <div class="stat"><b>${weak.length}</b><span>Hay quên</span></div>
      <div class="stat"><b>${acc}%</b><span>Tỉ lệ nhớ đúng</span></div>
    </div>
    <h3>Số cụm từ học mỗi ngày (14 ngày)</h3>
    <div class="chart">${days.map((d, i) => `<div title="${d}: ${perDay[i]}"><span>${perDay[i] || ""}</span><i style="height:${perDay[i] / max * 100}%"></i><small>${d.slice(8)}</small></div>`).join("")}</div>
    <h3>Theo trình độ</h3>
    ${levelBars()}
    </div>
    <div class="card"><h2>🗂️ Kho từ vựng (${Object.keys(WORD_LV).length.toLocaleString()} từ thông dụng nhất)</h2>
      <p class="muted">Xếp theo mức độ thông dụng. Bấm vào từ để xem nghĩa, từ loại; bấm ➕ để thêm vào bài học hôm nay.</p>
      <div class="row" style="flex-wrap:nowrap"><select id="blv" style="width:auto">${LEVELS.map(l => `<option ${l === (S.browseLv || S.level) ? "selected" : ""}>${l}</option>`).join("")}</select>
      <input type="text" id="bq" placeholder="Lọc từ..."></div>
      <div id="blist" style="margin-top:8px"></div></div>
    <div class="card"><h2>🔎 Tra từ bất kỳ (online)</h2>
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="q" placeholder="Nhập từ tiếng Anh, vd: decide"><button class="primary" id="qs">Tra</button></div>
      <div id="qr"></div></div>
    <div class="card"><h2>Danh sách (${list.length})</h2>
      <div class="row">${[["all", "Tất cả"], ["week", "Tuần này"], ["weak", "Hay quên"], ...LEVELS.map(l => [l, l])].map(([k, v]) => `<button data-f="${k}" class="${filter === k ? "primary" : ""}">${v}</button>`).join("")}</div>
      ${list.map(id => { const p = getP(id), l = L[id]; return `<div class="card" style="margin-top:8px">
        <div class="row" style="justify-content:space-between"><span class="phrase">${esc(p.en)}</span><button data-say="${esc(p.en)}">🔊</button></div>
        <div>🇻🇳 ${esc(p.vi)} <span class="muted">· ${p.lv} · học ${l.date} · ✅${l.right} ❌${l.wrong} · hộp ${l.box}/6 · ôn ${l.due}</span></div>
        ${infoBox(p.en)}</div>`; }).join("") || "<p class='muted'>Chưa có.</p>"}
    </div>`;
  el.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { S.vocabFilter = b.dataset.f; save(); show("vocab"); });
  el.querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(b.dataset.say));
  bindWordInfo(el);
  let page = 0;
  const drawBrowse = () => {
    const lv = el.querySelector("#blv").value, f = el.querySelector("#bq").value.trim().toLowerCase();
    const all = f ? Object.keys(WORD_LV).filter(w => w.includes(f)) : WORDS[lv];
    const per = 60, items = all.slice(page * per, page * per + per);
    el.querySelector("#blist").innerHTML = `<div class="words">${items.map(w => { const id = wid(w), st = S.learned[id] ? "✅" : assignedSet().has(id) ? "📅" : "";
      return `<span class="w"><a href="#" data-w="${w}">${w}</a> <small class="muted">${WORD_LV[w]}</small> ${st || `<button data-add="${w}" title="Học hôm nay">➕</button>`}</span>`; }).join("")}</div>
      <div id="wd"></div>
      <div class="row" style="margin-top:8px"><button id="pp" ${page ? "" : "disabled"}>◀</button><span class="muted">Trang ${page + 1}/${Math.max(1, Math.ceil(all.length / per))} · ${all.length.toLocaleString()} từ</span><button id="np" ${(page + 1) * per < all.length ? "" : "disabled"}>▶</button></div>`;
    el.querySelector("#pp").onclick = () => { page--; drawBrowse(); };
    el.querySelector("#np").onclick = () => { page++; drawBrowse(); };
    el.querySelectorAll("[data-add]").forEach(b => b.onclick = () => { const d = todaysPhrases(); d.ids.push(wid(b.dataset.add)); save(); drawBrowse(); });
    el.querySelectorAll("[data-w]").forEach(a => a.onclick = async e => {
      e.preventDefault(); const w = a.dataset.w, box = el.querySelector("#wd");
      box.innerHTML = "⏳ Đang tra..."; const m = await enrich(w);
      box.innerHTML = `<div class="card" style="margin-top:8px"><div class="phrase">${esc(w)}</div><div>🇻🇳 ${esc(m.vi || "")}</div>${m.pos ? `<div class="muted">${esc(m.pos)}</div>` : ""}${await wordInfoHTML(w)}</div>`;
      box.querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(b.dataset.say));
      box.querySelectorAll("[data-audio]").forEach(b => b.onclick = () => new Audio(b.dataset.audio).play());
      speak(w);
    });
  };
  el.querySelector("#blv").onchange = () => { S.browseLv = el.querySelector("#blv").value; page = 0; save(); drawBrowse(); };
  el.querySelector("#bq").oninput = () => { page = 0; drawBrowse(); };
  drawBrowse();
  const q = el.querySelector("#q"), go = async () => {
    const w = q.value.trim().toLowerCase(); if (!w) return;
    const r = el.querySelector("#qr"); r.innerHTML = "⏳ Đang tra...";
    const m = /\s/.test(w) ? {} : await enrich(w);
    r.innerHTML = (m.vi ? `<div>🇻🇳 <b>${esc(m.vi)}</b></div>${m.pos ? `<div class="muted">${esc(m.pos)}</div>` : ""}` : "") + await wordInfoHTML(w);
    r.querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(b.dataset.say));
    r.querySelectorAll("[data-audio]").forEach(b => b.onclick = () => new Audio(b.dataset.audio).play());
  };
  el.querySelector("#qs").onclick = go; q.onkeydown = e => e.key === "Enter" && go();
};


function levelBars() {
  return LEVELS.map(lv => {
    const np = PHRASES[lv].filter((_, i) => S.learned[pid(lv, i)]).length, nw = WORDS[lv].filter(w => S.learned[wid(w)]).length;
    return `<div style="margin-bottom:6px">${lv}: cụm từ ${np}/${PHRASES[lv].length} · từ vựng ${nw}/${WORDS[lv].length.toLocaleString()}
      <div class="bar"><div style="width:${np / PHRASES[lv].length * 100}%"></div></div><div class="bar" style="margin-top:2px"><div style="width:${nw / WORDS[lv].length * 100}%;background:var(--ok)"></div></div></div>`;
  }).join("");
}

// Lấy nghĩa tiếng Việt (theo từ loại) + ví dụ từ internet, lưu lại cho từ đã học
async function enrich(w) {
  S.wm = S.wm || {};
  const m = S.wm[w] = S.wm[w] || {};
  try {
    const r = await fetch("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&q=" + encodeURIComponent(w));
    const j = await r.json();
    m.vi = (j[0] || []).map(x => x[0]).join("");
    if (j[1]) m.pos = j[1].map(b => `${POS_VI[POS_EN[b[0]]] || b[0]}: ${b[1].slice(0, 4).join(", ")}`).join(" · ");
  } catch {
    try { const j = await (await fetch("https://api.mymemory.translated.net/get?langpair=en|vi&q=" + encodeURIComponent(w))).json(); m.vi = j.responseData.translatedText; } catch {}
  }
  if (!m.ex || m.ex === w) {
    const d = await lookup(w);
    const ex = d && d.flatMap(e => e.meanings).flatMap(x => x.definitions).map(x => x.example).find(Boolean);
    if (ex) m.ex = ex;
  }
  save();
  return m;
}

renderStats();
show("today");
