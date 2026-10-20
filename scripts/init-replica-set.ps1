# Initialise un replica set MONGODB local a un seul noeud (Windows, PowerShell).
# Prerequis : mongod.cfg contient deja  replication:\n  replSetName: rs0  et le service MongoDB a ete redemarre.
$mongosh = Get-Command mongosh -ErrorAction SilentlyContinue
if (-not $mongosh) { Write-Error "mongosh est introuvable. Installez MongoDB Shell : https://www.mongodb.com/try/download/shell"; exit 1 }
mongosh --quiet --eval "try { rs.status().ok } catch (e) { rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] }) }"
Write-Host "Termine. Verifiez avec : npm run check:mongo"
