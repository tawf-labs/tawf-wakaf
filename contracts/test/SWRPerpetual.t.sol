// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SWRBase} from "./SWRBase.t.sol";
import {SWRVault} from "../src/SWRVault.sol";
import {AkadCertificateNFT} from "../src/AkadCertificateNFT.sol";

/// @notice Waqf mu'abbad — the irrevocable endowment path.
///
/// The property under test is not "the button is hidden" but "the contract refuses". A frontend
/// that merely omits the withdraw control leaves `requestUnstake` callable from any block
/// explorer, which is exactly the decorative-metadata failure this project exists to correct.
contract SWRPerpetualTest is SWRBase {
    // =====================================================================
    //                          Irrevocability
    // =====================================================================

    function test_PerpetualDepositRecordsIrrevocablePosition() public {
        uint256 amount = idr(1_000_000);
        uint256 id = _depositPerpetual(alice, amount);

        SWRVault.Position memory p = vault.getPosition(alice, id);

        assertTrue(p.perpetual, "position must be flagged perpetual");
        assertEq(p.tenor, 0, "an endowment has no tenor to wait out");
        assertEq(p.unbondingPeriod, 0, "no unbonding period to imply a claim date");
        assertEq(p.principal, amount, "principal recorded in full");
        assertEq(uint256(p.status), uint256(SWRVault.Status.Active), "stays Active forever");

        assertEq(vault.perpetualPrincipal(), amount);
        assertEq(vault.perpetualCorpus(), amount);
        assertEq(vault.totalPrincipal(), amount, "counted in total principal like any other");
        assertEq(vault.balanceOf(alice), amount, "receipt minted 1:1");
    }

    function test_RevertWhen_UnstakingPerpetualPosition() public {
        uint256 id = _depositPerpetual(alice, idr(1_000_000));

        // Not a timing problem: wait out every tenor the vault offers and it still refuses.
        _warp(TENOR_LONG * 10);

        vm.prank(alice);
        vm.expectRevert(SWRVault.PerpetualPosition.selector);
        vault.requestUnstake(id);
    }

    function test_RevertWhen_UnstakingPerpetualPositionImmediately() public {
        uint256 id = _depositPerpetual(alice, idr(1_000_000));

        vm.prank(alice);
        vm.expectRevert(SWRVault.PerpetualPosition.selector);
        vault.requestUnstake(id);
    }

    function test_RevertWhen_ClaimingPerpetualPosition() public {
        uint256 id = _depositPerpetual(alice, idr(1_000_000));
        _warp(TENOR_LONG * 10);

        // `claim` is closed too, and for the reason it is normally closed: the position never
        // enters unbonding, because nothing can put it there.
        vm.prank(alice);
        vm.expectRevert(SWRVault.PositionNotUnbonding.selector);
        vault.claim(id);
    }

    function test_NoAdminPathOutOfAnEndowment() public {
        _depositPerpetual(alice, idr(1_000_000));
        _warp(TENOR_LONG * 10);

        // Positions are keyed by caller, so the owner reaching for alice's endowment finds
        // nothing — and reaching for their own still hits the same refusal as everyone else.
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SWRVault.NoSuchPosition.selector, 0));
        vault.requestUnstake(0);

        idrx.mint(owner, idr(1_000));
        uint256 ownerId = _depositPerpetual(owner, idr(1_000));

        vm.prank(owner);
        vm.expectRevert(SWRVault.PerpetualPosition.selector);
        vault.requestUnstake(ownerId);
    }

    function test_PerpetualAndTemporaryCoexist() public {
        uint256 perpetualId = _depositPerpetual(alice, idr(1_000_000));
        uint256 temporaryId = _deposit(alice, idr(2_000_000), 0);

        _warp(TENOR_SHORT + 1);

        // The temporary leg still works exactly as before.
        vm.prank(alice);
        vault.requestUnstake(temporaryId);

        _warp(UNBONDING + 1);
        vm.prank(alice);
        vault.claim(temporaryId);

        // The endowment is untouched by any of it.
        SWRVault.Position memory p = vault.getPosition(alice, perpetualId);
        assertTrue(p.perpetual);
        assertEq(uint256(p.status), uint256(SWRVault.Status.Active));
        assertEq(vault.perpetualPrincipal(), idr(1_000_000));
        assertEq(vault.totalPrincipal(), idr(1_000_000), "only the temporary principal left");
    }

    function test_AkadCertificateSaysPerpetual() public {
        uint256 id = _depositPerpetual(alice, idr(1_000_000));
        SWRVault.Position memory p = vault.getPosition(alice, id);

        string memory svg = akad.generateSVG(p.akadTokenId);

        // "0 Minutes" would state the opposite of the akad the waqif signed.
        assertTrue(_contains(svg, "Perpetual"), "certificate must read Perpetual");
        assertFalse(_contains(svg, "0 Minutes"), "certificate must not read a zero tenor");
    }

    // =====================================================================
    //                        Compounding corpus
    // =====================================================================

    function test_HarvestRetainsShareIntoCorpus() public {
        _depositPerpetual(alice, idr(10_000_000));
        _accrueYield(2_000); // +20% on both legs
        _refreshOracle();

        uint256 corpusBefore = vault.perpetualCorpus();
        uint256 nazirBefore = idrx.balanceOf(nazir);

        vm.prank(keeper);
        (uint256 toNazir,) = vault.harvest();

        assertGt(vault.perpetualCompounded(), 0, "some surplus must be retained");
        assertGt(vault.perpetualCorpus(), corpusBefore, "the endowment must grow");
        assertGt(toNazir, 0, "the nazir must still be paid");
        assertEq(idrx.balanceOf(nazir) - nazirBefore, toNazir);

        // The retained share is the configured fraction of the whole surplus, and the nazir keeps
        // the rest — so the endowment can never quietly take everything.
        assertLt(vault.perpetualCompounded(), toNazir, "30% retained must be less than 70% paid");
    }

    function test_HarvestNeverLeavesVaultBelowFloorWhenCompounding() public {
        _depositPerpetual(alice, idr(10_000_000));
        _deposit(bob, idr(5_000_000), 1);

        // A spread makes the unwind genuinely lossy, which is where the naive version of this
        // arithmetic charged the compounding cost to the buffer backing principal.
        _setSpread(50);

        // Routing 70% of each deposit through that spread starts NAV *below* the floor, so the
        // first accrual has to close the entry cost and the 10% buffer before any harvest is
        // possible at all. Clearing it up front is setup, not the property under test.
        _accrueYield(3_000);
        _refreshOracle();

        for (uint256 i; i < 5; ++i) {
            _accrueYield(1_500);
            _refreshOracle();

            vm.prank(keeper);
            vault.harvest();

            assertGe(
                vault.totalNavIDRX(),
                vault.harvestFloor(),
                "NAV must never end a compounding harvest below the floor it just raised"
            );
        }

        assertGt(vault.perpetualCompounded(), 0, "five compounding harvests must have grown the corpus");
    }

    function test_CompoundedCorpusCannotBeStrippedLater() public {
        _depositPerpetual(alice, idr(10_000_000));
        _accrueYield(2_000);
        _refreshOracle();

        vm.prank(keeper);
        vault.harvest();

        uint256 compounded = vault.perpetualCompounded();
        assertGt(compounded, 0);

        // With no new yield, the retained growth is now behind the floor and unreachable.
        _refreshOracle();
        vm.prank(keeper);
        vm.expectRevert();
        vault.harvest();

        assertEq(vault.perpetualCompounded(), compounded, "retained corpus is not clawed back");
    }

    function test_CompoundingRaisesTheFloorByExactlyWhatItRetained() public {
        _depositPerpetual(alice, idr(10_000_000));
        _accrueYield(2_000);
        _refreshOracle();

        uint256 floorBefore = vault.harvestFloor();

        vm.prank(keeper);
        vault.harvest();

        uint256 retained = vault.perpetualCompounded();
        // Principal did not move, so the only thing that can have changed the floor is the credit.
        assertEq(vault.harvestFloor(), floorBefore + retained, "floor rises by the retained amount");
    }

    function test_NoCompoundingWithoutPerpetualPositions() public {
        // Temporary-only vault: compoundBps is set, but there is no endowment to credit.
        _deposit(alice, idr(10_000_000), 0);
        _accrueYield(2_000);
        _refreshOracle();

        uint256 nazirBefore = idrx.balanceOf(nazir);

        vm.prank(keeper);
        (uint256 toNazir, uint256 bounty) = vault.harvest();

        assertEq(vault.perpetualCompounded(), 0, "nothing to compound into");
        assertGt(toNazir, 0);
        assertEq(idrx.balanceOf(nazir) - nazirBefore, toNazir);
        assertEq(idrx.balanceOf(keeper), bounty);
    }

    function test_SolvencyCountsCompoundedCorpusAsOwed() public {
        _depositPerpetual(alice, idr(10_000_000));
        _accrueYield(2_000);
        _refreshOracle();

        vm.prank(keeper);
        vault.harvest();

        uint256 owed = vault.totalPrincipal() + vault.perpetualCompounded();
        uint256 expected = ((vault.totalNavIDRX() + vault.reservedForClaims()) * 10_000) / owed;

        assertEq(vault.solvencyRatioBps(), expected, "compounded growth is an obligation, not free equity");
        assertGe(vault.solvencyRatioBps(), 10_000, "and it must still be fully backed");
    }

    // =====================================================================
    //                          Admin surface
    // =====================================================================

    function test_SetCompoundBps() public {
        vm.prank(owner);
        vault.setCompoundBps(1_000);
        assertEq(vault.compoundBps(), 1_000);
    }

    function test_RevertWhen_CompoundBpsAboveCap() public {
        uint256 cap = vault.MAX_COMPOUND_BPS();

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(SWRVault.CompoundTooHigh.selector, cap + 1, cap));
        vault.setCompoundBps(cap + 1);
    }

    function test_RevertWhen_NonOwnerSetsCompoundBps() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setCompoundBps(1_000);
    }

    function test_CompoundBpsZeroSendsEverythingToNazir() public {
        vm.prank(owner);
        vault.setCompoundBps(0);

        _depositPerpetual(alice, idr(10_000_000));
        _accrueYield(2_000);
        _refreshOracle();

        vm.prank(keeper);
        vault.harvest();

        assertEq(vault.perpetualCompounded(), 0, "nothing retained when the share is zero");
        assertGt(idrx.balanceOf(nazir), 0);
    }

    // --- helpers ----------------------------------------------------------

    function _contains(string memory haystack, string memory needle) private pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0 || n.length > h.length) return false;

        for (uint256 i; i <= h.length - n.length; ++i) {
            bool hit = true;
            for (uint256 j; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    hit = false;
                    break;
                }
            }
            if (hit) return true;
        }
        return false;
    }
}
