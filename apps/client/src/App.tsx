import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import AppShell from "./layouts/AppShell";
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from "./pages/AuthPages";
import Onboarding from "./pages/Onboarding";
import { EmptyState, Spinner } from "./components/ui";
import { ShieldAlert } from "./components/icons";

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
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
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
  const { businesses, business, businessLoading } = useAuth();
  if (businessLoading) return <Spinner />;
  if (businesses.length === 0) return <div className="min-h-full p-4"><Onboarding /></div>;
  if (!business) return <Spinner />;
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
        <Route element={<RequireAuth><Gate /></RequireAuth>}>
          <Route index element={<Home />} />
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
