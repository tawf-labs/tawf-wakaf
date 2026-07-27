// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAggregatorV3} from "../interfaces/IAggregatorV3.sol";

/// @notice TESTNET ONLY. Chainlink-shaped ETH/IDRX feed.
///
/// Sepolia has a live ETH/USD feed (0x694AA1769357215DE4FAC081bf1f309aDC325306, verified)
/// but no IDR feed anywhere, so the rupiah leg has to be supplied. On Sepolia this contract
/// is seeded from the real ETH/USD price times a USD/IDR rate.
///
/// That USD/IDR leg is an explicit trust assumption and is logged as such in the CROPS
/// record: whoever can set this price can move the vault's NAV, and therefore how much
/// yield is strippable. A production deployment needs a real feed or a multi-source median.
///
/// NEVER deploy to mainnet.
contract MockAggregator is IAggregatorV3 {
    uint8 public immutable decimals;
    string public description;

    int256 private _answer;
    uint256 private _updatedAt;
    uint80 private _roundId;

    address public owner;

    event AnswerUpdated(int256 answer, uint256 updatedAt);

    error NotOwner();
    error NonPositiveAnswer();

    constructor(uint8 decimals_, string memory description_, int256 initialAnswer) {
        decimals = decimals_;
        description = description_;
        owner = msg.sender;
        _set(initialAnswer);
    }

    function setAnswer(int256 answer) external {
        if (msg.sender != owner) revert NotOwner();
        _set(answer);
    }

    /// @notice TESTNET: let the feed go stale on purpose, to prove the vault's staleness
    ///         guard actually reverts rather than trusting a frozen price.
    function setUpdatedAt(uint256 ts) external {
        if (msg.sender != owner) revert NotOwner();
        _updatedAt = ts;
    }

    /// @notice TESTNET: refresh the timestamp without changing the price. Permissionless on
    ///         purpose — a real Chainlink feed is kept alive by its own node operators, and
    ///         without an equivalent the whole demo would freeze the first time this mock went
    ///         stale, with no way for a visitor to revive it.
    function poke() external {
        _updatedAt = block.timestamp;
        emit AnswerUpdated(_answer, block.timestamp);
    }

    function _set(int256 answer) private {
        if (answer <= 0) revert NonPositiveAnswer();
        _answer = answer;
        _updatedAt = block.timestamp;
        _roundId++;
        emit AnswerUpdated(answer, block.timestamp);
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (_roundId, _answer, _updatedAt, _updatedAt, _roundId);
    }
}
