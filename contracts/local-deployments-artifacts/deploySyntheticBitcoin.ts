import { ethers } from "ethers";
import {
  abi as SyntheticBitcoinAbi,
  bytecode as SyntheticBitcoinBytecode,
} from "./dynamic-artifacts/SyntheticBitcoin.json";
import { deployContractFromArtifacts } from "../common/helpers/deployments";
import { get1559Fees } from "../scripts/utils";

async function main() {
  const ORDERED_NONCE_POST_LINEAROLLUP = 4;
  const ORDERED_NONCE_POST_TOKENBRIDGE = 5;
  const ORDERED_NONCE_POST_L2MESSAGESERVICE = 3;

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  const syntheticBitcoinName = "SyntheticBitcoin";

  const { gasPrice } = await get1559Fees(provider);

  let walletNonce;

  if (process.env.SYNTHETIC_BITCOIN_L1 === "true") {
    if (!process.env.L1_NONCE) {
      walletNonce = await wallet.getNonce();
    } else {
      walletNonce = parseInt(process.env.L1_NONCE) + ORDERED_NONCE_POST_LINEAROLLUP + ORDERED_NONCE_POST_TOKENBRIDGE;
    }
  } else {
    if (!process.env.L2_NONCE) {
      walletNonce = await wallet.getNonce();
    } else {
      walletNonce =
        parseInt(process.env.L2_NONCE) + ORDERED_NONCE_POST_L2MESSAGESERVICE + ORDERED_NONCE_POST_TOKENBRIDGE;
    }
  }

  const syntheticBitcoin = await deployContractFromArtifacts(SyntheticBitcoinAbi, SyntheticBitcoinBytecode, wallet, {
    nonce: walletNonce,
    gasPrice,
  });

  const syntheticBitcoinAddress = await syntheticBitcoin.getAddress();
  const deployTx = syntheticBitcoin.deploymentTransaction();

  if (!deployTx) {
    throw "Deployment transaction not found.";
  }

  const chainId = (await provider.getNetwork()).chainId;

  console.log(`${syntheticBitcoinName} deployed: address=${syntheticBitcoinAddress} chainId=${chainId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
