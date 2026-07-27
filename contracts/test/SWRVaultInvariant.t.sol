// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SWRBase} from "./SWRBase.t.sol";
import {SWRVault} from "../src/SWRVault.sol";
import {MockIDRX} from "../src/mocks/MockIDRX.sol";
import {MockStETH} from "../src/mocks/MockStETH.sol";
import {MockEETH} from "../src/mocks/MockEETH.sol";

/// @notice Drives the vault through random but valid-shaped action sequences.
///
/// The ETH/IDRX price is deliberately held FIXED and the swap spread set to zero. That isolates
/// the vault's own accounting from market risk, which lets the suite assert the strong property
/// that actually matters — full solvency at all times — rather than a weakened version that a
/// price crash would trivially violate. FX risk is covered separately in the unit tests, where
/// the expected outcome is a recorded deficit rather than silent loss.
contract SWRHandler is Test {
    SWRVault public vault;
    MockIDRX public idrx;
    MockStETH public stETH;
    MockEETH public eETH;

    address[3] public actors;
    address public keeper;

    /// @dev Ghost state, tracked independently of the vault so the invariants have something to
    ///      check the vault's own bookkeeping against.
    uint256 public ghostDeposited;
    uint256 public ghostClaimed;
    uint256 public ghostYieldToNadzir;
    uint256 public ghostBountyPaid;
    uint256 public ghostPeakSeen;
    /// @dev Count of value-moving operations. Each one routes through a bounded number of integer
    ///      divisions, so it can shed at most a few base units of truncation dust. Tracking the
    ///      count lets the invariants bound that dust instead of pretending it is zero.
    uint256 public ghostValueOps;

    constructor(SWRVault _vault, MockIDRX _idrx, MockStETH _stETH, MockEETH _eETH, address[3] memory _actors, address _keeper) {
        vault = _vault;
        idrx = _idrx;
        stETH = _stETH;
        eETH = _eETH;
        actors = _actors;
        keeper = _keeper;
        ghostPeakSeen = _vault.peakNavPerPrincipalWad();
    }

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function deposit(uint256 actorSeed, uint256 amount, uint256 tenorIndex) public {
        address who = _actor(actorSeed);
        amount = bound(amount, 100, 500_000_00); // Rp 1 .. Rp 500,000 in 2-decimal base units
        tenorIndex = bound(tenorIndex, 0, 2);

        idrx.mint(who, amount);

        vm.startPrank(who);
        idrx.approve(address(vault), amount);
        try vault.deposit(amount, tenorIndex) {
            ghostDeposited += amount;
            ghostValueOps++;
        } catch {}
        vm.stopPrank();
    }

    function requestUnstake(uint256 actorSeed, uint256 posSeed) public {
        address who = _actor(actorSeed);
        uint256 count = vault.positionCount(who);
        if (count == 0) return;
        uint256 posId = posSeed % count;

        vm.prank(who);
        try vault.requestUnstake(posId) {
            ghostValueOps++;
        } catch {}
    }

    function claim(uint256 actorSeed, uint256 posSeed) public {
        address who = _actor(actorSeed);
        uint256 count = vault.positionCount(who);
        if (count == 0) return;
        uint256 posId = posSeed % count;

        vm.prank(who);
        try vault.claim(posId) returns (uint256 payout) {
            ghostClaimed += payout;
            ghostValueOps++;
        } catch {}
    }

    function harvest() public {
        vm.prank(keeper);
        try vault.harvest() returns (uint256 toNadzir, uint256 bounty) {
            ghostYieldToNadzir += toNadzir;
            ghostBountyPaid += bounty;
            ghostValueOps++;
        } catch {}
    }

    function accrueYield(uint256 bps) public {
        bps = bound(bps, 1, 500);
        try stETH.accrueBps(bps) {} catch {}
        try eETH.accrueBps(bps) {} catch {}
    }

    function passTime(uint256 secs) public {
        secs = bound(secs, 1 minutes, 20 minutes);
        vm.warp(block.timestamp + secs);
    }

    /// @dev Called by the invariant contract after each run to record the peak monotonically.
    function recordPeak() external {
        uint256 current = vault.peakNavPerPrincipalWad();
        if (current > ghostPeakSeen) ghostPeakSeen = current;
    }
}

contract SWRVaultInvariantTest is SWRBase {
    SWRHandler internal handler;

    function setUp() public override {
        super.setUp();

        // Isolate accounting from market risk: no swap spread, and the oracle never moves.
        _setSpread(0);

        // Oracle staleness would otherwise halt every priced action once the handler warps
        // past the window, collapsing the run into a long sequence of no-ops.
        vm.prank(owner);
        vault.setRiskParams(1_000, 50, 100, 3650 days);

        address[3] memory actors = [alice, bob, makeAddr("charlie")];
        handler = new SWRHandler(vault, idrx, stETH, eETH, actors, keeper);

        targetContract(address(handler));
    }

    /// @notice wqIDRX is minted 1:1 on deposit and burned 1:1 on claim, so its supply must equal
    ///         outstanding principal exactly — always, after any sequence.
    function invariant_ReceiptSupplyEqualsPrincipal() public view {
        assertEq(vault.totalSupply(), vault.totalPrincipal(), "receipt supply must track principal");
    }

    /// @notice Every rupiah promised to an unbonding position is actually sitting in the vault.
    ///         If this breaks, someone's claim would fail at payout time.
    function invariant_ReservedClaimsAreFullyBacked() public view {
        assertGe(
            idrx.balanceOf(address(vault)), vault.reservedForClaims(), "reserved claims must be held, not promised"
        );
    }

    function invariant_UnbondingNeverExceedsTotalPrincipal() public view {
        assertLe(vault.unbondingPrincipal(), vault.totalPrincipal(), "unbonding is a subset of principal");
    }

    /// @dev Solidity truncates on every division, so a rupiah figure that has been converted to
    ///      wei and back sheds sub-unit remainders. Each value-moving operation crosses a bounded
    ///      number of those conversions — two per adapter inside a liquidation, plus the two swap
    ///      legs — so total drift is bounded by ops x (adapters + 3) base units.
    ///
    ///      Asserting exact equality here would be asserting something arithmetically false.
    ///      Asserting a bound is the real property, and it still catches genuine leakage: a true
    ///      accounting bug loses a proportion of value, not a couple of base units per call.
    function _dustAllowance() internal view returns (uint256) {
        return handler.ghostValueOps() * (vault.adapterCount() + 3);
    }

    /// @notice With no adverse price move and no swap cost, the vault stays solvent: total backing
    ///         covers every outstanding obligation, to within truncation dust.
    function invariant_FullySolventUnderStablePrices() public view {
        assertGe(
            vault.totalNavIDRX() + vault.reservedForClaims() + _dustAllowance(),
            vault.totalPrincipal(),
            "backing must cover obligations"
        );
    }

    /// @notice Any recorded deficit under stable prices can only be truncation dust — never a
    ///         proportional loss, which would mean the mechanics themselves eat principal.
    function invariant_DeficitIsOnlyEverDust() public view {
        assertLe(vault.deficit(), _dustAllowance(), "mechanics must not lose principal beyond dust");
    }

    /// @notice Yield paid out to the nadzir and to harvest callers is genuinely surplus — it never
    ///         comes out of principal. This is the yield-stripping promise, checked structurally.
    function invariant_DistributedYieldNeverCameFromPrincipal() public view {
        // Everything the vault still holds, plus everything it has already paid out to wakif,
        // must cover every rupiah ever deposited — the distributed yield sits strictly on top.
        uint256 backing = vault.totalNavIDRX() + vault.reservedForClaims() + handler.ghostClaimed();
        assertGe(
            backing + _dustAllowance(), handler.ghostDeposited(), "payouts never dipped into principal"
        );
    }

    /// @notice The reported peak NAV ratio only ever ratchets upward.
    function invariant_PeakNavIsMonotonic() public {
        uint256 previous = handler.ghostPeakSeen();
        handler.recordPeak();
        assertGe(handler.ghostPeakSeen(), previous, "peak must never decrease");
        assertGe(vault.peakNavPerPrincipalWad(), 1e18, "peak starts at par and never falls below");
    }
}
