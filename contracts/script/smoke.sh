#!/usr/bin/env bash
# End-to-end smoke test against a live SWR deployment.
#
# Walks the whole wakif lifecycle — faucet, deposit, yield, permissionless harvest, unstake,
# claim — and asserts the two properties that matter: a harvest never dips the vault below its
# floor, and the wakif gets their principal back.
#
# Reads addresses from web/src/generated/addresses.json, so it works against anvil or Sepolia.
#
#   ./script/smoke.sh <rpc-url> <wakif-private-key> <keeper-private-key>
#
# On Sepolia the tenor and unbonding waits are real wall-clock minutes; on anvil the script
# fast-forwards with evm_increaseTime.

set -euo pipefail

RPC="${1:?usage: smoke.sh <rpc> <wakif-pk> <keeper-pk>}"
WAKIF_PK="${2:?missing wakif private key}"
KEEPER_PK="${3:?missing keeper private key}"

CFG="$(dirname "$0")/../../web/src/generated/addresses.json"
j() { python3 -c "import json,sys;print(json.load(open('$CFG'))['$1'])"; }

VAULT=$(j vault); IDRX=$(j idrx); AKAD=$(j akad)
STETH=$(j stETH); EETH=$(j eETH); CHAIN=$(j chainId)

WAKIF=$(cast wallet address --private-key "$WAKIF_PK")
KEEPER=$(cast wallet address --private-key "$KEEPER_PK")
NADZIR=$(cast call "$VAULT" "nadzir()(address)" --rpc-url "$RPC")

AMT=10000000  # Rp 100,000.00 in 2-decimal base units

r() { cast call "$VAULT" "$1" --rpc-url "$RPC" | cut -d' ' -f1; }
bal() { cast call "$IDRX" "balanceOf(address)(uint256)" "$1" --rpc-url "$RPC" | cut -d' ' -f1; }
send() { cast send "$@" --rpc-url "$RPC" >/dev/null; }

# anvil can time-travel; a real testnet cannot.
advance() {
  if [ "$CHAIN" = "31337" ]; then
    cast rpc evm_increaseTime "$1" --rpc-url "$RPC" >/dev/null
    cast rpc evm_mine --rpc-url "$RPC" >/dev/null
  else
    echo "   waiting $1s of real time (testnet)..."; sleep "$1"
  fi
  send "$(j feed)" "poke()" --private-key "$WAKIF_PK"
}

echo "=== SWR smoke test  (chain $CHAIN)"
echo "vault $VAULT"

echo
echo "-- 1. deposit Rp 100,000 on the 10-minute tenor"
send "$IDRX" "faucet()" --private-key "$WAKIF_PK"
send "$IDRX" "approve(address,uint256)" "$VAULT" "$AMT" --private-key "$WAKIF_PK"
send "$VAULT" "deposit(uint256,uint256)" "$AMT" 0 --private-key "$WAKIF_PK"
WQ=$(cast call "$VAULT" "balanceOf(address)(uint256)" "$WAKIF" --rpc-url "$RPC" | cut -d' ' -f1)
[ "$WQ" = "$AMT" ] || { echo "FAIL: wqIDRX not minted 1:1 ($WQ != $AMT)"; exit 1; }
echo "   wqIDRX minted 1:1        OK"
echo "   akad certificate         $(cast call "$AKAD" 'ownerOf(uint256)(address)' 0 --rpc-url "$RPC")"
echo "   NAV / floor              $(r 'totalNavIDRX()(uint256)') / $(r 'harvestFloor()(uint256)')"

echo
echo "-- 2. simulate validator rewards (+30% on both legs)"
send "$STETH" "accrueBps(uint256)" 3000 --private-key "$WAKIF_PK"
send "$EETH"  "accrueBps(uint256)" 3000 --private-key "$WAKIF_PK"
echo "   NAV                      $(r 'totalNavIDRX()(uint256)')"
echo "   solvency (bps)           $(r 'solvencyRatioBps()(uint256)')"

echo
echo "-- 3. harvest from a NON-owner wallet"
NAD_BEFORE=$(bal "$NADZIR")
send "$VAULT" "harvest()" --private-key "$KEEPER_PK"
NAD_AFTER=$(bal "$NADZIR")
NAV=$(r 'totalNavIDRX()(uint256)'); FLOOR=$(r 'harvestFloor()(uint256)')
[ "$NAD_AFTER" -gt "$NAD_BEFORE" ] || { echo "FAIL: nadzir received nothing"; exit 1; }
[ "$NAV" -ge "$FLOOR" ] || { echo "FAIL: harvest dipped below floor ($NAV < $FLOOR)"; exit 1; }
echo "   nadzir received          $((NAD_AFTER - NAD_BEFORE))"
echo "   keeper bounty            $(bal "$KEEPER")"
echo "   NAV >= floor after       OK  ($NAV >= $FLOOR)"

echo
echo "-- 4. wait out the tenor, then request unstake"
advance 610
send "$VAULT" "requestUnstake(uint256)" 0 --private-key "$WAKIF_PK"
echo "   reservedForClaims        $(r 'reservedForClaims()(uint256)')"

echo
echo "-- 5. wait out unbonding, then claim"
advance 310
BEFORE=$(bal "$WAKIF")
send "$VAULT" "claim(uint256)" 0 --private-key "$WAKIF_PK"
AFTER=$(bal "$WAKIF")
PAYOUT=$((AFTER - BEFORE))
[ "$PAYOUT" = "$AMT" ] || { echo "FAIL: principal not fully returned ($PAYOUT != $AMT)"; exit 1; }
echo "   payout                   $PAYOUT  (100% of principal)"
echo "   wqIDRX burned            $(cast call "$VAULT" 'balanceOf(address)(uint256)' "$WAKIF" --rpc-url "$RPC")"
echo "   deficit                  $(r 'deficit()(uint256)')"

echo
echo "=== all checks passed"
