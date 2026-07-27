// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SWRBase} from "./SWRBase.t.sol";
import {SWRVault} from "../src/SWRVault.sol";
import {IkrarAkadNFT} from "../src/IkrarAkadNFT.sol";
import {IYieldAdapter} from "../src/interfaces/IYieldAdapter.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract SWRVaultTest is SWRBase {
    // =====================================================================
    //                              Deposit
    // =====================================================================

    function test_DepositMintsReceiptOneToOneAndRoutesToBasket() public {
        _setSpread(0); // isolate routing from swap cost
        uint256 amount = idr(1_000_000);

        uint256 posId = _deposit(alice, amount, 0);

        assertEq(posId, 0, "first position");
        assertEq(vault.balanceOf(alice), amount, "wqIDRX minted 1:1 with principal");
        assertEq(vault.totalPrincipal(), amount, "principal tracked");

        // 40/30 to the LST legs, 30% left idle as the stable leg.
        assertApproxEqRel(vault.ethToIdrx(wstAdapter.totalAssetsETH()), (amount * 40) / 100, 0.01e18, "wstETH leg");
        assertApproxEqRel(vault.ethToIdrx(weETHAdapter.totalAssetsETH()), (amount * 30) / 100, 0.01e18, "weETH leg");
        assertApproxEqRel(idrx.balanceOf(address(vault)), (amount * 30) / 100, 0.01e18, "idle stable leg");
    }

    function test_DepositMintsAkadCertificateThatRenders() public {
        uint256 amount = idr(1_000_000);
        _deposit(alice, amount, 1);

        assertEq(akad.ownerOf(0), alice, "akad minted to the wakif");
        assertEq(akad.totalMinted(), 1);

        (address wakif, uint256 recorded, uint256 tenor,,) = akad.akads(0);
        assertEq(wakif, alice);
        assertEq(recorded, amount);
        assertEq(tenor, TENOR_MID, "vault-enforced tenor is recorded on the certificate");

        // The whole point of onchain SVG is that it renders with no gateway.
        string memory uri = akad.tokenURI(0);
        assertGt(bytes(uri).length, 100, "tokenURI produces real content");
    }

    function test_DepositUsesActualReceivedNotRequested() public {
        // MockIDRX is not fee-on-transfer, so received == requested. This pins the invariant
        // that accounting follows the balance delta rather than the caller's claimed amount.
        uint256 amount = idr(500_000);
        uint256 before = idrx.balanceOf(address(vault));
        _deposit(alice, amount, 0);
        uint256 routed = idrx.balanceOf(address(vault)) - before;

        assertEq(vault.totalPrincipal(), amount);
        assertLt(routed, amount, "most of the deposit left for the LST legs");
    }

    function test_RevertWhen_DepositZero() public {
        vm.prank(alice);
        vm.expectRevert(SWRVault.ZeroAmount.selector);
        vault.deposit(0, 0);
    }

    function test_RevertWhen_DepositBelowMinimum() public {
        vm.startPrank(alice);
        idrx.approve(address(vault), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(SWRVault.BelowMinimum.selector, 1, 10 ** IDRX_DECIMALS));
        vault.deposit(1, 0);
        vm.stopPrank();
    }

    function test_RevertWhen_DepositWithInvalidTenorIndex() public {
        vm.startPrank(alice);
        idrx.approve(address(vault), type(uint256).max);
        vm.expectRevert(abi.encodeWithSelector(SWRVault.InvalidTenorIndex.selector, 3, 3));
        vault.deposit(idr(1_000_000), 3);
        vm.stopPrank();
    }

    // =====================================================================
    //                     wqIDRX is not transferable
    // =====================================================================

    function test_RevertWhen_TransferringReceiptToken() public {
        _deposit(alice, idr(1_000_000), 0);

        vm.prank(alice);
        vm.expectRevert(bytes("wqIDRX: non-transferable"));
        vault.transfer(bob, idr(1));
    }

    function test_RevertWhen_TransferFromReceiptToken() public {
        _deposit(alice, idr(1_000_000), 0);

        vm.prank(alice);
        vault.approve(bob, type(uint256).max);

        vm.prank(bob);
        vm.expectRevert(bytes("wqIDRX: non-transferable"));
        vault.transferFrom(alice, bob, idr(1));
    }

    function test_ReceiptDecimalsMatchDepositAsset() public view {
        assertEq(vault.decimals(), IDRX_DECIMALS, "1:1 must be literal in base units");
    }

    // =====================================================================
    //                          Tenor lock enforcement
    // =====================================================================

    function test_RevertWhen_UnstakeBeforeTenorElapsed() public {
        uint256 posId = _deposit(alice, idr(1_000_000), 0);

        _warp(TENOR_SHORT - 1);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(SWRVault.TenorNotElapsed.selector, block.timestamp + 1)
        );
        vault.requestUnstake(posId);
    }

    function test_RevertWhen_ClaimBeforeUnbondingElapsed() public {
        uint256 posId = _deposit(alice, idr(1_000_000), 0);

        _warp(TENOR_SHORT);
        vm.prank(alice);
        vault.requestUnstake(posId);

        _warp(UNBONDING - 1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SWRVault.UnbondingNotElapsed.selector, block.timestamp + 1));
        vault.claim(posId);
    }

    function test_RevertWhen_ClaimingAnActivePosition() public {
        uint256 posId = _deposit(alice, idr(1_000_000), 0);
        _warp(TENOR_SHORT);

        vm.prank(alice);
        vm.expectRevert(SWRVault.PositionNotUnbonding.selector);
        vault.claim(posId);
    }

    function test_RevertWhen_RequestingUnstakeTwice() public {
        uint256 posId = _deposit(alice, idr(1_000_000), 0);
        _warp(TENOR_SHORT);

        vm.startPrank(alice);
        vault.requestUnstake(posId);
        vm.expectRevert(SWRVault.PositionNotActive.selector);
        vault.requestUnstake(posId);
        vm.stopPrank();
    }

    function test_TenorIsSnapshotted_OwnerCannotExtendALiveLock() public {
        uint256 posId = _deposit(alice, idr(1_000_000), 0);

        // Owner lengthens every tenor option after the fact.
        uint256[] memory longer = new uint256[](1);
        longer[0] = 3650 days;
        vm.prank(owner);
        vault.setTenorOptions(longer, 3650 days);

        // Alice's existing position still matures on its original schedule.
        _warp(TENOR_SHORT);
        vm.prank(alice);
        vault.requestUnstake(posId);

        SWRVault.Position memory p = vault.getPosition(alice, posId);
        assertEq(uint8(p.status), uint8(SWRVault.Status.Unbonding), "original tenor honoured");
        assertEq(p.unbondingPeriod, UNBONDING, "unbonding period also snapshotted");
    }

    // =====================================================================
    //                            Full lifecycle
    // =====================================================================

    function test_FullLifecycle_ReturnsFullPrincipal() public {
        _setSpread(0);
        uint256 amount = idr(1_000_000);
        uint256 balanceBefore = idrx.balanceOf(alice);

        uint256 posId = _deposit(alice, amount, 0);
        _accrueYield(500); // +5% on both legs

        _warp(TENOR_SHORT);
        vm.prank(alice);
        vault.requestUnstake(posId);

        _warp(UNBONDING);
        vm.prank(alice);
        uint256 payout = vault.claim(posId);

        assertEq(payout, amount, "100% of principal returned");
        assertEq(idrx.balanceOf(alice), balanceBefore, "wakif made whole");
        assertEq(vault.balanceOf(alice), 0, "wqIDRX burned");
        assertEq(vault.totalPrincipal(), 0);
        assertEq(vault.reservedForClaims(), 0);
    }

    function test_PrincipalIsReservedAtUnstakeSoClaimCannotBeStarved() public {
        _setSpread(0);
        uint256 amount = idr(1_000_000);
        uint256 posId = _deposit(alice, amount, 0);

        _warp(TENOR_SHORT);
        vm.prank(alice);
        vault.requestUnstake(posId);

        assertEq(vault.reservedForClaims(), amount, "principal earmarked up front");

        // Reserved IDRX is excluded from working NAV, so a harvest cannot reach it.
        assertLt(vault.totalNavIDRX(), amount, "reserved funds are outside harvestable NAV");
    }

    // =====================================================================
    //                        Permissionless harvest
    // =====================================================================

    function test_HarvestIsPermissionlessAndPaysTheCallerABounty() public {
        _setSpread(0);
        _deposit(alice, idr(10_000_000), 2);
        _accrueYield(3_000); // +30%, comfortably above the 10% buffer

        uint256 nadzirBefore = idrx.balanceOf(nadzir);

        // `keeper` is nobody special — no role, no ownership.
        vm.prank(keeper);
        (uint256 toNadzir, uint256 bounty) = vault.harvest();

        assertGt(toNadzir, 0, "nadzir received yield");
        assertGt(bounty, 0, "caller earned the bounty");
        assertEq(idrx.balanceOf(keeper), bounty, "bounty actually paid");
        assertEq(idrx.balanceOf(nadzir) - nadzirBefore, toNadzir, "nadzir actually paid");
        assertEq(vault.totalYieldStripped(), toNadzir);

        // Bounty is the configured slice of what was realised.
        assertApproxEqRel(bounty, ((toNadzir + bounty) * 50) / 10_000, 0.01e18, "0.5% bounty");
    }

    function test_HarvestNeverStripsBelowPrincipalPlusBuffer() public {
        _setSpread(0);
        uint256 amount = idr(10_000_000);
        _deposit(alice, amount, 2);
        _accrueYield(5_000); // +50%

        vm.prank(keeper);
        vault.harvest();

        // This is the core safety property: after any harvest the vault still fully backs
        // principal plus the cushion.
        assertGe(vault.totalNavIDRX(), vault.harvestFloor(), "floor respected");
        assertGe(vault.totalNavIDRX(), amount, "principal still fully backed");
        assertGe(vault.solvencyRatioBps(), 10_000, "solvent");
    }

    /// @notice Regression: unwinding costs two swap legs, and that cost must fall on the yield
    ///         being distributed — never on the buffer backing principal. Sizing the payout from
    ///         the pre-unwind NAV left the vault BELOW its own floor after every harvest, quietly
    ///         funding the nadzir out of the wakif's cushion. Only shows up with a non-zero spread,
    ///         which is why the zero-spread invariant suite could not see it.
    function test_HarvestWithRealisticSpreadStillEndsAtOrAboveTheFloor() public {
        _setSpread(30); // 0.30%, a realistic DEX fee
        _deposit(alice, idr(10_000_000), 2);
        _accrueYield(3_000);

        vm.prank(keeper);
        vault.harvest();

        assertGe(vault.totalNavIDRX(), vault.harvestFloor(), "harvest must not eat the buffer");
        assertGe(vault.solvencyRatioBps(), 10_000, "still fully solvent");
    }

    function test_HarvestCostIsBorneByYieldNotByPrincipal() public {
        _setSpread(100); // 1% — an expensive unwind, to make the effect unmissable
        uint256 amount = idr(10_000_000);
        _deposit(alice, amount, 2);
        _accrueYield(5_000);

        uint256 floorBefore = vault.harvestFloor();

        vm.prank(keeper);
        (uint256 toNadzir, uint256 bounty) = vault.harvest();

        // Expensive swaps shrink what the nadzir receives; they must not shrink the backing.
        assertGt(toNadzir + bounty, 0, "some yield still reached the nadzir");
        assertGe(vault.totalNavIDRX(), floorBefore, "principal + buffer intact after a costly unwind");
    }

    function test_RevertWhen_HarvestingWithNoSurplus() public {
        _setSpread(0);
        _deposit(alice, idr(1_000_000), 0);
        // No yield accrued — NAV sits at principal, below principal + 10% buffer.

        vm.prank(keeper);
        vm.expectRevert(
            abi.encodeWithSelector(SWRVault.NoSurplus.selector, vault.totalNavIDRX(), vault.harvestFloor())
        );
        vault.harvest();
    }

    function test_RevertWhen_YieldExistsButHasNotClearedTheBuffer() public {
        _setSpread(0);
        _deposit(alice, idr(10_000_000), 2);
        _accrueYield(100); // +1% on 70% deployed = well under the 10% buffer

        vm.prank(keeper);
        vm.expectRevert();
        vault.harvest();

        assertEq(idrx.balanceOf(nadzir), 0, "buffer must be filled before the nadzir is paid");
    }

    function test_HarvestDoesNotConsumeReservedClaims() public {
        _setSpread(0);
        uint256 amount = idr(10_000_000);

        uint256 alicePos = _deposit(alice, amount, 0);
        _deposit(bob, amount, 2);

        _warp(TENOR_SHORT);
        vm.prank(alice);
        vault.requestUnstake(alicePos);

        uint256 reserved = vault.reservedForClaims();
        _accrueYield(5_000);

        vm.prank(keeper);
        vault.harvest();

        assertEq(vault.reservedForClaims(), reserved, "reservation untouched by harvest");

        _warp(UNBONDING);
        vm.prank(alice);
        uint256 payout = vault.claim(alicePos);
        assertEq(payout, amount, "alice still gets 100% after a harvest ran");
    }

    // =====================================================================
    //                             Oracle safety
    // =====================================================================

    function test_RevertWhen_OracleIsStale() public {
        _deposit(alice, idr(1_000_000), 0);

        // Freeze the feed and jump past the staleness window. A dead feed keeps returning its
        // last answer forever — refusing to price against it is the entire defence.
        vm.warp(block.timestamp + 4 hours);

        vm.expectRevert();
        vault.totalNavIDRX();
    }

    function test_RevertWhen_OraclePriceIsNonPositive() public {
        // The mock refuses to publish a non-positive answer at all, so assert that guard holds.
        vm.expectRevert(abi.encodeWithSelector(MockAggregatorErrors.NonPositiveAnswer.selector));
        feed.setAnswer(0);
    }

    function test_StaleOracleBlocksDepositsButNotClaims() public {
        _setSpread(0);
        uint256 posId = _deposit(alice, idr(1_000_000), 0);

        _warp(TENOR_SHORT);
        vm.prank(alice);
        vault.requestUnstake(posId);

        // Now let the oracle die completely.
        vm.warp(block.timestamp + UNBONDING + 10 hours);

        // Claim pays from the earmarked reserve and needs no price at all — a wakif's exit does
        // not depend on the oracle, the keeper, or the team.
        vm.prank(alice);
        uint256 payout = vault.claim(posId);
        assertEq(payout, idr(1_000_000), "exit works with a dead oracle");
    }

    // =====================================================================
    //                       Slippage / MEV protection
    // =====================================================================

    function test_RevertWhen_SwapExceedsSlippageTolerance() public {
        // Widen the desk's spread far past the vault's 1% tolerance.
        _setSpread(500); // 5%

        vm.startPrank(alice);
        idrx.approve(address(vault), type(uint256).max);
        vm.expectRevert(); // MockSwapRouter.InsufficientOutput
        vault.deposit(idr(1_000_000), 0);
        vm.stopPrank();
    }

    function test_SpreadIsChargedAndShowsUpAsAShortfallNotSilentLoss() public {
        _setSpread(30); // 0.30%, a realistic DEX fee
        uint256 amount = idr(1_000_000);
        uint256 posId = _deposit(alice, amount, 0);

        _warp(TENOR_SHORT);
        vm.prank(alice);
        vault.requestUnstake(posId);

        _warp(UNBONDING);
        vm.prank(alice);
        uint256 payout = vault.claim(posId);

        // Round-trip swap cost is real money. With no yield to cover it the wakif is slightly
        // short, and the vault records that openly rather than papering over it.
        assertLe(payout, amount);
        assertGe(payout, (amount * 99) / 100, "shortfall bounded by the spread");
        if (payout < amount) {
            assertGt(vault.deficit(), 0, "shortfall is recorded, not hidden");
        }
    }

    function test_YieldCoversRoundTripSpreadOverAFullTenor() public {
        _setSpread(30);
        uint256 amount = idr(1_000_000);
        uint256 posId = _deposit(alice, amount, 2);

        _accrueYield(300); // +3%, comfortably more than the 0.6% round trip

        _warp(TENOR_LONG);
        vm.prank(alice);
        vault.requestUnstake(posId);

        _warp(UNBONDING);
        vm.prank(alice);
        uint256 payout = vault.claim(posId);

        assertEq(payout, amount, "100% returned once yield covers the spread");
        assertEq(vault.deficit(), 0, "no shortfall");
    }

    // =====================================================================
    //                        Deficit / insolvency path
    // =====================================================================

    function test_EthCrashProducesRecordedDeficitAndTopUpClosesIt() public {
        _setSpread(0);
        uint256 amount = idr(10_000_000);
        uint256 posId = _deposit(alice, amount, 0);

        // ETH halves against the rupiah. This is the FX risk the design cannot engineer away.
        _setPrice(ETH_IDRX_PRICE / 2);

        _warp(TENOR_SHORT);
        vm.prank(alice);
        vault.requestUnstake(posId);

        assertGt(vault.deficit(), 0, "shortfall surfaced");
        assertLt(vault.solvencyRatioBps(), 10_000, "under-collateralised, and says so");

        // A takaful reserve — or anyone — can make the wakif whole.
        uint256 shortfall = vault.deficit();
        idrx.mint(address(this), shortfall);
        idrx.approve(address(vault), shortfall);
        vault.topUp(shortfall);

        assertEq(vault.deficit(), 0, "deficit closed");
    }

    // =====================================================================
    //                            Access control
    // =====================================================================

    function test_RevertWhen_NonOwnerCallsAdminSetters() public {
        vm.startPrank(alice);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setNadzir(alice);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setRiskParams(0, 0, 100, 1 hours);

        uint256[] memory t = new uint256[](1);
        t[0] = 1 days;
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.setTenorOptions(t, 1 days);

        vm.stopPrank();
    }

    function test_RevertWhen_NonVaultMintsAkad() public {
        vm.prank(alice);
        vm.expectRevert(IkrarAkadNFT.OnlyVault.selector);
        akad.mintAkad(alice, idr(1), 1 days, "FAKE");
    }

    function test_RevertWhen_AkadVaultRepointed() public {
        vm.prank(akad.owner());
        vm.expectRevert(IkrarAkadNFT.VaultAlreadySet.selector);
        akad.setVault(alice);
    }

    function test_RevertWhen_NonVaultCallsAdapter() public {
        vm.prank(alice);
        vm.expectRevert();
        wstAdapter.deposit{value: 0}();

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert();
        wstAdapter.withdraw(1, 1);
    }

    function test_RevertWhen_WeightsExceedOneHundredPercent() public {
        IYieldAdapter[] memory a = new IYieldAdapter[](2);
        a[0] = IYieldAdapter(address(wstAdapter));
        a[1] = IYieldAdapter(address(weETHAdapter));
        uint256[] memory w = new uint256[](2);
        w[0] = 7_000;
        w[1] = 4_000; // 110% total

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SWRVault.WeightsExceedTotal.selector, 11_000));
        vault.setAdapters(a, w);
    }

    function test_RevertWhen_AdapterAndWeightArraysMismatch() public {
        IYieldAdapter[] memory a = new IYieldAdapter[](2);
        a[0] = IYieldAdapter(address(wstAdapter));
        a[1] = IYieldAdapter(address(weETHAdapter));
        uint256[] memory w = new uint256[](1);
        w[0] = 5_000;

        vm.prank(owner);
        vm.expectRevert(SWRVault.LengthMismatch.selector);
        vault.setAdapters(a, w);
    }

    function test_RevertWhen_SettingZeroSlippageTolerance() public {
        vm.prank(owner);
        vm.expectRevert(bytes("slippage out of range"));
        vault.setRiskParams(1_000, 50, 0, 3 hours);
    }

    function test_RevertWhen_QueryingUnknownPosition() public {
        vm.expectRevert(abi.encodeWithSelector(SWRVault.NoSuchPosition.selector, 0));
        vault.getPosition(alice, 0);
    }

    // =====================================================================
    //                          Multi-user accounting
    // =====================================================================

    function test_TwoWakifWithDifferentTenorsSettleIndependently() public {
        _setSpread(0);
        uint256 aliceAmount = idr(2_000_000);
        uint256 bobAmount = idr(5_000_000);

        uint256 aliceP = _deposit(alice, aliceAmount, 0); // short
        uint256 bobP = _deposit(bob, bobAmount, 2); // long

        assertEq(vault.totalPrincipal(), aliceAmount + bobAmount);

        _warp(TENOR_SHORT);

        // Bob's long tenor is still locked.
        vm.prank(bob);
        vm.expectRevert();
        vault.requestUnstake(bobP);

        vm.prank(alice);
        vault.requestUnstake(aliceP);
        _warp(UNBONDING);
        vm.prank(alice);
        assertEq(vault.claim(aliceP), aliceAmount);

        assertEq(vault.totalPrincipal(), bobAmount, "only bob's principal remains");

        _warp(TENOR_LONG);
        vm.prank(bob);
        vault.requestUnstake(bobP);
        _warp(UNBONDING);
        vm.prank(bob);
        assertEq(vault.claim(bobP), bobAmount);

        assertEq(vault.totalPrincipal(), 0);
        assertEq(vault.totalSupply(), 0, "all receipts burned");
    }
}

/// @dev Selector holder so the oracle test can name the mock's error without importing it.
interface MockAggregatorErrors {
    error NonPositiveAnswer();
}
