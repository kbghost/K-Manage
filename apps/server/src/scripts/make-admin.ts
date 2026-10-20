import mongoose from "mongoose";
import { loadEnv } from "../config/env.js";
import { User } from "../modules/auth/models.js";

const email = process.argv[2];
if (!email) { console.error("Usage : npm run make-admin -w @k-manage/server -- email@exemple.com"); process.exit(1); }
await mongoose.connect(loadEnv().MONGODB_URI);
const r = await User.updateOne({ email: email.toLowerCase() }, { isPlatformAdmin: true });
console.log(r.matchedCount ? `${email} est maintenant administrateur de plateforme (sans acces aux donnees des commerces).` : "Aucun compte avec cet email.");
await mongoose.disconnect();
