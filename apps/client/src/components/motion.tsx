import { useEffect, useMemo, type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { cx } from "./ui";

const item: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } } };
/** Conteneur dont les enfants `Item` apparaissent en cascade. */
export function Stagger({ children, className, delay = 0.05 }: { children: ReactNode; className?: string; delay?: number }) {
  return <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: delay } } }}>{children}</motion.div>;
}
export function Item({ children, className }: { children: ReactNode; className?: string }) { return <motion.div variants={item} className={className}>{children}</motion.div>; }
/** Apparition au defilement. */
export function Reveal({ children, className, y = 16 }: { children: ReactNode; className?: string; y?: number }) {
  return <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.4, ease: "easeOut" }}>{children}</motion.div>;
}

/** Pluie de confettis (celebration d'un objectif atteint). N'affiche rien si l'utilisateur reduit les animations. */
export function Confetti({ run, onDone }: { run: boolean; onDone?: () => void }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(() => Array.from({ length: 46 }, (_, i) => ({ id: i, x: Math.random() * 100, r: Math.random() * 720 - 360, d: 1.8 + Math.random() * 1.4, delay: Math.random() * 0.35, size: 6 + Math.random() * 7, c: ["#f5a524", "#059669", "#10b981", "#ec4899", "#8b5cf6", "#14b8a6"][i % 6]! })), []);
  useEffect(() => { if (!run) return; const t = setTimeout(() => onDone?.(), 3600); return () => clearTimeout(t); }, [run, onDone]);
  if (!run || reduce) return null;
  return (
    <div aria-hidden className="no-print pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {pieces.map((p) => <motion.span key={p.id} className="absolute rounded-[2px]" style={{ left: `${p.x}%`, top: -20, width: p.size, height: p.size * 0.5, background: p.c }} initial={{ y: 0, rotate: 0, opacity: 1 }} animate={{ y: "105vh", rotate: p.r, opacity: [1, 1, 0] }} transition={{ duration: p.d, delay: p.delay, ease: "easeIn" }} />)}
    </div>
  );
}

/** Anneau de progression anime. */
export function ProgressRing({ value, size = 96, stroke = 9, children, className }: { value: number; size?: number; stroke?: number; children?: ReactNode; className?: string }) {
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const pct = Math.max(0, Math.min(1, value));
  return (
    <div className={cx("relative grid place-items-center", className)} style={{ width: size, height: size }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
      <svg width={size} height={size} className="-rotate-90"><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#fbbf24" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} /></svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
