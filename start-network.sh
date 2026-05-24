#!/bin/bash
cd ~/blockchain-diploma-app/blockchain-network
export PATH=$PATH:~/blockchain-diploma-app/blockchain-network/bin
export FABRIC_CFG_PATH=~/blockchain-diploma-app/blockchain-network/config

echo "Khởi động Fabric network..."
./network.sh up createChannel -c mychannel -ca -i 2.5.7
sleep 10
./network.sh deployCC -c mychannel -ccn diploma -ccp ../chaincode -ccl javascript -ccv 1.0 -ccs 1
echo "✅ Network sẵn sàng!"
