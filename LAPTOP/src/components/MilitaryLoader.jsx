import React, { useState, useEffect } from "react";

const ADMIN_PHRASES = [
  "Initializing Command Center...",
  "Verifying Officer Credentials...",
  "Synchronizing Muster Logs...",
  "Loading Battalion Analytics...",
  "Decrypting Attendance Records...",
  "Establishing Secure Connection...",
  "Fetching Cadet Roster Data...",
  "Calibrating Formation Tracker...",
  "Loading Command Analytics...",
  "Preparing Duty Officer Interface...",
];

const CADET_PHRASES = [
  "Verifying Cadet Credentials...",
  "Loading Personnel File...",
  "Fetching Attendance Records...",
  "Synchronizing Muster Status...",
  "Connecting to HQ Database...",
  "Loading ROTC Profile...",
  "Checking Formation Status...",
  "Retrieving Unit Assignments...",
];

const STYLE_ID = "military-loader-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes ml-radar-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes ml-pulse-ring { 0%{transform:scale(1);opacity:0.7} 60%{transform:scale(1.18);opacity:0.15} 100%{transform:scale(1.25);opacity:0} }
    @keyframes ml-core-throb { 0%,100%{transform:scale(1);box-shadow:0 0 0px 0px rgba(234,179,8,0)} 50%{transform:scale(1.08);box-shadow:0 0 22px 8px rgba(234,179,8,0.55)} }
    @keyframes ml-dot-blink { 0%,80%,100%{opacity:0;transform:scale(0.8)} 40%{opacity:1;transform:scale(1)} }
    @keyframes ml-shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
    @keyframes ml-ambient { 0%,100%{opacity:0.35;transform:scale(1)} 50%{opacity:0.65;transform:scale(1.08)} }
    @keyframes ml-fadein { from{opacity:0} to{opacity:1} }
    @keyframes ml-phrase-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(style);
}

function AnimatedDots() {
  return (
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center", marginLeft: 6 }}>
      {[0, 0.18, 0.36].map((delay, i) => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: "50%", background: "#EAB308",
          display: "inline-block",
          animation: `ml-dot-blink 1.2s ease-in-out ${delay}s infinite`
        }} />
      ))}
    </span>
  );
}

// Static phrase with entrance animation — used for action-specific messages
function StaticPhrase({ phrase }) {
  return (
    <p key={phrase} style={{
      margin: 0, fontSize: "0.88rem",
      fontFamily: "'Rajdhani','Oswald','Inter',system-ui,sans-serif",
      fontWeight: 700, letterSpacing: "0.08em",
      color: "rgba(234,179,8,0.95)", textTransform: "uppercase",
      textShadow: "0 0 14px rgba(234,179,8,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "ml-phrase-in 0.35s ease both",
    }}>
      {phrase}<AnimatedDots />
    </p>
  );
}

// Cycling phrase — used for generic/startup loading
function CyclingPhrase({ phrases }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx((i) => (i + 1) % phrases.length); setVisible(true); }, 300);
    }, 2600);
    return () => clearInterval(interval);
  }, [phrases]);
  return (
    <p style={{
      margin: 0, fontSize: "0.85rem",
      fontFamily: "'Rajdhani','Oswald','Inter',system-ui,sans-serif",
      fontWeight: 600, letterSpacing: "0.06em",
      color: "rgba(234,179,8,0.85)", textTransform: "uppercase",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(-5px)",
      transition: "opacity 0.3s ease, transform 0.3s ease",
      textShadow: "0 0 12px rgba(234,179,8,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {phrases[idx]}<AnimatedDots />
    </p>
  );
}

function RadarScanner({ size = 96 }) {
  const r = size / 2;
  const strokeW = size * 0.04;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div style={{
        position: "absolute", inset: -size * 0.2, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(234,179,8,0.25) 0%, transparent 70%)",
        animation: "ml-ambient 2.4s ease-in-out infinite", pointerEvents: "none"
      }} />
      {[0, 0.5, 1].map((delay) => (
        <div key={delay} style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: "2px solid rgba(234,179,8,0.6)",
          animation: `ml-pulse-ring 2.4s ease-out ${delay}s infinite`, pointerEvents: "none"
        }} />
      ))}
      <svg width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <circle cx={r} cy={r} r={r - strokeW} stroke="rgba(0,57,28,0.9)" strokeWidth={strokeW * 2} fill="none" />
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          const x1 = r + (r - strokeW * 2.5) * Math.cos(angle);
          const y1 = r + (r - strokeW * 2.5) * Math.sin(angle);
          const x2 = r + (r - strokeW * 1) * Math.cos(angle);
          const y2 = r + (r - strokeW * 1) * Math.sin(angle);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(234,179,8,0.3)" strokeWidth={i % 3 === 0 ? 2 : 1} />;
        })}
        {[0.35, 0.6, 0.82].map((pct, i) => (
          <circle key={i} cx={r} cy={r} r={(r - strokeW) * pct} stroke="rgba(234,179,8,0.1)" strokeWidth={1} fill="none" />
        ))}
        <line x1={r} y1={strokeW * 2} x2={r} y2={size - strokeW * 2} stroke="rgba(234,179,8,0.12)" strokeWidth={1} />
        <line x1={strokeW * 2} y1={r} x2={size - strokeW * 2} y2={r} stroke="rgba(234,179,8,0.12)" strokeWidth={1} />
      </svg>
      <div style={{ position: "absolute", inset: 0, animation: "ml-radar-spin 1.8s linear infinite" }}>
        <svg width={size} height={size}>
          <defs>
            <linearGradient id="ml-sweep-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(234,179,8,0)" />
              <stop offset="100%" stopColor="rgba(234,179,8,0.9)" />
            </linearGradient>
          </defs>
          <path
            d={`M ${r} ${r} L ${r} ${strokeW} A ${r - strokeW} ${r - strokeW} 0 0 1 ${r + (r - strokeW) * Math.sin((80 * Math.PI) / 180)} ${r - (r - strokeW) * Math.cos((80 * Math.PI) / 180)} Z`}
            fill="url(#ml-sweep-grad)" opacity="0.85"
          />
          <line x1={r} y1={r} x2={r} y2={strokeW} stroke="rgba(234,179,8,1)" strokeWidth={2} />
        </svg>
      </div>
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: size * 0.15, height: size * 0.15,
        borderRadius: "50%", background: "#EAB308",
        animation: "ml-core-throb 1.8s ease-in-out infinite",
      }} />
    </div>
  );
}

function SkeletonBar({ width = "100%", height = 14, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: 6,
      background: "linear-gradient(90deg, rgba(0,57,28,0.08) 25%, rgba(234,179,8,0.07) 50%, rgba(0,57,28,0.08) 75%)",
      backgroundSize: "600px 100%",
      animation: "ml-shimmer 1.6s linear infinite",
      ...style
    }} />
  );
}

function CardSkeleton({ rows = 4, showHeader = true, label = "Loading Data..." }) {
  return (
    <div style={{
      background: "#ffffff", borderRadius: 12,
      border: "1px solid rgba(0,57,28,0.12)", overflow: "hidden",
      animation: "ml-fadein 0.4s ease",
      boxShadow: "0 2px 12px rgba(0,57,28,0.06)",
    }}>
      {showHeader && (
        <div style={{
          padding: "0.9rem 1.25rem",
          borderBottom: "1px solid rgba(0,57,28,0.08)",
          background: "linear-gradient(135deg, rgba(0,57,28,0.04) 0%, rgba(234,179,8,0.03) 100%)",
          display: "flex", alignItems: "center", gap: 10
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            border: "2px solid rgba(234,179,8,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", flexShrink: 0,
            animation: "ml-radar-spin 2s linear infinite",
          }}>
            <div style={{
              position: "absolute", top: 2, left: "50%", marginLeft: -0.5,
              width: 1, height: 10, background: "rgba(234,179,8,0.9)",
              transformOrigin: "bottom center",
            }} />
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#EAB308" }} />
          </div>
          <div style={{ flex: 1 }}><SkeletonBar width="45%" height={12} /></div>
          <SkeletonBar width={60} height={22} style={{ borderRadius: 20 }} />
        </div>
      )}
      <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <SkeletonBar width={32} height={32} style={{ borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
              <SkeletonBar width={`${65 + (i % 3) * 12}%`} height={12} />
              <SkeletonBar width={`${40 + (i % 2) * 20}%`} height={10} />
            </div>
            <SkeletonBar width={54} height={22} style={{ borderRadius: 8, flexShrink: 0 }} />
          </div>
        ))}
      </div>
      <div style={{
        padding: "0.6rem 1.25rem 0.85rem",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        borderTop: "1px solid rgba(0,57,28,0.06)"
      }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#EAB308", animation: "ml-core-throb 1.4s ease-in-out infinite" }} />
        <p style={{
          margin: 0, fontSize: "0.72rem", fontWeight: 700,
          letterSpacing: "0.1em", color: "rgba(0,57,28,0.5)",
          textTransform: "uppercase", fontFamily: "'Rajdhani','Inter',system-ui"
        }}>{label}</p>
      </div>
    </div>
  );
}

function FullscreenLoader({ mode = "admin", label, subtitle, staticPhrase }) {
  const phrases = mode === "cadet" ? CADET_PHRASES : ADMIN_PHRASES;
  const systemLabel = mode === "cadet" ? "CADET PORTAL" : "COMMAND CENTER";
  const size = 130;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999999,
      background: "linear-gradient(160deg, #001a0e 0%, #00391c 45%, #002a14 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      animation: "ml-fadein 0.35s ease", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(234,179,8,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(234,179,8,0.04) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(234,179,8,0.08) 0%, transparent 70%)",
        animation: "ml-ambient 3s ease-in-out infinite",
      }} />
      {[
        { top: 20, left: 20, borderTop: "2px solid", borderLeft: "2px solid" },
        { top: 20, right: 20, borderTop: "2px solid", borderRight: "2px solid" },
        { bottom: 20, left: 20, borderBottom: "2px solid", borderLeft: "2px solid" },
        { bottom: 20, right: 20, borderBottom: "2px solid", borderRight: "2px solid" },
      ].map((s, i) => (
        <div key={i} style={{ position: "absolute", width: 36, height: 36, borderColor: "rgba(234,179,8,0.35)", ...s }} />
      ))}
      <p style={{
        margin: "0 0 8px", fontSize: "0.68rem",
        fontFamily: "'Rajdhani','Oswald','Inter',system-ui",
        fontWeight: 700, letterSpacing: "0.3em",
        color: "rgba(234,179,8,0.45)", textTransform: "uppercase",
      }}>
        CSU ROTC UNIT {systemLabel}
      </p>
      <div style={{ marginBottom: 36, marginTop: 8 }}>
        <RadarScanner size={size} />
      </div>
      <h1 style={{
        margin: "0 0 6px", fontSize: "1.45rem",
        fontFamily: "'Oswald','Rajdhani','Inter',system-ui",
        fontWeight: 700, letterSpacing: "0.12em",
        color: "#ffffff", textTransform: "uppercase",
        textShadow: "0 2px 20px rgba(0,0,0,0.5)", textAlign: "center",
      }}>
        {label || (mode === "cadet" ? "Cadet Portal" : "Command Center")}
      </h1>
      <div style={{
        width: 120, height: 2, marginBottom: 18,
        background: "linear-gradient(90deg, transparent, #EAB308, transparent)",
        borderRadius: 2,
      }} />
      {/* Show static action phrase OR cycling phrases */}
      {staticPhrase
        ? <StaticPhrase phrase={staticPhrase} />
        : <CyclingPhrase phrases={phrases} />
      }
      <div style={{
        marginTop: 32, width: 200, height: 3,
        background: "rgba(255,255,255,0.08)",
        borderRadius: 3, overflow: "hidden", position: "relative"
      }}>
        <div style={{
          position: "absolute", top: 0, left: 0, height: "100%", width: "40%",
          background: "linear-gradient(90deg, transparent, #EAB308, rgba(234,179,8,0.5))",
          borderRadius: 3,
          animation: "ml-shimmer 1.6s linear infinite",
          backgroundSize: "600px 100%",
        }} />
      </div>
      <p style={{
        position: "absolute", bottom: 18, margin: 0, fontSize: "0.65rem",
        fontFamily: "monospace", color: "rgba(255,255,255,0.2)",
        letterSpacing: "0.15em", textTransform: "uppercase"
      }}>
        {subtitle || "Caraga State University · ROTC Attendance System"}
      </p>
    </div>
  );
}

/**
 * MilitaryLoader
 * Props:
 *   mode         'admin' | 'cadet'       phrase set + branding (default: 'admin')
 *   variant      'fullscreen' | 'card'   display mode (default: 'fullscreen')
 *   label        string                  optional heading override
 *   subtitle     string                  optional footer/subtitle text
 *   staticPhrase string                  if set, shows this single phrase instead of cycling (for action-specific messages)
 *   rows         number                  skeleton rows (card mode, default: 4)
 *   showHeader   boolean                 card header (card mode, default: true)
 *   cardLabel    string                  card bottom label
 */
export default function MilitaryLoader({
  mode = "admin",
  variant = "fullscreen",
  label,
  subtitle,
  staticPhrase,
  rows = 4,
  showHeader = true,
  cardLabel = "Loading Data...",
}) {
  if (variant === "card") {
    return <CardSkeleton rows={rows} showHeader={showHeader} label={cardLabel} />;
  }
  return <FullscreenLoader mode={mode} label={label} subtitle={subtitle} staticPhrase={staticPhrase} />;
}
