import { ethers, network } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  tryVerifyContract,
  tryStoreAddress,
  validateDeployBranchAndTags,
  getDeployedContractAddress,
} from "../common/helpers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  validateDeployBranchAndTags(hre.network.name);

  const contractName = "SyntheticBitcoin";
  const existingContractAddress = await getDeployedContractAddress(contractName, deployments);

  if (!existingContractAddress) {
    console.log(`Deploying initial version, NB: the address will be saved if env SAVE_ADDRESS=true.`);
  } else {
    console.log(`Deploying new version, NB: ${existingContractAddress} will be overwritten if env SAVE_ADDRESS=true.`);
  }

  const SyntheticBitcoinFactory = await ethers.getContractFactory(contractName);
  const contract = await SyntheticBitcoinFactory.deploy();

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  process.env.SYNTHETIC_BITCOIN_TOKEN_ADDRESS = contractAddress;

  const deployTx = contract.deploymentTransaction();
  if (!deployTx) {
    throw "Deployment transaction not found.";
  }

  await tryStoreAddress(network.name, contractName, contractAddress, deployTx.hash);

  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log(`${contractName} deployed on ${network.name}, chainId=${chainId}, at address: ${contractAddress}`);

  await tryVerifyContract(contractAddress);
};

export default func;
func.tags = ["SyntheticBitcoin"];
