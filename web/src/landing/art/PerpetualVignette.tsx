import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { IsoBox, FlowLine, FILLS, PAL, draw, drop, fade, VIEW, useInViewLoop, useLoopClock } from '../../motion';

/* Perpetual: the block rides a closed loop and never leaves it. The loop is a circle on the iso floor
 * (an ellipse 1.2247 : 0.7071 after the projection), drawn inside a platform; the block travels it on a slow clock. */
const CX = 180, FY = 204, SIDE = 150, PH = 12;       // platform front corner (CX, FY), side length, thickness
const CY = FY - SIDE / 2 - PH;                       // centre of the platform's top face
const R = 58;
const RX = R * 1.2247, RY = R * 0.7071;
const BLOCK = 26;                                    // block footprint; its front corner sits half a block below the path point
const LOOP = `M${CX - RX} ${CY} A${RX} ${RY} 0 1 1 ${CX + RX} ${CY} A${RX} ${RY} 0 1 1 ${CX - RX} ${CY}`;
const at = (th: number) => [CX + RX * Math.cos(th), CY + RY * Math.sin(th)] as const;

export default function PerpetualVignette({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const live = useInViewLoop(ref);
  const block = useRef<SVGGElement>(null);
  const place = (p: number) => {
    const el = block.current;
    if (!el) return;
    const [x, y] = at(Math.PI * 0.75 + p * Math.PI * 2);
    el.style.transform = `translate(${x.toFixed(2)}px, ${(y + BLOCK / 2).toFixed(2)}px)`;
  };
  useLoopClock(live, place, 16, 1.6);
  const [sx, sy] = at(Math.PI * 0.75);

  return (
    <motion.svg
      ref={ref}
      viewBox="0 18 360 200"
      className={`block h-auto w-full overflow-visible ${className}`}
      aria-hidden="true"
      initial={reduce ? false : 'hidden'}
      whileInView="show"
      viewport={VIEW}
    >
      <motion.ellipse variants={fade(0.1, 0.6)} cx={CX} cy={FY - 40} rx={112} ry={30} fill="rgba(16,38,31,.07)" />
      <IsoBox x={CX} y={FY} a={SIDE} b={SIDE} h={PH} fills={['#9FB3A8', '#9FB3A8', PAL.glaze]} variants={drop(0, 0.15, 0.16, -40)} />

      <motion.path variants={draw(0.8, 1.4)} d={LOOP} stroke={PAL.line} strokeWidth="3" fill="none" />
      <FlowLine d={LOOP} stroke={PAL.accent} strokeWidth={2} dash="1.2 3.3" duration={5} startAfter={2.2} opacity={0.7} />

      {/* the block: placed on the loop by the clock; the wrapper sets its resting spot so a still frame is also right */}
      <g ref={block} style={{ transform: `translate(${sx}px, ${sy + BLOCK / 2}px)` }}>
        <IsoBox x={0} y={0} a={BLOCK} b={BLOCK} h={20} fills={[...FILLS.zakat]} variants={drop(1, 1.3, 0.16, -46)} />
      </g>
    </motion.svg>
  );
}
