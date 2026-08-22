// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SWRBase} from "./SWRBase.t.sol";
import {SWRVault} from "../src/SWRVault.sol";

contract SWRVaultFuzzTest is SWRBase {
    // =====================================================================
    //                          Decimal normalisation
    // =====================================================================

    /// @dev The conversion pair is where a 6-decimal USD asset meets 18-decimal ETH. Any
    ///      hardcoded 1e18 anywhere in that path shows up here as a wildly wrong round trip.
    function testFuzz_EthUsdcConversionRoundTrip(uint256 weiAmount) public view {
        weiAmount = bound(weiAmount, 1e12, 10_000 ether);

        uint256 asUsdc = vault.ethToUsdc(weiAmount);
        uint256 backToWei = vault.usdcToEth(asUsdc);

        // USDC has 6 decimals, so one base unit is $0.000001, worth ~4e8 wei at $2,400/ETH.
        // The round trip can only lose that quantisation step, never a decimal-shift factor.
        assertApproxEqRel(backToWei, weiAmount, 0.001e18, "round trip must not shift decimals");
    }

    function testFuzz_ConversionIsMonotonic(uint256 a, uint256 b) public view {
        a = bound(a, 1e12, 1_000 ether);
        b = bound(b, 1e12, 1_000 ether);
        if (a > b) (a, b) = (b, a);

        assertLe(vault.ethToUsdc(a), vault.ethToUsdc(b), "more ETH is never less USD");
    }

    function testFuzz_ConversionTracksPrice(uint256 priceMultiplierBps) public {
        priceMultiplierBps = bound(priceMultiplierBps, 1_000, 100_000); // 0.1x .. 10x

        uint256 baseline = vault.ethToUsdc(1 ether);
        _setPrice((ETH_USD_PRICE * int256(priceMultiplierBps)) / 10_000);
        uint256 moved = vault.ethToUsdc(1 ether);

        assertApproxEqRel(moved, (baseline * priceMultiplierBps) / 10_000, 0.001e18, "price scales linearly");
    }

    // =====================================================================
    //                            Lifecycle round trip
    // =====================================================================

    /// @notice The product's central promise: whatever you put in, you get back.
    function testFuzz_DepositClaimReturnsFullPrincipal(uint256 amount, uint256 tenorIndex) public {
        _setSpread(0);
        amount = bound(amount, usd(1_000), usd(10_000_000));
        tenorIndex = bound(tenorIndex, 0, 2);

        uint256 balanceBefore = usdc.balanceOf(alice);
        uint256 posId = _deposit(alice, amount, tenorIndex);

        SWRVault.Position memory p = vault.getPosition(alice, posId);
        _warp(p.tenor);

        vm.prank(alice);
        vault.requestUnstake(posId);

        _warp(UNBONDING);
        vm.prank(alice);
        uint256 payout = vault.claim(posId);

        // 6-decimal USDC sheds at most a few base units of truncation dust across the round trip;
        // a genuine accounting bug loses a proportion, not a handful of units.
        assertApproxEqAbs(payout, amount, 10, "full principal returned within dust");
        assertApproxEqAbs(usdc.balanceOf(alice), balanceBefore, 10, "waqif made whole within dust");
        assertEq(vault.balanceOf(alice), 0, "receipts burned");
    }

    function testFuzz_ReceiptSupplyAlwaysEqualsPrincipal(uint256 a1, uint256 a2) public {
        _setSpread(0);
        a1 = bound(a1, usd(1_000), usd(5_000_000));
        a2 = bound(a2, usd(1_000), usd(5_000_000));

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
        amount = bound(amount, usd(100_000), usd(10_000_000));
        yieldBps = bound(yieldBps, 0, 20_000); // up to +200%

        _deposit(alice, amount, 2);
        if (yieldBps > 0) _accrueYield(yieldBps);

        vm.prank(keeper);
        try vault.harvest() returns (uint256, uint256) {
            assertGe(vault.totalNavUSDC(), vault.harvestFloor(), "floor holds after harvest");
            assertGe(vault.totalNavUSDC(), vault.workingPrincipal(), "principal still backed");
        } catch {
            // Reverting because there is no surplus is the correct outcome, not a failure.
            assertLe(vault.totalNavUSDC(), vault.harvestFloor() + vault.adapterCount() + 1);
        }
    }

    function testFuzz_BufferScalesWithPrincipal(uint256 amount, uint256 bufferBps) public {
        amount = bound(amount, usd(1_000), usd(10_000_000));
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

        _deposit(alice, usd(10_000_000), 2);
        _accrueYield(yieldBps);

        vm.prank(keeper);
        (uint256 toNazir, uint256 bounty) = vault.harvest();

        uint256 total = toNazir + bounty;
        assertLe(bounty, (total * bountyBps) / 10_000 + 1, "bounty capped at its configured share");
        assertEq(usdc.balanceOf(keeper), bounty);
    }

    // =====================================================================
    //                             Access / bounds
    // =====================================================================

    function testFuzz_RevertWhen_UnstakingBeforeMaturity(uint256 amount, uint256 elapsed) public {
        _setSpread(0);
        amount = bound(amount, usd(1_000), usd(1_000_000));
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

        uint256 posId = _deposit(alice, usd(1_000_000), 0);
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

        uint256 posId = _deposit(alice, usd(1_000_000), 0);
        _warp(TENOR_SHORT);

        // Positions are keyed by caller, so a stranger simply has no position at that index.
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(SWRVault.NoSuchPosition.selector, posId));
        vault.requestUnstake(posId);
    }
}
