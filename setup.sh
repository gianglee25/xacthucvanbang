#!/bin/bash
set -e
echo "=== SETUP BLOCKCHAIN MULTI-ORG ==="

# 1. Cài dependencies
echo ">>> Cài npm dependencies..."
npm install

# 2. Lấy registerEnroll.sh nếu chưa có
if [ ! -f "blockchain-network/organizations/fabric-ca/registerEnroll.sh" ]; then
  echo ">>> Download registerEnroll.sh..."
  sudo chown -R $USER:$USER blockchain-network/organizations/ 2>/dev/null || true
  curl -s -o blockchain-network/organizations/fabric-ca/registerEnroll.sh \
    https://raw.githubusercontent.com/hyperledger/fabric-samples/main/test-network/organizations/fabric-ca/registerEnroll.sh
  chmod +x blockchain-network/organizations/fabric-ca/registerEnroll.sh
fi

# 3. Khởi động network + tạo channel
echo ">>> Khởi động Fabric network..."
cd blockchain-network
./network.sh down 2>/dev/null || true
./network.sh up createChannel -ca -c mychannel

# 4. Deploy chaincode với AND policy
echo ">>> Deploy chaincode với Endorsement Policy AND(Org1, Org2)..."
export PATH=$PATH:$(pwd)/../bin
export FABRIC_CFG_PATH=$(pwd)/config
export CORE_PEER_TLS_ENABLED=true

# Approve Org1
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$(pwd)/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

./network.sh deployCC -c mychannel -ccn educert -ccp ../chaincode -ccl typescript -ccv 1.0 -ccs 1

PACKAGE_ID=$(peer lifecycle chaincode queryinstalled --output json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['installed_chaincodes'][0]['package_id'])")

peer lifecycle chaincode approveformyorg \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $(pwd)/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem \
  --channelID mychannel --name educert --version 1.0 \
  --package-id $PACKAGE_ID --sequence 2 \
  --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')"

# Approve Org2
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$(pwd)/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051

peer lifecycle chaincode approveformyorg \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $(pwd)/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem \
  --channelID mychannel --name educert --version 1.0 \
  --package-id $PACKAGE_ID --sequence 2 \
  --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')"

# Commit
peer lifecycle chaincode commit \
  -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $(pwd)/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem \
  --channelID mychannel --name educert --version 1.0 --sequence 2 \
  --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')" \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles $(pwd)/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles $(pwd)/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt

echo ">>> Chaincode deployed với AND policy!"
cd ..

# 5. Enroll Admin Org1
echo ">>> Enroll Admin Org1..."
node -e "
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs'), path = require('path');
const cwd = '$(pwd)';
async function main() {
  const ccp = JSON.parse(fs.readFileSync(path.resolve(cwd, 'src/config/connection-org1.json'), 'utf8'));
  const caCert = fs.readFileSync(path.resolve(cwd, 'blockchain-network/organizations/peerOrganizations/org1.example.com/ca/ca.org1.example.com-cert.pem'));
  const ca = new FabricCAServices(ccp.certificateAuthorities['ca.org1.example.com'].url, { trustedRoots: caCert, verify: false }, 'ca-org1');
  const walletPath = path.join(cwd, 'wallet');
  if (!fs.existsSync(walletPath)) fs.mkdirSync(walletPath, { recursive: true });
  const adminPath = path.join(walletPath, 'admin.json');
  if (fs.existsSync(adminPath)) { console.log('Admin Org1 da ton tai'); return; }
  const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
  fs.writeFileSync(adminPath, JSON.stringify({ credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() }, mspId: 'Org1MSP', type: 'X.509' }, null, 2));
  console.log('Done: admin.json');
}
main().catch(console.error);
"

# 6. Enroll Admin Org2
echo ">>> Enroll Admin Org2..."
node -e "
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs'), path = require('path');
const cwd = '$(pwd)';
async function main() {
  const ccp = JSON.parse(fs.readFileSync(path.resolve(cwd, 'src/config/connection-org2.json'), 'utf8'));
  const caCert = fs.readFileSync(path.resolve(cwd, 'blockchain-network/organizations/peerOrganizations/org2.example.com/ca/ca.org2.example.com-cert.pem'));
  const ca = new FabricCAServices(ccp.certificateAuthorities['ca.org2.example.com'].url, { trustedRoots: caCert, verify: false }, 'ca-org2');
  const walletPath = path.join(cwd, 'wallet');
  if (!fs.existsSync(walletPath)) fs.mkdirSync(walletPath, { recursive: true });
  const adminPath = path.join(walletPath, 'admin-org2.json');
  if (fs.existsSync(adminPath)) { console.log('Admin Org2 da ton tai'); return; }
  const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
  fs.writeFileSync(adminPath, JSON.stringify({ credentials: { certificate: enrollment.certificate, privateKey: enrollment.key.toBytes() }, mspId: 'Org2MSP', type: 'X.509' }, null, 2));
  console.log('Done: admin-org2.json');
}
main().catch(console.error);
"

echo ""
echo "=== SETUP HOÀN TẤT ==="
echo "Chạy: NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev"
