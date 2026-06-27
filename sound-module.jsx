import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";

const LAYERS = [
  {
    id: "hum",
    label: "ELECTRICAL HUM",
    desc: "Deep drone — constant field presence",
    defaultVol: -18,
    color: "#00FF41",
  },
  {
    id: "static",
    label: "TRANSMISSION STATIC",
    desc: "Period interference — signal decay",
    defaultVol: -28,
    color: "#00FF41",
  },
  {
    id: "ping",
    label: "NODE LOCATED",
    desc: "Random radar ping — target acquired",
    defaultVol: -22,
    color: "#D4A017",
  },
];

export default function SoundModule() {
  const [started, setStarted] = useState(false);
  const [active, setActive] = useState(false);
  const [volumes, setVolumes] = useState({ hum: -18, static: -28, ping: -22 });
  const [muted, setMuted] = useState({ hum: false, static: false, ping: false });
  const [pingFlash, setPingFlash] = useState(false);
  const [staticFlash, setStaticFlash] = useState(false);
  const [transmission, setTransmission] = useState(false);

  const nodesRef = useRef({});
  const pingTimeoutRef = useRef(null);
  const staticIntervalRef = useRef(null);

  const buildAudio = useCallback(async () => {
    await Tone.start();

    // --- HUM ---
    const humVol = new Tone.Volume(volumes.hum).toDestination();
    const hum = new Tone.Oscillator({ frequency: 52, type: "sawtooth" });
    const humFilter = new Tone.Filter({ frequency: 180, type: "lowpass", rolloff: -24 });
    const humTremolo = new Tone.Tremolo({ frequency: 0.08, depth: 0.15 }).start();
    hum.connect(humFilter);
    humFilter.connect(humTremolo);
    humTremolo.connect(humVol);
    hum.start();

    // Sub hum layer
    const subVol = new Tone.Volume(volumes.hum - 6).toDestination();
    const sub = new Tone.Oscillator({ frequency: 26, type: "sine" });
    const subFilter = new Tone.Filter({ frequency: 80, type: "lowpass" });
    sub.connect(subFilter);
    subFilter.connect(subVol);
    sub.start();

    // --- STATIC ---
    const staticVol = new Tone.Volume(volumes.static).toDestination();
    const noise = new Tone.Noise("brown");
    const staticFilter = new Tone.Filter({ frequency: 2200, type: "bandpass", Q: 0.4 });
    const staticGain = new Tone.Gain(0);
    noise.connect(staticFilter);
    staticFilter.connect(staticGain);
    staticGain.connect(staticVol);
    noise.start();

    // Trigger static bursts
    const fireStatic = () => {
      if (!active) return;
      const duration = 0.08 + Math.random() * 0.18;
      staticGain.gain.cancelScheduledValues(Tone.now());
      staticGain.gain.setValueAtTime(0, Tone.now());
      staticGain.gain.linearRampToValueAtTime(0.9, Tone.now() + 0.02);
      staticGain.gain.linearRampToValueAtTime(0, Tone.now() + duration);
      setStaticFlash(true);
      setTimeout(() => setStaticFlash(false), (duration + 0.05) * 1000);
      const nextDelay = 3000 + Math.random() * 9000;
      staticIntervalRef.current = setTimeout(fireStatic, nextDelay);
    };
    staticIntervalRef.current = setTimeout(fireStatic, 2000 + Math.random() * 4000);

    // --- PING ---
    const pingVol = new Tone.Volume(volumes.ping).toDestination();
    const firePing = () => {
      const synth = new Tone.Synth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.005, decay: 0.8, sustain: 0, release: 1.2 },
      }).connect(pingVol);
      const pingFilter = new Tone.Filter({ frequency: 3200, type: "highpass" });
      synth.connect(pingFilter);
      pingFilter.connect(pingVol);

      const freq = 880 + Math.random() * 440;
      synth.triggerAttackRelease(freq, "4n");
      setPingFlash(true);
      setTransmission(true);
      setTimeout(() => setPingFlash(false), 300);
      setTimeout(() => setTransmission(false), 2000);
      setTimeout(() => synth.dispose(), 3000);

      const nextDelay = 8000 + Math.random() * 22000;
      pingTimeoutRef.current = setTimeout(firePing, nextDelay);
    };
    pingTimeoutRef.current = setTimeout(firePing, 4000 + Math.random() * 8000);

    nodesRef.current = { hum, sub, humVol, subVol, noise, staticVol, staticGain, pingVol };
  }, []);

  const stopAudio = useCallback(() => {
    clearTimeout(pingTimeoutRef.current);
    clearTimeout(staticIntervalRef.current);
    const n = nodesRef.current;
    try {
      Object.values(n).forEach((node) => {
        if (node && typeof node.stop === "function") node.stop();
        if (node && typeof node.dispose === "function") node.dispose();
      });
    } catch (e) {}
    nodesRef.current = {};
  }, []);

  const handleToggle = async () => {
    if (!active) {
      if (!started) {
        await buildAudio();
        setStarted(true);
      }
      setActive(true);
    } else {
      stopAudio();
      setStarted(false);
      setActive(false);
      setTransmission(false);
    }
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  const handleVolume = (id, val) => {
    setVolumes((v) => ({ ...v, [id]: val }));
    const n = nodesRef.current;
    const volNode = n[id + "Vol"] || n["staticVol"] || n["pingVol"];
    if (id === "hum" && n.humVol) n.humVol.volume.rampTo(val, 0.1);
    if (id === "static" && n.staticVol) n.staticVol.volume.rampTo(val, 0.1);
    if (id === "ping" && n.pingVol) n.pingVol.volume.rampTo(val, 0.1);
  };

  const handleMute = (id) => {
    setMuted((m) => {
      const next = { ...m, [id]: !m[id] };
      const n = nodesRef.current;
      const vol = next[id] ? -80 : volumes[id];
      if (id === "hum" && n.humVol) n.humVol.volume.rampTo(vol, 0.1);
      if (id === "static" && n.staticVol) n.staticVol.volume.rampTo(vol, 0.1);
      if (id === "ping" && n.pingVol) n.pingVol.volume.rampTo(vol, 0.1);
      return next;
    });
  };

  return (
    <div style={{
      background: "#0A0A0A",
      minHeight: "100vh",
      fontFamily: "'Courier New', Courier, monospace",
      color: "#00FF41",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
    }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div style={{ fontSize: "10px", letterSpacing: "6px", color: "#00FF41", opacity: 0.5, marginBottom: "8px" }}>
          HAKUNASHORTCUT
        </div>
        <div style={{ fontSize: "11px", letterSpacing: "4px", color: "#00FF41", opacity: 0.35 }}>
          NORTH KINANGOP // DIGITAL FRONTIER
        </div>
        <div style={{
          width: "160px",
          height: "1px",
          background: "linear-gradient(to right, transparent, #00FF41, transparent)",
          margin: "16px auto",
          opacity: 0.4
        }}/>
        <div style={{ fontSize: "13px", letterSpacing: "5px", opacity: 0.7 }}>
          SOUND MODULE v1.0
        </div>
      </div>

      {/* Radar visual */}
      <div style={{
        position: "relative",
        width: "180px",
        height: "180px",
        marginBottom: "40px",
      }}>
        {[1, 0.65, 0.4].map((scale, i) => (
          <div key={i} style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: `${180 * scale}px`,
            height: `${180 * scale}px`,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: `1px solid #00FF41`,
            opacity: active ? 0.15 + i * 0.1 : 0.06,
            transition: "opacity 0.5s",
          }}/>
        ))}
        {/* Crosshair */}
        {["horizontal", "vertical"].map((dir) => (
          <div key={dir} style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: dir === "horizontal" ? "180px" : "1px",
            height: dir === "vertical" ? "180px" : "1px",
            transform: dir === "horizontal" ? "translate(-50%, -50%)" : "translate(-50%, -50%)",
            background: "#00FF41",
            opacity: active ? 0.25 : 0.08,
            transition: "opacity 0.5s",
          }}/>
        ))}
        {/* Sweep arm */}
        {active && (
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: "90px",
            height: "1px",
            transformOrigin: "0 50%",
            background: "linear-gradient(to right, #00FF41, transparent)",
            opacity: 0.6,
            animation: "sweep 4s linear infinite",
          }}/>
        )}
        {/* Centre dot */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: "8px", height: "8px",
          borderRadius: "50%",
          background: active ? "#00FF41" : "#1a1a1a",
          transform: "translate(-50%, -50%)",
          boxShadow: active ? "0 0 12px #00FF41" : "none",
          transition: "all 0.5s",
        }}/>
        {/* Ping flash */}
        {pingFlash && (
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            width: "20px", height: "20px",
            borderRadius: "50%",
            background: "#D4A017",
            transform: "translate(-50%, -50%)",
            boxShadow: "0 0 20px #D4A017",
            opacity: 0.9,
          }}/>
        )}
      </div>

      {/* Transmission status */}
      <div style={{
        fontSize: "9px",
        letterSpacing: "4px",
        color: transmission ? "#D4A017" : "#00FF41",
        opacity: transmission ? 1 : (active ? 0.4 : 0.2),
        marginBottom: "32px",
        minHeight: "14px",
        transition: "color 0.2s, opacity 0.3s",
      }}>
        {transmission ? "▶ INCOMING TRANSMISSION" : active ? "AMBIENT: ACTIVE" : "AMBIENT: STANDBY"}
      </div>

      {/* Main toggle */}
      <button
        onClick={handleToggle}
        style={{
          background: "transparent",
          border: `1px solid ${active ? "#00FF41" : "#333"}`,
          color: active ? "#00FF41" : "#555",
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "11px",
          letterSpacing: "5px",
          padding: "14px 36px",
          cursor: "pointer",
          marginBottom: "48px",
          boxShadow: active ? "0 0 20px rgba(0,255,65,0.15)" : "none",
          transition: "all 0.3s",
        }}
      >
        {active ? "TERMINATE SIGNAL" : "ACTIVATE SIGNAL"}
      </button>

      {/* Layer controls */}
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{
          fontSize: "9px",
          letterSpacing: "4px",
          opacity: 0.35,
          marginBottom: "20px",
          borderBottom: "1px solid #111",
          paddingBottom: "8px"
        }}>
          LAYER CONTROLS
        </div>

        {LAYERS.map((layer) => (
          <div key={layer.id} style={{
            marginBottom: "28px",
            opacity: active ? 1 : 0.35,
            transition: "opacity 0.4s",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}>
              <div>
                <div style={{
                  fontSize: "9px",
                  letterSpacing: "3px",
                  color: layer.id === "ping" && pingFlash ? "#D4A017" :
                         layer.id === "static" && staticFlash ? "#00FF41" :
                         layer.color,
                  marginBottom: "2px",
                  transition: "color 0.1s",
                }}>
                  {layer.id === "ping" && pingFlash ? "▶ " : ""}
                  {layer.id === "static" && staticFlash ? "∿ " : ""}
                  {layer.label}
                </div>
                <div style={{ fontSize: "8px", letterSpacing: "1px", opacity: 0.35 }}>
                  {layer.desc}
                </div>
              </div>
              <button
                onClick={() => handleMute(layer.id)}
                style={{
                  background: "transparent",
                  border: `1px solid ${muted[layer.id] ? "#333" : "#00FF41"}`,
                  color: muted[layer.id] ? "#333" : "#00FF41",
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: "8px",
                  letterSpacing: "2px",
                  padding: "4px 10px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {muted[layer.id] ? "OFF" : "ON"}
              </button>
            </div>
            <input
              type="range"
              min="-40"
              max="-10"
              step="1"
              value={volumes[layer.id]}
              onChange={(e) => handleVolume(layer.id, parseInt(e.target.value))}
              style={{
                width: "100%",
                appearance: "none",
                height: "1px",
                background: `linear-gradient(to right, ${layer.color} ${((volumes[layer.id] + 40) / 30) * 100}%, #222 0%)`,
                outline: "none",
                cursor: "pointer",
                opacity: muted[layer.id] ? 0.2 : 0.8,
              }}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: "40px",
        fontSize: "8px",
        letterSpacing: "3px",
        opacity: 0.2,
        textAlign: "center",
      }}>
        KNOWLEDGE IS POWER. SYSTEMS ARE LEVERAGE.
      </div>

      <style>{`
        @keyframes sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input[type=range]::-webkit-slider-thumb {
          appearance: none;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #00FF41;
          cursor: pointer;
          box-shadow: 0 0 6px #00FF41;
        }
        input[type=range]::-moz-range-thumb {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #00FF41;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
