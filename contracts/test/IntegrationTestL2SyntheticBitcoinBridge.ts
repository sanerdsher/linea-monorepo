import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployTokenBridgeWithMockMessaging } from "../scripts/tokenBridge/test/deployTokenBridges";
import { BridgedToken, L2SyntheticBitcoin } from "../typechain-types";

describe("L2SyntheticBitcoinBridgeIntegration", () => {
  async function deployContractsFixture() {
    const [owner, user] = await ethers.getSigners();
    const deploymentFixture = await deployTokenBridgeWithMockMessaging();
    const { l2TokenBridge } = deploymentFixture;
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

    const l2SyntheticBitcoinFactory = await ethers.getContractFactory("L2SyntheticBitcoin");
    const l2SyntheticBitcoinLogic = await l2SyntheticBitcoinFactory.deploy();

    await l2SyntheticBitcoinLogic.waitForDeployment();

    const l2SyntheticBitcoinLogicAddress = await l2SyntheticBitcoinLogic.getAddress();
    const l2SyntheticBitcoinInterface = l2SyntheticBitcoinFactory.interface;
    const proxyAdminFactory = await ethers.getContractFactory("ProxyAdmin");
    const proxyAdmin = await proxyAdminFactory.deploy();

    await proxyAdmin.waitForDeployment();

    const l2BridgeAddress = await l2TokenBridge.getAddress();
    const proxyFactory = await ethers.getContractFactory(
      "contracts/proxies/TransparentUpgradeableProxy.sol:TransparentUpgradeableProxy",
    );
    const l2SyntheticBitcoinProxy = await proxyFactory.deploy(
      l2SyntheticBitcoinLogicAddress,
      await proxyAdmin.getAddress(),
      l2SyntheticBitcoinInterface.encodeFunctionData(l2SyntheticBitcoinInterface.getFunction("initializeV3")!, [
        l2BridgeAddress,
      ]),
    );

    await l2SyntheticBitcoinProxy.waitForDeployment();

    const l2SyntheticBitcoinAddress = await l2SyntheticBitcoinProxy.getAddress();
    const l2SyntheticBitcoin = l2SyntheticBitcoinFactory.attach(l2SyntheticBitcoinAddress) as L2SyntheticBitcoin;
    const l2ConnectedSyntheticBitcoin = l2SyntheticBitcoin.connect(user);
    const l2TokensParams = {
      L2WBTC: {
        name: "L2 Wrapped Bitcoin",
        initialUserBalance: 1_50_000_000,
        coeff: {
          numerator: 98,
          denominator: 100,
        },
      },
      L2TBTC: {
        name: "L2 tBTC",
        initialUserBalance: 50_000_000,
        coeff: {
          numerator: 1,
          denominator: 1,
        },
      },
    };
    let l2Symbol: keyof typeof l2TokensParams;

    for (l2Symbol in l2TokensParams) {
      const { name, initialUserBalance, coeff } = l2TokensParams[l2Symbol];
      const token = await ERC20.deploy(name, l2Symbol);

      await token.waitForDeployment();
      await token.mint(user.address, initialUserBalance);

      const tokenAddress = await token.getAddress();

      await l2SyntheticBitcoin.allowOrChangeBaseToken(tokenAddress, coeff);

      await token.connect(user).approve(l2SyntheticBitcoinAddress, initialUserBalance);
      await l2ConnectedSyntheticBitcoin["depositAndMint(address,uint256)"](tokenAddress, initialUserBalance);
    }

    return { owner, user, ...deploymentFixture, proxyAdmin, syntheticBitcoin, l2SyntheticBitcoin };
  }

  it("Should bridge token", async () => {
    const fixture = await loadFixture(deployContractsFixture);
    const { user, l1TokenBridge, l2TokenBridge, syntheticBitcoin, chainIds } = fixture;
    const bridgeAddress = await l1TokenBridge.getAddress();

    await syntheticBitcoin.connect(user).approve(bridgeAddress, 3_94_000_000);

    const syntheticBitcoinAddress = await syntheticBitcoin.getAddress();

    {
      const { l2SyntheticBitcoin } = fixture;
      const l2SyntheticBitcoinAddress = await l2SyntheticBitcoin.getAddress();

      await l2TokenBridge.setCustomContract(syntheticBitcoinAddress, l2SyntheticBitcoinAddress);
    }

    await l1TokenBridge.connect(user).bridgeToken(syntheticBitcoinAddress, 3_94_000_000, user.address);

    const l2SyntheticBitcoinAddress = await l2TokenBridge.nativeToBridgedToken(chainIds[0], syntheticBitcoinAddress);
    const connectedL2TokenBridge = l2TokenBridge.connect(user);

    await connectedL2TokenBridge.confirmDeployment([l2SyntheticBitcoinAddress]);

    const bridgedTokenFactory = await ethers.getContractFactory("BridgedToken");
    const l2SyntheticBitcoin = bridgedTokenFactory.attach(l2SyntheticBitcoinAddress) as BridgedToken;

    expect(await syntheticBitcoin.balanceOf(user.address)).to.be.equal(0);
    expect(await syntheticBitcoin.balanceOf(bridgeAddress)).to.be.equal(3_94_000_000);
    expect(await l2SyntheticBitcoin.balanceOf(user.address)).to.be.equal(5_91_000_000);

    const l2BridgeAddress = await l2TokenBridge.getAddress();

    await l2SyntheticBitcoin.connect(user).approve(l2BridgeAddress, 3_94_000_000);
    await connectedL2TokenBridge.bridgeToken(l2SyntheticBitcoinAddress, 3_94_000_000, user.address);

    expect(await syntheticBitcoin.balanceOf(user.address)).to.be.equal(3_94_000_000);
    expect(await syntheticBitcoin.balanceOf(bridgeAddress)).to.be.equal(0);
    expect(await l2SyntheticBitcoin.balanceOf(user.address)).to.be.equal(1_97_000_000);
  });
});
