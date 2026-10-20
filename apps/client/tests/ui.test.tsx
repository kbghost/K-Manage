import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog, DataTable, EmptyState, MoneyInput, Spinner } from "../src/components/ui";
import { useState } from "react";

describe("composants UI", () => {
  it("DataTable : chargement, erreur avec reessayer, vide, donnees", async () => {
    const cols = [{ key: "n", header: "Nom", render: (r: { id: string; n: string }) => r.n }];
    const { rerender } = render(<DataTable columns={cols} rows={undefined} loading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    const retry = vi.fn(); rerender(<DataTable columns={cols} rows={undefined} error={new Error("Serveur indisponible")} onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Serveur indisponible"); await userEvent.click(screen.getByRole("button", { name: "Reessayer" })); expect(retry).toHaveBeenCalled();
    rerender(<DataTable columns={cols} rows={[]} empty={<EmptyState title="Aucun produit" />} />); expect(screen.getByText("Aucun produit")).toBeInTheDocument();
    rerender(<DataTable columns={cols} rows={[{ id: "1", n: "Riz" }]} />); expect(screen.getByRole("columnheader", { name: "Nom" })).toBeInTheDocument(); expect(screen.getByText("Riz")).toBeInTheDocument();
  });
  it("MoneyInput : formate et renvoie un entier", async () => {
    function T() { const [v, setV] = useState(0); return <><MoneyInput label="Montant" value={v} onChange={setV} /><output>{v}</output></>; }
    render(<T />); await userEvent.type(screen.getByLabelText("Montant"), "12a500");
    expect(screen.getByRole("status")).toHaveTextContent("12500"); expect((screen.getByLabelText("Montant") as HTMLInputElement).value).toMatch(/^12[\s\u202f\u00a0]500$/);
  });
  it("ConfirmDialog : demande confirmation avant l'action et se ferme avec Echap", async () => {
    const ok = vi.fn(), close = vi.fn();
    render(<ConfirmDialog open title="Supprimer ?" message="Action definitive" danger confirmLabel="Supprimer" onConfirm={ok} onClose={close} />);
    expect(screen.getByRole("dialog", { name: "Supprimer ?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Supprimer" })); expect(ok).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}"); expect(close).toHaveBeenCalled();
  });
  it("Spinner expose un role status", () => { render(<Spinner />); expect(screen.getByRole("status")).toHaveTextContent("Chargement"); });
});
