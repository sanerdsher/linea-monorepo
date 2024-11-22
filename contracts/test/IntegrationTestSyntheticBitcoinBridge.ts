import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployTokenBridgeWithMockMessaging } from "../scripts/tokenBridge/test/deployTokenBridges";
import { BridgedToken } from "../typechain-types";

describe("SyntheticBitcoinBridgeIntegration", () => {
  async function deployContractsFixture() {
    const [owner, user] = await ethers.getSigners();
    const deploymentFixture = await deployTokenBridgeWithMockMessaging();
    const syntheticBitcoinFactory = await ethers.getContractFactory("SyntheticBitcoin");
    const syntheticBitcoin = await syntheticBitcoinFactory.deploy();

    await syntheticBitcoin.waitForDeployment();

    const syntheticBitcoinAddress = await syntheticBitcoin.getAddress();
    const connectedSyntheticBitcoin = syntheticBitcoin.connect(user);
    const ERC20 = await ethers.getContractFactory("MockERC20MintBurn");
    const tokensParams = {
      WBTC: {
        name: "Wrapped Bitcoin",
        initialUserBalance: 3_00_000_000,
        coeff: {
          numerator: 98,
          denominator: 100,
        },
      },
      TBTC: {
        name: "tBTC",
        initialUserBalance: 1_00_000_000,
        coeff: {
          numerator: 1,
          denominator: 1,
        },
      },
    };
    let symbol: keyof typeof tokensParams;

    for (symbol in tokensParams) {
      const { name, initialUserBalance, coeff } = tokensParams[symbol];
      const token = await ERC20.deploy(name, symbol);

      await token.waitForDeployment();
      await token.mint(user.address, initialUserBalance);

      const tokenAddress = await token.getAddress();

      await syntheticBitcoin.allowOrChangeBaseToken(tokenAddress, coeff);

      await token.connect(user).approve(syntheticBitcoinAddress, initialUserBalance);
      await connectedSyntheticBitcoin["depositAndMint(address,uint256)"](tokenAddress, initialUserBalance);
    }

    return { owner, user, ...deploymentFixture, syntheticBitcoin };
  }

  it("Should bridge token", async () => {
    const { user, l1TokenBridge, l2TokenBridge, syntheticBitcoin, chainIds } =
      await loadFixture(deployContractsFixture);
    const bridgeAddress = await l1TokenBridge.getAddress();

    await syntheticBitcoin.connect(user).approve(bridgeAddress, 3_94_000_000);

    const syntheticBitcoinAddress = await syntheticBitcoin.getAddress();

    await l1TokenBridge.connect(user).bridgeToken(syntheticBitcoinAddress, 3_94_000_000, user.address);

    const l2SyntheticBitcoinAddress = await l2TokenBridge.nativeToBridgedToken(chainIds[0], syntheticBitcoinAddress);
    const connectedL2TokenBridge = l2TokenBridge.connect(user);

    await connectedL2TokenBridge.confirmDeployment([l2SyntheticBitcoinAddress]);

    const bridgedTokenFactory = await ethers.getContractFactory("BridgedToken");
    const l2SyntheticBitcoin = bridgedTokenFactory.attach(l2SyntheticBitcoinAddress) as BridgedToken;

    expect(await syntheticBitcoin.balanceOf(user.address)).to.be.equal(0);
    expect(await syntheticBitcoin.balanceOf(bridgeAddress)).to.be.equal(3_94_000_000);
    expect(await l2SyntheticBitcoin.balanceOf(user.address)).to.be.equal(3_94_000_000);

    const l2BridgeAddress = await l2TokenBridge.getAddress();

    await l2SyntheticBitcoin.connect(user).approve(l2BridgeAddress, 3_94_000_000);
    await connectedL2TokenBridge.bridgeToken(l2SyntheticBitcoinAddress, 3_94_000_000, user.address);

    expect(await syntheticBitcoin.balanceOf(user.address)).to.be.equal(3_94_000_000);
    expect(await syntheticBitcoin.balanceOf(bridgeAddress)).to.be.equal(0);
    expect(await l2SyntheticBitcoin.balanceOf(user.address)).to.be.equal(0);
  });
});
