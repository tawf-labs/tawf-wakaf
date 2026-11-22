import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { IsoBox, Float, FlowLine, FILLS, PAL, draw, drop, fade, VIEW, useInViewLoop, useLoopClock } from '../../motion';
import Coin from './Coin';

/* The waqf in one picture: a solid corpus block that never moves, and coins of yield leaving it along drawn
 * lanes to a Nazir block. Everything hangs off one iso floor frame, so each lane really starts behind the
 * corpus and ends on the Nazir's near face. No numbers. */
const FX = 118, FY = 262;                         // front-bottom corner of the corpus
const floor = (u: number, w: number) => [FX + 0.866 * (u - w), FY - 0.5 * (u + w)] as const; // u up-right, w up-left
const CORPUS = { a: 66, b: 66 };
const NAZIR_U = 236;                              // how far along u the Nazir stands
const NAZIR = { a: 56, b: 56 };
const nazirF = floor(NAZIR_U, 0);
const LANES = [
  { w: 14, color: PAL.honey },
  { w: 30, color: PAL.honey },
  { w: 46, color: PAL.honey },
].map((l) => ({ ...l, from: floor(40, l.w), to: floor(NAZIR_U, l.w) }));
const d = (l: (typeof LANES)[number]) => `M${l.from[0]} ${l.from[1]} L${l.to[0]} ${l.to[1]}`;

const INTRO_END = 2.6; // seconds: lanes are drawn, blocks have landed, coins may leave

/* Yield coins: each lane carries one coin that emerges from behind the corpus, crosses, and is absorbed by the Nazir.
 * One clock drives all three (transform + opacity only); it pauses offscreen and under reduced motion shows them still. */
function Beads({ run }: { run: boolean }) {
  const refs = useRef<(SVGGElement | null)[]>([]);
  const reduce = useReducedMotion();
  const place = (p: number) => {
    LANES.forEach((l, i) => {
      const el = refs.current[i];
      if (!el) return;
      const t = (p + i / LANES.length) % 1;
      const e = t * t * (3 - 2 * t) * 0.35 + t * 0.65;           // mostly even, softly eased
      const x = l.from[0] + (l.to[0] - l.from[0]) * e;
      const y = l.from[1] + (l.to[1] - l.from[1]) * e - 5;
      const o = Math.min(1, t / 0.1, (1 - t) / 0.12);
      const s = 0.7 + 0.3 * Math.min(1, t / 0.1);
      el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(3)})`;
      el.style.opacity = o.toFixed(3);
    });
  };
  // still frame: coins resting at different points of their lanes
  useEffect(() => { if (reduce) place(0.4); }, [reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  useLoopClock(run, place, 9);
  return (
    <>
      {LANES.map((l, i) => (
        <g key={i} ref={(el) => { refs.current[i] = el; }} style={{ opacity: 0 }}>
          <Coin cx={0} cy={0} r={11} color={l.color} face={PAL.butter} />
        </g>
      ))}
    </>
  );
}

export default function CorpusArt({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const live = useInViewLoop(ref);
  const [armed, setArmed] = useState(!!reduce);
  useEffect(() => {
    if (reduce) { setArmed(true); return; }
    const t = window.setTimeout(() => setArmed(true), INTRO_END * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  return (
    <motion.svg
      ref={ref}
      viewBox="0 14 480 300"
      className={`block h-auto w-full overflow-visible ${className}`}
      aria-hidden="true"
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={VIEW}
    >
      <motion.ellipse variants={fade(0.1, 0.6)} cx={FX + 6} cy={FY - 26} rx={92} ry={26} fill="rgba(16,38,31,.07)" />
      <motion.ellipse variants={fade(0.3, 0.6)} cx={nazirF[0] + 4} cy={nazirF[1] - 22} rx={74} ry={22} fill="rgba(16,38,31,.07)" />

      {/* lanes: drawn first, then a slow dashed flow rides on top */}
      {LANES.map((l, i) => (
        <g key={i}>
          <motion.path variants={draw(0.7 + i * 0.18, 1.1)} d={d(l)} stroke={PAL.line} strokeWidth="3" strokeLinecap="round" fill="none" />
          <FlowLine d={d(l)} stroke={l.color} strokeWidth={2} dash="1.4 3.2" duration={3.4} startAfter={INTRO_END - 0.4} opacity={0.75} />
        </g>
      ))}

      {/* the Nazir, a lighter block waiting at the end of the lanes */}
      <Float as="g" amplitude={3} duration={9} delay={1.5} run={live && armed}>
        <IsoBox x={nazirF[0]} y={nazirF[1]} a={NAZIR.a} b={NAZIR.b} h={26} fills={[...FILLS.zakat]} variants={drop(1, 0.5, 0.16, -50)} />
        <IsoBox x={nazirF[0]} y={nazirF[1] - 26} a={NAZIR.a} b={NAZIR.b} h={14} fills={[...FILLS.waqf]} variants={drop(2, 0.5, 0.16, -50)} />
      </Float>

      <Beads run={live && armed} />

      {/* the corpus: heavy, dark, and still. It lands once and never moves again. */}
      <IsoBox x={FX} y={FY} a={CORPUS.a} b={CORPUS.b} h={34} fills={[...FILLS.ledger]} variants={drop(0, 0.2, 0.16, -60)} />
      <IsoBox x={FX} y={FY - 34} a={CORPUS.a} b={CORPUS.b} h={34} fills={[...FILLS.ledger]} variants={drop(1, 0.2, 0.16, -60)} />
      <IsoBox x={FX} y={FY - 68} a={CORPUS.a} b={CORPUS.b} h={14} fills={[...FILLS.zakat]} variants={drop(2, 0.2, 0.16, -60)} />

      <motion.g variants={fade(1.4, 0.7)} fontFamily="inherit" fontWeight="600" fill={PAL.ink} letterSpacing="-.01em">
        <text x={FX} y={FY + 38} textAnchor="middle" fontSize="19">Corpus</text>
        <text x={nazirF[0] + 40} y={nazirF[1] + 36} textAnchor="middle" fontSize="19">Nazir</text>
      </motion.g>
    </motion.svg>
  );
}
