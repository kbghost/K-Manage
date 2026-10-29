import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./lib/auth";
import { api } from "./lib/api";
import AppShell from "./layouts/AppShell";
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from "./pages/AuthPages";
import Onboarding from "./pages/Onboarding";
import { EmptyState, Spinner } from "./components/ui";
import { ShieldAlert } from "./components/icons";
import Landing from "./pages/Landing";

const Billing = lazy(() => import("./pages/Billing"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Pos = lazy(() => import("./pages/Pos"));
const Products = lazy(() => import("./pages/Products"));
const Stock = lazy(() => import("./pages/Stock"));
const Sales = lazy(() => import("./pages/Sales"));
const Customers = lazy(() => import("./pages/Customers"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Purchases = lazy(() => import("./pages/Purchases"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Cash = lazy(() => import("./pages/Cash"));
const Reports = lazy(() => import("./pages/Reports"));
const Members = lazy(() => import("./pages/Members"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Audit = lazy(() => import("./pages/Audit"));
const Profile = lazy(() => import("./pages/Profile"));

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth(); const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return loc.pathname === "/" ? <Landing /> : <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}
function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}
export function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(perm)) return <EmptyState icon={ShieldAlert} title="Acces non autorise" text="Votre role ne permet pas d'ouvrir cette page. Contactez le proprietaire du commerce si besoin." />;
  return <>{children}</>;
}
function Home() {
  const { can } = useAuth();
  if (can("reports.read")) return <Dashboard />;
  return <Navigate to={can("sales.create") ? "/pos" : can("products.read") ? "/products" : "/profile"} replace />;
}
function Gate() {
  const { user, businesses, business, businessLoading, activeId } = useAuth();
  const location = useLocation();
  const billing = useQuery({
    queryKey: ["billing", activeId],
    enabled: !!user && !!activeId && businesses.some((item) => item.id === activeId),
    queryFn: async () => (await api<{ access: boolean }>("GET", "/billing/current")).data,
  });
  if (!user) return <Navigate to="/login" replace />;
  if (businessLoading) return <Spinner />;
  if (businesses.length === 0) return <div className="min-h-full p-4"><Onboarding /></div>;
  if (!business) return <Spinner />;
  if (billing.isLoading) return <Spinner label="Vérification de l’abonnement..." />;
  if (billing.isError || !billing.data) return <EmptyState title="Abonnement indisponible" text="Impossible de vérifier l’accès à cette boutique. Vérifiez votre connexion puis rechargez la page." action={<button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white" onClick={() => void billing.refetch()}>Réessayer</button>} />;
  if (!billing.data.access && location.pathname !== "/billing") return <Navigate to="/billing" replace />;
  return <AppShell />;
}

export default function App() {
  const P = (perm: string, el: ReactNode) => <Guard perm={perm}>{el}</Guard>;
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/welcome" element={<Landing />} />
        <Route path="/details" element={<Landing defaultSection="details" />} />
        <Route path="/tarifs" element={<Landing defaultSection="tarifs" />} />
        <Route element={<RequireAuth><Gate /></RequireAuth>}>
          <Route index element={<Home />} />
          <Route path="billing" element={<Billing />} />
          <Route path="pos" element={P("sales.create", <Pos />)} />
          <Route path="products" element={P("products.read", <Products />)} />
          <Route path="stock" element={P("stock.read", <Stock />)} />
          <Route path="sales" element={P("sales.read", <Sales />)} />
          <Route path="customers" element={P("customers.read", <Customers />)} />
          <Route path="suppliers" element={P("suppliers.read", <Suppliers />)} />
          <Route path="purchases" element={P("purchases.read", <Purchases />)} />
          <Route path="expenses" element={P("expenses.read", <Expenses />)} />
          <Route path="cash" element={P("cash.manage", <Cash />)} />
          <Route path="reports" element={P("reports.read", <Reports />)} />
          <Route path="members" element={P("members.manage", <Members />)} />
          <Route path="audit" element={P("audit.read", <Audit />)} />
          <Route path="settings" element={P("settings.update", <SettingsPage />)} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<EmptyState title="Page introuvable" />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
