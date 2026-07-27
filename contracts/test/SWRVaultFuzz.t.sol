// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SWRBase} from "./SWRBase.t.sol";
import {SWRVault} from "../src/SWRVault.sol";

contract SWRVaultFuzzTest is SWRBase {
    // =====================================================================
    //                          Decimal normalisation
    // =====================================================================

    /// @dev The conversion pair is where a 2-decimal rupiah asset meets 18-decimal ETH. Any
    ///      hardcoded 1e18 anywhere in that path shows up here as a wildly wrong round trip.
    function testFuzz_EthIdrxConversionRoundTrip(uint256 weiAmount) public view {
        weiAmount = bound(weiAmount, 1e12, 10_000 ether);

        uint256 asIdrx = vault.ethToIdrx(weiAmount);
        uint256 backToWei = vault.idrxToEth(asIdrx);

        // IDRX has 2 decimals, so one base unit is Rp 0.01 — worth ~3e8 wei at Rp 32M/ETH.
        // The round trip can only lose that quantisation step, never a decimal-shift factor.
        assertApproxEqRel(backToWei, weiAmount, 0.001e18, "round trip must not shift decimals");
    }

    function testFuzz_ConversionIsMonotonic(uint256 a, uint256 b) public view {
        a = bound(a, 1e12, 1_000 ether);
        b = bound(b, 1e12, 1_000 ether);
        if (a > b) (a, b) = (b, a);

        assertLe(vault.ethToIdrx(a), vault.ethToIdrx(b), "more ETH is never less rupiah");
    }

    function testFuzz_ConversionTracksPrice(uint256 priceMultiplierBps) public {
        priceMultiplierBps = bound(priceMultiplierBps, 1_000, 100_000); // 0.1x .. 10x

        uint256 baseline = vault.ethToIdrx(1 ether);
        _setPrice((ETH_IDRX_PRICE * int256(priceMultiplierBps)) / 10_000);
        uint256 moved = vault.ethToIdrx(1 ether);

        assertApproxEqRel(moved, (baseline * priceMultiplierBps) / 10_000, 0.001e18, "price scales linearly");
    }

    // =====================================================================
    //                            Lifecycle round trip
    // =====================================================================

    /// @notice The product's central promise: whatever you put in, you get back.
    function testFuzz_DepositClaimReturnsFullPrincipal(uint256 amount, uint256 tenorIndex) public {
        _setSpread(0);
        amount = bound(amount, idr(1_000), idr(10_000_000));
        tenorIndex = bound(tenorIndex, 0, 2);

        uint256 balanceBefore = idrx.balanceOf(alice);
        uint256 posId = _deposit(alice, amount, tenorIndex);

        SWRVault.Position memory p = vault.getPosition(alice, posId);
        _warp(p.tenor);

        vm.prank(alice);
        vault.requestUnstake(posId);

        _warp(UNBONDING);
        vm.prank(alice);
        uint256 payout = vault.claim(posId);

        assertEq(payout, amount, "full principal returned");
        assertEq(idrx.balanceOf(alice), balanceBefore, "wakif made whole");
        assertEq(vault.balanceOf(alice), 0, "receipts burned");
    }

    function testFuzz_ReceiptSupplyAlwaysEqualsPrincipal(uint256 a1, uint256 a2) public {
        _setSpread(0);
        a1 = bound(a1, idr(1_000), idr(5_000_000));
        a2 = bound(a2, idr(1_000), idr(5_000_000));

        _deposit(alice, a1, 0);
        assertEq(vault.totalSupply(), vault.totalPrincipal());

        _deposit(bob, a2, 1);
        assertEq(vault.totalSupply(), vault.totalPrincipal(), "1:1 holds across users");
        assertEq(vault.totalSupply(), a1 + a2);
    }

    // =====================================================================
    //                              Harvest math
    // =====================================================================

    /// @notice No matter how much yield arrives, a harvest may never dip the vault's backing
    ///         below principal plus the configured cushion.
    function testFuzz_HarvestNeverBreaksPrincipalBacking(uint256 amount, uint256 yieldBps) public {
        _setSpread(0);
        amount = bound(amount, idr(100_000), idr(10_000_000));
        yieldBps = bound(yieldBps, 0, 20_000); // up to +200%

        _deposit(alice, amount, 2);
        if (yieldBps > 0) _accrueYield(yieldBps);

        vm.prank(keeper);
        try vault.harvest() returns (uint256, uint256) {
            assertGe(vault.totalNavIDRX(), vault.harvestFloor(), "floor holds after harvest");
            assertGe(vault.totalNavIDRX(), vault.workingPrincipal(), "principal still backed");
        } catch {
            // Reverting because there is no surplus is the correct outcome, not a failure.
            assertLe(vault.totalNavIDRX(), vault.harvestFloor() + vault.adapterCount() + 1);
        }
    }

    function testFuzz_BufferScalesWithPrincipal(uint256 amount, uint256 bufferBps) public {
        amount = bound(amount, idr(1_000), idr(10_000_000));
        bufferBps = bound(bufferBps, 0, 5_000);

        vm.prank(owner);
        vault.setRiskParams(bufferBps, 50, 100, 3 hours);

        _setSpread(0);
        _deposit(alice, amount, 0);

        assertEq(vault.requiredBuffer(), (amount * bufferBps) / 10_000, "buffer is a clean fraction");
        assertEq(vault.harvestFloor(), amount + vault.requiredBuffer());
    }

    function testFuzz_BountyNeverExceedsConfiguredShare(uint256 yieldBps, uint256 bountyBps) public {
        _setSpread(0);
        yieldBps = bound(yieldBps, 2_000, 20_000);
        bountyBps = bound(bountyBps, 0, 1_000);

        vm.prank(owner);
        vault.setRiskParams(1_000, bountyBps, 100, 3 hours);

        _deposit(alice, idr(10_000_000), 2);
        _accrueYield(yieldBps);

        vm.prank(keeper);
        (uint256 toNadzir, uint256 bounty) = vault.harvest();

        uint256 total = toNadzir + bounty;
        assertLe(bounty, (total * bountyBps) / 10_000 + 1, "bounty capped at its configured share");
        assertEq(idrx.balanceOf(keeper), bounty);
    }

    // =====================================================================
    //                             Access / bounds
    // =====================================================================

    function testFuzz_RevertWhen_UnstakingBeforeMaturity(uint256 amount, uint256 elapsed) public {
        _setSpread(0);
        amount = bound(amount, idr(1_000), idr(1_000_000));
        elapsed = bound(elapsed, 0, TENOR_SHORT - 1);

        uint256 posId = _deposit(alice, amount, 0);
        _warp(elapsed);

        vm.prank(alice);
        vm.expectRevert();
        vault.requestUnstake(posId);
    }

    function testFuzz_RevertWhen_ClaimingBeforeUnbondingCompletes(uint256 elapsed) public {
        _setSpread(0);
        elapsed = bound(elapsed, 0, UNBONDING - 1);

        uint256 posId = _deposit(alice, idr(1_000_000), 0);
        _warp(TENOR_SHORT);
        vm.prank(alice);
        vault.requestUnstake(posId);

        _warp(elapsed);
        vm.prank(alice);
        vm.expectRevert();
        vault.claim(posId);
    }

    function testFuzz_OnlyPositionOwnerCanAct(address stranger) public {
        vm.assume(stranger != alice && stranger != address(0));
        _setSpread(0);

        uint256 posId = _deposit(alice, idr(1_000_000), 0);
        _warp(TENOR_SHORT);

        // Positions are keyed by caller, so a stranger simply has no position at that index.
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(SWRVault.NoSuchPosition.selector, posId));
        vault.requestUnstake(posId);
    }
}
