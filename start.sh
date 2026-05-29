#!/bin/bash
echo "=== KHOI DONG HE THONG VAN BANG BLOCKCHAIN ==="

# 1. Kiem tra Docker dang chay
if ! docker info > /dev/null 2>&1; then
  echo "Docker chua chay. Hay khoi dong Docker truoc."
  exit 1
fi

# 2. Khoi dong lai Fabric network (giu nguyen data)
echo ">>> Khoi dong Fabric network..."
cd blockchain-network
DOCKER_SOCK=/var/run/docker.sock docker compose \
  -f compose/compose-test-net.yaml \
  -f compose/docker/docker-compose-test-net.yaml \
  -f compose/compose-ca.yaml \
  up -d

echo ">>> Doi peer khoi dong..."
sleep 5

# 3. Kiem tra peer co chay khong
PEER_STATUS=$(docker ps --filter "name=peer0.org1.example.com" --filter "status=running" -q)
if [ -z "$PEER_STATUS" ]; then
  echo "Peer chua chay. Thu chay setup.sh lan dau."
  exit 1
fi

echo "Fabric network dang chay!"

# 4. Kiem tra wallet
cd ..
if [ ! -f "wallet/admin.json" ] || [ ! -f "wallet/admin-org2.json" ]; then
  echo ">>> Wallet chua co, tao lai..."
  node -e "
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs'), path = require('path');
const cwd = process.cwd();
async function enroll(ccpFile, caName, walletFile, mspId) {
  const ccp = JSON.parse(fs.readFileSync(path.resolve(cwd, ccpFile), 'utf8'));
  const org = mspId === 'Org1MSP' ? 'org1' : 'org2';
  const caCert = fs.readFileSync(path.resolve(cwd, 'blockchain-network/organizations/peerOrganizations/' + org + '.example.com/ca/ca.' + org + '.example.com-cert.pem'));
  const ca = new FabricCAServices(ccp.certificateAuthorities[caName].url, { trustedRoots: caCert, verify: false }, caName);
  const walletPath = path.join(cwd, 'wallet');
  if (!fs.existsSync(walletPath)) fs.mkdirSync(walletPath, { recursive: true });
  const adminPath = path.join(walletPath, walletFile);
  if (fs.existsSync(adminPath)) { console.log(walletFile + ' da ton tai'); return; }
  const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
  fs.writeFileSync(adminPath, JSON.stringify({ credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() }, mspId, type: 'X.509' }, null, 2));
  console.log('Da tao: ' + walletFile);
}
Promise.all([
  enroll('src/config/connection-org1.json', 'ca.org1.example.com', 'admin.json', 'Org1MSP'),
  enroll('src/config/connection-org2.json', 'ca.org2.example.com', 'admin-org2.json', 'Org2MSP'),
]).catch(console.error);
"
fi

echo ""
echo "=== KHOI DONG APP ==="
echo ">>> Chay: NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev"
echo ""
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev
