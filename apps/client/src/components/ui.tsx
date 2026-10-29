import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AnimatePresence, animate, motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, X, type IconType } from "./icons";
import { ApiError, type Meta } from "../lib/api";
import { parseMoney } from "../lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ------------------------------------------------------------------ boutons
type Variant = "primary" | "secondary" | "danger" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-700 text-white shadow-sm hover:bg-brand-800 focus-visible:outline-brand-700 disabled:bg-brand-700/50",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:outline-brand-700",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 disabled:bg-red-600/50",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:outline-brand-700",
};
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }: Omit<HTMLMotionProps<"button">, "children"> & { children?: ReactNode; variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const off = disabled || loading;
  return (
    <motion.button {...p} disabled={off} whileTap={off ? undefined : { scale: 0.96 }} whileHover={off ? undefined : { y: -1 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg font-medium shadow-[0_1px_0_rgb(255_255_255/0.12)_inset] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed", size === "sm" ? "px-3 py-1.5 text-sm" : size === "lg" ? "px-5 py-3 text-base" : "px-4 py-2 text-sm", VARIANTS[variant], className)}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}{children}
    </motion.button>
  );
}

// ------------------------------------------------------------------ champs
export const inputCls = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-2 focus:outline-brand-600/30 disabled:bg-slate-100";
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children(id)}
      {error ? <p role="alert" className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }>(function Input({ label, error, hint, className, ...p }, ref) {
  return <Field label={label} error={error} hint={hint} className={className}>{(id) => <input id={id} ref={ref} aria-invalid={!!error} className={inputCls} {...p} />}</Field>;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string }>(function Select({ label, error, className, children, ...p }, ref) {
  return <Field label={label} error={error} className={className}>{(id) => <select id={id} ref={ref} className={inputCls} {...p}>{children}</select>}</Field>;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }>(function Textarea({ label, error, className, ...p }, ref) {
  return <Field label={label} error={error} className={className}>{(id) => <textarea id={id} ref={ref} rows={3} className={inputCls} {...p} />}</Field>;
});
/** Champ monetaire : affiche « 1 500 » et renvoie un entier (FCFA, sans decimales). */
export function MoneyInput({ label, value, onChange, error, hint, className, ...p }: { label: string; value: number; onChange: (n: number) => void; error?: string; hint?: string; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(id) => (
        <div className="relative">
          <input id={id} inputMode="numeric" autoComplete="off" aria-invalid={!!error} className={cx(inputCls, "pr-14 text-right tabular-nums")} {...p}
            value={value ? new Intl.NumberFormat("fr-FR").format(value) : ""} placeholder="0" onChange={(e) => onChange(parseMoney(e.target.value))} />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">FCFA</span>
        </div>
      )}
    </Field>
  );
}

// ------------------------------------------------------------------ affichage
export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: string; actions?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800 px-3.5 sm:px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className="p-3.5 sm:p-4">{children}</div>
    </section>
  );
}
const TONES = { gray: "bg-slate-100 text-slate-700", green: "bg-emerald-100 text-emerald-800", red: "bg-red-100 text-red-800", amber: "bg-amber-100 text-amber-800", blue: "bg-brand-100 text-brand-800" };
export type Tone = keyof typeof TONES;
export const Badge = ({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) => <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", TONES[tone])}>{children}</span>;
export const Spinner = ({ label = "Chargement..." }: { label?: string }) => <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="size-5 animate-spin" aria-hidden />{label}</div>;
export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cx("skeleton h-4", className)} />;
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div role="status" aria-label="Chargement" className="space-y-3 py-2">
      <div className="md:hidden space-y-3">
        {Array.from({ length: Math.min(rows, 3) }, (_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
      <div className="hidden md:block space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: cols }, (_, j) => (
              <Skeleton key={j} className={cx("h-5 flex-1", j === 0 && "flex-[2]")} />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement...</span>
    </div>
  );
}
/** Nombre qui s'anime vers sa valeur (respecte « reduire les animations »). */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const reduce = useReducedMotion(); const [shown, setShown] = useState(reduce ? value : 0); const from = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    const c = animate(from.current, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => { from.current = v; setShown(v); } });
    return () => c.stop();
  }, [value, reduce]);
  return <span>{format(Math.round(shown))}</span>;
}
export function EmptyState({ icon: Icon, title, text, action }: { icon?: IconType; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      {Icon && <div className="rounded-full bg-slate-100 p-3 text-slate-400"><Icon className="size-6" aria-hidden /></div>}
      <p className="font-medium text-slate-700">{title}</p>
      {text && <p className="max-w-sm text-sm text-slate-500">{text}</p>}
      {action}
    </div>
  );
}
export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Une erreur est survenue");
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-10 text-center">
      <AlertTriangle className="size-6 text-red-500" aria-hidden /><p className="text-sm text-slate-700">{errMsg(error)}</p>
      {retry && <Button variant="secondary" size="sm" onClick={retry}>Reessayer</Button>}
    </div>
  );
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function StatCard({ label, value, count, format, hint, icon: Icon, tone = "blue" }: { label: string; value?: ReactNode; count?: number; format?: (n: number) => string; hint?: string; icon?: IconType; tone?: "blue" | "green" | "amber" | "red" | "gray" }) {
  const t = {
    blue: "bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-400",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400",
    red: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-400",
    gray: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  }[tone];
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 26 }} className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm transition-shadow hover:shadow-md">
      <div>
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">{label}</p>
          {Icon && <div className={cx("shrink-0 rounded-lg p-1.5 sm:rounded-xl sm:p-2 transition-transform group-hover:scale-105", t)}><Icon className="size-4 sm:size-5" aria-hidden /></div>}
        </div>
        <div className="mt-1.5 sm:mt-2 text-[15px] sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums break-words leading-tight">
          {count !== undefined && format ? <AnimatedNumber value={count} format={format} /> : value}
        </div>
      </div>
      {hint && <p className="mt-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 leading-tight">{hint}</p>}
    </motion.div>
  );
}

// ------------------------------------------------------------------ tableau pagine
export interface Col<T> { key: string; header: string; render: (row: T) => ReactNode; align?: "right"; className?: string }
export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  loading,
  error,
  onRetry,
  empty,
  onRowClick,
  mobileRender,
}: {
  columns: Col<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: ReactNode;
  onRowClick?: (r: T) => void;
  mobileRender?: (row: T, index: number) => ReactNode;
}) {
  if (error) return <ErrorState error={error} retry={onRetry} />;
  if (loading && !rows) return <TableSkeleton cols={Math.min(columns.length, 5)} />;
  if (!rows || rows.length === 0) return <>{empty ?? <EmptyState title="Aucun resultat" />}</>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cx("px-3 py-2 font-medium", c.align === "right" && "text-right")}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.id ?? i}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={cx(
                "border-b border-slate-100 dark:border-slate-800 last:border-0",
                onRowClick && "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
              )}
            >
              {columns.map((c) => (
                <td key={c.key} className={cx("px-3 py-2.5 align-middle", c.align === "right" && "text-right tabular-nums", c.className)}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Pagination({ meta, onPage }: { meta?: Meta; onPage: (p: number) => void }) {
  if (!meta || meta.pages <= 1) return meta ? <p className="px-3 pt-3 text-xs text-slate-500">{meta.total} resultat(s)</p> : null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 px-3 pt-3 text-sm text-slate-600">
      <span>{meta.total} resultat(s)</span>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Page precedente"><ChevronLeft className="size-4" /></Button>
        <span className="px-2 tabular-nums">{meta.page} / {meta.pages}</span>
        <Button variant="secondary" size="sm" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)} aria-label="Page suivante"><ChevronRight className="size-4" /></Button>
      </div>
    </nav>
  );
}
export function SearchBox({ value, onChange, placeholder = "Rechercher...", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => v !== value && onChange(v), 300); return () => clearTimeout(t); }, [v, value, onChange]);
  return <input type="search" aria-label={placeholder} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className={cx(inputCls, "w-full sm:w-64", className)} />;
}

// ------------------------------------------------------------------ modales
export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey); ref.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);
  const w = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  const accessibleName = typeof title === "string" ? title.replace(/^Reçu\b/, "Recu") : title;
  return (
    <AnimatePresence>
      {open && (
        <motion.div key="overlay" className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 print:bg-transparent print:backdrop-blur-none print:p-0 print:static" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={accessibleName} tabIndex={-1} initial={{ opacity: 0, y: 32, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }} transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className={cx("flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white dark:bg-slate-900 shadow-xl outline-none sm:rounded-3xl print:shadow-none print:border-none print:max-h-none print:w-auto print:rounded-none", w)}>
            <header className="no-print flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4"><h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2><button onClick={onClose} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-500 hover:rotate-90 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"><X className="size-5" /></button></header>
            <div className="overflow-y-auto px-6 py-5 print:overflow-visible print:p-0">{children}</div>
            {footer && <footer className="no-print flex flex-wrap justify-end gap-2 border-t border-slate-100 dark:border-slate-800 px-6 py-4">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirmer", danger, loading, onConfirm, onClose, children }: { open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void; children?: ReactNode }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <p className="text-sm text-slate-600">{message}</p>{children}
    </Modal>
  );
}

// ------------------------------------------------------------------ notifications (toasts)
type ToastKind = "success" | "error" | "info";
const ToastCtx = createContext<(kind: ToastKind, msg: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; kind: ToastKind; msg: string }[]>([]);
  const push = useCallback((kind: ToastKind, msg: string) => {
    const id = Date.now() + Math.random(); setItems((l) => [...l, { id, kind, msg }]); setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const I = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertTriangle : Info;
            return (
              <motion.div key={t.id} layout role={t.kind === "error" ? "alert" : "status"} initial={{ opacity: 0, y: 24, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }} transition={{ type: "spring", stiffness: 420, damping: 28 }}
                className={cx("pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg", t.kind === "success" ? "bg-emerald-600" : t.kind === "error" ? "bg-red-600" : "bg-slate-900")}>
                <I className="mt-0.5 size-5 shrink-0" aria-hidden />{t.msg}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
