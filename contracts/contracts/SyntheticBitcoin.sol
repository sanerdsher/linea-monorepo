pragma solidity 0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

error UnknownBaseToken(address baseToken);

contract SyntheticBitcoin is ERC20, ERC20Permit, Ownable {
    using SafeERC20 for IERC20;

    string private constant _TOKEN_NAME = "SyntheticBitcoin";
    string private constant _TOKEN_SYMBOL = "SBTC";

    struct ConversionCoeff {
        uint64 numerator;
        uint64 denominator;
    }

    mapping(address => ConversionCoeff) private _baseTokens;

    constructor()
        ERC20(_TOKEN_NAME, _TOKEN_SYMBOL)
        ERC20Permit(_TOKEN_NAME) {}

    function decimals() public pure override returns (uint8) {
        return 8;
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

    function denyBaseToken(address baseToken) onlyOwner public {
        delete _baseTokens[baseToken];
    }

    function _depositAndMint(address baseToken, address from, address to, uint256 value) internal {
        ConversionCoeff memory coeff = _baseTokens[baseToken];

        if (coeff.denominator == 0) {
            revert UnknownBaseToken(baseToken);
        }

        uint256 valueToMint = value * coeff.numerator / coeff.denominator;

        IERC20(baseToken).safeTransferFrom(from, address(this), value);
        _mint(to, valueToMint);
    }

    function depositAndMint(address baseToken, address to, uint256 value) external {
        _depositAndMint(baseToken, _msgSender(), to, value);
    }

    function depositAndMint(address baseToken, uint256 value) public {
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
        IERC20(baseToken).safeTransfer(to, valueToWithdrawal);
    }

    function burnAndWithdrawal(address baseToken, address to, uint256 value) external {
        _burnAndWithdrawal(baseToken, _msgSender(), to, value);
    }

    function burnAndWithdrawal(address baseToken, uint256 value) external {
        address sender = _msgSender();

        _burnAndWithdrawal(baseToken, sender, sender, value);
    }
}
