// Verifie la connexion MongoDB et la presence d'un replica set (necessaire aux transactions).
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/k-manage?replicaSet=rs0";
const useTx = (process.env.USE_TRANSACTIONS ?? "true") === "true";
try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  const info = await mongoose.connection.db.admin().serverInfo();
  console.log(`OK  MongoDB ${info.version} joignable.`);
  if (hello.setName) console.log(`OK  Replica set « ${hello.setName} » actif : les transactions sont disponibles.`);
  else if (useTx) { console.error("ERREUR  Aucun replica set : les transactions sont impossibles. Voir README (etape « Replica set local »), ou USE_TRANSACTIONS=false en developpement uniquement."); process.exitCode = 1; }
  else console.log("ATTENTION  Pas de replica set, USE_TRANSACTIONS=false : mode developpement sans atomicite stricte.");
} catch (e) {
  console.error("ERREUR  Connexion impossible :", e.message);
  console.error("Verifiez que le service MongoDB est demarre (Windows : services.msc > MongoDB Server) et la variable MONGODB_URI.");
  process.exitCode = 1;
} finally { await mongoose.disconnect().catch(() => undefined); }
