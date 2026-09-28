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
const getP = id => { const [lv, i] = id.split("-"); const p = PHRASES[lv][+i]; return { id, lv, en: p[0], vi: p[1], ex: p[2] }; };
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

// ===== 10 cụm từ mỗi ngày =====
function todaysPhrases() {
  const d = today();
  if (!S.days[d]) {
    const picked = [];
    for (let li = LEVELS.indexOf(S.level); li < LEVELS.length && picked.length < DAILY; li++) {
      const lv = LEVELS[li];
      PHRASES[lv].forEach((_, i) => {
        const id = pid(lv, i);
        const assigned = Object.values(S.days).some(x => x.ids.includes(id));
        if (picked.length < DAILY && !S.learned[id] && !assigned) picked.push(id);
      });
    }
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
  $("#stats").innerHTML = `Trình độ <b>${S.level}</b> · 🔥 ${S.streak} ngày · 📚 ${n} cụm từ · 🔁 ${due} cần ôn`;
}

const views = {};
let current = "today";
function show(tab) {
  current = tab;
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  speechSynthesis && speechSynthesis.cancel();
  views[tab]($("#view"));
}
document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => show(b.dataset.tab));

// ----- Hôm nay -----
views.today = el => {
  const day = todaysPhrases();
  const isWeekend = [0, 6].includes(new Date().getDay());
  el.innerHTML = `
    <div class="card">
      <h2>📅 10 cụm từ hôm nay (${today()})</h2>
      <div class="row">
        <label>Trình độ:</label>
        <select id="lvl" style="width:auto">${LEVELS.map(l => `<option ${l === S.level ? "selected" : ""}>${l}</option>`).join("")}</select>
        <span class="muted">Đã học ${day.done.length}/${day.ids.length} hôm nay</span>
      </div>
      <div class="bar" style="margin-top:8px"><div style="width:${day.ids.length ? day.done.length / day.ids.length * 100 : 0}%"></div></div>
      ${isWeekend ? `<p>🎯 Hôm nay là cuối tuần — hãy làm <a href="#" id="goquiz">bài kiểm tra tuần</a>!</p>` : ""}
      <p class="muted">Cách học: nghe 🔊 → đọc to theo → đọc ví dụ → tự đặt 1 câu → bấm "Đã thuộc". Sau đó luyện Flashcard.</p>
    </div>
    ${day.ids.length ? "" : `<div class="card">🎉 Bạn đã học hết toàn bộ cụm từ! Hãy tiếp tục ôn tập.</div>`}
    ${day.ids.map((id, n) => { const p = getP(id); const done = day.done.includes(id); return `
      <div class="card">
        <div class="row" style="justify-content:space-between">
          <span class="phrase">${n + 1}. ${esc(p.en)} <span class="muted">(${p.lv})</span></span>
          <span class="row"><button data-say="${esc(p.en)}">🔊</button><button data-slow="${esc(p.en)}">🐢</button></span>
        </div>
        <div>🇻🇳 ${esc(p.vi)}</div>
        <div class="row"><i>“${esc(p.ex)}”</i> <button data-say="${esc(p.ex)}">🔊</button></div>
        <input type="text" placeholder="Tự đặt một câu với cụm từ này..." data-own="${id}" value="${esc((S.own || {})[id] || "")}" style="margin:8px 0">
        <button class="${done ? "" : "primary"}" data-learn="${id}" ${done ? "disabled" : ""}>${done ? "✅ Đã thuộc" : "Đã thuộc"}</button>
      </div>`; }).join("")}
    <div class="card row"><button class="primary" id="flash">🃏 Luyện Flashcard hôm nay</button></div>`;
  el.querySelector("#lvl").onchange = e => {
    if (confirm("Đổi trình độ? Cụm từ mới từ ngày mai (hoặc ngay nếu hôm nay chưa học) sẽ theo trình độ này.")) {
      S.level = e.target.value;
      const d = S.days[today()];
      if (d && !d.done.length) delete S.days[today()];
      save();
    }
    show("today");
  };
  el.querySelectorAll("[data-say]").forEach(b => b.onclick = () => speak(b.dataset.say));
  el.querySelectorAll("[data-slow]").forEach(b => b.onclick = () => speak(b.dataset.slow, 0.6));
  el.querySelectorAll("[data-learn]").forEach(b => b.onclick = () => { markLearned(b.dataset.learn); show("today"); });
  el.querySelectorAll("[data-own]").forEach(i => i.onchange = () => { S.own = S.own || {}; S.own[i.dataset.own] = i.value; save(); });
  el.querySelector("#flash").onclick = () => flashcards(el, day.ids);
  const gq = el.querySelector("#goquiz"); if (gq) gq.onclick = e => { e.preventDefault(); show("quiz"); };
};

function flashcards(el, ids, onGrade) {
  ids = shuffle(ids); let i = 0, flipped = false;
  const draw = () => {
    if (i >= ids.length) { el.innerHTML = `<div class="card"><h2>🎉 Xong!</h2><p>Bạn đã xem hết ${ids.length} thẻ.</p><button class="primary" id="back">Quay lại</button></div>`; el.querySelector("#back").onclick = () => show(current); return; }
    const p = getP(ids[i]);
    el.innerHTML = `<div class="card"><div class="muted">Thẻ ${i + 1}/${ids.length} · bấm vào thẻ để lật</div>
      <div class="card flash" id="fc">${flipped ? `<div class="phrase">${esc(p.en)}</div><i>${esc(p.ex)}</i>` : `<div class="phrase">${esc(p.vi)}</div><div class="muted">Cụm từ tiếng Anh là gì?</div>`}</div>
      <div class="row">${flipped ? `<button id="no">❌ Chưa nhớ</button><button class="primary" id="yes">✅ Nhớ rồi</button><button id="say">🔊</button>` : `<button class="primary" id="flip">Lật thẻ</button>`}</div></div>`;
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
  return ids.length >= 5 ? ids : PHRASES[S.level].map((_, i) => pid(S.level, i));
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
  const pool = Object.keys(S.learned).length >= 4 ? Object.keys(S.learned) : ids;
  const qs = shuffle(ids).slice(0, 20).map((id, n) => {
    const p = getP(id), type = n % 3;
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
    ${LEVELS.map(lv => { const n = PHRASES[lv].filter((_, i) => S.learned[pid(lv, i)]).length; return `<div>${lv}: ${n}/${PHRASES[lv].length}<div class="bar"><div style="width:${n / PHRASES[lv].length * 100}%"></div></div></div>`; }).join("")}
    <p>🔥 Chuỗi ngày học: <b>${S.streak}</b> · ✍️ Bài viết: <b>${S.writings.length}</b> · 📖 Bài đọc: <b>${Object.keys(S.readDone).length}</b> · 📝 Bài kiểm tra: <b>${S.quizzes.length}</b></p>
    <p class="muted">Dữ liệu được lưu trên trình duyệt của bạn. Hãy sao lưu để chuyển sang máy khác.</p>
    <div class="row"><button id="exp">⬇️ Sao lưu</button><label class="row"><button id="impb">⬆️ Khôi phục</button><input type="file" id="imp" accept=".json" hidden></label><button id="reset">🗑️ Xóa dữ liệu</button></div></div>
    <div class="card"><h3>Cụm từ đã học</h3>${Object.keys(S.learned).map(getP).map(p => `<div>${esc(p.en)} — <span class="muted">${esc(p.vi)} · ôn lại ${S.learned[p.id].due}</span></div>`).join("") || "<p class='muted'>Chưa có.</p>"}</div>`;
  el.querySelector("#exp").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" })); a.download = `english-backup-${today()}.json`; a.click(); };
  el.querySelector("#impb").onclick = () => el.querySelector("#imp").click();
  el.querySelector("#imp").onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { S = JSON.parse(t); save(); show("progress"); alert("Đã khôi phục!"); } catch { alert("File không hợp lệ"); } }); };
  el.querySelector("#reset").onclick = () => { if (confirm("Xóa toàn bộ tiến độ?")) { localStorage.removeItem(KEY); location.reload(); } };
};

renderStats();
show("today");
