import { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, User } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where, onSnapshot, serverTimestamp, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment } from "firebase/firestore";
import QRCode from "qrcode";
import "./App.css";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBKJEniid1KLEyO-gJKFoMVOCNR1fMKO0I",
  authDomain: "voiceme-3c90b.firebaseapp.com",
  projectId: "voiceme-3c90b",
  storageBucket: "voiceme-3c90b.firebasestorage.app",
  messagingSenderId: "945997974995",
  appId: "1:945997974995:web:3e64c86b52a28268e03fba",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const VAPID_PUBLIC = "BGTg5ddUvPcvHTwApXthOHJSNklchloKvnrtre6HMAkO9ypJ_wP9kuDvaPGnzccaaFczuBj6VDmpXHcZRDnHi5U";
const PUSH_BACKEND = "https://app-vdlmhgya.fly.dev";

// Sound Generator (Web Audio API - zero files)
const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
let audioCtx: AudioContext | null = null;
function getACtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

type SoundDef = { name: string; emoji: string; color: string; play: () => void };

function createSounds(): SoundDef[] {
  const tone = (freq: number, dur: number, type: OscillatorType = "sine", vol = 0.5) => {
    const c = getACtx(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(c.destination);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.start(); o.stop(c.currentTime + dur);
  };
  return [
    { name: "Bip", emoji: "\uD83D\uDD14", color: "#00FF88", play: () => { tone(880, 0.15); setTimeout(() => tone(1100, 0.15), 160); } },
    { name: "Alarme", emoji: "\uD83D\uDEA8", color: "#FF0066", play: () => { for (let i = 0; i < 6; i++) setTimeout(() => tone(i % 2 === 0 ? 800 : 600, 0.12, "square", 0.3), i * 130); } },
    { name: "Klaxon", emoji: "\uD83D\uDE97", color: "#FFB800", play: () => { tone(300, 0.5, "sawtooth", 0.4); setTimeout(() => tone(250, 0.5, "sawtooth", 0.4), 500); } },
    { name: "Laser", emoji: "\uD83D\uDD2B", color: "#00BBFF", play: () => { const c = getACtx(), o = c.createOscillator(), g = c.createGain(); o.type = "sawtooth"; o.frequency.value = 1500; o.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.5); g.gain.value = 0.3; g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.5); } },
    { name: "Bisou", emoji: "\uD83D\uDE18", color: "#FF69B4", play: () => { tone(600, 0.08); setTimeout(() => tone(900, 0.06), 100); setTimeout(() => tone(1200, 0.1), 170); } },
    { name: "Boom", emoji: "\uD83D\uDCA5", color: "#FF3B00", play: () => { const c = getACtx(), o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = 150; o.frequency.exponentialRampToValueAtTime(30, c.currentTime + 0.8); g.gain.value = 0.6; g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.8); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.8); } },
    { name: "Fantome", emoji: "\uD83D\uDC7B", color: "#9B59B6", play: () => { const c = getACtx(), o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = 400; o.frequency.linearRampToValueAtTime(800, c.currentTime + 0.3); o.frequency.linearRampToValueAtTime(200, c.currentTime + 0.6); g.gain.value = 0.3; g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.8); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.8); } },
    { name: "Victoire", emoji: "\uD83C\uDFC6", color: "#FFD700", play: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.2, "triangle", 0.4), i * 150)); } },
    { name: "Robot", emoji: "\uD83E\uDD16", color: "#00CED1", play: () => { for (let i = 0; i < 8; i++) setTimeout(() => tone(200 + Math.random() * 800, 0.05, "square", 0.2), i * 60); } },
    { name: "Sirene", emoji: "\uD83D\uDE91", color: "#FF4444", play: () => { const c = getACtx(), o = c.createOscillator(), g = c.createGain(); o.type = "sine"; g.gain.value = 0.3; o.connect(g); g.connect(c.destination); o.start(); const n = c.currentTime; for (let i = 0; i < 4; i++) { o.frequency.setValueAtTime(600, n + i * 0.4); o.frequency.linearRampToValueAtTime(900, n + i * 0.4 + 0.2); o.frequency.linearRampToValueAtTime(600, n + i * 0.4 + 0.4); } g.gain.exponentialRampToValueAtTime(0.001, n + 1.6); o.stop(n + 1.6); } },
    { name: "Meow", emoji: "\uD83D\uDC31", color: "#FFA07A", play: () => { const c = getACtx(), o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = 700; o.frequency.exponentialRampToValueAtTime(400, c.currentTime + 0.4); g.gain.value = 0.35; g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.5); } },
    { name: "Prout", emoji: "\uD83D\uDCA8", color: "#8B4513", play: () => { const c = getACtx(), buf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) { const t = i / c.sampleRate; d[i] = Math.sin(2 * Math.PI * (80 + Math.sin(t * 15) * 30) * t) * Math.exp(-t * 3) * 0.5 + (Math.random() - 0.5) * 0.1 * Math.exp(-t * 5); } const s = c.createBufferSource(); s.buffer = buf; const g = c.createGain(); g.gain.value = 0.6; s.connect(g); g.connect(c.destination); s.start(); } },
  ];
}

// Particle Animation
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }

function AnimOverlay({ particles }: { particles: Particle[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pRef = useRef(particles);
  pRef.current = particles;
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    let on = true;
    let frame = 0;
    const loop = () => {
      if (!on) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      pRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.02;
        if (p.life <= 0) return;
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => { on = false; cancelAnimationFrame(frame); };
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999 }} />;
}

function spawnP(color: string): Particle[] {
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  return Array.from({ length: 40 }, () => ({
    x: cx + (Math.random() - 0.5) * 100, y: cy + (Math.random() - 0.5) * 100,
    vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15 - 5,
    life: 1, color, size: 4 + Math.random() * 8,
  }));
}

// CSS Animations
const CSS = `
@keyframes shockwave { 0% { transform:scale(0);opacity:.8 } 100% { transform:scale(3);opacity:0 } }
@keyframes float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-10px) } }
@keyframes glow-pulse { 0%,100% { box-shadow:0 0 20px rgba(0,255,136,.3) } 50% { box-shadow:0 0 40px rgba(0,255,136,.6),0 0 80px rgba(0,255,136,.2) } }
@keyframes shake { 0%,100% { transform:translateX(0) } 25% { transform:translateX(-5px) rotate(-1deg) } 75% { transform:translateX(5px) rotate(1deg) } }
@keyframes ping-ring { 0% { transform:scale(1);opacity:1 } 100% { transform:scale(2.5);opacity:0 } }
@keyframes slide-up { from { transform:translateY(100%);opacity:0 } to { transform:translateY(0);opacity:1 } }
@keyframes fade-in { from { opacity:0;transform:scale(.9) } to { opacity:1;transform:scale(1) } }
@keyframes bounce-in { 0% { transform:scale(.3);opacity:0 } 50% { transform:scale(1.05) } 70% { transform:scale(.95) } 100% { transform:scale(1);opacity:1 } }
@keyframes neon-flicker { 0%,19%,21%,23%,25%,54%,56%,100% { text-shadow:0 0 10px currentColor,0 0 20px currentColor,0 0 40px currentColor } 20%,24%,55% { text-shadow:none } }
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; margin:0; padding:0; }
input { font-family:inherit }
::-webkit-scrollbar { width:4px } ::-webkit-scrollbar-track { background:transparent } ::-webkit-scrollbar-thumb { background:#333;border-radius:2px }
`;

// Types
type Screen = "auth" | "home" | "friends" | "qr" | "profile";
interface Prof { uid: string; username: string; email: string; createdAt?: any; friends?: string[]; pingsSent?: number; pingsReceived?: number; pushEndpoint?: string; pushP256dh?: string; pushAuth?: string; }
interface PingMsg { id: string; from: string; fromName: string; to: string; sound: string; soundEmoji: string; timestamp: any; seen: boolean; }
interface FReq { id: string; from: string; fromName: string; to: string; status: string; timestamp: any; }

// Bottom Nav
function Nav({ screen, setScreen }: { screen: Screen; setScreen: (s: Screen) => void }) {
  const items: { icon: string; label: string; s: Screen }[] = [
    { icon: "\uD83C\uDFE0", label: "Pings", s: "home" },
    { icon: "\uD83D\uDC65", label: "Amis", s: "friends" },
    { icon: "\uD83D\uDCF7", label: "QR", s: "qr" },
    { icon: "\uD83D\uDC64", label: "Profil", s: "profile" },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "space-around", padding: "12px 0 20px", background: "linear-gradient(transparent, #0a0a0f 30%)", borderTop: "1px solid #1a1a2e", zIndex: 100 }}>
      {items.map(it => (
        <button key={it.s} onClick={() => setScreen(it.s)} style={{ background: "none", border: "none", color: screen === it.s ? "#00FF88" : "#555", fontSize: 11, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", padding: "4px 12px" }}>
          <span style={{ fontSize: 22, filter: screen === it.s ? "drop-shadow(0 0 8px #00FF88)" : "none" }}>{it.icon}</span>
          <span style={{ fontWeight: screen === it.s ? 700 : 400 }}>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

// Auth Screen
function AuthScreen({ onDone }: { onDone: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [uname, setUname] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setErr(""); setBusy(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, pw);
      } else {
        if (!uname.trim() || uname.length < 3) { setErr("Pseudo: 3 caracteres minimum"); setBusy(false); return; }
        const snap = await getDocs(query(collection(db, "ping_profiles"), where("username", "==", uname.toLowerCase().trim())));
        if (!snap.empty) { setErr("Ce pseudo est deja pris!"); setBusy(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, pw);
        await setDoc(doc(db, "ping_profiles", cred.user.uid), {
          uid: cred.user.uid, username: uname.toLowerCase().trim(), email,
          createdAt: serverTimestamp(), friends: [], pingsSent: 0, pingsReceived: 0,
        });
      }
      onDone();
    } catch (e: any) {
      if (e.code === "auth/email-already-in-use") setErr("Email deja utilise");
      else if (e.code === "auth/invalid-credential") setErr("Email ou mot de passe incorrect");
      else if (e.code === "auth/weak-password") setErr("Mot de passe trop faible (6 car. min)");
      else setErr(e.message);
    }
    setBusy(false);
  };

  const inp: React.CSSProperties = { width: "100%", padding: "14px 16px", borderRadius: 12, border: "1px solid #1a1a2e", background: "#111118", color: "#fff", fontSize: 16, marginBottom: 12, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: "radial-gradient(circle at 50% 30%, #0f1a0f, #0a0a0f)" }}>
      <div style={{ animation: "float 3s ease-in-out infinite", marginBottom: 32, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 8, filter: "drop-shadow(0 0 30px #00FF88)" }}>{"\uD83D\uDD14"}</div>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: "#00FF88", letterSpacing: 8, animation: "neon-flicker 3s infinite", margin: 0 }}>PING</h1>
        <p style={{ color: "#666", fontSize: 14, marginTop: 8 }}>Sonne tes potes</p>
      </div>
      <div style={{ width: "100%", maxWidth: 340, animation: "fade-in 0.5s ease-out" }}>
        {!isLogin && <input value={uname} onChange={e => setUname(e.target.value)} placeholder="Pseudo" style={inp} />}
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" style={inp} />
        <input value={pw} onChange={e => setPw(e.target.value)} placeholder="Mot de passe" type="password" style={{ ...inp, marginBottom: 16 }} onKeyDown={e => e.key === "Enter" && go()} />
        {err && <div style={{ color: "#FF0066", fontSize: 13, marginBottom: 12, textAlign: "center" }}>{err}</div>}
        <button onClick={go} disabled={busy} style={{ width: "100%", padding: 16, borderRadius: 12, border: "none", background: "linear-gradient(135deg, #00FF88, #00BBFF)", color: "#000", fontSize: 18, fontWeight: 800, cursor: "pointer", letterSpacing: 2, boxShadow: "0 0 30px rgba(0,255,136,0.3)" }}>
          {busy ? "..." : isLogin ? "ENTRER" : "CREER MON COMPTE"}
        </button>
        <button onClick={() => { setIsLogin(!isLogin); setErr(""); }} style={{ width: "100%", padding: 12, marginTop: 12, borderRadius: 12, border: "1px solid #1a1a2e", background: "transparent", color: "#888", fontSize: 14, cursor: "pointer" }}>
          {isLogin ? "Pas de compte ? Inscription" : "Deja un compte ? Connexion"}
        </button>
      </div>
    </div>
  );
}

// Home Screen
function HomeScreen({ profile: _profile, friends, pings, freqs, sounds, onPing, onAccept, onDecline, onMarkSeen, setScreen, triggerAnim }: {
  profile: Prof | null; friends: Prof[]; pings: PingMsg[]; freqs: FReq[]; sounds: SoundDef[];
  onPing: (uid: string, s: SoundDef) => void; onAccept: (r: FReq) => void; onDecline: (r: FReq) => void;
  onMarkSeen: (id: string) => void; setScreen: (s: Screen) => void; triggerAnim: (c: string) => void;
}) {
  const unseen = pings.filter(p => !p.seen);
  const [target, setTarget] = useState<Prof | null>(null);
  const [picker, setPicker] = useState(false);

  const playReceived = (p: PingMsg) => {
    const s = sounds.find(sd => sd.name === p.sound);
    if (s) { s.play(); triggerAnim(s.color); }
    onMarkSeen(p.id);
  };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1a1a2e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>{"\uD83D\uDD14"}</span>
          <span style={{ fontSize: 24, fontWeight: 900, color: "#00FF88", letterSpacing: 4 }}>PING</span>
        </div>
        {freqs.length > 0 && (
          <div style={{ background: "#FF0066", color: "#fff", borderRadius: 20, padding: "4px 10px", fontSize: 12, fontWeight: 700, animation: "shake 0.5s infinite" }}>
            {freqs.length} demande{freqs.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {freqs.length > 0 && (
        <div style={{ padding: "12px 20px" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 2 }}>Demandes d&apos;amis</div>
          {freqs.map(r => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#111118", borderRadius: 12, marginBottom: 8, animation: "slide-up 0.3s ease-out" }}>
              <span style={{ color: "#fff", fontWeight: 600 }}>@{r.fromName}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onAccept(r)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#00FF88", color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Accepter</button>
                <button onClick={() => onDecline(r)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#333", color: "#888", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Non</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {unseen.length > 0 && (
        <div style={{ padding: "12px 20px" }}>
          <div style={{ fontSize: 12, color: "#FF0066", marginBottom: 8, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700 }}>
            {"\uD83D\uDD14"} {unseen.length} nouveau{unseen.length > 1 ? "x" : ""} ping{unseen.length > 1 ? "s" : ""}!
          </div>
          {unseen.slice(0, 5).map(p => (
            <button key={p.id} onClick={() => playReceived(p)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", background: "linear-gradient(135deg, #1a0a1a, #0a1a0a)", border: "1px solid #FF006633", borderRadius: 12, marginBottom: 8, cursor: "pointer", animation: "shake 1s infinite", textAlign: "left" as const }}>
              <span style={{ fontSize: 32 }}>{p.soundEmoji}</span>
              <div>
                <div style={{ color: "#FF0066", fontWeight: 700, fontSize: 14 }}>@{p.fromName}</div>
                <div style={{ color: "#666", fontSize: 12 }}>Tap pour ecouter le {p.sound}!</div>
              </div>
              <div style={{ marginLeft: "auto", width: 12, height: 12, borderRadius: "50%", background: "#FF0066", animation: "ping-ring 1s infinite", boxShadow: "0 0 10px #FF0066", flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: "12px 20px" }}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 12, textTransform: "uppercase", letterSpacing: 2 }}>Tes potes ({friends.length})</div>
        {friends.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{"\uD83D\uDC7B"}</div>
            <div style={{ fontSize: 14 }}>Personne ici... Ajoute des potes!</div>
            <button onClick={() => setScreen("friends")} style={{ marginTop: 16, padding: "10px 24px", borderRadius: 10, border: "none", background: "#00FF88", color: "#000", fontWeight: 700, cursor: "pointer" }}>Ajouter des amis</button>
          </div>
        )}
        {friends.map(f => {
          const fp = pings.filter(p => p.from === f.uid && !p.seen);
          return (
            <div key={f.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#111118", borderRadius: 14, marginBottom: 10, animation: "fade-in 0.3s ease-out", border: fp.length > 0 ? "1px solid #FF006644" : "1px solid #1a1a2e" }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg, " + (fp.length > 0 ? "#FF0066" : "#00FF88") + ", #00BBFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#000", flexShrink: 0 }}>
                {f.username?.[0]?.toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>@{f.username}</div>
                <div style={{ color: "#555", fontSize: 12 }}>{f.pingsSent || 0} envoyes / {f.pingsReceived || 0} recus</div>
              </div>
              <button onClick={() => { setTarget(f); setPicker(true); }} style={{ width: 50, height: 50, borderRadius: "50%", border: "none", background: "linear-gradient(135deg, #00FF88, #00BBFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, cursor: "pointer", boxShadow: "0 0 20px rgba(0,255,136,0.3)", animation: "glow-pulse 2s infinite", flexShrink: 0 }}>
                {"\uD83D\uDD14"}
              </button>
            </div>
          );
        })}
      </div>

      {picker && target && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9000, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setPicker(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111118", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", maxHeight: "70vh", overflow: "auto", animation: "slide-up 0.3s ease-out" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "#333", margin: "0 auto 16px" }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Ping @{target.username}</div>
              <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>Choisis un son</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {sounds.map(s => (
                <button key={s.name} onClick={() => { onPing(target.uid, s); setPicker(false); }}
                  style={{ padding: 16, borderRadius: 16, border: "2px solid " + s.color + "33", background: "#0a0a0f", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
                  <span style={{ fontSize: 32, filter: "drop-shadow(0 0 10px " + s.color + ")" }}>{s.emoji}</span>
                  <span style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Nav screen="home" setScreen={setScreen} />
    </div>
  );
}

// Friends Screen
function FriendsScreen({ profile, friends, onReq, onRemove, setScreen, uid }: {
  profile: Prof | null; friends: Prof[]; onReq: (uid: string) => void; onRemove: (uid: string) => void; setScreen: (s: Screen) => void; uid: string | undefined;
}) {
  const [term, setTerm] = useState("");
  const [res, setRes] = useState<Prof[]>([]);
  const [searched, setSearched] = useState(false);
  const [sent, setSent] = useState<string[]>([]);
  const search = async () => {
    if (!term.trim()) return; setSearched(true);
    const snap = await getDocs(query(collection(db, "ping_profiles"), where("username", "==", term.toLowerCase().trim())));
    const r: Prof[] = []; snap.forEach(d => { if (d.id !== uid) r.push(d.data() as Prof); }); setRes(r);
  };
  const inp: React.CSSProperties = { flex: 1, padding: "12px 16px", borderRadius: 12, border: "1px solid #1a1a2e", background: "#111118", color: "#fff", fontSize: 15, outline: "none" };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #1a1a2e" }}>
        <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: "#00FF88", fontSize: 24, cursor: "pointer" }}>{"\u2190"}</button>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Ajouter des amis</span>
      </div>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={term} onChange={e => setTerm(e.target.value)} placeholder="Rechercher un pseudo..." onKeyDown={e => e.key === "Enter" && search()} style={inp} />
          <button onClick={search} style={{ padding: "12px 20px", borderRadius: 12, border: "none", background: "#00FF88", color: "#000", fontWeight: 700, cursor: "pointer" }}>{"\uD83D\uDD0D"}</button>
        </div>
        {searched && res.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#555" }}>Aucun resultat</div>}
        {res.map(r => (
          <div key={r.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#111118", borderRadius: 12, marginTop: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #00FF88, #00BBFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#000" }}>{r.username?.[0]?.toUpperCase()}</div>
            <div style={{ flex: 1 }}><div style={{ color: "#fff", fontWeight: 600 }}>@{r.username}</div></div>
            {profile?.friends?.includes(r.uid) ? <span style={{ color: "#00FF88", fontSize: 13 }}>Deja amis</span>
              : sent.includes(r.uid) ? <span style={{ color: "#FFB800", fontSize: 13 }}>Envoye!</span>
              : <button onClick={() => { onReq(r.uid); setSent([...sent, r.uid]); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#00FF88", color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Ajouter</button>}
          </div>
        ))}
      </div>
      <div style={{ padding: "0 20px" }}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8, textTransform: "uppercase", letterSpacing: 2 }}>Tes potes ({friends.length})</div>
        {friends.map(f => (
          <div key={f.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#111118", borderRadius: 12, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #00FF88, #00BBFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#000" }}>{f.username?.[0]?.toUpperCase()}</div>
            <div style={{ flex: 1 }}><div style={{ color: "#fff", fontWeight: 600 }}>@{f.username}</div></div>
            <button onClick={() => { if (confirm("Retirer @" + f.username + " ?")) onRemove(f.uid); }} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #FF006644", background: "transparent", color: "#FF0066", fontSize: 12, cursor: "pointer" }}>Retirer</button>
          </div>
        ))}
      </div>
      <Nav screen="friends" setScreen={setScreen} />
    </div>
  );
}

// QR Screen
function QRScreen({ profile, onReq, setScreen }: { profile: Prof | null; onReq: (uid: string) => void; setScreen: (s: Screen) => void }) {
  const [qr, setQr] = useState("");
  const [scanning, setScanning] = useState(false);
  const vidRef = useRef<HTMLVideoElement>(null);
  const stRef = useRef<MediaStream | null>(null);
  const intRef = useRef<any>(null);

  useEffect(() => {
    if (profile?.uid) QRCode.toDataURL("ping:" + profile.uid + ":" + profile.username, { width: 250, margin: 2, color: { dark: "#00FF88", light: "#0a0a0f" } }).then(setQr);
  }, [profile]);

  const stopScan = useCallback(() => {
    setScanning(false);
    if (intRef.current) clearInterval(intRef.current);
    stRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const handleQR = useCallback((val: string) => {
    if (!val.startsWith("ping:")) return;
    const parts = val.split(":");
    const uid = parts[1]; const uname = parts[2];
    stopScan();
    if (uid && uid !== profile?.uid) { onReq(uid); alert("Demande envoyee a @" + uname + "!"); }
    else if (uid === profile?.uid) alert("C'est ton propre QR code!");
  }, [profile, onReq, stopScan]);

  const startScan = async () => {
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stRef.current = stream;
      if (vidRef.current) { vidRef.current.srcObject = stream; vidRef.current.play(); }
      intRef.current = setInterval(async () => {
        if (!vidRef.current) return;
        const cv = document.createElement("canvas");
        cv.width = vidRef.current.videoWidth; cv.height = vidRef.current.videoHeight;
        cv.getContext("2d")?.drawImage(vidRef.current, 0, 0);
        if ("BarcodeDetector" in window) {
          try {
            const det = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
            const bc = await det.detect(cv);
            if (bc.length > 0) handleQR(bc[0].rawValue);
          } catch { /* ignore */ }
        }
      }, 500);
    } catch { alert("Impossible d'acceder a la camera"); setScanning(false); }
  };

  const importQR = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]; if (!file) return;
      const img = new Image();
      img.onload = async () => {
        const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
        cv.getContext("2d")?.drawImage(img, 0, 0);
        if ("BarcodeDetector" in window) {
          try {
            const det = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
            const bc = await det.detect(cv);
            if (bc.length > 0) handleQR(bc[0].rawValue); else alert("Aucun QR code trouve");
          } catch { alert("Erreur de scan"); }
        } else { alert("BarcodeDetector non supporte sur ce navigateur"); }
      };
      img.src = URL.createObjectURL(file);
    };
    input.click();
  };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #1a1a2e" }}>
        <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: "#00FF88", fontSize: 24, cursor: "pointer" }}>{"\u2190"}</button>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>QR Code</span>
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ background: "#111118", borderRadius: 20, padding: 24, marginBottom: 24, border: "1px solid #00FF8833", boxShadow: "0 0 30px rgba(0,255,136,0.1)", animation: "fade-in 0.5s ease-out" }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: "#888" }}>Mon QR Code</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#00FF88" }}>@{profile?.username}</div>
          </div>
          {qr && <img src={qr} alt="QR" style={{ width: 250, height: 250, borderRadius: 12 }} />}
          <div style={{ textAlign: "center", marginTop: 12, color: "#555", fontSize: 12 }}>Montre ce QR a tes potes pour qu&apos;ils t&apos;ajoutent</div>
        </div>
        {scanning ? (
          <div style={{ width: "100%", maxWidth: 300 }}>
            <video ref={vidRef} style={{ width: "100%", borderRadius: 16, border: "2px solid #00FF88" }} />
            <button onClick={stopScan} style={{ width: "100%", marginTop: 12, padding: 14, borderRadius: 12, border: "none", background: "#FF0066", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Arreter le scan</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 300 }}>
            <button onClick={startScan} style={{ padding: 16, borderRadius: 12, border: "none", background: "linear-gradient(135deg, #00FF88, #00BBFF)", color: "#000", fontWeight: 800, fontSize: 16, cursor: "pointer", letterSpacing: 1, boxShadow: "0 0 20px rgba(0,255,136,0.3)" }}>
              {"\uD83D\uDCF7"} Scanner un QR Code
            </button>
            <button onClick={importQR} style={{ padding: 14, borderRadius: 12, border: "1px solid #1a1a2e", background: "#111118", color: "#888", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              {"\uD83D\uDCC1"} Importer une image QR
            </button>
          </div>
        )}
      </div>
      <Nav screen="qr" setScreen={setScreen} />
    </div>
  );
}

// Profile Screen
function ProfileScreen({ profile, onLogout, setScreen, pings }: { profile: Prof | null; onLogout: () => void; setScreen: (s: Screen) => void; pings: PingMsg[] }) {
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #1a1a2e" }}>
        <button onClick={() => setScreen("home")} style={{ background: "none", border: "none", color: "#00FF88", fontSize: 24, cursor: "pointer" }}>{"\u2190"}</button>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Mon Profil</span>
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 90, height: 90, borderRadius: "50%", background: "linear-gradient(135deg, #00FF88, #00BBFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 900, color: "#000", boxShadow: "0 0 30px rgba(0,255,136,0.3)", animation: "glow-pulse 2s infinite", marginBottom: 16 }}>
          {profile?.username?.[0]?.toUpperCase() || "?"}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#00FF88" }}>@{profile?.username}</div>
        <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>{profile?.email}</div>
        <div style={{ display: "flex", gap: 24, marginTop: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#00BBFF" }}>{profile?.pingsSent || 0}</div>
            <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Envoyes</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#FF0066" }}>{profile?.pingsReceived || 0}</div>
            <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Recus</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#FFB800" }}>{profile?.friends?.length || 0}</div>
            <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>Amis</div>
          </div>
        </div>
        <div style={{ width: "100%", marginTop: 32 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 12, textTransform: "uppercase", letterSpacing: 2 }}>Pings recents</div>
          {pings.length === 0 && <div style={{ color: "#444", textAlign: "center", padding: 20 }}>Aucun ping recu</div>}
          {pings.slice(0, 20).map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#111118", borderRadius: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>{p.soundEmoji}</span>
              <div style={{ flex: 1 }}><span style={{ color: "#aaa", fontSize: 13 }}>@{p.fromName}</span><span style={{ color: "#555", fontSize: 12, marginLeft: 8 }}>{p.sound}</span></div>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.seen ? "#333" : "#FF0066", display: "inline-block" }} />
            </div>
          ))}
        </div>
        <button onClick={onLogout} style={{ marginTop: 32, padding: "14px 40px", borderRadius: 12, border: "1px solid #FF006644", background: "transparent", color: "#FF0066", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Deconnexion</button>
      </div>
      <Nav screen="profile" setScreen={setScreen} />
    </div>
  );
}

// Main App
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<Screen>("auth");
  const [profile, setProfile] = useState<Prof | null>(null);
  const [friends, setFriends] = useState<Prof[]>([]);
  const [pings, setPings] = useState<PingMsg[]>([]);
  const [freqs, setFreqs] = useState<FReq[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [animColor, setAnimColor] = useState("");
  const [shock, setShock] = useState(false);
  const [lastPing, setLastPing] = useState<{ from: string; emoji: string; color: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const sRef = useRef(createSounds());

  const triggerAnim = useCallback((color: string) => {
    setAnimColor(color); setParticles(spawnP(color)); setShock(true);
    setTimeout(() => setShock(false), 600);
    setTimeout(() => setParticles([]), 2000);
  }, []);

  // Auth listener
  useEffect(() => {
    const u = onAuthStateChanged(auth, async (usr) => {
      setUser(usr);
      if (usr) {
        const s = await getDoc(doc(db, "ping_profiles", usr.uid));
        if (s.exists()) { setProfile(s.data() as Prof); setScreen("home"); }
        else setScreen("auth");
      } else { setScreen("auth"); setProfile(null); }
      setLoading(false);
    });
    return u;
  }, []);

  // Profile listener
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "ping_profiles", user.uid), s => { if (s.exists()) setProfile(s.data() as Prof); });
  }, [user]);

  // Pings listener
  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "ping_messages"), where("to", "==", user.uid)), s => {
      const m: PingMsg[] = []; s.forEach(d => m.push({ id: d.id, ...d.data() } as PingMsg));
      m.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)); setPings(m);
    });
  }, [user]);

  // Friend requests listener
  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "ping_friend_requests"), where("to", "==", user.uid), where("status", "==", "pending")), s => {
      const r: FReq[] = []; s.forEach(d => r.push({ id: d.id, ...d.data() } as FReq)); setFreqs(r);
    });
  }, [user]);

  // Friends profiles listener
  useEffect(() => {
    if (!profile?.friends?.length) { setFriends([]); return; }
    const unsubs = profile.friends.map(fid =>
      onSnapshot(doc(db, "ping_profiles", fid), s => {
        if (s.exists()) setFriends(prev => [...prev.filter(f => f.uid !== fid), s.data() as Prof]);
      })
    );
    return () => unsubs.forEach(u => u());
  }, [profile?.friends]);

  // Register SW
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js"); }, []);

  // Listen for SW messages (sound play from push)
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.data?.type === "PLAY_SOUND") {
        const s = sRef.current.find(sd => sd.name.toLowerCase() === e.data.sound?.toLowerCase());
        if (s) { s.play(); triggerAnim(s.color); setLastPing({ from: e.data.from || "?", emoji: s.emoji, color: s.color }); setTimeout(() => setLastPing(null), 3000); }
      }
    };
    navigator.serviceWorker?.addEventListener("message", h);
    return () => navigator.serviceWorker?.removeEventListener("message", h);
  }, [triggerAnim]);

  // Setup push notifications
  const setupPush = useCallback(async () => {
    if (!user) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const b64 = (s: string) => {
        const pad = "=".repeat((4 - (s.length % 4)) % 4);
        const b = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
        const r = atob(b); const a = new Uint8Array(r.length);
        for (let i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a;
      };
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) });
      const j = sub.toJSON();
      await updateDoc(doc(db, "ping_profiles", user.uid), { pushEndpoint: j.endpoint, pushP256dh: j.keys?.p256dh, pushAuth: j.keys?.auth });
    } catch (e) { console.error("Push err:", e); }
  }, [user]);

  useEffect(() => { if (user && profile) setupPush(); }, [user, profile, setupPush]);

  // Send ping
  const sendPing = async (fuid: string, sound: SoundDef) => {
    if (!user || !profile) return;
    sound.play(); triggerAnim(sound.color);
    const mid = user.uid + "_" + fuid + "_" + Date.now();
    await setDoc(doc(db, "ping_messages", mid), { from: user.uid, to: fuid, fromName: profile.username, sound: sound.name, soundEmoji: sound.emoji, timestamp: serverTimestamp(), seen: false });
    await updateDoc(doc(db, "ping_profiles", user.uid), { pingsSent: increment(1) });
    await updateDoc(doc(db, "ping_profiles", fuid), { pingsReceived: increment(1) });
    const fd = await getDoc(doc(db, "ping_profiles", fuid));
    if (fd.exists()) {
      const d = fd.data();
      if (d.pushEndpoint) {
        try {
          await fetch(PUSH_BACKEND + "/send-notification", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: { endpoint: d.pushEndpoint, keys: { p256dh: d.pushP256dh, auth: d.pushAuth } },
              title: sound.emoji + " PING de " + profile.username + "!", body: profile.username + " t'a envoye un " + sound.name + "!", data: { sound: sound.name, from: profile.username } }) });
        } catch { /* ignore push errors */ }
      }
    }
  };

  const sendReq = async (tuid: string) => {
    if (!user || !profile || tuid === user.uid) return;
    if (profile.friends?.includes(tuid)) return;
    await setDoc(doc(db, "ping_friend_requests", user.uid + "_" + tuid), { from: user.uid, to: tuid, fromName: profile.username, status: "pending", timestamp: serverTimestamp() });
  };

  const acceptReq = async (r: FReq) => {
    if (!user) return;
    await updateDoc(doc(db, "ping_profiles", user.uid), { friends: arrayUnion(r.from) });
    await updateDoc(doc(db, "ping_profiles", r.from), { friends: arrayUnion(user.uid) });
    await deleteDoc(doc(db, "ping_friend_requests", r.id));
  };

  const declineReq = async (r: FReq) => { await deleteDoc(doc(db, "ping_friend_requests", r.id)); };

  const removeFriend = async (fuid: string) => {
    if (!user) return;
    await updateDoc(doc(db, "ping_profiles", user.uid), { friends: arrayRemove(fuid) });
    await updateDoc(doc(db, "ping_profiles", fuid), { friends: arrayRemove(user.uid) });
  };

  const markSeen = async (id: string) => { await updateDoc(doc(db, "ping_messages", id), { seen: true }); };

  const logout = () => { signOut(auth); setScreen("auth"); setProfile(null); setFriends([]); setPings([]); setFreqs([]); };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#00FF88", fontSize: 32, animation: "neon-flicker 2s infinite", fontWeight: 900 }}>PING</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", position: "relative", overflow: "hidden" }}>
      <style>{CSS}</style>
      {particles.length > 0 && <AnimOverlay particles={particles} />}
      {shock && <div style={{ position: "fixed", top: "50%", left: "50%", width: 100, height: 100, marginLeft: -50, marginTop: -50, borderRadius: "50%", border: "3px solid " + animColor, animation: "shockwave 0.6s ease-out", zIndex: 9998, pointerEvents: "none" }} />}
      {lastPing && (
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 10000, pointerEvents: "none", animation: "bounce-in 0.5s ease-out", textAlign: "center" }}>
          <div style={{ fontSize: 80, filter: "drop-shadow(0 0 30px " + lastPing.color + ")" }}>{lastPing.emoji}</div>
          <div style={{ fontSize: 18, color: lastPing.color, fontWeight: 700, marginTop: 8, textShadow: "0 0 10px " + lastPing.color }}>PING de {lastPing.from}!</div>
        </div>
      )}
      {screen === "auth" && <AuthScreen onDone={() => {}} />}
      {screen === "home" && <HomeScreen profile={profile} friends={friends} pings={pings} freqs={freqs} sounds={sRef.current} onPing={sendPing} onAccept={acceptReq} onDecline={declineReq} onMarkSeen={markSeen} setScreen={setScreen} triggerAnim={triggerAnim} />}
      {screen === "friends" && <FriendsScreen profile={profile} friends={friends} onReq={sendReq} onRemove={removeFriend} setScreen={setScreen} uid={user?.uid} />}
      {screen === "qr" && <QRScreen profile={profile} onReq={sendReq} setScreen={setScreen} />}
      {screen === "profile" && <ProfileScreen profile={profile} onLogout={logout} setScreen={setScreen} pings={pings} />}
    </div>
  );
}

export default App;
