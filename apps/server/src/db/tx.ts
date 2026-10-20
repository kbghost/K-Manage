/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { type ClientSession, type Model } from "mongoose";

let enabled = true;
export const configureTransactions = (v: boolean) => { enabled = v; };

type Undo = () => Promise<unknown>;
export type Doc = { _id: mongoose.Types.ObjectId } & Record<string, any>;

/**
 * Unite de travail. Avec transactions (production) tout est atomique via MongoDB.
 * Sans transactions (dev/test sur un Mongo sans replica set), les ecritures sont annulees
 * "au mieux" en cas d'echec (compensation) — aucune garantie d'atomicite stricte.
 */
export class Tx {
  private undos: Undo[] = [];
  constructor(public readonly session?: ClientSession) {}

  async create(model: Model<any>, doc: Record<string, unknown>): Promise<Doc> {
    const [created] = await model.create([doc], { session: this.session });
    if (!created) throw new Error("creation impossible");
    if (!this.session) this.undos.push(() => model.deleteOne({ _id: created._id }));
    return created as unknown as Doc;
  }

  /** Mise a jour conditionnelle atomique. Renvoie le document APRES mise a jour, ou null si le filtre ne correspond pas. */
  async update(model: Model<any>, filter: Record<string, unknown>, update: Record<string, unknown>, inverse: Record<string, unknown>): Promise<Doc | null> {
    const doc = await model.findOneAndUpdate(filter, update, { returnDocument: "after", session: this.session });
    if (doc && !this.session) this.undos.push(() => model.updateOne({ _id: doc._id }, inverse));
    return doc as unknown as Doc | null;
  }

  async rollback() {
    for (const u of this.undos.reverse()) {
      try { await u(); } catch { /* compensation au mieux */ }
    }
  }
}

export async function runTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!enabled) {
    const tx = new Tx();
    try { return await fn(tx); } catch (e) { await tx.rollback(); throw e; }
  }
  const session = await mongoose.startSession();
  try {
    return (await session.withTransaction(() => fn(new Tx(session)))) as T;
  } finally {
    await session.endSession();
  }
}
