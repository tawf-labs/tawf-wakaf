// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TESTNET ONLY. Stand-in for the IDRX rupiah stablecoin, with an open faucet.
///
/// Decimals are a CONSTRUCTOR PARAMETER, seeded to 2 on Sepolia. This is deliberate:
/// `security/SKILL.md` calls wrong-decimal handling the #1 "where did my money go?" bug,
/// and a 2-decimal asset paired with 18-decimal ETH is a far harsher test of the vault's
/// normalisation math than another 18-decimal token would be.
///
/// The real IDRX decimals MUST be verified against its live deployment before mainnet —
/// nothing in this repo should be taken as authority on that.
///
/// NEVER deploy to mainnet.
contract MockIDRX is ERC20 {
    uint8 private immutable _decimals;

    /// @notice Faucet ceiling per call, in whole IDRX.
    uint256 public constant FAUCET_AMOUNT_WHOLE = 10_000_000;

    event FaucetDrip(address indexed to, uint256 amount);

    constructor(uint8 decimals_) ERC20("Mock IDRX", "IDRX") {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Open faucet — anyone, any time. It is play money on a testnet.
    function faucet() external {
        uint256 amount = FAUCET_AMOUNT_WHOLE * (10 ** _decimals);
        _mint(msg.sender, amount);
        emit FaucetDrip(msg.sender, amount);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
