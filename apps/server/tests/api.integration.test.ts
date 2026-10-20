/**
 * Tests d'integration : exigent une vraie base MongoDB-compatible.
 *   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/kmtest npm test -w @k-manage/server
 * Avec un replica set, ajouter TEST_USE_TRANSACTIONS=true pour tester le mode transactionnel.
 * Sans TEST_MONGODB_URI ils sont IGNORES (donc non executes).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { addStaff, bootApp, Client, mkProduct, mongoUri, newOwner, uniq } from "./helpers.js";

const run = mongoUri ? describe : describe.skip;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

run("API K-Manage (integration)", () => {
  let ctx: Awaited<ReturnType<typeof bootApp>>;
  let owner: Client, other: Client, manager: Client, cashier: Client, keeper: Client;
  beforeAll(async () => {
    ctx = await bootApp();
    owner = await newOwner(ctx.app, "Alice"); other = await newOwner(ctx.app, "Bob");
    manager = await addStaff(ctx.app, owner, "manager"); cashier = await addStaff(ctx.app, owner, "cashier"); keeper = await addStaff(ctx.app, owner, "storekeeper");
  });
  afterAll(async () => { await ctx.close(); });

  describe("authentification", () => {
    it("refuse l'acces non authentifie", async () => { expect((await request(ctx.app).get("/api/v1/auth/me")).status).toBe(401); });
    it("refuse une ecriture sans jeton CSRF", async () => {
      const r = await owner.agent.post("/api/v1/businesses").send({ name: "X" }); expect(r.status).toBe(403); expect(r.body.error.code).toBe("CSRF_INVALID");
    });
    it("meme message pour mauvais mot de passe et compte inconnu", async () => {
      const a = await new Client(ctx.app).login(owner.email, "mauvais-mot-de-passe"); const b = await new Client(ctx.app).login("inconnu@test.bj", "mauvais-mot-de-passe");
      expect(a.status).toBe(401); expect(b.status).toBe(401); expect(a.body.error.message).toBe(b.body.error.message);
    });
    it("refuse un mot de passe trop court et un email en double", async () => {
      expect((await request(ctx.app).post("/api/v1/auth/register").send({ email: "x@test.bj", password: "court", fullName: "X" })).status).toBe(400);
      expect((await request(ctx.app).post("/api/v1/auth/register").send({ email: owner.email, password: "motdepasse-solide-1", fullName: "Dup" })).body.error.code).toBe("EMAIL_TAKEN");
    });
    it("reinitialisation du mot de passe : jeton a usage unique, sessions revoquees", async () => {
      const u = await new Client(ctx.app).register("Reset");
      const f = await request(ctx.app).post("/api/v1/auth/forgot-password").send({ email: u.email });
      const token = f.body.data.devResetToken; expect(token).toBeTruthy();
      expect((await request(ctx.app).post("/api/v1/auth/reset-password").send({ token, password: "nouveau-mot-de-passe-2" })).status).toBe(204);
      expect((await request(ctx.app).post("/api/v1/auth/reset-password").send({ token, password: "autre-mot-de-passe-33" })).status).toBe(400);
      expect((await u.get("/auth/me")).status).toBe(401); // ancienne session revoquee
      expect((await new Client(ctx.app).login(u.email, "nouveau-mot-de-passe-2")).status).toBe(200);
      const unknown = await request(ctx.app).post("/api/v1/auth/forgot-password").send({ email: "personne@test.bj" });
      expect(unknown.status).toBe(200); expect(unknown.body.data.devResetToken).toBeUndefined();
    });
    it("deconnexion et revocation de session", async () => {
      const u = await new Client(ctx.app).register("Out"); expect((await u.post("/auth/logout")).status).toBe(204); expect((await u.get("/auth/me")).status).toBe(401);
    });
  });

  describe("isolation multi-commerce", () => {
    it("un non-membre ne voit pas le commerce (404) et ne peut rien modifier", async () => {
      const bAsA = other.businessId;
      const probe = new Client(ctx.app); probe.agent = other.agent; probe.csrf = other.csrf; probe.use(owner.businessId);
      expect((await probe.get("/businesses/current")).status).toBe(404);
      expect((await probe.patch("/businesses/current", { name: "Pirate" })).status).toBe(404);
      expect((await probe.get("/catalog/products")).status).toBe(404);
      expect((await other.get("/businesses")).body.data.map((b: { id: string }) => b.id)).toEqual([bAsA]);
    });
    it("une ressource d'un autre commerce est introuvable meme avec son propre commerce actif", async () => {
      const p = await mkProduct(owner);
      expect((await other.get(`/catalog/products/${p.id}`)).status).toBe(404);
      expect((await other.patch(`/catalog/products/${p.id}`, { name: "Vole" })).status).toBe(404);
      expect((await other.post("/stock/movements", { type: "entry", productId: p.id, quantity: 5 })).status).toBe(404);
      expect((await other.post("/sales", { lines: [{ productId: p.id, quantity: 1 }], payments: [{ method: "cash", amount: 1000 }] })).status).toBe(400);
      const s = await owner.post("/sales", { lines: [{ productId: p.id, quantity: 1 }], payments: [{ method: "cash", amount: 1000 }] });
      expect((await other.get(`/sales/${s.body.data.id}`)).status).toBe(404);
      expect((await other.post(`/sales/${s.body.data.id}/cancel`, { reason: "piratage" })).status).toBe(404);
      expect((await other.get("/catalog/products")).body.data.some((x: { id: string }) => x.id === p.id)).toBe(false);
    });
    it("les memes SKU sont autorises dans deux commerces differents", async () => {
      const sku = `COMMUN${uniq()}`;
      expect((await owner.post("/catalog/products", { name: "A", sku, costPrice: 1, salePrice: 2 })).status).toBe(201);
      expect((await other.post("/catalog/products", { name: "B", sku, costPrice: 1, salePrice: 2 })).status).toBe(201);
    });
    it("un administrateur de plateforme n'a pas acces aux donnees d'un commerce", async () => {
      const { User } = await import("../src/modules/auth/models.js");
      const admin = await new Client(ctx.app).register("Admin"); await User.updateOne({ email: admin.email }, { isPlatformAdmin: true });
      admin.use(owner.businessId);
      expect((await admin.get("/catalog/products")).status).toBe(404);
      expect((await admin.get("/admin/stats")).status).toBe(200);
      expect((await owner.get("/admin/stats")).status).toBe(403);
    });
  });

  describe("roles et permissions (serveur)", () => {
    it("le caissier ne peut pas creer de produit, ajuster le stock, rembourser ni voir l'audit", async () => {
      const p = await mkProduct(owner);
      expect((await cashier.post("/catalog/products", { name: "X", sku: "ZZ1", costPrice: 1, salePrice: 2 })).status).toBe(403);
      expect((await cashier.post("/stock/movements", { type: "entry", productId: p.id, quantity: 1 })).status).toBe(403);
      expect((await cashier.get("/audit-logs")).status).toBe(403);
      expect((await cashier.get("/reports/dashboard")).status).toBe(403);
    });
    it("le prix d'achat est masque pour le caissier", async () => {
      const p = await mkProduct(owner);
      expect((await cashier.get(`/catalog/products/${p.id}`)).body.data.costPrice).toBeUndefined();
      expect((await cashier.get("/catalog/products")).body.data[0].costPrice).toBeUndefined();
      expect((await owner.get(`/catalog/products/${p.id}`)).body.data.costPrice).toBe(600);
    });
    it("le magasinier ne peut pas vendre mais peut ajuster le stock", async () => {
      const p = await mkProduct(owner);
      expect((await keeper.post("/sales", { lines: [{ productId: p.id, quantity: 1 }], payments: [{ method: "cash", amount: 1000 }] })).status).toBe(403);
      expect((await keeper.post("/stock/movements", { type: "entry", productId: p.id, quantity: 2 })).status).toBe(201);
    });
    it("seul le proprietaire gere les membres et les parametres ; le proprietaire est protege", async () => {
      expect((await manager.get("/members")).status).toBe(403);
      expect((await manager.patch("/businesses/current", { name: "Autre" })).status).toBe(403);
      const ms = await owner.get("/members"); const own = ms.body.data.find((m: { role: string }) => m.role === "owner");
      expect((await owner.patch(`/members/${own.id}`, { status: "disabled" })).status).toBe(403);
      expect((await owner.post("/members", { email: "x@test.bj", role: "owner" })).status).toBe(400);
    });
    it("un membre desactive perd l'acces immediatement", async () => {
      const tmp = await addStaff(ctx.app, owner, "cashier"); expect((await tmp.get("/catalog/products")).status).toBe(200);
      const ms = await owner.get("/members"); const m = ms.body.data.find((x: { user?: { email: string } }) => x.user?.email === tmp.email);
      expect((await owner.patch(`/members/${m.id}`, { status: "disabled" })).status).toBe(200);
      expect((await tmp.get("/catalog/products")).status).toBe(404);
    });
  });

  describe("produits et stock", () => {
    it("SKU unique par commerce, code-barres absent sans collision, code-barres unique sinon", async () => {
      const sku = `U${uniq()}`;
      expect((await owner.post("/catalog/products", { name: "A", sku, costPrice: 1, salePrice: 2 })).status).toBe(201);
      expect((await owner.post("/catalog/products", { name: "A2", sku: sku.toLowerCase(), costPrice: 1, salePrice: 2 })).body.error.code).toBe("DUPLICATE_SKU");
      expect((await owner.post("/catalog/products", { name: "B", sku: `B${uniq()}`, costPrice: 1, salePrice: 2 })).status).toBe(201);
      expect((await owner.post("/catalog/products", { name: "C", sku: `C${uniq()}`, costPrice: 1, salePrice: 2 })).status).toBe(201);
      const code = `600${uniq()}`;
      expect((await owner.post("/catalog/products", { name: "D", sku: `D${uniq()}`, barcode: code, costPrice: 1, salePrice: 2 })).status).toBe(201);
      expect((await owner.post("/catalog/products", { name: "E", sku: `E${uniq()}`, barcode: code, costPrice: 1, salePrice: 2 })).body.error.code).toBe("DUPLICATE_BARCODE");
      expect((await owner.get(`/catalog/products/lookup?code=${code}`)).body.data.name).toBe("D");
    });
    it("valide les montants (entiers, positifs) et les identifiants", async () => {
      expect((await owner.post("/catalog/products", { name: "N", sku: "N1", costPrice: -5, salePrice: 2 })).status).toBe(400);
      expect((await owner.post("/catalog/products", { name: "N", sku: "N2", costPrice: 1, salePrice: 2.5 })).status).toBe(400);
      expect((await owner.get("/catalog/products/pas-un-id")).status).toBe(400);
      expect((await owner.get("/catalog/products?limit=10000")).status).toBe(400);
      // Operateurs Mongo injectes via la query-string : jamais interpretes (cles ignorees ou rejetees)
      const inj = await owner.get("/catalog/products?sort[$ne]=1&q[$ne]=x&categoryId[$ne]=1"); expect([200, 400]).toContain(inj.status);
      if (inj.status === 200) expect(inj.body.meta.total).toBe((await owner.get("/catalog/products")).body.meta.total);
    });
    it("tout mouvement de stock est trace ; sortie sans motif refusee ; stock negatif refuse", async () => {
      const p = await mkProduct(owner, { initialStock: 5 });
      expect((await owner.post("/stock/movements", { type: "exit", productId: p.id, quantity: 1 })).status).toBe(400);
      expect((await owner.post("/stock/movements", { type: "exit", productId: p.id, quantity: 9, reason: "casse" })).body.error.code).toBe("INSUFFICIENT_STOCK");
      expect((await owner.post("/stock/movements", { type: "exit", productId: p.id, quantity: 2, reason: "casse" })).status).toBe(201);
      expect((await owner.post("/stock/movements", { type: "adjustment", productId: p.id, countedQuantity: 10, reason: "recomptage" })).status).toBe(201);
      const h = await owner.get(`/catalog/products/${p.id}/history`);
      expect(h.body.data.movements.map((m: { type: string; quantity: number }) => [m.type, m.quantity]).reverse()).toEqual([["initial", 5], ["exit", -2], ["adjustment", 7]]);
      expect((await owner.get(`/catalog/products/${p.id}`)).body.data.stock).toBe(10);
    });
    it("inventaire physique, import controle (dry-run) et alertes", async () => {
      const p = await mkProduct(owner, { initialStock: 4, alertThreshold: 5 });
      expect((await owner.get("/stock/alerts")).body.data.low.some((x: { id: string }) => x.id === p.id)).toBe(true);
      const inv = await owner.post("/stock/inventory", { note: "inventaire d'octobre", items: [{ productId: p.id, counted: 12 }] });
      expect(inv.body.data.adjusted).toBe(1); expect((await owner.get(`/catalog/products/${p.id}`)).body.data.stock).toBe(12);
      const rows = [{ name: "Import 1", sku: `I${uniq()}`, costPrice: 100, salePrice: 150, stock: 3 }, { name: "", sku: "BAD", costPrice: "x", salePrice: 1 }];
      const dry = await owner.post("/catalog/products/import", { rows, dryRun: true }); expect(dry.body.data.valid).toBe(false);
      expect((await owner.post("/catalog/products/import", { rows })).status).toBe(422);
      expect((await owner.post("/catalog/products/import", { rows: [rows[0]] })).status).toBe(201);
    });
    it("archivage et historique des prix (audit)", async () => {
      const p = await mkProduct(owner);
      await owner.patch(`/catalog/products/${p.id}`, { salePrice: 1200 });
      const h = await owner.get(`/catalog/products/${p.id}/history`);
      expect(h.body.data.changes.some((c: { action: string }) => c.action === "product.price_changed")).toBe(true);
      expect((await owner.del(`/catalog/products/${p.id}`)).body.data.status).toBe("archived");
      expect((await owner.post("/sales", { lines: [{ productId: p.id, quantity: 1 }], payments: [{ method: "cash", amount: 1200 }] })).status).toBe(400);
    });
  });

  describe("ventes", () => {
    it("le serveur recalcule tout : les totaux/prix du navigateur sont ignores", async () => {
      const p = await mkProduct(owner, { salePrice: 1500, initialStock: 10 });
      const r = await cashier.post("/sales", { lines: [{ productId: p.id, quantity: 3, unitPrice: 1, total: 3 }], total: 1, subtotal: 1, payments: [{ method: "cash", amount: 4500 }] });
      expect(r.status).toBe(201); expect(r.body.data.total).toBe(4500); expect(r.body.data.lines[0].unitPrice).toBe(1500);
      expect(r.body.data.paymentStatus).toBe("paid"); expect(r.body.data.remaining).toBe(0);
      expect((await owner.get(`/catalog/products/${p.id}`)).body.data.stock).toBe(7);
      const mv = (await owner.get(`/stock/movements?productId=${p.id}&type=sale`)).body.data; expect(mv).toHaveLength(1); expect(mv[0].quantity).toBe(-3);
    });
    it("idempotence : rejouer la meme requete ne cree ni 2e vente ni 2e sortie de stock", async () => {
      const p = await mkProduct(owner, { initialStock: 10 }); const key = `idem-${uniq()}`;
      const body = { lines: [{ productId: p.id, quantity: 2 }], payments: [{ method: "cash", amount: 2000 }] };
      const a = await cashier.post("/sales", body, { "idempotency-key": key }); const b = await cashier.post("/sales", body, { "idempotency-key": key });
      expect(a.status).toBe(201); expect(b.status).toBe(200); expect(b.body.data.replay).toBe(true); expect(b.body.data.number).toBe(a.body.data.number);
      expect((await owner.get(`/catalog/products/${p.id}`)).body.data.stock).toBe(8);
      const par = await Promise.all([1, 2, 3].map(() => cashier.post("/sales", body, { "idempotency-key": `par-${key}` })));
      expect(par.filter((x) => x.status === 201).length).toBe(1); expect((await owner.get(`/catalog/products/${p.id}`)).body.data.stock).toBe(6);
    });
    it("ventes concurrentes sur stock limite : jamais de stock negatif", async () => {
      const p = await mkProduct(owner, { initialStock: 3 });
      const rs = await Promise.all(Array.from({ length: 8 }, () => cashier.post("/sales", { lines: [{ productId: p.id, quantity: 1 }], payments: [{ method: "cash", amount: 1000 }] }, { "idempotency-key": `c-${uniq()}-xx` })));
      expect(rs.filter((r) => r.status === 201)).toHaveLength(3);
      expect(rs.filter((r) => r.status === 409).every((r) => r.body.error.code === "INSUFFICIENT_STOCK")).toBe(true);
      expect((await owner.get(`/catalog/products/${p.id}`)).body.data.stock).toBe(0);
      const sold = (await owner.get(`/stock/movements?productId=${p.id}&type=sale&limit=50`)).body.data; expect(sold).toHaveLength(3);
    });
    it("remise soumise a permission ; surpaiement et credit anonyme refuses", async () => {
      const p = await mkProduct(owner, { salePrice: 1000 });
      const L = [{ productId: p.id, quantity: 2 }];
      expect((await cashier.post("/sales", { lines: [{ productId: p.id, quantity: 2, discount: 100 }], payments: [{ method: "cash", amount: 1900 }] })).status).toBe(403);
      const m = await manager.post("/sales", { lines: [{ productId: p.id, quantity: 2, discount: 100 }], discount: 50, payments: [{ method: "cash", amount: 1850 }] });
      expect(m.status).toBe(201); expect(m.body.data.total).toBe(1850);
      expect((await cashier.post("/sales", { lines: L, payments: [{ method: "cash", amount: 5000 }] })).body.error.code).toBe("OVERPAYMENT");
      expect((await cashier.post("/sales", { lines: L, payments: [{ method: "cash", amount: 500 }] })).body.error.code).toBe("CUSTOMER_REQUIRED_FOR_CREDIT");
      expect((await cashier.post("/sales", { lines: [{ productId: p.id, quantity: -1 }], payments: [] })).status).toBe(400);
      expect((await cashier.post("/sales", { lines: L, payments: [{ method: "bitcoin", amount: 2000 }] })).body.error.code).toBe("INVALID_PAYMENT_METHOD");
    });
    it("credit client : paiement partiel, solde, double paiement, reglement FIFO", async () => {
      const c = (await owner.post("/parties/customers", { name: "Client Credit" })).body.data;
      const p = await mkProduct(owner, { salePrice: 1000, initialStock: 50 });
      const s1 = (await cashier.post("/sales", { customerId: c.id, lines: [{ productId: p.id, quantity: 10 }], payments: [{ method: "cash", amount: 4000 }] })).body.data;
      const s2 = (await cashier.post("/sales", { customerId: c.id, lines: [{ productId: p.id, quantity: 5 }], payments: [] })).body.data;
      expect([s1.remaining, s1.paymentStatus, s2.paymentStatus]).toEqual([6000, "partial", "unpaid"]);
      expect((await owner.get(`/parties/customers/${c.id}`)).body.data.balance).toBe(11000);
      const key = `pay-${uniq()}-aa`;
      expect((await cashier.post(`/sales/${s1.id}/payments`, { amount: 7000, method: "cash" })).body.error.code).toBe("OVERPAYMENT");
      const p1 = await cashier.post(`/sales/${s1.id}/payments`, { amount: 2000, method: "transfer" }, { "idempotency-key": key });
      const p2 = await cashier.post(`/sales/${s1.id}/payments`, { amount: 2000, method: "transfer" }, { "idempotency-key": key });
      expect([p1.status, p2.status, p2.body.data.replay]).toEqual([201, 200, true]);
      expect((await owner.get(`/sales/${s1.id}`)).body.data.remaining).toBe(4000);
      // 2 paiements simultanes qui, ensemble, depasseraient le solde : un seul peut passer
      const race = await Promise.all([cashier.post(`/sales/${s1.id}/payments`, { amount: 4000, method: "cash" }), cashier.post(`/sales/${s1.id}/payments`, { amount: 4000, method: "cash" })]);
      expect(race.filter((r) => r.status === 201)).toHaveLength(1);
      expect((await owner.get(`/sales/${s1.id}`)).body.data.remaining).toBe(0);
      expect((await owner.get(`/parties/customers/${c.id}`)).body.data.balance).toBe(5000);
      const sk = `set-${uniq()}-bb`;
      expect((await owner.post(`/parties/customers/${c.id}/settlements`, { amount: 9999, method: "cash" })).body.error.code).toBe("OVERPAYMENT");
      const st = await owner.post(`/parties/customers/${c.id}/settlements`, { amount: 3000, method: "cash" }, { "idempotency-key": sk });
      const st2 = await owner.post(`/parties/customers/${c.id}/settlements`, { amount: 3000, method: "cash" }, { "idempotency-key": sk });
      expect([st.status, st2.status]).toEqual([201, 200]);
      expect((await owner.get(`/parties/customers/${c.id}`)).body.data.balance).toBe(2000);
      expect((await owner.get("/parties/customers/receivables/list")).body.data.find((x: { id: string }) => x.id === c.id).balance).toBe(2000);
      expect((await owner.get(`/sales/${s2.id}`)).body.data.ledger.consistent).toBe(true);
    });
    it("remboursement partiel puis annulation : stock, caisse, historique conserve", async () => {
      const p = await mkProduct(owner, { salePrice: 1000, initialStock: 10 });
      const s = (await cashier.post("/sales", { lines: [{ productId: p.id, quantity: 4 }], payments: [{ method: "cash", amount: 4000 }] })).body.data;
      expect((await cashier.post(`/sales/${s.id}/refund`, { lines: [{ lineIndex: 0, quantity: 1 }], reason: "defaut" })).status).toBe(403);
      const rf = await manager.post(`/sales/${s.id}/refund`, { lines: [{ lineIndex: 0, quantity: 1 }], reason: "article defectueux" });
      expect(rf.status).toBe(200); expect(rf.body.data.cashRefund).toBe(1000); expect(rf.body.data.sale.refundedTotal).toBe(1000);
      expect((await owner.get(`/catalog/products/${p.id}`)).body.data.stock).toBe(7);
      expect((await manager.post(`/sales/${s.id}/refund`, { lines: [{ lineIndex: 0, quantity: 4 }], reason: "trop" })).status).toBe(400);
      expect((await manager.post(`/sales/${s.id}/cancel`, { reason: "client parti" })).status).toBe(200);
      const d = (await owner.get(`/sales/${s.id}`)).body.data;
      expect([d.status, d.paidAmount, d.remaining, d.refunds.length, d.ledger.consistent]).toEqual(["cancelled", 0, 0, 2, true]);
      expect((await owner.get(`/catalog/products/${p.id}`)).body.data.stock).toBe(10);
      expect((await manager.post(`/sales/${s.id}/cancel`, { reason: "encore" })).status).toBe(409);
      const logs = (await owner.get("/audit-logs?limit=100")).body.data.map((l: { action: string }) => l.action);
      expect(logs).toEqual(expect.arrayContaining(["sale.refund", "sale.cancel", "sale.discount"]));
    });
  });

  describe("achats, depenses, caisse", () => {
    it("achat : reception partielle tracee, stock, paiements sans double comptage, dette fournisseur", async () => {
      const sup = (await owner.post("/parties/suppliers", { name: "Fournisseur A" })).body.data;
      const p = await mkProduct(owner, { initialStock: 0, costPrice: 500 });
      const pu = await keeper.post("/purchases", { supplierId: sup.id, lines: [{ productId: p.id, quantity: 10, unitCost: 700 }] });
      expect(pu.status).toBe(201); expect(pu.body.data.total).toBe(7000);
      const id = pu.body.data.id;
      expect((await keeper.post(`/purchases/${id}/receive`, { lines: [{ lineIndex: 0, quantity: 11 }] })).body.error.code).toBe("OVER_RECEIPT");
      expect((await keeper.post(`/purchases/${id}/receive`, { lines: [{ lineIndex: 0, quantity: 4 }] })).body.data.status).toBe("partial");
      expect((await owner.get(`/catalog/products/${p.id}`)).body.data).toMatchObject({ stock: 4, costPrice: 700 });
      expect((await keeper.post(`/purchases/${id}/receive`, { lines: [{ lineIndex: 0, quantity: 6 }] })).body.data.status).toBe("received");
      expect((await keeper.post(`/purchases/${id}/receive`, { lines: [{ lineIndex: 0, quantity: 1 }] })).status).toBe(409);
      expect((await owner.get(`/parties/suppliers/${sup.id}`)).body.data.balance).toBe(7000);
      const key = `sp-${uniq()}-zz`;
      const a = await owner.post(`/purchases/${id}/payments`, { amount: 3000, method: "transfer" }, { "idempotency-key": key });
      const b = await owner.post(`/purchases/${id}/payments`, { amount: 3000, method: "transfer" }, { "idempotency-key": key });
      expect([a.status, b.status]).toEqual([201, 200]);
      expect((await owner.post(`/purchases/${id}/payments`, { amount: 5000, method: "transfer" })).body.error.code).toBe("OVERPAYMENT");
      expect((await owner.get(`/parties/suppliers/${sup.id}`)).body.data.balance).toBe(4000);
      expect((await owner.post(`/purchases/${id}/cancel`)).status).toBe(409);
    });
    it("depenses : especes -> sortie de caisse (caisse ouverte exigee), credit -> aucune sortie", async () => {
      const bz = await newOwner(ctx.app, "Caisse");
      const ex = { category: "Transport", description: "Carburant", amount: 2000, date: "2026-10-16", method: "cash" };
      expect((await bz.post("/expenses", ex)).body.error.code).toBe("NO_OPEN_SESSION");
      expect((await bz.post("/cash-sessions", { openingAmount: 10000 })).status).toBe(201);
      expect((await bz.post("/cash-sessions", { openingAmount: 1 })).body.error.code).toBe("SESSION_ALREADY_OPEN");
      expect((await bz.post("/expenses", ex)).status).toBe(201);
      expect((await bz.post("/expenses", { ...ex, amount: 999999 })).body.error.code).toBe("INSUFFICIENT_CASH");
      const pay = (await bz.post("/expenses", { category: "Loyer", description: "Loyer octobre", amount: 50000, date: "2026-10-16", status: "payable" })).body.data;
      expect((await bz.get("/cash-sessions/current")).body.data.summary.expected).toBe(8000);
      expect((await bz.post(`/expenses/${pay.id}/pay`, { method: "transfer" })).body.data.status).toBe("paid");
      expect((await bz.get("/cash-sessions/current")).body.data.summary.expected).toBe(8000);
      expect((await bz.post(`/expenses/${pay.id}/pay`, { method: "transfer" })).status).toBe(409);
    });
    it("caisse : ventes/remboursements/entrees, ecart a la cloture, correction reservee", async () => {
      const bz = await newOwner(ctx.app, "Till"); const cash = await addStaff(ctx.app, bz, "cashier"); const mgr = await addStaff(ctx.app, bz, "manager");
      const p = await mkProduct(bz, { salePrice: 1000, initialStock: 20 });
      await cash.post("/cash-sessions", { openingAmount: 5000 });
      await cash.post("/sales", { lines: [{ productId: p.id, quantity: 5 }], payments: [{ method: "cash", amount: 5000 }] });
      await cash.post("/sales", { lines: [{ productId: p.id, quantity: 2 }], payments: [{ method: "transfer", amount: 2000 }] });
      await cash.post("/cash-sessions/current/entries", { type: "in", amount: 1000, reason: "apport" });
      await cash.post("/cash-sessions/current/entries", { type: "out", amount: 500, reason: "sachets" });
      expect((await cash.get("/cash-sessions/current")).body.data.summary.expected).toBe(5000 + 5000 + 1000 - 500);
      const closed = await cash.post("/cash-sessions/current/close", { countedAmount: 10300 });
      expect([closed.body.data.expectedAmount, closed.body.data.difference]).toEqual([10500, -200]);
      expect((await cash.post("/cash-sessions/current/close", { countedAmount: 1 })).status).toBe(409);
      const sid = closed.body.data.id;
      expect((await cash.post(`/cash-sessions/${sid}/corrections`, { countedAmount: 10500, reason: "erreur de comptage" })).status).toBe(403);
      const fix = await mgr.post(`/cash-sessions/${sid}/corrections`, { countedAmount: 10500, reason: "erreur de comptage" });
      expect([fix.status, fix.body.data.difference, fix.body.data.corrections.length]).toEqual([200, 0, 1]);
      expect((await bz.get("/audit-logs?action=cash.correction")).body.data).toHaveLength(1);
    });
  });

  describe("rapports et exports", () => {
    it("chiffres coherents entre dashboard et rapports, ventes annulees exclues", async () => {
      const bz = await newOwner(ctx.app, "Rapport"); const c = (await bz.post("/parties/customers", { name: "Cli" })).body.data;
      const p = await mkProduct(bz, { salePrice: 1000, costPrice: 600, initialStock: 100 });
      const s1 = (await bz.post("/sales", { lines: [{ productId: p.id, quantity: 3 }], payments: [{ method: "cash", amount: 3000 }] })).body.data;
      await bz.post("/sales", { customerId: c.id, lines: [{ productId: p.id, quantity: 2, discount: 200 }], payments: [{ method: "cash", amount: 1000 }] });
      const gone = (await bz.post("/sales", { lines: [{ productId: p.id, quantity: 7 }], payments: [{ method: "cash", amount: 7000 }] })).body.data;
      await bz.post(`/sales/${gone.id}/cancel`, { reason: "erreur de saisie" });
      await bz.post(`/sales/${s1.id}/refund`, { lines: [{ lineIndex: 0, quantity: 1 }], reason: "retour" });
      await bz.post("/cash-sessions", { openingAmount: 0 });
      await bz.post("/expenses", { category: "Autre", description: "Frais", amount: 500, date: new Date().toISOString().slice(0, 10), method: "transfer" });
      const sum = (await bz.get("/reports/summary")).body.data;
      expect(sum).toMatchObject({ salesCount: 2, grossSales: 4800, refunds: 1000, netSales: 3800, cogs: 2400, grossMargin: 1400, collected: 3000, expenses: 500, receivables: 800, payables: 0 });
      const dash = (await bz.get("/reports/dashboard")).body.data;
      expect(dash.summary.netSales).toBe(sum.netSales); expect(dash.today.revenue).toBe(3800);
      expect(dash.topProducts[0]).toMatchObject({ quantity: 4, revenue: 3800 });
      const series = (await bz.get("/reports/sales-series")).body.data; expect(series.totals.net).toBe(3800);
      expect((await bz.get("/reports/receivables")).body.data.totals.balance).toBe(800);
      const stock = (await bz.get("/reports/stock")).body.data; expect(stock.rows.find((r: { sku: string }) => r.sku).value).toBeGreaterThan(0);
      expect((await bz.get("/reports/inconnu")).status).toBe(404);
    });
    it("exports CSV, Excel et PDF ; donnees financieres reservees", async () => {
      const bz = await newOwner(ctx.app, "Export"); const mgr = await addStaff(ctx.app, bz, "manager"); const keeperX = await addStaff(ctx.app, bz, "storekeeper");
      await mkProduct(bz, { name: "=CMD()", initialStock: 3 });
      const csv = await bz.get("/catalog/products?format=csv"); expect(csv.headers["content-type"]).toContain("text/csv"); expect(csv.text).toContain("'=CMD()");
      const x = await bz.get("/reports/stock?format=xlsx").buffer(true).parse((res, cb) => { const d: Buffer[] = []; res.on("data", (c: Buffer) => d.push(c)); res.on("end", () => cb(null, Buffer.concat(d))); });
      expect(x.headers["content-type"]).toContain("spreadsheetml"); expect((x.body as Buffer).subarray(0, 2).toString()).toBe("PK");
      const pdf = await bz.get("/reports/stock?format=pdf").buffer(true).parse((res, cb) => { const d: Buffer[] = []; res.on("data", (c: Buffer) => d.push(c)); res.on("end", () => cb(null, Buffer.concat(d))); });
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
      expect((await mgr.get("/reports/expenses")).status).toBe(200);
      expect((await keeperX.get("/reports/expenses")).status).toBe(403);
      expect((await keeperX.get("/reports/stock")).status).toBe(403);
    });
    it("notifications de stock faible", async () => {
      const bz = await newOwner(ctx.app, "Notif"); await mkProduct(bz, { initialStock: 1, alertThreshold: 5 });
      expect((await bz.get("/reports/notifications")).body.data.map((n: { type: string }) => n.type)).toContain("stock_low");
    });
  });

  describe("fichiers et robustesse", () => {
    it("televersement : signature verifiee, lecture reservee aux membres", async () => {
      const ok = await owner.agent.post("/api/v1/uploads").set("x-csrf-token", owner.csrf).set("x-business-id", owner.businessId).attach("file", PNG, { filename: "../../etc/passwd.png" });
      expect(ok.status).toBe(201);
      const bad = await owner.agent.post("/api/v1/uploads").set("x-csrf-token", owner.csrf).set("x-business-id", owner.businessId).attach("file", Buffer.from("<script>alert(1)</script>"), { filename: "x.png", contentType: "image/png" });
      expect(bad.status).toBe(415);
      expect((await owner.get(`/uploads/${ok.body.data.id}`)).headers["content-type"]).toBe("image/png");
      expect((await other.get(`/uploads/${ok.body.data.id}`)).status).toBe(404);
    });
    it("JSON invalide -> 400, route inconnue -> 404, aucun detail interne", async () => {
      const r = await owner.agent.post("/api/v1/catalog/products").set("x-csrf-token", owner.csrf).set("x-business-id", owner.businessId).set("Content-Type", "application/json").send("{pas json");
      expect(r.status).toBe(400); expect(r.body.error.code).toBe("BAD_JSON");
      const nf = await request(ctx.app).get("/api/v1/nope"); expect(nf.status).toBe(404); expect(JSON.stringify(nf.body)).not.toMatch(/stack|mongoose/i);
    });
    it("OpenAPI et sante", async () => {
      expect((await request(ctx.app).get("/api/v1/health")).body.status).toBe("ok");
      const o = (await request(ctx.app).get("/api/v1/openapi.json")).body; expect(Object.keys(o.paths).length).toBeGreaterThan(50);
    });
  });
});
