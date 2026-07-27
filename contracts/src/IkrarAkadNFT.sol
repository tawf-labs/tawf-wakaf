// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @notice The Ikrar Akad (Wakalah bil Istithmar) certificate for one SWR deposit,
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
contract IkrarAkadNFT is ERC721, Ownable {
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
        address wakif;
        uint256 amount; // deposit asset base units
        uint256 tenor; // seconds
        uint256 timestamp;
        string poolId;
    }

    mapping(uint256 => AkadDetails) public akads;

    event VaultSet(address indexed vault);
    event AkadMinted(uint256 indexed tokenId, address indexed wakif, uint256 amount, uint256 tenor);

    error OnlyVault();
    error VaultAlreadySet();
    error ZeroAddress();
    error NonexistentAkad();

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    constructor(uint8 _assetDecimals, string memory _assetSymbol)
        ERC721("Ikrar Akad Wakaf SWR", "IKRAR")
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
            AkadDetails({wakif: to, amount: amount, tenor: tenor, timestamp: block.timestamp, poolId: poolId});
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
        return string.concat(whole.toString(), ",", fracStr);
    }

    function _formatTenor(uint256 tenorSeconds) internal pure returns (string memory) {
        if (tenorSeconds >= 1 days) return string.concat((tenorSeconds / 1 days).toString(), " Hari");
        if (tenorSeconds >= 1 hours) return string.concat((tenorSeconds / 1 hours).toString(), " Jam");
        return string.concat((tenorSeconds / 1 minutes).toString(), " Menit");
    }

    function generateSVG(uint256 tokenId) public view returns (string memory) {
        AkadDetails memory d = akads[tokenId];
        if (d.wakif == address(0)) revert NonexistentAkad();

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
                "<text x='200' y='50' font-family='Courier, monospace' font-size='16' font-weight='bold' fill='url(#goldGrad)' text-anchor='middle'>IKRAR AKAD WAKAF</text>",
                "<text x='200' y='70' font-family='Courier, monospace' font-size='10' font-weight='bold' fill='#e2e8f0' text-anchor='middle'>WAKALAH BIL ISTITHMAR - SWR</text>",
                "<line x1='50' y1='85' x2='350' y2='85' stroke='#fbbf24' stroke-width='1' stroke-dasharray='5,5'/>",
                "<foreignObject x='40' y='100' width='320' height='120'>",
                "<p xmlns='http://www.w3.org/1999/xhtml' style='font-family:Courier, monospace; font-size:10px; color:#94a3b8; margin:0; text-align:justify; line-height:1.4;'>",
                "Bahwasanya pemilik wallet di bawah ini dengan sadar menyerahkan modal (wakalah bil istithmar) kepada protokol SWR. Pokok dikembalikan 100% setelah tenor dan masa unbonding; hasil (yield) disalurkan kepada Nadzir.",
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
                "<text x='50' y='240' fill='#fbbf24' font-weight='bold'>WAKIF:</text>",
                "<text x='50' y='255' fill='#f1f5f9' font-size='8'>",
                d.wakif.toHexString(),
                "</text>",
                "<text x='50' y='285' fill='#fbbf24' font-weight='bold'>NOMINAL:</text>",
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
                        '{"name": "Ikrar Akad Wakaf SWR #',
                        tokenId.toString(),
                        '", "description": "Sertifikat Akad Wakaf Uang (Wakalah bil Istithmar) untuk wakif ',
                        d.wakif.toHexString(),
                        '. Pokok dijaga 100%, yield disalurkan kepada Nadzir.", "image": "',
                        imageURI,
                        '", "attributes": [',
                        '{"trait_type": "Pool ID", "value": "',
                        d.poolId,
                        '"},{"trait_type": "Nominal", "value": "',
                        _formatAmount(d.amount),
                        " ",
                        assetSymbol,
                        '"},{"trait_type": "Tenor", "value": "',
                        _formatTenor(d.tenor),
                        '"},{"display_type": "date", "trait_type": "Tanggal Akad", "value": ',
                        d.timestamp.toString(),
                        "}]}"
                    )
                )
            )
        );

        return string.concat("data:application/json;base64,", json);
    }
}
