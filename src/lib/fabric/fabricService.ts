import * as grpc from "@grpc/grpc-js";
import { connect, Identity, Signer, signers } from "@hyperledger/fabric-gateway";
import * as crypto from "crypto";
import * as fs from "fs";

const channelName = "mychannel";
const chaincodeName = "educert";
const BASE = process.cwd();

const ORG1 = {
  mspId: "Org1MSP",
  peerEndpoint: "localhost:7051",
  peerHostAlias: "peer0.org1.example.com",
  tlsCertPath: `${BASE}/blockchain-network/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem`,
  walletPath: `${BASE}/wallet/admin.json`,
};

const ORG2 = {
  mspId: "Org2MSP",
  peerEndpoint: "localhost:9051",
  peerHostAlias: "peer0.org2.example.com",
  tlsCertPath: `${BASE}/blockchain-network/organizations/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem`,
  walletPath: `${BASE}/wallet/admin-org2.json`,
};

async function newGrpcConnection(org: typeof ORG1): Promise<grpc.Client> {
  const tlsCert = fs.readFileSync(org.tlsCertPath);
  // Tạo credentials với cert gốc của Fabric CA
  const tlsCredentials = grpc.credentials.createSsl(
    tlsCert,
    null,
    null,
    { checkServerIdentity: () => undefined }
  );
  return new grpc.Client(org.peerEndpoint, tlsCredentials, {
    "grpc.ssl_target_name_override": org.peerHostAlias,
    "grpc.keepalive_time_ms": 600000,
    "grpc.keepalive_timeout_ms": 60000,
  });
}

function newIdentity(walletJson: any, mspId: string): Identity {
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
  if (!fs.existsSync(ORG1.walletPath)) {
    throw new Error(`Wallet Org1 không tìm thấy tại: ${ORG1.walletPath}`);
  }

  const walletOrg1 = JSON.parse(fs.readFileSync(ORG1.walletPath, "utf8"));
  const clientOrg1 = await newGrpcConnection(ORG1);

  const gateway = connect({
    client: clientOrg1,
    identity: newIdentity(walletOrg1, ORG1.mspId),
    signer: newSigner(walletOrg1),
    evaluateOptions: () => ({ deadline: Date.now() + 10000 }),
    endorseOptions: () => ({ deadline: Date.now() + 30000 }),
    submitOptions: () => ({ deadline: Date.now() + 30000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });

  let clientOrg2: grpc.Client | null = null;

  try {
    const network = gateway.getNetwork(channelName);
    const contract = network.getContract(chaincodeName);

    if (action === "submit") {
      if (!fs.existsSync(ORG2.walletPath)) {
        throw new Error(`Wallet Org2 không tìm thấy tại: ${ORG2.walletPath}`);
      }

      clientOrg2 = await newGrpcConnection(ORG2);

      const proposal = contract.newProposal(transactionName, {
        arguments: args,
        endorsingOrganizations: [ORG1.mspId, ORG2.mspId],
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
      return { txId, payload: resultText || "{}" };

    } else {
      const resultBytes = await contract.evaluateTransaction(transactionName, ...args);
      const resultText = new TextDecoder().decode(resultBytes);
      return { result: resultText ? JSON.parse(resultText) : null };
    }

  } finally {
    gateway.close();
    clientOrg1.close();
    if (clientOrg2) clientOrg2.close();
  }
}
