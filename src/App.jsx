import { useState, useEffect, useRef, useCallback, memo } from "react";

// ─── SEED & ANGLE ─────────────────────────────────────────────────────────────
function seedFromDate(d) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function getAngleForSeed(seed) {
  let s = (seed + 99991) >>> 0;
  s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b)) >>> 0;
  s = (Math.imul(s ^ (s >>> 16), 0x45d9f3b)) >>> 0;
  s = (s ^ (s >>> 16)) >>> 0;
  const candidates = [];
  for (let a = 10; a <= 350; a += 5)
    if (a !== 90 && a !== 180 && a !== 270) candidates.push(a);
  return candidates[s % candidates.length];
}
function formatDate(d) {
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}
function isToday(d) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

const LS = "angolo_";
const MAX_TRIES = 4;

// ─── FEEDBACK ─────────────────────────────────────────────────────────────────
function getFeedback(absDiff, guess, target) {
  const arrow = guess > target ? "↓" : guess < target ? "↑" : "";
  if (absDiff === 0) return { label: "🎯 Perfetto!", color: "#6aaa64", arrow: "" };
  if (absDiff <= 5)  return { label: "🔥 Bollente!", color: "#e05252", arrow };
  if (absDiff <= 15) return { label: "♨️ Caldo!",   color: "#e07c30", arrow };
  if (absDiff <= 30) return { label: "🌡️ Tiepido",  color: "#c9b458", arrow };
  if (absDiff <= 50) return { label: "❄️ Freddo",   color: "#4e9ee8", arrow };
  return                     { label: "🧊 Glaciale", color: "#818384", arrow };
}

// ─── STREAK ───────────────────────────────────────────────────────────────────
function computeStreak() {
  const today = new Date();
  let streak = 0;
  const todaySeed = seedFromDate(today);
  let todayWon = false;
  try { const t = JSON.parse(localStorage.getItem(LS + "game_" + todaySeed) || "null"); todayWon = t?.won === true; } catch {}
  const startOffset = todayWon ? 0 : 1;
  for (let i = startOffset; i <= 365; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    try {
      const saved = JSON.parse(localStorage.getItem(LS + "game_" + seedFromDate(d)) || "null");
      if (saved?.won === true) streak++;
      else break;
    } catch { break; }
  }
  return streak;
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
function spawnConfetti() {
  const colors = ["#6aaa64", "#c9b458", "#538d4e", "#b59f3b", "#ffffff", "#85c0f9"];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;top:0;left:${Math.random() * 100}vw;
      width:${5 + Math.random() * 7}px;height:${7 + Math.random() * 9}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      border-radius:${Math.random() > 0.5 ? "50%" : "2px"};pointer-events:none;z-index:9999;
      animation:confettiFall ${1.5 + Math.random() * 2}s ease-out forwards;
      animation-delay:${Math.random() * 0.6}s;`;
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove());
  }
}

// ─── CANVAS ANGLE ─────────────────────────────────────────────────────────────
function drawAngle(canvas, angleDeg) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const len = Math.min(W, H) * 0.38;
  // Base ray goes right-downward; second ray rotates by angleDeg counterclockwise
  const baseAngle = Math.PI * 1.1;
  const secondAngle = baseAngle - (angleDeg * Math.PI / 180);

  // Rays
  ctx.strokeStyle = "#e05252";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(baseAngle) * len, cy + Math.sin(baseAngle) * len);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(secondAngle) * len, cy + Math.sin(secondAngle) * len);
  ctx.stroke();

  // Arc
  const arcR = len * 0.36;
  ctx.strokeStyle = "#5bc4d4";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, arcR, secondAngle, baseAngle);
  ctx.stroke();

  // Vertex dot
  ctx.fillStyle = "#5bc4d4";
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fill();
}

// ─── COUNTDOWN ────────────────────────────────────────────────────────────────
const Countdown = memo(function Countdown() {
  const [time, setTime] = useState("--:--:--");
  useEffect(() => {
    function tick() {
      const now = new Date();
      const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
      const diff = midnight - now;
      const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setTime(`${h}:${m}:${s}`);
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="countdown-time">{time}</span>;
});

// ─── STYLES ───────────────────────────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#121213;--surface:#1a1a1b;--border:#3a3a3c;
  --text:#fff;--muted:#818384;
  --correct:#6aaa64;--present:#c9b458;--absent:#3a3a3c;
  --share-bg:#0e0e0f;
}
.light{
  --bg:#f9f9f9;--surface:#fff;--border:#d3d6da;
  --text:#1a1a1b;--muted:#6e7275;
  --share-bg:#e8e8e8;
}
.light .btn-secondary{background:#c5c7c9!important;color:#1a1a1b!important}
.light .toast{background:#1a1a1b;color:#fff}

.angolo-root{
  background:var(--bg);color:var(--text);
  font-family:'Inter',sans-serif;
  display:flex;flex-direction:column;align-items:center;
  width:100%;min-height:100dvh;
  transition:background .25s,color .25s;
}
@keyframes confettiFall{0%{transform:translateY(-10px) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
@keyframes streakPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}

.header{
  width:100%;max-width:480px;
  display:grid;grid-template-columns:1fr auto 1fr;
  align-items:center;padding:10px 10px 8px;
  border-bottom:1px solid var(--border);flex-shrink:0;
}
.header-left{display:flex;justify-content:flex-start;align-items:center;gap:2px}
.header-right{display:flex;justify-content:flex-end;align-items:center;gap:2px}
.header-center{display:flex;flex-direction:column;align-items:center;gap:1px;}
.header-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:3px;line-height:1;white-space:nowrap;color:var(--text);}
.header-date{font-size:10px;color:var(--muted);letter-spacing:.3px}

.icon-btn{
  background:none;border:none;cursor:pointer;color:var(--muted);
  font-size:16px;line-height:1;
  display:flex;align-items:center;justify-content:center;
  width:28px;height:28px;border-radius:6px;transition:color .2s,background .2s;
}
.icon-btn:hover{color:var(--text);background:rgba(128,128,128,.12)}
.streak-badge{
  display:flex;align-items:center;gap:2px;font-size:12px;font-weight:700;color:#f5a000;
  padding:2px 6px;border-radius:10px;
  background:rgba(245,160,0,.12);border:1px solid rgba(245,160,0,.25);
  margin-right:2px;white-space:nowrap;
}
.streak-badge.pulse{animation:streakPulse .4s ease}

.toast-container{
  position:fixed;top:56px;left:50%;transform:translateX(-50%);
  display:flex;flex-direction:column;align-items:center;gap:8px;
  z-index:100;pointer-events:none;
}
.toast{
  background:var(--text);color:var(--bg);
  font-weight:700;font-size:13px;padding:9px 16px;border-radius:6px;
  animation:fadeIn .2s ease both;white-space:nowrap;
}

.game-area{
  flex:1;width:100%;max-width:480px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:14px;padding:16px 8px 20px;
}
.canvas-wrap{
  display:flex;align-items:center;justify-content:center;
  background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:8px;
}
canvas{display:block;}

.input-row{display:flex;gap:8px;width:100%;max-width:320px;align-items:center;}
.angle-input{
  flex:1;background:var(--surface);border:2px solid var(--border);border-radius:8px;
  color:var(--text);font-family:'Inter',sans-serif;font-size:20px;font-weight:700;
  padding:10px 14px;text-align:center;outline:none;
  transition:border-color .15s;
}
.angle-input:focus{border-color:#818384;}
.angle-input::placeholder{color:var(--muted);}
.angle-input:disabled{opacity:.5;}
.btn-guess{
  padding:10px 20px;border-radius:8px;border:none;
  background:var(--correct);color:#fff;font-family:'Inter',sans-serif;font-weight:700;font-size:14px;
  cursor:pointer;transition:filter .15s;white-space:nowrap;
}
.btn-guess:hover{filter:brightness(1.12)}
.btn-guess:disabled{background:var(--absent);cursor:not-allowed;filter:none;}

.attempts-list{width:100%;max-width:320px;display:flex;flex-direction:column;gap:6px;}
.attempt-row{
  display:grid;grid-template-columns:64px 1fr 40px;
  align-items:center;gap:6px;
  background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;
  animation:slideIn .2s ease both;
}
.attempt-deg{font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--text);text-align:center;}
.attempt-label{font-size:13px;font-weight:700;text-align:center;}
.attempt-arrow{font-size:20px;font-weight:700;text-align:center;}
.attempt-counter{font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.5px;text-align:center;min-height:15px;}

.overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.82);
  display:flex;align-items:center;justify-content:center;
  z-index:200;padding:16px;
}
.modal{
  background:var(--surface);border:1px solid var(--border);border-radius:14px;
  width:100%;max-width:340px;padding:20px 16px;
  display:flex;flex-direction:column;align-items:center;gap:13px;
  animation:slideUp .25s ease both;
  max-height:90dvh;overflow-y:auto;
}
.modal-handle{width:36px;height:4px;border-radius:2px;background:var(--border);margin-bottom:-4px;flex-shrink:0;}
.modal h2{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:2px;color:var(--text)}
.modal p{font-size:13px;color:var(--muted);text-align:center;line-height:1.5}
.modal-answer{
  font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:4px;
  color:var(--correct);background:rgba(106,170,100,.12);
  padding:6px 24px;border-radius:8px;border:1px solid rgba(106,170,100,.3);
}
.modal-answer.wrong{color:#e05252;background:rgba(224,82,82,.12);border-color:rgba(224,82,82,.3);}
.countdown-wrap{
  display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;
  padding:10px;border-radius:10px;border:1px solid var(--border);
  background:rgba(255,255,255,.03);
}
.countdown-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px}
.countdown-time{font-family:'Bebas Neue',sans-serif;font-size:34px;letter-spacing:4px;color:var(--text);line-height:1}

.btn{
  padding:11px 16px;border-radius:8px;border:none;
  font-family:'Inter',sans-serif;font-weight:700;font-size:13px;
  cursor:pointer;transition:filter .15s,transform .1s;
  white-space:nowrap;color:#fff!important;touch-action:manipulation;
}
.btn:hover{filter:brightness(1.12)}
.btn:active{transform:scale(.97)}
.btn-primary{background:var(--correct)}
.btn-secondary{background:#4a4a4c}
.btn-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;width:100%}

.tutorial-item{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted);text-align:left;width:100%;}
.tutorial-badge{min-width:84px;padding:4px 8px;border-radius:6px;font-weight:700;font-size:12px;text-align:center;color:#fff;}

/* Archive */
.archive-grid{
  display:grid;grid-template-columns:repeat(7,1fr);gap:4px;width:100%;
}
.archive-cell{
  aspect-ratio:1;border-radius:6px;border:1px solid var(--border);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  font-size:10px;cursor:pointer;transition:background .15s;
  background:var(--surface);color:var(--text);
  padding:2px;
}
.archive-cell:hover{background:var(--border)}
.archive-cell.won{background:rgba(106,170,100,.18);border-color:rgba(106,170,100,.5)}
.archive-cell.lost{background:rgba(224,82,82,.15);border-color:rgba(224,82,82,.4)}
.archive-cell.today{border-color:var(--text);font-weight:700}
.archive-cell .arc-day{font-family:'Bebas Neue',sans-serif;font-size:14px;line-height:1}
.archive-month{font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.5px;text-align:left;width:100%;margin-top:6px;}
`;

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AngoloQuiz() {
  const today = new Date();
  const todaySeed = seedFromDate(today);

  const [archiveDate, setArchiveDate] = useState(null); // null = today
  const activeSeed = archiveDate ? seedFromDate(archiveDate) : todaySeed;
  const target = getAngleForSeed(activeSeed);
  const isArchiveMode = archiveDate && !isToday(archiveDate);

  const loadGame = useCallback((seed) => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS + "game_" + seed) || "null");
      if (saved) return { guesses: saved.guesses || [], gameOver: saved.gameOver || false, won: saved.won || false };
    } catch {}
    return { guesses: [], gameOver: false, won: false };
  }, []);

  const [gameState, setGameState] = useState(() => loadGame(activeSeed));
  const { guesses, gameOver, won } = gameState;

  const [current, setCurrent] = useState("");
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [lightMode, setLightMode] = useState(() => {
    try { return localStorage.getItem(LS + "light") === "1"; } catch { return false; }
  });
  const [streak, setStreak] = useState(0);
  const [streakPulse, setStreakPulse] = useState(false);
  const canvasRef = useRef(null);
  const inputRef = useRef(null);

  // Reload when archiveDate changes
  useEffect(() => {
    setGameState(loadGame(activeSeed));
    setCurrent("");
    setModal(null);
  }, [activeSeed, loadGame]);

  useEffect(() => {
    drawAngle(canvasRef.current, target);
  }, [target]);

  useEffect(() => {
    setStreak(computeStreak());
  }, [gameOver]);

  // Auto-show end modal
  useEffect(() => {
    if (gameOver && modal === null) {
      const t = setTimeout(() => setModal("end"), 400);
      return () => clearTimeout(t);
    }
  }, [gameOver]);

  function toast(msg) {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 1800);
  }

  function saveGame(state) {
    try { localStorage.setItem(LS + "game_" + activeSeed, JSON.stringify(state)); } catch {}
  }

  function submitGuess() {
    if (gameOver) return;
    const val = parseInt(current);
    if (isNaN(val) || val < 1 || val > 359) { toast("Inserisci un angolo tra 1° e 359°"); return; }

    const newGuesses = [...guesses, val];
    const absDiff = Math.abs(val - target);
    const newWon = absDiff === 0;
    const newGameOver = newWon || newGuesses.length >= MAX_TRIES;

    const newState = { guesses: newGuesses, gameOver: newGameOver, won: newWon };
    setGameState(newState);
    saveGame(newState);
    setCurrent("");

    if (newGameOver) {
      if (newWon) {
        spawnConfetti();
        // Update streak
        const newStreak = computeStreak();
        if (newStreak > streak) { setStreakPulse(true); setTimeout(() => setStreakPulse(false), 500); }
      }
      setTimeout(() => setModal("end"), 600);
    }
  }

  function buildShare() {
    const icons = guesses.map(g => {
      const d = Math.abs(g - target);
      if (d === 0) return "🎯";
      if (d <= 5) return "🔥";
      if (d <= 15) return "♨️";
      if (d <= 30) return "🌡️";
      if (d <= 50) return "❄️";
      return "🧊";
    });
    const scoreStr = won ? `${guesses.length}/${MAX_TRIES}` : `X/${MAX_TRIES}`;
    const dateStr = formatDate(archiveDate || today);
    return `ANGOLO — ${dateStr}\n${scoreStr}\n${icons.join("")}`;
  }

  function getArchiveStatus(d) {
    try {
      const saved = JSON.parse(localStorage.getItem(LS + "game_" + seedFromDate(d)) || "null");
      if (!saved?.guesses?.length) return null;
      return saved.won ? "w" : "l";
    } catch { return null; }
  }

  const dateLabel = formatDate(archiveDate || today);

  // ─── MODALS ─────────────────────────────────────────────────────────────────
  function ModalTutorial() {
    return (
      <div className="overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
        <div className="modal">
          <div className="modal-handle" />
          <h2>Come si gioca</h2>
          <p>Indovina la misura dell'angolo in figura.<br />Hai <strong>{MAX_TRIES}</strong> tentativi.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            {[
              { label: "🎯 Perfetto!", color: "#6aaa64", desc: "Esatto al grado" },
              { label: "🔥 Bollente!", color: "#e05252", desc: "Distanza 1–5°" },
              { label: "♨️ Caldo!",   color: "#e07c30", desc: "Distanza 6–15°" },
              { label: "🌡️ Tiepido",  color: "#c9b458", desc: "Distanza 16–30°" },
              { label: "❄️ Freddo",   color: "#4e9ee8", desc: "Distanza 31–50°" },
              { label: "🧊 Glaciale", color: "#818384", desc: "Distanza >50°" },
            ].map(fb => (
              <div key={fb.label} className="tutorial-item">
                <span className="tutorial-badge" style={{ background: fb.color }}>{fb.label}</span>
                <span>{fb.desc}</span>
              </div>
            ))}
          </div>
          <p>La freccia <strong>↑ ↓</strong> indica se l'angolo cercato è più grande o più piccolo.</p>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setModal(null)}>Inizia!</button>
        </div>
      </div>
    );
  }

  function ModalEnd() {
    const shareText = buildShare();
    return (
      <div className="overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
        <div className="modal">
          <div className="modal-handle" />
          <h2>{won ? "Ottimo!" : "Fine!"}</h2>
          <div className={`modal-answer${won ? "" : " wrong"}`}>{target}°</div>
          <p>{won ? `Indovinato in ${guesses.length}/${MAX_TRIES}` : "Non indovinato"}</p>
          {!isArchiveMode && (
            <div className="countdown-wrap">
              <span className="countdown-label">Prossimo angolo tra</span>
              <Countdown />
            </div>
          )}
          <div className="btn-row">
            <button className="btn btn-primary" onClick={() => {
              navigator.clipboard?.writeText(shareText).then(() => { toast("Copiato!"); }).catch(() => toast("Copia: " + shareText));
            }}>Condividi</button>
            <button className="btn btn-secondary" onClick={() => { setModal("archive"); }}>Archivio</button>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Chiudi</button>
          </div>
        </div>
      </div>
    );
  }

  function ModalArchive() {
    // Show last 28 days + today
    const days = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      days.push(d);
    }
    return (
      <div className="overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
        <div className="modal">
          <div className="modal-handle" />
          <h2>Archivio</h2>
          <div className="archive-grid">
            {days.map((d, i) => {
              const status = getArchiveStatus(d);
              const isTod = isToday(d);
              let cls = "archive-cell";
              if (status === "w") cls += " won";
              else if (status === "l") cls += " lost";
              if (isTod) cls += " today";
              return (
                <div key={i} className={cls} onClick={() => {
                  setArchiveDate(isTod ? null : d);
                  setModal(null);
                }}>
                  <span className="arc-day">{d.getDate()}</span>
                  <span style={{ fontSize: 9, color: "var(--muted)" }}>{d.toLocaleDateString("it-IT", { month: "short" })}</span>
                  {status === "w" && <span style={{ fontSize: 10 }}>✓</span>}
                  {status === "l" && <span style={{ fontSize: 10 }}>✗</span>}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11 }}>
            <span style={{ color: "#6aaa64", marginRight: 8 }}>■ Indovinato</span>
            <span style={{ color: "#e05252" }}>■ Non indovinato</span>
          </p>
          <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setModal(null)}>Chiudi</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className={`angolo-root${lightMode ? " light" : ""}`}>

        <div className="toast-container">
          {toasts.map(t => <div key={t.id} className="toast">{t.msg}</div>)}
        </div>

        <header className="header">
          <div className="header-left">
            <button className="icon-btn" onClick={() => setModal("tutorial")} title="Come si gioca">?</button>
          </div>
          <div className="header-center">
            <span className="header-title">ANGOLO{isArchiveMode ? " 📅" : ""}</span>
            <span className="header-date">{dateLabel}</span>
          </div>
          <div className="header-right">
            {streak >= 2 && (
              <div className={`streak-badge${streakPulse ? " pulse" : ""}`}>🔥{streak}</div>
            )}
            <button className="icon-btn" title="Tema" onClick={() => {
              setLightMode(n => { const v = !n; try { localStorage.setItem(LS + "light", v ? "1" : "0"); } catch {} return v; });
            }}>{lightMode ? "🌙" : "☀️"}</button>
            <button className="icon-btn" title="Archivio" style={{ fontSize: 15 }} onClick={() => setModal("archive")}>◷</button>
          </div>
        </header>

        <div className="game-area">
          <div className="canvas-wrap">
            <canvas ref={canvasRef} width={260} height={220} />
          </div>

          <div className="input-row">
            <input
              ref={inputRef}
              className="angle-input"
              type="number"
              min={1}
              max={359}
              placeholder="°"
              value={current}
              disabled={gameOver}
              onChange={e => setCurrent(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitGuess(); }}
            />
            <button
              className="btn-guess"
              disabled={gameOver}
              onClick={submitGuess}
            >Indovina!</button>
          </div>

          <div className="attempt-counter">
            {!gameOver && `${guesses.length}/${MAX_TRIES}`}
          </div>

          <div className="attempts-list">
            {guesses.map((g, i) => {
              const absDiff = Math.abs(g - target);
              const fb = getFeedback(absDiff, g, target);
              return (
                <div key={i} className="attempt-row">
                  <span className="attempt-deg">{g}°</span>
                  <span className="attempt-label" style={{ color: fb.color }}>{fb.label}</span>
                  <span className="attempt-arrow" style={{ color: fb.color }}>{fb.arrow}</span>
                </div>
              );
            })}
          </div>
        </div>

        {modal === "tutorial" && <ModalTutorial />}
        {modal === "end"      && <ModalEnd />}
        {modal === "archive"  && <ModalArchive />}
      </div>
    </>
  );
}
