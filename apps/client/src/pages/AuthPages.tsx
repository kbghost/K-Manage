import { useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "motion/react";
import { ClipboardList, Eye, EyeSlash, Package, ShoppingCart, TrendingUp } from "../components/icons";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Field, Input, cx, errMsg, inputCls } from "../components/ui";

const PERKS = [
  { icon: ShoppingCart, title: "Vendez vite et sans calculatrice", text: "Caisse rapide, lecteur code-barres, gestion des crédits et tickets propres." },
  { icon: Package, title: "Vos stocks toujours sous contrôle", text: "Alertes quand un article est presque fini et suivi des entrées / sorties." },
  { icon: TrendingUp, title: "Sachez exactement ce que vous gagnez", text: "Bénéfice réel, argent dehors chez les clients et suivi précis des dépenses." },
];
function Shell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      <aside className="hero-card relative hidden flex-col justify-between p-12 lg:flex">
        <motion.div aria-hidden className="absolute -right-24 -top-24 size-80 rounded-full bg-white/10" animate={{ y: [0, 18, 0], scale: [1, 1.05, 1] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div aria-hidden className="absolute -bottom-32 -left-16 size-96 rounded-full bg-emerald-500/20" animate={{ y: [0, -22, 0] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }} />
        <div className="relative z-10 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-white/15 backdrop-blur"><ClipboardList className="size-7" /></div><span className="text-2xl font-semibold tracking-tight">K-Manage</span></div>
        <div className="relative z-10 max-w-lg">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-4xl font-bold leading-tight">Gérez votre commerce, <span className="text-emerald-300">en toute sérénité.</span></motion.h2>
          <ul className="mt-10 space-y-6">
            {PERKS.map((p, i) => (
              <motion.li key={p.title} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 200, damping: 22 }} className="flex gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/20"><p.icon className="size-7" /></span>
                <div><p className="font-semibold text-base">{p.title}</p><p className="text-sm text-white/80">{p.text}</p></div>
              </motion.li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-white/70">Simple, rapide et adapté aux réalités du commerce · Montants en FCFA</p>
      </aside>
      <div className="grid place-items-center bg-grain p-5 sm:p-10">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 220, damping: 26 }} className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 lg:hidden"><div className="grid size-10 place-items-center rounded-xl bg-brand-700 text-white"><ClipboardList className="size-6" /></div><span className="text-xl font-semibold tracking-tight">K-Manage</span></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-lg sm:p-9">
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1><p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>{children}
          </div>
          {footer && <p className="mt-5 text-center text-sm text-slate-600">{footer}</p>}
        </motion.div>
      </div>
    </div>
  );
}
const Alert = ({ text }: { text: string }) => <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{text}</p>;

const loginSchema = z.object({ email: z.string().min(1, "Saisissez votre email").email("Email invalide"), password: z.string().min(1, "Saisissez votre mot de passe") });
export function LoginPage() {
  const { signIn } = useAuth(); const nav = useNavigate(); const [error, setError] = useState(""); const [showPassword, setShowPassword] = useState(false);
  const f = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  return (
    <Shell title="Connexion" subtitle="Accedez a la gestion de votre commerce." footer={<>Pas encore de compte ? <Link className="font-medium text-brand-700 hover:underline" to="/register">Creer un compte</Link></>}>
      <form noValidate onSubmit={f.handleSubmit(async (v) => { setError(""); try { await signIn("login", v); nav("/"); } catch (e) { setError(errMsg(e)); } })} className="space-y-4">
        {error && <Alert text={error} />}
        <Input label="Email" type="email" autoComplete="email" placeholder="votre@email.com" error={f.formState.errors.email?.message} {...f.register("email")} />
        <Field label="Mot de passe" error={f.formState.errors.password?.message}>
          {(id) => (
            <div className="relative">
              <input id={id} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Saisissez votre mot de passe" className={cx(inputCls, "pr-12")} aria-invalid={!!f.formState.errors.password} {...f.register("password")} />
              <button type="button" className="absolute inset-y-0 right-2 my-auto grid size-9 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          )}
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={f.formState.isSubmitting}>Se connecter</Button>
        <p className="text-center text-sm"><Link className="text-brand-700 hover:underline" to="/forgot-password">Mot de passe oublie ?</Link></p>
      </form>
    </Shell>
  );
}

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Saisissez votre nom complet"), email: z.string().min(1, "Saisissez votre email").email("Email invalide"), phone: z.string().optional(),
  password: z.string().min(10, "10 caracteres minimum"), confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" });
export function RegisterPage() {
  const { signIn } = useAuth(); const nav = useNavigate(); const [error, setError] = useState(""); const [showPassword, setShowPassword] = useState(false); const [showConfirm, setShowConfirm] = useState(false);
  const f = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });
  return (
    <Shell title="Creer un compte" subtitle="Quelques secondes suffisent pour commencer." footer={<>Deja inscrit ? <Link className="font-medium text-brand-700 hover:underline" to="/login">Se connecter</Link></>}>
      <form noValidate onSubmit={f.handleSubmit(async ({ confirm: _c, ...v }) => { void _c; setError(""); try { await signIn("register", { ...v, phone: v.phone || undefined }); nav("/"); } catch (e) { setError(errMsg(e)); } })} className="space-y-4">
        {error && <Alert text={error} />}
        <Input label="Nom complet" autoComplete="name" placeholder="Ex. Amadou HOUNKPE" error={f.formState.errors.fullName?.message} {...f.register("fullName")} />
        <Input label="Email" type="email" autoComplete="email" placeholder="votre@email.com" error={f.formState.errors.email?.message} {...f.register("email")} />
        <Input label="Telephone (facultatif)" type="tel" autoComplete="tel" placeholder="Ex. +229 01 23 45 67" {...f.register("phone")} />
        <Field label="Mot de passe" hint="10 caracteres minimum" error={f.formState.errors.password?.message}>
          {(id) => (
            <div className="relative">
              <input id={id} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Choisissez un mot de passe" className={cx(inputCls, "pr-12")} aria-invalid={!!f.formState.errors.password} {...f.register("password")} />
              <button type="button" className="absolute inset-y-0 right-2 my-auto grid size-9 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          )}
        </Field>
        <Field label="Confirmer le mot de passe" error={f.formState.errors.confirm?.message}>
          {(id) => (
            <div className="relative">
              <input id={id} type={showConfirm ? "text" : "password"} autoComplete="new-password" placeholder="Confirmez votre mot de passe" className={cx(inputCls, "pr-12")} aria-invalid={!!f.formState.errors.confirm} {...f.register("confirm")} />
              <button type="button" className="absolute inset-y-0 right-2 my-auto grid size-9 place-items-center rounded text-slate-500 hover:bg-slate-100 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700" aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={showConfirm} onClick={() => setShowConfirm((visible) => !visible)}>
                {showConfirm ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          )}
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={f.formState.isSubmitting}>Creer mon compte</Button>
      </form>
    </Shell>
  );
}

export function ForgotPasswordPage() {
  const [done, setDone] = useState<{ devResetToken?: string } | null>(null); const [error, setError] = useState("");
  const f = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.string().min(1, "Saisissez votre email").email("Email invalide") })) });
  return (
    <Shell title="Mot de passe oublie" subtitle="Nous preparons un lien de reinitialisation valable 1 heure." footer={<Link className="font-medium text-brand-700 hover:underline" to="/login">Retour a la connexion</Link>}>
      {done ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">Si un compte existe pour cet email, des instructions ont ete preparees. Si l'envoi d'emails n'est pas configure sur ce serveur, contactez l'administrateur.</p>
          {done.devResetToken && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">Mode developpement : <Link className="font-medium underline" to={`/reset-password?token=${done.devResetToken}`}>ouvrir le lien de reinitialisation</Link></p>}
        </div>
      ) : (
        <form noValidate onSubmit={f.handleSubmit(async (v) => { setError(""); try { setDone((await api<{ devResetToken?: string }>("POST", "/auth/forgot-password", v, { tenant: false })).data); } catch (e) { setError(errMsg(e)); } })} className="space-y-4">
          {error && <Alert text={error} />}
          <Input label="Email du compte" type="email" autoComplete="email" error={f.formState.errors.email?.message} {...f.register("email")} />
          <Button type="submit" className="w-full" size="lg" loading={f.formState.isSubmitting}>Envoyer</Button>
        </form>
      )}
    </Shell>
  );
}

const resetSchema = z.object({ password: z.string().min(10, "10 caracteres minimum"), confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" });
export function ResetPasswordPage() {
  const [params] = useSearchParams(); const nav = useNavigate(); const [error, setError] = useState(""); const token = params.get("token") ?? "";
  const f = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  return (
    <Shell title="Nouveau mot de passe" subtitle="Choisissez un mot de passe d'au moins 10 caracteres.">
      <form noValidate onSubmit={f.handleSubmit(async (v) => { setError(""); try { await api("POST", "/auth/reset-password", { token, password: v.password }, { tenant: false }); nav("/login"); } catch (e) { setError(e instanceof ApiError ? e.message : "Erreur"); } })} className="space-y-4">
        {!token && <Alert text="Lien invalide : refaites une demande de reinitialisation." />}{error && <Alert text={error} />}
        <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" error={f.formState.errors.password?.message} {...f.register("password")} />
        <Input label="Confirmer" type="password" autoComplete="new-password" error={f.formState.errors.confirm?.message} {...f.register("confirm")} />
        <Button type="submit" className="w-full" size="lg" disabled={!token} loading={f.formState.isSubmitting}>Enregistrer</Button>
      </form>
    </Shell>
  );
}
