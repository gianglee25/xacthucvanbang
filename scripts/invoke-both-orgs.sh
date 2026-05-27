#!/bin/bash
cd "$(dirname "$0")/../blockchain-network"

export PATH=$PATH:$(pwd)/../bin
export FABRIC_CFG_PATH=$(pwd)/config
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$(pwd)/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

echo "Invoking with both Org1 + Org2 endorsement..."
peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls --cafile $(pwd)/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem \
  -C mychannel -n educert \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles $(pwd)/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles $(pwd)/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
  "$@"
