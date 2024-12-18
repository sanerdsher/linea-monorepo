pragma solidity 0.8.19;

import { IERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import { CustomBridgedToken } from "./tokenBridge/CustomBridgedToken.sol";

error UnknownBaseToken(address baseToken);

contract L2SyntheticBitcoin is CustomBridgedToken, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    string private constant _TOKEN_NAME = "SyntheticBitcoin";
    string private constant _TOKEN_SYMBOL = "SBTC";

    struct ConversionCoeff {
        uint64 numerator;
        uint64 denominator;
    }

    mapping(address => ConversionCoeff) private _baseTokens;

    function initializeV3(
        address _bridge
    ) public reinitializer(3) {
        __ERC20_init(_TOKEN_NAME, _TOKEN_SYMBOL);
        __ERC20Permit_init(_TOKEN_NAME);
        __Ownable_init();
        bridge = _bridge;
        _decimals = 8;
    }

    function getBaseToken(address baseToken) external view returns (ConversionCoeff memory) {
        ConversionCoeff memory coeff = _baseTokens[baseToken];

        if (coeff.numerator == 0) {
            revert UnknownBaseToken(baseToken);
        }

        return coeff;
    }

    function allowOrChangeBaseToken(address baseToken, ConversionCoeff memory coeff) onlyOwner external {
        require(coeff.numerator >= 1 && coeff.denominator >= 1);

        _baseTokens[baseToken] = coeff;
    }

    function denyBaseToken(address baseToken) onlyOwner external {
        delete _baseTokens[baseToken];
    }

    function _depositAndMint(address baseToken, address from, address to, uint256 value) internal {
        ConversionCoeff memory coeff = _baseTokens[baseToken];

        if (coeff.denominator == 0) {
            revert UnknownBaseToken(baseToken);
        }

        uint256 valueToMint = value * coeff.numerator / coeff.denominator;

        IERC20Upgradeable(baseToken).safeTransferFrom(from, address(this), value);
        _mint(to, valueToMint);
    }

    function depositAndMint(address baseToken, address to, uint256 value) external {
        _depositAndMint(baseToken, _msgSender(), to, value);
    }

    function depositAndMint(address baseToken, uint256 value) external {
        address sender = _msgSender();

        _depositAndMint(baseToken, sender, sender, value);
    }

    function _burnAndWithdrawal(address baseToken, address from, address to, uint256 value) internal {
        ConversionCoeff memory coeff = _baseTokens[baseToken];

        if (coeff.numerator == 0) {
            revert UnknownBaseToken(baseToken);
        }

        uint256 valueToWithdrawal = value * coeff.denominator / coeff.numerator;

        if (from != to) {
            _transfer(from, to, value);
        }

        _burn(to, value);
        IERC20Upgradeable(baseToken).safeTransfer(to, valueToWithdrawal);
    }

    function burnAndWithdrawal(address baseToken, address to, uint256 value) external {
        _burnAndWithdrawal(baseToken, _msgSender(), to, value);
    }

    function burnAndWithdrawal(address baseToken, uint256 value) external {
        address sender = _msgSender();

        _burnAndWithdrawal(baseToken, sender, sender, value);
    }
}
