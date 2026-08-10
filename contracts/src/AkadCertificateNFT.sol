// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @notice The Akad (Wakalah bil Istithmar) certificate for one SWR deposit,
/// rendered fully onchain as SVG — no IPFS, no gateway, nothing to go dark.
///
/// Ported from the `skripsi-staking` thesis project with two substantive changes:
///
///  1. Amounts are IDRX base units at an arbitrary decimals value, not 18-decimal wei.
///     The original hardcoded `/1e18`, which on a 2-decimal token would render every
///     deposit as "0.0000".
///  2. Minting is restricted to the vault. In the original, the akad's `period` was
///     decorative metadata that nothing enforced; here the same field is the tenor the
///     vault actually locks against, so the certificate has to be non-forgeable.
contract AkadCertificateNFT is ERC721, Ownable {
    using Strings for uint256;
    using Strings for address;

    uint256 private _nextTokenId;

    /// @notice The only address permitted to mint. Set once, after the vault is deployed.
    address public vault;

    /// @notice Decimals of the deposit asset, for display formatting.
    uint8 public immutable assetDecimals;

    /// @notice Ticker of the deposit asset, for display.
    string public assetSymbol;

    struct AkadDetails {
        address waqif;
        uint256 amount; // deposit asset base units
        uint256 tenor; // seconds
        uint256 timestamp;
        string poolId;
    }

    mapping(uint256 => AkadDetails) public akads;

    event VaultSet(address indexed vault);
    event AkadMinted(uint256 indexed tokenId, address indexed waqif, uint256 amount, uint256 tenor);

    error OnlyVault();
    error VaultAlreadySet();
    error ZeroAddress();
    error NonexistentAkad();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(uint8 _assetDecimals, string memory _assetSymbol)
        ERC721("SWR Waqf Akad Certificate", "AKAD")
        Ownable(msg.sender)
    {
        assetDecimals = _assetDecimals;
        assetSymbol = _assetSymbol;
    }

    /// @dev One-way. Once the vault is set it cannot be repointed, so the owner cannot
    ///      later mint counterfeit akad certificates against deposits that never happened.
    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        if (vault != address(0)) revert VaultAlreadySet();
        vault = _vault;
        emit VaultSet(_vault);
    }

    function mintAkad(address to, uint256 amount, uint256 tenor, string calldata poolId)
        external
        onlyVault
        returns (uint256 tokenId)
    {
        tokenId = _nextTokenId++;
        akads[tokenId] =
            AkadDetails({waqif: to, amount: amount, tenor: tenor, timestamp: block.timestamp, poolId: poolId});
        _safeMint(to, tokenId);
        emit AkadMinted(tokenId, to, amount, tenor);
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    // --- rendering --------------------------------------------------------

    /// @dev Decimal-aware fixed-point rendering. Two fractional digits is right for a
    ///      rupiah-denominated asset; a token with fewer decimals is left-padded.
    function _formatAmount(uint256 amount) internal view returns (string memory) {
        uint256 scale = 10 ** assetDecimals;
        uint256 whole = amount / scale;
        if (assetDecimals == 0) return whole.toString();

        uint256 frac = amount % scale;
        // Normalise the fraction to exactly 2 displayed digits.
        uint256 shown = assetDecimals >= 2 ? frac / (10 ** (assetDecimals - 2)) : frac * (10 ** (2 - assetDecimals));

        string memory fracStr = shown.toString();
        if (shown < 10) fracStr = string.concat("0", fracStr);
        // Decimal point, not the Indonesian comma — every other string on this certificate is
        // English, and "1,50 IDRX" reads as one-thousand-five-hundred to that audience.
        return string.concat(whole.toString(), ".", fracStr);
    }

    function _formatTenor(uint256 tenorSeconds) internal pure returns (string memory) {
        // Waqf mu'abbad has no tenor. Without this the certificate would read "0 Minutes", which
        // states the opposite of what the akad actually says.
        if (tenorSeconds == 0) return "Perpetual";
        if (tenorSeconds >= 1 days) return string.concat((tenorSeconds / 1 days).toString(), " Days");
        if (tenorSeconds >= 1 hours) return string.concat((tenorSeconds / 1 hours).toString(), " Hours");
        return string.concat((tenorSeconds / 1 minutes).toString(), " Minutes");
    }

    /// @dev The wording of the akad, which is not the same akad in both cases. A tenor of zero is
    ///      waqf mu'abbad: the corpus is never returned, so printing the fixed-tenor promise of a
    ///      100% principal return on that certificate would state the opposite of what the waqif
    ///      actually agreed to — and this certificate is the artefact they keep.
    function _deedText(uint256 tenor) internal pure returns (string memory) {
        if (tenor == 0) {
            return "The wallet owner named below knowingly and irrevocably endows this capital"
            " (wakalah bil istithmar) to the SWR protocol. The corpus is never returned; it is"
            " preserved in perpetuity, and its yield is directed to the Nazir.";
        }
        return "The wallet owner named below knowingly entrusts this capital (wakalah bil"
        " istithmar) to the SWR protocol. The principal is returned in full after the tenor and"
        " unbonding period; the yield is directed to the Nazir.";
    }

    function generateSVG(uint256 tokenId) public view returns (string memory) {
        AkadDetails memory d = akads[tokenId];
        if (d.waqif == address(0)) revert NonexistentAkad();

        return string(
            abi.encodePacked(
                "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' width='100%' height='100%'>",
                "<defs>",
                "<linearGradient id='bgGrad' x1='0%' y1='0%' x2='100%' y2='100%'>",
                "<stop offset='0%' stop-color='#0f172a'/><stop offset='100%' stop-color='#065f46'/>",
                "</linearGradient>",
                "<linearGradient id='goldGrad' x1='0%' y1='0%' x2='100%' y2='0%'>",
                "<stop offset='0%' stop-color='#fbbf24'/><stop offset='100%' stop-color='#f59e0b'/>",
                "</linearGradient>",
                "</defs>",
                "<rect width='400' height='400' rx='20' fill='url(#bgGrad)' stroke='#fbbf24' stroke-width='4'/>",
                "<text x='200' y='50' font-family='Courier, monospace' font-size='16' font-weight='bold' fill='url(#goldGrad)' text-anchor='middle'>WAQF AKAD CERTIFICATE</text>",
                "<text x='200' y='70' font-family='Courier, monospace' font-size='10' font-weight='bold' fill='#e2e8f0' text-anchor='middle'>WAKALAH BIL ISTITHMAR - SWR</text>",
                "<line x1='50' y1='85' x2='350' y2='85' stroke='#fbbf24' stroke-width='1' stroke-dasharray='5,5'/>",
                "<foreignObject x='40' y='100' width='320' height='120'>",
                "<p xmlns='http://www.w3.org/1999/xhtml' style='font-family:Courier, monospace; font-size:10px; color:#94a3b8; margin:0; text-align:justify; line-height:1.4;'>",
                _deedText(d.tenor),
                "</p>",
                "</foreignObject>",
                _paramsGroup(d),
                "<line x1='50' y1='330' x2='350' y2='330' stroke='#fbbf24' stroke-width='1'/>",
                "<text x='200' y='355' font-family='Courier, monospace' font-size='9' fill='#64748b' text-anchor='middle'>IMMUTABLE ONCHAIN CERTIFICATE</text>",
                "<text x='200' y='370' font-family='Courier, monospace' font-size='8' fill='#fbbf24' text-anchor='middle'>TOKEN ID: #",
                tokenId.toString(),
                "</text>",
                "</svg>"
            )
        );
    }

    /// @dev Split out to keep `generateSVG` under the stack-depth limit.
    function _paramsGroup(AkadDetails memory d) private view returns (string memory) {
        return string(
            abi.encodePacked(
                "<g font-family='Courier, monospace' font-size='10'>",
                "<text x='50' y='240' fill='#fbbf24' font-weight='bold'>WAQIF:</text>",
                "<text x='50' y='255' fill='#f1f5f9' font-size='8'>",
                d.waqif.toHexString(),
                "</text>",
                "<text x='50' y='285' fill='#fbbf24' font-weight='bold'>AMOUNT:</text>",
                "<text x='50' y='300' fill='#f1f5f9' font-size='13' font-weight='bold'>",
                _formatAmount(d.amount),
                " ",
                assetSymbol,
                "</text>",
                "<text x='250' y='285' fill='#fbbf24' font-weight='bold'>POOL / TENOR:</text>",
                "<text x='250' y='300' fill='#f1f5f9'>",
                d.poolId,
                " / ",
                _formatTenor(d.tenor),
                "</text>",
                "</g>"
            )
        );
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        AkadDetails memory d = akads[tokenId];

        string memory imageURI =
            string.concat("data:image/svg+xml;base64,", Base64.encode(bytes(generateSVG(tokenId))));

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "SWR Waqf Akad #',
                        tokenId.toString(),
                        '", "description": "Cash Waqf Akad Certificate (Wakalah bil Istithmar) for waqif ',
                        d.waqif.toHexString(),
                        '. Principal preserved, yield directed to the Nazir.", "image": "',
                        imageURI,
                        '", "attributes": [',
                        '{"trait_type": "Pool ID", "value": "',
                        d.poolId,
                        '"},{"trait_type": "Amount", "value": "',
                        _formatAmount(d.amount),
                        " ",
                        assetSymbol,
                        '"},{"trait_type": "Tenor", "value": "',
                        _formatTenor(d.tenor),
                        '"},{"display_type": "date", "trait_type": "Akad Date", "value": ',
                        d.timestamp.toString(),
                        "}]}"
                    )
                )
            )
        );

        return string.concat("data:application/json;base64,", json);
    }
}
