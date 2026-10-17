// Deterministic timeline: every value is a pure function of t (seconds). World units: metres.
// +X = ship bow / catapult direction, +Y = up, +Z = starboard. Catapult lane at z = 0, deck top y = 20.
export const DURATION = 82;
export const DECK_Y = 20, LANE_Z = 0, STROKE = 88, BRAKE_END = 97, BOW_X = 98;
export const HOLD_X = -0.85;           // nose-axle x at the catapult hold position
export const T = { taxi0: 8, taxi1: 13.6, bar0: 11.5, bar1: 14.6, hb0: 16, hb1: 18.2, spool0: 18.5, jbd0: 24.8, jbd1: 29.5,
  ab0: 44.5, ab1: 64, steam0: 41, steam1: 48.5, stroke0: 52, stroke1: 60, jbdDown0: 62, jbdDown1: 68,
  replay0: 65, replay1: 70.5, reset0: 70.5, reset1: 76 };

export const SCENES = [
 { n: 1, t0: 0,  t1: 8,  title: 'A RUNWAY THAT IS TOO SHORT', text: 'An F/A-18 needs a lot of speed to take off. But an aircraft carrier gives it only a few hundred feet of runway. So how does it get airborne in seconds?' },
 { n: 2, t0: 8,  t1: 16, title: 'THE AIRCRAFT CONNECTS', text: 'First, the jet rolls into position. Its nose-wheel launch bar locks onto a shuttle hidden in the catapult track.' },
 { n: 3, t0: 16, t1: 24, title: 'RESTRAIN IT BEFORE FIRING', text: 'A holdback attachment keeps the aircraft from moving while its engines build power. It must release when the catapult launches.' },
 { n: 4, t0: 24, t1: 32, title: 'RAISE THE JET-BLAST DEFLECTOR', text: 'Behind the jet, a heavy jet-blast deflector rises. It redirects the engine exhaust away from the deck crew and equipment.' },
 { n: 5, t0: 32, t1: 40, title: 'PREPARE THE LAUNCH', text: "The jet increases power, and the launch system is prepared. But the aircraft's engines alone aren't doing the whole job." },
 { n: 6, t0: 40, t1: 49, title: 'THE HIDDEN STEAM CATAPULT', text: 'Below the deck, high-pressure steam enters the catapult cylinders. The pressure drives pistons connected to the shuttle above.' },
 { n: 7, t0: 49, t1: 57, title: 'THE LAUNCH BEGINS', text: 'When the launch is authorised, the catapult releases its stored energy. The shuttle surges forward, and the nose gear transmits that force to the jet.' },
 { n: 8, t0: 57, t1: 65, title: 'HUNDREDS OF FEET IN SECONDS', text: 'Within seconds, the catapult has accelerated the aircraft across the deck to the required launch speed. Then the jet separates and flies away.' },
 { n: 9, t0: 65, t1: 73, title: 'THE SHUTTLE STOPS AND RESETS', text: 'But the shuttle is still racing along the track. A water-brake system absorbs its energy, slows it down, and helps prepare the catapult for the next launch.' },
 { n: 10, t0: 73, t1: 82, title: 'THE COMPLETE LAUNCH SYSTEM', text: "The steam catapult supplies the extra acceleration, the shuttle transfers it through the launch bar, and the jet's own engines provide thrust. That's how a fighter takes off from a ship in seconds." },
];

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const sstep = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const lerp = (a, b, u) => a + (b - a) * u;
const ramp = (t, a, b) => sstep((t - a) / (b - a));
const easeOut = (u) => 1 - Math.pow(1 - clamp(u), 2.4);

// ---- launch stroke (time-scaled: real ~2.4 s stroke is shown ~3.4x slower, captioned on screen) ----
export function stroke(t) {
  const D = T.stroke1 - T.stroke0, tau = clamp((t - T.stroke0) / D);
  return { s: STROKE * (1.2 * tau * tau - 0.2 * tau * tau * tau), v: STROKE * (2.4 * tau - 0.6 * tau * tau) / D };
}
const V_END = STROKE * 1.8 / (T.stroke1 - T.stroke0);
const S_BREAK = 0.06;                                   // tension-bolt stretch before the holdback separates (m)
export const T_BREAK = (() => { let a = T.stroke0, b = T.stroke1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (stroke(m).s < S_BREAK) a = m; else b = m; } return b; })();

// ---- numerically-integrated tables (deterministic, built once) ----
function table(fn, dt, t1) { const n = Math.ceil(t1 / dt) + 1, o = new Float64Array(n); for (let i = 1; i < n; i++) o[i] = o[i - 1] + fn((i - 0.5) * dt) * dt; return { o, dt }; }
const look = (tb, t) => { const f = clamp(t, 0, (tb.o.length - 1) * tb.dt) / tb.dt, i = Math.min(Math.floor(f), tb.o.length - 2); return lerp(tb.o[i], tb.o[i + 1], f - i); };
const fl = (t) => t - T.stroke1;
const flightV = (t) => { const x = fl(t); return x < 0 ? 0 : V_END + 1.0 * Math.min(x, 5) + 1.2 * Math.max(0, x - 5); };
const GAM = (t) => 0.21 * ramp(t, T.stroke1 + 0.9, T.stroke1 + 5.5);
const xTab = table(flightV, 0.02, DURATION), yTab = table((t) => flightV(t) * Math.sin(GAM(t)), 0.02, DURATION);
const steamFlow = (t) => { const p = steamP(t); return 0.5 * p + (t > T.stroke0 && t < T.stroke1 + 2 ? 1.5 : 0); };
const steamTab = table(steamFlow, 0.05, DURATION);
function steamP(t) {
  if (t < T.steam0) return 0;
  if (t < T.stroke0) return ramp(t, T.steam0, T.steam1);
  if (t < T.stroke1) return lerp(1, 0.55, (t - T.stroke0) / (T.stroke1 - T.stroke0));
  return 0.55 * (1 - ramp(t, T.stroke1, T.stroke1 + 2.5));
}
export function cutOpen(t) {
  return Math.max(ramp(t, 40.3, 42.3) * (1 - ramp(t, 47.6, 49.4)), ramp(t, 65.3, 66.8) * (1 - ramp(t, 72.4, 73.6)));
}

export function shuttle(t) {          // shuttle + piston assembly distance along track from start (m)
  if (t < T.stroke0) return { x: 0, v: 0, brake: 0 };
  if (t < T.stroke1) { const k = stroke(t); return { x: k.s, v: k.v, brake: 0 }; }
  const Dz = BRAKE_END - STROKE, a = V_END * V_END / (2 * Dz), Tb = V_END / a;
  const brakeAt = (u) => { const tt = Math.min(u, Tb); return { x: STROKE + V_END * tt - 0.5 * a * tt * tt, v: Math.max(0, V_END - a * tt) }; };
  if (t < T.replay0) { const b = brakeAt(t - T.stroke1); return { x: b.x, v: b.v, brake: b.v > 0.01 ? 1 : 0 }; }
  if (t < T.replay1) { // slow-motion replay of the braking (x0.15), labelled on screen
    const b = brakeAt((t - T.replay0) / (T.replay1 - T.replay0) * Tb); return { x: b.x, v: b.v * 0.15, brake: b.v / V_END, replay: true };
  }
  if (t < T.reset1) { const u = ramp(t, T.reset0, T.reset1); return { x: lerp(BRAKE_END, 0, u), v: 0, brake: 0, reset: true }; }
  return { x: 0, v: 0, brake: 0 };
}

export function state(t) {
  t = clamp(t, 0, DURATION);
  const sh = shuttle(t), k = stroke(t);
  // aircraft nose-axle x
  let gx;
  if (t < T.taxi0) gx = -16;
  else if (t < T.taxi1) gx = lerp(-16, HOLD_X, easeOut((t - T.taxi0) / (T.taxi1 - T.taxi0)));
  else if (t < T.stroke1) gx = HOLD_X + Math.max(0, k.s - S_BREAK);
  else gx = HOLD_X + STROKE - S_BREAK + look(xTab, t);
  const airborneY = t < T.stroke1 ? 0 : look(yTab, t);
  const airT = t - T.stroke1;
  const pitch = (t < T.stroke0 ? 0 : 0.012 * ramp(t, T.stroke0, T.stroke0 + 1.5)) * (1 - ramp(t, T.stroke1, T.stroke1 + 1)) +
                (t > T.stroke1 ? GAM(t) + 0.05 * ramp(t, T.stroke1 + 0.8, T.stroke1 + 3) : 0);
  const taxiRoll = (t > T.taxi0 && t < T.taxi1) ? 0.006 * Math.sin(t * 9) * (1 - ramp(t, T.taxi1 - 1, T.taxi1)) : 0;
  const barLift = 0.62 * (1 - ramp(t, T.bar0, T.bar1)) + 0.7 * ramp(t, T.stroke1, T.stroke1 + 0.7); // launch-bar angle (rad), 0 = engaged
  const barEngaged = t >= T.bar1 - 0.2 && t < T.stroke1;
  // holdback: 0 stowed/hanging, 1 attached at deck unit; >T_BREAK it drops away with the aircraft
  const hbAttach = ramp(t, T.hb0, T.hb1);
  const hbSep = t < T_BREAK ? 0 : sstep((t - T_BREAK) / 1.4);
  const hbTension = t < T.hb1 ? 0 : (t < T_BREAK ? clamp(0.25 + 0.75 * ramp(t, T.stroke0 - 0.1, T_BREAK)) : 0);
  const thr = t < T.spool0 ? 0.3 : t < 24 ? lerp(0.3, 0.55, ramp(t, T.spool0, 24)) : t < 32 ? lerp(0.55, 0.7, ramp(t, 24, 32))
            : t < 44.5 ? lerp(0.7, 0.92, ramp(t, 32, 40)) : t < 66 ? 1.0 : lerp(1.0, 0.85, ramp(t, 66, 70));
  const ab = t >= T.ab0 && t < T.ab1 ? ramp(t, T.ab0, T.ab0 + 1.2) * (1 - ramp(t, T.ab1 - 1.5, T.ab1)) : 0;
  const jbd = 1.0 * Math.max(ramp(t, T.jbd0, T.jbd1) * (1 - ramp(t, T.jbdDown0, T.jbdDown1)), 0); // rad (~57 deg max)
  const jbdRate = (Math.abs(ramp(t + 0.05, T.jbd0, T.jbd1) - ramp(t - 0.05, T.jbd0, T.jbd1)) + Math.abs(ramp(t + 0.05, T.jbdDown0, T.jbdDown1) - ramp(t - 0.05, T.jbdDown0, T.jbdDown1))) * 10;
  const p = steamP(t);
  return { t, gx, gy: airborneY, pitch, roll: taxiRoll, airborne: t > T.stroke1 + 0.9, airT, aircraftV: t < T.stroke0 ? 0 : t < T.stroke1 ? k.v : flightV(t),
    barLift, barEngaged, hbAttach, hbSep, hbTension, throttle: thr, ab, jbd, jbdRate, shuttleX: sh.x, shuttleV: sh.v, brake: sh.brake, replay: !!sh.replay, reset: !!sh.reset,
    pistonX: Math.min(sh.x, BRAKE_END), steam: p, steamPhase: look(steamTab, t), cut: cutOpen(t),
    scene: sceneAt(t), slowmo: t >= T.stroke0 - 0.5 && t < T.stroke1 + 5 };
}
export function sceneAt(t) { for (const s of SCENES) if (t >= s.t0 && t < s.t1) return s; return SCENES[SCENES.length - 1]; }

// Audio one-shot events (fired only on smooth forward playback)
export const EVENTS = [
  { t: 14.4, id: 'engage' }, { t: 17.9, id: 'holdback' }, { t: 25.2, id: 'hyd' }, { t: 41.2, id: 'valve' },
  { t: T.stroke0, id: 'launch' }, { t: T_BREAK, id: 'snap' }, { t: T.stroke1 + 0.1, id: 'brake' }, { t: T.jbdDown0, id: 'hyd' }, { t: T.replay0 + 0.1, id: 'brake' },
];
