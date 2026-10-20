import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useAction } from "../lib/hooks";
import { fmtDateTime } from "../lib/format";
import { Badge, Button, Card, DataTable, Input, PageHeader } from "../components/ui";

const pwd = z.object({ currentPassword: z.string().min(1, "Saisissez le mot de passe actuel"), newPassword: z.string().min(10, "10 caracteres minimum"), confirm: z.string() }).refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas" });
interface S { id: string; userAgent?: string; createdAt: string; current: boolean }

export default function Profile() {
  const { user } = useAuth(); const qc = useQueryClient();
  const p = useForm<{ fullName: string; phone?: string }>({ resolver: zodResolver(z.object({ fullName: z.string().trim().min(2, "Nom obligatoire"), phone: z.string().optional() })), defaultValues: { fullName: user?.fullName ?? "", phone: user?.phone ?? "" } });
  const saveP = useAction((v: { fullName: string; phone?: string }) => api("PATCH", "/auth/me", v, { tenant: false }), { success: "Profil enregistre.", onSuccess: () => void qc.invalidateQueries({ queryKey: ["me"] }) });
  const c = useForm<z.infer<typeof pwd>>({ resolver: zodResolver(pwd) });
  const savePw = useAction((v: z.infer<typeof pwd>) => api("POST", "/auth/change-password", { currentPassword: v.currentPassword, newPassword: v.newPassword }), { success: "Mot de passe modifie. Les autres appareils ont ete deconnectes.", onSuccess: () => { c.reset(); void qc.invalidateQueries({ queryKey: ["sessions"] }); } });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: async () => (await api<S[]>("GET", "/auth/sessions", undefined, { tenant: false })).data });
  const revoke = useAction((id: string) => api("DELETE", `/auth/sessions/${id}`), { success: "Session revoquee.", onSuccess: () => void qc.invalidateQueries({ queryKey: ["sessions"] }) });
  return (
    <>
      <PageHeader title="Mon profil" subtitle={user?.email} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Informations"><form noValidate onSubmit={p.handleSubmit((v) => saveP.mutate(v))} className="space-y-3"><Input label="Nom complet" error={p.formState.errors.fullName?.message} {...p.register("fullName")} /><Input label="Telephone" type="tel" {...p.register("phone")} /><Button type="submit" loading={saveP.isPending}>Enregistrer</Button></form></Card>
        <Card title="Changer le mot de passe"><form noValidate onSubmit={c.handleSubmit((v) => savePw.mutate(v))} className="space-y-3"><Input label="Mot de passe actuel" type="password" autoComplete="current-password" error={c.formState.errors.currentPassword?.message} {...c.register("currentPassword")} /><Input label="Nouveau mot de passe" type="password" autoComplete="new-password" error={c.formState.errors.newPassword?.message} {...c.register("newPassword")} /><Input label="Confirmer" type="password" autoComplete="new-password" error={c.formState.errors.confirm?.message} {...c.register("confirm")} /><Button type="submit" loading={savePw.isPending}>Modifier</Button></form></Card>
        <Card title="Appareils connectes" className="lg:col-span-2"><DataTable rows={sessions.data} loading={sessions.isLoading} columns={[{ key: "a", header: "Appareil", render: (s) => <span className="text-xs">{s.userAgent?.slice(0, 80) ?? "Inconnu"}</span> }, { key: "d", header: "Connecte le", render: (s) => fmtDateTime(s.createdAt) }, { key: "c", header: "", render: (s) => (s.current ? <Badge tone="green">Cet appareil</Badge> : <Button variant="secondary" size="sm" loading={revoke.isPending} onClick={() => revoke.mutate(s.id)}>Deconnecter</Button>) }]} /></Card>
      </div>
    </>
  );
}
