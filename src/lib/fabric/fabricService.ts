import * as grpc from "@grpc/grpc-js";
import {
  connect,
  Identity,
  Signer,
  signers,
} from "@hyperledger/fabric-gateway";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

// SỬA CÁC DÒNG NÀY TRONG FILE src/lib/fabric/fabricService.ts
const channelName = "channel-vb-tlu"; // Thay "mychannel"
const chaincodeName = "educert"; // Thay "diploma"
const mspId = "Org1MSP";
const peerEndpoint = "localhost:7051";
const peerHostAlias = "peer0.org1.example.com";
const tlsCertPath =
  "/home/giang/blockchain-diploma-app/blockchain-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt";
("/home/giang/blockchain-diploma-app/blockchain-network/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem");
const walletPath = path.resolve(process.cwd(), "wallet", "admin.json");

async function newGrpcConnection(): Promise<grpc.Client> {
  const tlsCert = fs.readFileSync(tlsCertPath);
  const tlsCredentials = grpc.credentials.createSsl(tlsCert);
  return new grpc.Client(peerEndpoint, tlsCredentials, {
    "grpc.ssl_target_name_override": peerHostAlias,
    "grpc.keepalive_time_ms": 600000,
    "grpc.keepalive_timeout_ms": 60000,
  });
}

function newIdentity(walletJson: any): Identity {
  return {
    mspId,
    credentials: Buffer.from(walletJson.credentials.certificate),
  };
}

function newSigner(walletJson: any): Signer {
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(walletJson.credentials.privateKey),
    format: "pem",
  });
  return signers.newPrivateKeySigner(privateKey);
}

export async function executeTransaction(
  action: "submit" | "evaluate",
  transactionName: string,
  ...args: string[]
): Promise<any> {
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet không tìm thấy tại: ${walletPath}`);
  }

  const walletJson = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  const client = await newGrpcConnection();
  const gateway = connect({
    client,
    identity: newIdentity(walletJson),
    signer: newSigner(walletJson),
    evaluateOptions: () => ({ deadline: Date.now() + 10000 }),
    endorseOptions: () => ({ deadline: Date.now() + 30000 }),
    submitOptions: () => ({ deadline: Date.now() + 30000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });

  try {
    const network = gateway.getNetwork(channelName);
    const contract = network.getContract(chaincodeName);

    if (action === "submit") {
      const proposal = contract.newProposal(transactionName, {
        arguments: args,
      });
      const transaction = await proposal.endorse();
      const txId = transaction.getTransactionId();
      const commit = await transaction.submit();
      const status = await commit.getStatus();

      if (!status.successful) {
        throw new Error(`Transaction ${txId} thất bại với mã: ${status.code}`);
      }

      const resultBytes = transaction.getResult();
      const resultText = new TextDecoder().decode(resultBytes);
      return {
        txId,
        payload: resultText || "{}",
      };
    } else {
      const resultBytes = await contract.evaluateTransaction(
        transactionName,
        ...args,
      );
      const resultText = new TextDecoder().decode(resultBytes);
      return { result: resultText ? JSON.parse(resultText) : null };
    }
  } finally {
    gateway.close();
    client.close();
  }
}
