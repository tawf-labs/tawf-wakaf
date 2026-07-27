// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IYieldAdapter} from "./interfaces/IYieldAdapter.sol";
import {ISwapRouter, IWETH} from "./interfaces/ISwapRouter.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";
import {IkrarAkadNFT} from "./IkrarAkadNFT.sol";

/// @title SWR Vault — Staking Wakaf Ritel
/// @notice Retail cash-waqf vault. A wakif deposits IDRX and picks a tenor; the vault routes the
///         deposit across a basket of liquid-staking venues, strips NAV surplus to the nadzir
///         wallet, and returns 100% of the principal after tenor + unbonding.
///
/// ## The honest risk, stated up front
///
/// Principal is denominated in IDRX (rupiah) but is backed by ETH-correlated assets. If ETH falls
/// against the rupiah, NAV falls below `totalPrincipal` and no amount of Solidity can conjure the
/// difference. `bufferBps`, `deficit`, `solvencyRatioBps()` and `topUp()` exist to make that risk
/// visible and survivable — not to eliminate it. It is a property of the asset choice.
///
/// ## Nothing is automatic
///
/// `harvest()` is permissionless and pays a bounty from the surplus it strips. There is no cron and
/// no privileged keeper: the diagram's "Keeper Node" is a convenience caller competing with anyone
/// else who wants the bounty. No admin key sits on the path between yield and the nadzir, and
/// `claim()` has no pause and no owner gate, so a wakif's exit never depends on this team existing.
///
/// ## wqIDRX
///
/// This contract IS the receipt token, minted 1:1 with principal and non-transferable. Each deposit
/// carries its own tenor and unbonding clock, so a freely transferable receipt would let someone
/// send the token away while keeping the claim.
contract SWRVault is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant BPS = 10_000;
    uint256 internal constant WAD = 1e18;

    enum Status {
        Active,
        Unbonding,
        Claimed
    }

    /// @dev Packed into 3 slots. uint128 caps principal at ~3.4e38 base units — far beyond any
    ///      plausible rupiah figure even at 18 decimals.
    struct Position {
        uint128 principal; // IDRX base units owed to the wakif
        uint128 reserved; // IDRX actually set aside at requestUnstake
        uint64 depositedAt;
        uint64 tenor; // seconds; snapshotted, so later config changes cannot extend a live lock
        uint64 unbondingStart; // 0 until requestUnstake
        uint64 unbondingPeriod; // seconds; snapshotted for the same reason
        uint64 akadTokenId;
        Status status;
    }

    // --- immutable wiring -------------------------------------------------

    IERC20 public immutable idrx;
    uint8 public immutable idrxDecimals;
    IWETH public immutable weth;
    IkrarAkadNFT public immutable akad;

    // --- configurable wiring ----------------------------------------------

    ISwapRouter public router;
    IAggregatorV3 public ethIdrxFeed;
    address public nadzir;

    IYieldAdapter[] public adapters;
    /// @notice Basis points of each deposit routed to `adapters[i]`. The unallocated remainder
    ///         stays as idle IDRX — the stable leg standing in for the PRD's syariah-RWA sleeve,
    ///         which doubles as the first line of defence in a drawdown.
    uint256[] public weightsBps;

    uint256[] public tenorOptions; // seconds
    uint256 public unbondingPeriod; // seconds

    uint256 public bufferBps = 1_000; // 10% cushion held over principal before any yield leaves
    uint256 public harvestBountyBps = 50; // 0.5% of stripped surplus to whoever calls harvest()
    uint256 public maxSlippageBps = 100; // 1% floor on every swap; never 0
    uint256 public maxOracleAge = 3 hours;
    uint256 public minDeposit;
    uint256 public minHarvest;

    // --- accounting -------------------------------------------------------

    mapping(address => Position[]) private _positions;

    /// @notice Sum of every un-claimed position's principal, in IDRX base units.
    uint256 public totalPrincipal;
    /// @notice Principal belonging to positions already in unbonding. Its backing has been pulled
    ///         out of the basket into `reservedForClaims`, so it must be excluded from the harvest
    ///         floor — otherwise the floor counts an obligation whose assets are no longer in NAV,
    ///         and yield stops being distributable the moment anyone starts unbonding.
    uint256 public unbondingPrincipal;
    /// @notice IDRX earmarked for positions already in unbonding. Excluded from working NAV.
    uint256 public reservedForClaims;
    /// @notice Lifetime IDRX delivered to the nadzir.
    uint256 public totalYieldStripped;
    /// @notice Cumulative principal that could not be reserved in full — the FX risk, made visible.
    uint256 public deficit;
    /// @notice Highest NAV-per-principal ever observed, in WAD. Reporting only, never a gate.
    uint256 public peakNavPerPrincipalWad;

    // --- events -----------------------------------------------------------

    event Deposited(
        address indexed wakif, uint256 indexed positionId, uint256 amount, uint256 tenor, uint256 akadTokenId
    );
    event Routed(uint256 indexed adapterIndex, uint256 idrxIn, uint256 ethStaked);
    event UnstakeRequested(
        address indexed wakif, uint256 indexed positionId, uint256 reserved, uint256 claimableAt
    );
    event Claimed(address indexed wakif, uint256 indexed positionId, uint256 payout, uint256 principal);
    event YieldStripped(address indexed caller, address indexed nadzir, uint256 toNadzir, uint256 bounty, uint256 nav);
    event ShortfallRecorded(address indexed wakif, uint256 indexed positionId, uint256 missing);
    event ToppedUp(address indexed from, uint256 amount, uint256 remainingDeficit);
    event NadzirUpdated(address indexed nadzir);
    event AdaptersUpdated(uint256 adapterCount, uint256 totalWeightBps);
    event TenorOptionsUpdated(uint256[] tenors, uint256 unbondingPeriod);
    event RiskParamsUpdated(uint256 bufferBps, uint256 harvestBountyBps, uint256 maxSlippageBps, uint256 maxOracleAge);
    event OracleUpdated(address indexed feed, uint256 maxOracleAge);
    event RouterUpdated(address indexed router);

    // --- errors -----------------------------------------------------------

    error ZeroAmount();
    error ZeroAddress();
    error BelowMinimum(uint256 given, uint256 required);
    error InvalidTenorIndex(uint256 given, uint256 optionCount);
    error NoSuchPosition(uint256 positionId);
    error PositionNotActive();
    error PositionNotUnbonding();
    error TenorNotElapsed(uint256 maturesAt);
    error UnbondingNotElapsed(uint256 claimableAt);
    error NoSurplus(uint256 nav, uint256 floor);
    error SurplusTooSmall(uint256 surplus, uint256 minimum);
    error StaleOracle(uint256 updatedAt, uint256 maxAge);
    error BadOraclePrice(int256 answer);
    error WeightsExceedTotal(uint256 totalBps);
    error LengthMismatch();
    error AmountTooLarge();
    error NoAdapters();
    error EthTransferFailed();

    constructor(
        IERC20 _idrx,
        IWETH _weth,
        ISwapRouter _router,
        IAggregatorV3 _ethIdrxFeed,
        IkrarAkadNFT _akad,
        address _nadzir,
        uint256[] memory _tenorOptions,
        uint256 _unbondingPeriod,
        address _owner
    ) ERC20("Wakaf Staked IDRX", "wqIDRX") Ownable(_owner) {
        if (
            address(_idrx) == address(0) || address(_weth) == address(0) || address(_router) == address(0)
                || address(_ethIdrxFeed) == address(0) || address(_akad) == address(0) || _nadzir == address(0)
        ) revert ZeroAddress();
        if (_tenorOptions.length == 0) revert ZeroAmount();

        idrx = _idrx;
        idrxDecimals = IERC20Metadata(address(_idrx)).decimals();
        weth = _weth;
        router = _router;
        ethIdrxFeed = _ethIdrxFeed;
        akad = _akad;
        nadzir = _nadzir;
        tenorOptions = _tenorOptions;
        unbondingPeriod = _unbondingPeriod;

        // One whole unit of IDRX, whatever its decimals. Never a hardcoded 1e18.
        minDeposit = 10 ** idrxDecimals;
        minHarvest = 10 ** idrxDecimals;
        peakNavPerPrincipalWad = WAD;
    }

    // =====================================================================
    //                            wqIDRX receipt
    // =====================================================================

    /// @dev Matches the deposit asset so "1:1 with principal" is literally true in base units.
    function decimals() public view override returns (uint8) {
        return idrxDecimals;
    }

    /// @dev Mint and burn only. A transferable receipt would decouple the token from the
    ///      per-position tenor and unbonding clocks that gate the claim.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            revert("wqIDRX: non-transferable");
        }
        super._update(from, to, value);
    }

    // =====================================================================
    //                              Wakif flow
    // =====================================================================

    /// @notice Deposit IDRX and lock it for the chosen tenor.
    /// @param amount IDRX base units
    /// @param tenorIndex index into `tenorOptions`
    function deposit(uint256 amount, uint256 tenorIndex) external nonReentrant returns (uint256 positionId) {
        if (amount == 0) revert ZeroAmount();
        if (tenorIndex >= tenorOptions.length) revert InvalidTenorIndex(tenorIndex, tenorOptions.length);
        if (amount < minDeposit) revert BelowMinimum(amount, minDeposit);
        if (adapters.length == 0) revert NoAdapters();

        // Measure what actually landed rather than trusting `amount`: a fee-on-transfer or
        // deflationary asset would otherwise mint receipts against money the vault never received.
        uint256 balanceBefore = idrx.balanceOf(address(this));
        idrx.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = idrx.balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();
        if (received > type(uint128).max) revert AmountTooLarge();

        uint256 tenor = tenorOptions[tenorIndex];
        positionId = _positions[msg.sender].length;

        // EFFECTS first. `akad.mintAkad` ends in `_safeMint`, which invokes `onERC721Received` on
        // a contract recipient — a genuine callback into arbitrary code. `nonReentrant` already
        // blocks re-entry, but the position must exist and be fully accounted before that
        // callback can observe the vault, so a reader called from it never sees a half-built state.
        _positions[msg.sender].push(
            Position({
                principal: uint128(received),
                reserved: 0,
                depositedAt: uint64(block.timestamp),
                tenor: uint64(tenor),
                unbondingStart: 0,
                unbondingPeriod: uint64(unbondingPeriod),
                akadTokenId: 0,
                status: Status.Active
            })
        );

        totalPrincipal += received;
        _mint(msg.sender, received);

        // INTERACTIONS. The certificate id is cosmetic — it links the position to its akad NFT
        // and gates nothing, so writing it back after the mint costs no safety.
        uint256 akadTokenId = akad.mintAkad(msg.sender, received, tenor, _poolLabel(tenorIndex));
        _positions[msg.sender][positionId].akadTokenId = uint64(akadTokenId);

        emit Deposited(msg.sender, positionId, received, tenor, akadTokenId);

        _route(received);
    }

    /// @notice Start the unbonding clock. Only after the tenor has fully elapsed.
    /// @dev Pulls this position's principal out of the basket immediately and earmarks it, so the
    ///      later `claim()` is solvent by construction rather than by hope.
    ///
    ///      Known and accepted CEI deviation: `reservedForClaims` is written after the liquidation
    ///      calls, because how much can be reserved is not knowable until the unwind returns. It
    ///      cannot be hoisted. What makes it safe is that `nonReentrant` shares one lock across
    ///      every entrypoint here, and every address reached during the unwind — router, adapters,
    ///      WETH — is owner-configured rather than caller-supplied, so an attacker cannot inject a
    ///      contract into the call path. Flagged by Slither as `reentrancy-eth`; recorded in the
    ///      README rather than suppressed.
    function requestUnstake(uint256 positionId) external nonReentrant {
        Position storage p = _getPosition(msg.sender, positionId);
        if (p.status != Status.Active) revert PositionNotActive();

        uint256 maturesAt = uint256(p.depositedAt) + p.tenor;
        if (block.timestamp < maturesAt) revert TenorNotElapsed(maturesAt);

        p.status = Status.Unbonding;
        p.unbondingStart = uint64(block.timestamp);

        uint256 need = p.principal;

        // Spend the idle stable leg first — it exists for exactly this, and it avoids paying
        // swap spread to unwind LST positions that are still earning.
        uint256 idle = _idleIdrx();
        uint256 obtained = need <= idle ? need : idle;
        uint256 missing = need - obtained;
        if (missing > 0) {
            obtained += _liquidateToIdrx(missing);
        }

        uint256 reserved = obtained >= need ? need : obtained;
        p.reserved = uint128(reserved);
        reservedForClaims += reserved;
        unbondingPrincipal += need;

        if (reserved < need) {
            uint256 shortfall = need - reserved;
            deficit += shortfall;
            emit ShortfallRecorded(msg.sender, positionId, shortfall);
        }

        emit UnstakeRequested(msg.sender, positionId, reserved, block.timestamp + p.unbondingPeriod);
    }

    /// @notice Claim principal once the unbonding period has elapsed. No pause, no owner gate.
    function claim(uint256 positionId) external nonReentrant returns (uint256 payout) {
        Position storage p = _getPosition(msg.sender, positionId);
        if (p.status != Status.Unbonding) revert PositionNotUnbonding();

        uint256 claimableAt = uint256(p.unbondingStart) + p.unbondingPeriod;
        if (block.timestamp < claimableAt) revert UnbondingNotElapsed(claimableAt);

        payout = p.reserved;
        uint256 principal = p.principal;

        p.status = Status.Claimed;
        p.reserved = 0;

        reservedForClaims -= payout;
        unbondingPrincipal -= principal;
        totalPrincipal -= principal;

        _burn(msg.sender, principal);

        emit Claimed(msg.sender, positionId, payout, principal);

        if (payout > 0) {
            idrx.safeTransfer(msg.sender, payout);
        }
    }

    // =====================================================================
    //                          Permissionless yield
    // =====================================================================

    /// @notice Strip NAV surplus to the nadzir. Callable by anyone; the caller keeps
    ///         `harvestBountyBps` of what they realise.
    /// @dev Only the amount above principal + buffer is ever touched, so a harvest can never
    ///      reduce the vault's backing of principal below the cushion.
    function harvest() external nonReentrant returns (uint256 toNadzir, uint256 bounty) {
        uint256 nav = totalNavIDRX();
        uint256 floor = harvestFloor();

        _updatePeak(nav);

        if (nav <= floor) revert NoSurplus(nav, floor);
        uint256 surplus = nav - floor;
        if (surplus < minHarvest) revert SurplusTooSmall(surplus, minHarvest);

        uint256 realised = _liquidateToIdrx(surplus);
        if (realised == 0) revert NoSurplus(nav, floor);

        // Re-measure AFTER the unwind, and distribute only the amount by which NAV still exceeds
        // the floor.
        //
        // Unwinding crosses two swap legs and is not free. Sizing the payout from the pre-unwind
        // NAV would charge that cost to the buffer backing principal — the vault would end a
        // harvest *below* its own floor, quietly funding the nadzir out of the wakif's cushion.
        // Measuring afterwards makes the cost fall on the yield being distributed, where it
        // belongs. `floor` is unchanged here because no principal moved during liquidation.
        //
        // The payout is IDRX leaving 1:1 with no conversion, so post-harvest NAV lands exactly on
        // the floor rather than approximately on it.
        uint256 navAfter = totalNavIDRX();
        uint256 distributable = navAfter > floor ? navAfter - floor : 0;
        if (distributable > realised) distributable = realised;
        if (distributable == 0) revert NoSurplus(navAfter, floor);

        bounty = (distributable * harvestBountyBps) / BPS;
        toNadzir = distributable - bounty;

        totalYieldStripped += toNadzir;

        emit YieldStripped(msg.sender, nadzir, toNadzir, bounty, nav);

        if (bounty > 0) idrx.safeTransfer(msg.sender, bounty);
        if (toNadzir > 0) idrx.safeTransfer(nadzir, toNadzir);
    }

    /// @notice Donate IDRX to close a recorded deficit. Permissionless — a takaful reserve, the
    ///         nadzir, or anyone at all can make wakif whole.
    function topUp(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        idrx.safeTransferFrom(msg.sender, address(this), amount);
        deficit = amount >= deficit ? 0 : deficit - amount;
        emit ToppedUp(msg.sender, amount, deficit);
    }

    // =====================================================================
    //                                 Views
    // =====================================================================

    /// @notice Working NAV in IDRX: idle stable leg plus the ETH value of the basket, excluding
    ///         IDRX already earmarked for positions in unbonding.
    function totalNavIDRX() public view returns (uint256) {
        return _idleIdrx() + ethToIdrx(totalAdapterETH());
    }

    function totalAdapterETH() public view returns (uint256 total) {
        uint256 n = adapters.length;
        for (uint256 i; i < n; ++i) {
            total += adapters[i].totalAssetsETH();
        }
    }

    /// @notice Principal still backed by the basket — total obligations minus those already
    ///         pulled out and earmarked for claims.
    function workingPrincipal() public view returns (uint256) {
        return totalPrincipal > unbondingPrincipal ? totalPrincipal - unbondingPrincipal : 0;
    }

    /// @notice NAV must exceed this before any yield may leave for the nadzir.
    function harvestFloor() public view returns (uint256) {
        return workingPrincipal() + requiredBuffer();
    }

    function requiredBuffer() public view returns (uint256) {
        return (workingPrincipal() * bufferBps) / BPS;
    }

    /// @notice Total backing as basis points of total obligation. 10000 = exactly fully backed.
    /// @dev Counts earmarked claim reserves as backing, because they are: they are IDRX sitting
    ///      here with a specific wakif's name on them.
    function solvencyRatioBps() external view returns (uint256) {
        if (totalPrincipal == 0) return BPS;
        return ((totalNavIDRX() + reservedForClaims) * BPS) / totalPrincipal;
    }

    function positionsOf(address wakif) external view returns (Position[] memory) {
        return _positions[wakif];
    }

    function positionCount(address wakif) external view returns (uint256) {
        return _positions[wakif].length;
    }

    function getPosition(address wakif, uint256 positionId) external view returns (Position memory) {
        if (positionId >= _positions[wakif].length) revert NoSuchPosition(positionId);
        return _positions[wakif][positionId];
    }

    function tenorOptionsList() external view returns (uint256[] memory) {
        return tenorOptions;
    }

    function adapterCount() external view returns (uint256) {
        return adapters.length;
    }

    function adapterInfo(uint256 i)
        external
        view
        returns (address addr, string memory label, uint256 weight, uint256 assetsETH, uint256 assetsIDRX)
    {
        IYieldAdapter a = adapters[i];
        addr = address(a);
        label = a.name();
        weight = weightsBps[i];
        assetsETH = a.totalAssetsETH();
        assetsIDRX = ethToIdrx(assetsETH);
    }

    /// @notice IDRX base units for a given amount of wei, at the current oracle price.
    function ethToIdrx(uint256 weiAmount) public view returns (uint256) {
        if (weiAmount == 0) return 0;
        uint256 price = _oraclePrice();
        return (weiAmount * price * (10 ** idrxDecimals)) / (10 ** ethIdrxFeed.decimals()) / WAD;
    }

    /// @notice Wei for a given amount of IDRX base units, at the current oracle price.
    function idrxToEth(uint256 idrxAmount) public view returns (uint256) {
        if (idrxAmount == 0) return 0;
        uint256 price = _oraclePrice();
        return (idrxAmount * (10 ** ethIdrxFeed.decimals()) * WAD) / price / (10 ** idrxDecimals);
    }

    // =====================================================================
    //                                Internals
    // =====================================================================

    function _getPosition(address wakif, uint256 positionId) private view returns (Position storage) {
        if (positionId >= _positions[wakif].length) revert NoSuchPosition(positionId);
        return _positions[wakif][positionId];
    }

    /// @dev IDRX held here that is NOT already promised to an unbonding position.
    function _idleIdrx() private view returns (uint256) {
        uint256 bal = idrx.balanceOf(address(this));
        return bal > reservedForClaims ? bal - reservedForClaims : 0;
    }

    function _oraclePrice() private view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = ethIdrxFeed.latestRoundData();
        if (answer <= 0) revert BadOraclePrice(answer);
        // A feed that has stopped reporting keeps returning its last value forever. Refusing to
        // price against a stale answer is the whole defence.
        if (block.timestamp > updatedAt && block.timestamp - updatedAt > maxOracleAge) {
            revert StaleOracle(updatedAt, maxOracleAge);
        }
        return uint256(answer);
    }

    function _updatePeak(uint256 nav) private {
        if (totalPrincipal == 0) return;
        uint256 ratio = (nav * WAD) / totalPrincipal;
        if (ratio > peakNavPerPrincipalWad) peakNavPerPrincipalWad = ratio;
    }

    /// @dev Split a fresh deposit across the basket. The unallocated remainder simply stays as
    ///      IDRX — no transfer needed, it is already here.
    function _route(uint256 amount) private {
        uint256 n = adapters.length;
        for (uint256 i; i < n; ++i) {
            uint256 portion = (amount * weightsBps[i]) / BPS;
            if (portion == 0) continue;
            uint256 ethOut = _swapIdrxToEth(portion);
            if (ethOut == 0) continue;
            adapters[i].deposit{value: ethOut}();
            emit Routed(i, portion, ethOut);
        }
    }

    function _swapIdrxToEth(uint256 idrxAmount) private returns (uint256 ethOut) {
        uint256 expected = idrxToEth(idrxAmount);
        uint256 minOut = (expected * (BPS - maxSlippageBps)) / BPS;

        idrx.forceApprove(address(router), idrxAmount);
        uint256 wethOut = router.swapExactInput(address(idrx), address(weth), idrxAmount, minOut, address(this));

        weth.withdraw(wethOut);
        return wethOut;
    }

    function _swapEthToIdrx(uint256 ethAmount) private returns (uint256 idrxOut) {
        weth.deposit{value: ethAmount}();

        uint256 expected = ethToIdrx(ethAmount);
        uint256 minOut = (expected * (BPS - maxSlippageBps)) / BPS;

        IERC20(address(weth)).forceApprove(address(router), ethAmount);
        idrxOut = router.swapExactInput(address(weth), address(idrx), ethAmount, minOut, address(this));
    }

    /// @dev Unwind roughly `targetIdrx` worth of basket, proportionally across adapters so the
    ///      weights stay honoured, and convert the proceeds back to IDRX.
    ///
    ///      May return slightly MORE than requested. Getting `targetIdrx` out means crossing two
    ///      swap legs — LST->WETH inside the adapter, then WETH->IDRX here — so liquidating the
    ///      exact nominal amount always lands short by about twice the spread. The target is
    ///      grossed up for both legs at the vault's own slippage tolerance; any excess simply
    ///      stays as idle IDRX, moved from the LST sleeve into the stable sleeve rather than lost.
    ///      Callers must cap what they pay out, never assuming the return equals the request.
    function _liquidateToIdrx(uint256 targetIdrx) private returns (uint256 obtainedIdrx) {
        uint256 targetEth = idrxToEth(targetIdrx);
        if (targetEth == 0) return 0;

        uint256 denom = BPS - maxSlippageBps;
        targetEth = (targetEth * BPS * BPS) / (denom * denom);

        uint256 totalEth = totalAdapterETH();
        if (totalEth == 0) return 0;
        if (targetEth > totalEth) targetEth = totalEth;

        uint256 ethBefore = address(this).balance;

        uint256 n = adapters.length;
        for (uint256 i; i < n; ++i) {
            IYieldAdapter a = adapters[i];
            uint256 aEth = a.totalAssetsETH();
            if (aEth == 0) continue;

            uint256 shareEth = (targetEth * aEth) / totalEth;
            if (shareEth == 0) continue;

            uint256 lstAmount = (a.lstBalance() * shareEth) / aEth;
            if (lstAmount == 0) continue;

            uint256 minEthOut = (shareEth * (BPS - maxSlippageBps)) / BPS;
            a.withdraw(lstAmount, minEthOut);
        }

        uint256 ethGot = address(this).balance - ethBefore;
        if (ethGot == 0) return 0;

        obtainedIdrx = _swapEthToIdrx(ethGot);
    }

    function _poolLabel(uint256 tenorIndex) private pure returns (string memory) {
        if (tenorIndex == 0) return "SWR-01";
        if (tenorIndex == 1) return "SWR-02";
        if (tenorIndex == 2) return "SWR-03";
        return "SWR-XX";
    }

    // =====================================================================
    //                              Administration
    // =====================================================================
    //
    // Every lever below is enumerated in the CROPS record in the README. None of them can move
    // principal, touch `reservedForClaims`, or block `claim()`.

    function setNadzir(address _nadzir) external onlyOwner {
        if (_nadzir == address(0)) revert ZeroAddress();
        nadzir = _nadzir;
        emit NadzirUpdated(_nadzir);
    }

    function setAdapters(IYieldAdapter[] calldata _adapters, uint256[] calldata _weightsBps) external onlyOwner {
        if (_adapters.length != _weightsBps.length) revert LengthMismatch();

        uint256 total = 0;
        for (uint256 i; i < _weightsBps.length; ++i) {
            if (address(_adapters[i]) == address(0)) revert ZeroAddress();
            total += _weightsBps[i];
        }
        // Strictly less than 100% is fine and expected — the remainder is the stable leg.
        if (total > BPS) revert WeightsExceedTotal(total);

        adapters = _adapters;
        weightsBps = _weightsBps;

        emit AdaptersUpdated(_adapters.length, total);
    }

    function setTenorOptions(uint256[] calldata _tenorOptions, uint256 _unbondingPeriod) external onlyOwner {
        if (_tenorOptions.length == 0) revert ZeroAmount();
        tenorOptions = _tenorOptions;
        unbondingPeriod = _unbondingPeriod;
        emit TenorOptionsUpdated(_tenorOptions, _unbondingPeriod);
    }

    function setRiskParams(
        uint256 _bufferBps,
        uint256 _harvestBountyBps,
        uint256 _maxSlippageBps,
        uint256 _maxOracleAge
    ) external onlyOwner {
        require(_bufferBps <= BPS, "buffer too high");
        require(_harvestBountyBps <= 1_000, "bounty > 10%");
        require(_maxSlippageBps > 0 && _maxSlippageBps <= 2_000, "slippage out of range");
        require(_maxOracleAge > 0, "oracle age = 0");

        bufferBps = _bufferBps;
        harvestBountyBps = _harvestBountyBps;
        maxSlippageBps = _maxSlippageBps;
        maxOracleAge = _maxOracleAge;

        emit RiskParamsUpdated(_bufferBps, _harvestBountyBps, _maxSlippageBps, _maxOracleAge);
    }

    function setOracle(IAggregatorV3 _feed, uint256 _maxOracleAge) external onlyOwner {
        if (address(_feed) == address(0)) revert ZeroAddress();
        require(_maxOracleAge > 0, "oracle age = 0");
        ethIdrxFeed = _feed;
        maxOracleAge = _maxOracleAge;
        emit OracleUpdated(address(_feed), _maxOracleAge);
    }

    function setRouter(ISwapRouter _router) external onlyOwner {
        if (address(_router) == address(0)) revert ZeroAddress();
        router = _router;
        emit RouterUpdated(address(_router));
    }

    function setLimits(uint256 _minDeposit, uint256 _minHarvest) external onlyOwner {
        minDeposit = _minDeposit;
        minHarvest = _minHarvest;
    }

    /// @dev Receives ETH from adapter withdrawals and from `weth.withdraw`.
    receive() external payable {}
}
