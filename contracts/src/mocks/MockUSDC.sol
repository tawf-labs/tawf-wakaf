// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TESTNET ONLY. Stand-in for a USD stablecoin (USDC-shaped), with an open faucet.
///
/// Decimals are a CONSTRUCTOR PARAMETER, seeded to 6 to match USDC. Pairing a 6-decimal asset with
/// 18-decimal ETH is a harsher exercise of the vault's normalisation math than another 18-decimal
/// token would be, and wrong-decimal handling is the single most common "where did my money go?"
/// bug.
///
/// On Arbitrum Sepolia the deploy script uses the REAL USDC (0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d)
/// instead of this mock. This contract exists for anvil, local dev, and the test suite.
///
/// NEVER deploy to mainnet.
contract MockUSDC is ERC20 {
    uint8 private immutable _decimals;

    /// @notice Faucet ceiling per call, in whole USDC.
    uint256 public constant FAUCET_AMOUNT_WHOLE = 10_000_000;

    event FaucetDrip(address indexed to, uint256 amount);

    constructor(uint8 decimals_) ERC20("Mock USDC", "USDC") {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /// @notice Open faucet, anyone and any time. It is play money on a testnet.
    function faucet() external {
        uint256 amount = FAUCET_AMOUNT_WHOLE * (10 ** _decimals);
        _mint(msg.sender, amount);
        emit FaucetDrip(msg.sender, amount);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
