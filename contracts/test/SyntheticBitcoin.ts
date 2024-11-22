import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { MockERC20MintBurn } from "../typechain-types";

describe("SyntheticBitcoinBridgeIntegration", () => {
  async function deployContractsFixture() {
    const [owner, user] = await ethers.getSigners();
    const syntheticBitcoinFactory = await ethers.getContractFactory("SyntheticBitcoin");
    const syntheticBitcoin = await syntheticBitcoinFactory.deploy();

    await syntheticBitcoin.waitForDeployment();

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
    const tokens: { [name: string]: MockERC20MintBurn } = {};
    let symbol: keyof typeof tokensParams;

    for (symbol in tokensParams) {
      const { name, initialUserBalance } = tokensParams[symbol];
      const token = await ERC20.deploy(name, symbol);

      await token.waitForDeployment();
      await token.mint(user.address, initialUserBalance);

      tokens[symbol] = token;
    }

    return { owner, user, syntheticBitcoin, tokensParams, tokens };
  }

  it("Should revert with UnknownBaseToken", async () => {
    const {
      owner,
      user,
      syntheticBitcoin,
      tokens: { WBTC: token },
    } = await loadFixture(deployContractsFixture);
    const tokenAddress = await token.getAddress();

    await expect(syntheticBitcoin.connect(user).getBaseToken(tokenAddress)).to.be.revertedWithCustomError(
      syntheticBitcoin,
      "UnknownBaseToken",
    );
    await expect(
      syntheticBitcoin.connect(user)["depositAndMint(address,uint256)"](tokenAddress, 1),
    ).to.be.revertedWithCustomError(syntheticBitcoin, "UnknownBaseToken");
    await expect(
      syntheticBitcoin.connect(user)["depositAndMint(address,address,uint256)"](tokenAddress, owner.address, 1),
    ).to.be.revertedWithCustomError(syntheticBitcoin, "UnknownBaseToken");
    await expect(
      syntheticBitcoin.connect(user)["burnAndWithdrawal(address,uint256)"](tokenAddress, 1),
    ).to.be.revertedWithCustomError(syntheticBitcoin, "UnknownBaseToken");
    await expect(
      syntheticBitcoin.connect(user)["burnAndWithdrawal(address,address,uint256)"](tokenAddress, owner.address, 1),
    ).to.be.revertedWithCustomError(syntheticBitcoin, "UnknownBaseToken");
  });

  it("Should allow/disallow base token", async () => {
    const {
      user,
      syntheticBitcoin,
      tokensParams: {
        WBTC: { coeff },
      },
      tokens: { WBTC: token },
    } = await loadFixture(deployContractsFixture);
    const tokenAddress = await token.getAddress();

    await syntheticBitcoin.allowOrChangeBaseToken(tokenAddress, coeff);
    expect(await syntheticBitcoin.connect(user).getBaseToken(tokenAddress)).to.deep.eq([BigInt(98), BigInt(100)]);
    await syntheticBitcoin.denyBaseToken(tokenAddress);
    await expect(syntheticBitcoin.connect(user).getBaseToken(tokenAddress)).to.be.revertedWithCustomError(
      syntheticBitcoin,
      "UnknownBaseToken",
    );
  });

  it("Should revert minting/burn synthetic tokens", async () => {
    const {
      user,
      syntheticBitcoin,
      tokensParams: {
        WBTC: { initialUserBalance, coeff },
      },
      tokens: { WBTC: token },
    } = await loadFixture(deployContractsFixture);
    const syntheticBitcoinAddress = await syntheticBitcoin.getAddress();
    const tokenAddress = await token.getAddress();

    await syntheticBitcoin.allowOrChangeBaseToken(tokenAddress, coeff);
    await token.connect(user).approve(syntheticBitcoinAddress, initialUserBalance);
    await expect(
      syntheticBitcoin.connect(user)["depositAndMint(address,uint256)"](tokenAddress, initialUserBalance + 1),
    ).to.be.revertedWith("ERC20: insufficient allowance");

    expect(await syntheticBitcoin.balanceOf(user.address)).to.be.equal(0);

    await expect(
      syntheticBitcoin.connect(user)["burnAndWithdrawal(address,uint256)"](tokenAddress, 1),
    ).to.be.revertedWith("ERC20: burn amount exceeds balance");

    expect(await syntheticBitcoin.balanceOf(user.address)).to.be.equal(0);
  });

  it("Should mint/burn synthetic tokens", async () => {
    const {
      user,
      syntheticBitcoin,
      tokensParams: {
        WBTC: { initialUserBalance, coeff },
      },
      tokens: { WBTC: token },
    } = await loadFixture(deployContractsFixture);
    const syntheticBitcoinAddress = await syntheticBitcoin.getAddress();
    const tokenAddress = await token.getAddress();

    await syntheticBitcoin.allowOrChangeBaseToken(tokenAddress, coeff);
    await token.connect(user).approve(syntheticBitcoinAddress, initialUserBalance);
    await syntheticBitcoin.connect(user)["depositAndMint(address,uint256)"](tokenAddress, initialUserBalance);

    expect(await syntheticBitcoin.balanceOf(user.address)).to.be.equal(2_94_000_000);

    await syntheticBitcoin.connect(user)["burnAndWithdrawal(address,uint256)"](tokenAddress, 2_94_000_000);

    expect(await syntheticBitcoin.balanceOf(user.address)).to.be.equal(0);
    expect(await token.balanceOf(user.address)).to.be.equal(3_00_000_000);
  });

  it("Should mint/burn synthetic tokens", async () => {
    const {
      owner,
      user,
      syntheticBitcoin,
      tokensParams: {
        WBTC: { initialUserBalance, coeff },
      },
      tokens: { WBTC: token },
    } = await loadFixture(deployContractsFixture);
    const syntheticBitcoinAddress = await syntheticBitcoin.getAddress();
    const tokenAddress = await token.getAddress();

    await syntheticBitcoin.allowOrChangeBaseToken(tokenAddress, coeff);
    await token.connect(user).approve(syntheticBitcoinAddress, initialUserBalance);
    await syntheticBitcoin
      .connect(user)
      ["depositAndMint(address,address,uint256)"](tokenAddress, owner.address, initialUserBalance);

    expect(await syntheticBitcoin.balanceOf(owner.address)).to.be.equal(2_94_000_000);

    await syntheticBitcoin["burnAndWithdrawal(address,address,uint256)"](tokenAddress, user.address, 2_94_000_000);

    expect(await syntheticBitcoin.balanceOf(owner.address)).to.be.equal(0);
    expect(await token.balanceOf(user.address)).to.be.equal(3_00_000_000);
  });
});
