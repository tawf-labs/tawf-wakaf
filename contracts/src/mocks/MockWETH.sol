// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TESTNET ONLY. Canonical WETH9 behaviour.
/// Sepolia already has a real WETH at 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 (verified),
/// which the deploy script prefers; this exists so unit tests need no fork.
contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") {}

    function deposit() public payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "ETH transfer failed");
    }

    receive() external payable {
        deposit();
    }
}
