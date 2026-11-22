import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { IsoBox, FlowLine, FILLS, PAL, draw, drop, fade, VIEW, useInViewLoop, useLoopClock } from '../../motion';

/* Fixed tenor: the block travels a line between two posts and comes back whole. One iso floor frame
 * (u up-right, w up-left) places the platform, both posts, the line and the block, so they all line up. */
const FX = 112, FY = 196;
const L = 196, W = 46, PH = 8;
const floor = (u: number, w: number) => [FX + 0.866 * (u - w), FY - 0.5 * (u + w) - PH] as const;
const WC = W / 2;
const U_A = 46, U_B = L - 46;                          // the block rests here at either end of its journey
const POST = 14, BLOCK = 22;
const frontOf = (uc: number, a: number) => floor(uc - a / 2, WC - a / 2);
const lineA = floor(U_A, WC), lineB = floor(U_B, WC);
const LINE = `M${lineA[0]} ${lineA[1]} L${lineB[0]} ${lineB[1]}`;
const postA = frontOf(12, POST), postB = frontOf(L - 12, POST);

/* 0..1..0 with a rest at each post: out for 40% of the cycle, still, back for 40%, still. */
const journey = (p: number) => {
  const ease = (t: number) => t * t * (3 - 2 * t);
  if (p < 0.4) return ease(p / 0.4);
  if (p < 0.5) return 1;
  if (p < 0.9) return 1 - ease((p - 0.5) / 0.4);
  return 0;
};

export default function TenorVignette({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const live = useInViewLoop(ref);
  const block = useRef<SVGGElement>(null);
  const pos = (t: number) => {
    const u = U_A + (U_B - U_A) * t;
    const f = frontOf(u, BLOCK);
    return `translate(${f[0].toFixed(2)}px, ${f[1].toFixed(2)}px)`;
  };
  useLoopClock(live, (p) => { if (block.current) block.current.style.transform = pos(journey(p)); }, 12, 1.8);
  const base = floor(0, 0);

  return (
    <motion.svg
      ref={ref}
      viewBox="0 10 360 200"
      className={`block h-auto w-full overflow-visible ${className}`}
      aria-hidden="true"
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={VIEW}
    >
      <motion.ellipse variants={fade(0.1, 0.6)} cx={floor(L / 2, WC)[0]} cy={floor(L / 2, WC)[1] + 10} rx={96} ry={24} fill="rgba(16,38,31,.07)" />
      <IsoBox x={base[0]} y={base[1] + PH} a={L} b={W} h={PH} fills={['#B8C7BE', '#9FB3A8', PAL.glaze]} variants={drop(0, 0.15, 0.16, -36)} />

      <motion.path variants={draw(0.8, 1.2)} d={LINE} stroke={PAL.line} strokeWidth="3" strokeLinecap="round" fill="none" />
      <FlowLine d={LINE} stroke={PAL.honey} strokeWidth={2} dash="1.2 3.3" duration={5} startAfter={2} opacity={0.6} />

      {/* far post first, then the block, then the near post, so the block passes between them in the right order */}
      <IsoBox x={postB[0]} y={postB[1]} a={POST} b={POST} h={46} fills={[...FILLS.ledger]} variants={drop(1, 0.5, 0.16, -46)} />
      <g ref={block} style={{ transform: pos(0) }}>
        <IsoBox x={0} y={0} a={BLOCK} b={BLOCK} h={20} fills={[...FILLS.zakat]} variants={drop(2, 0.9, 0.16, -46)} />
      </g>
      <IsoBox x={postA[0]} y={postA[1]} a={POST} b={POST} h={46} fills={[...FILLS.ledger]} variants={drop(3, 0.5, 0.16, -46)} />
    </motion.svg>
  );
}
