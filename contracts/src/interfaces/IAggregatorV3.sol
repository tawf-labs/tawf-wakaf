// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Chainlink price feed shape.
/// Sepolia ETH/USD: 0x694AA1769357215DE4FAC081bf1f309aDC325306 (verified live, 8 decimals).
///
/// Callers MUST check `updatedAt` staleness and `answer > 0` — a feed that has stopped
/// reporting still returns its last value forever, which is how stale-oracle exploits work.
interface IAggregatorV3 {
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}
