#!/usr/bin/env bash
# End-to-end smoke test against a live SWR deployment.
#
# Walks the whole waqif lifecycle: faucet, deposit, yield, permissionless harvest, unstake,
# claim. It asserts the two properties that matter: a harvest never dips the vault below its
# floor, and the waqif gets their principal back.
#
# Reads addresses from web/src/generated/addresses.json, so it works against anvil or Sepolia.
#
#   ./script/smoke.sh <rpc-url> <waqif-private-key> <keeper-private-key>
#
# Steps 1-3 run anywhere. Steps 4-5 have to wait out a real waqf tenor, which is 30 days, so they
# run only on anvil where the script fast-forwards with evm_increaseTime. On a live chain the
# script asserts the lock instead: requestUnstake must revert TenorNotElapsed. Waits are read from
# the vault rather than hardcoded, so re-seeding the ladder does not silently break this script.

set -euo pipefail

RPC="${1:?usage: smoke.sh <rpc> <waqif-pk> <keeper-pk>}"
WAQIF_PK="${2:?missing waqif private key}"
KEEPER_PK="${3:?missing keeper private key}"

CFG="$(dirname "$0")/../../web/src/generated/addresses.json"
j() { python3 -c "import json,sys;print(json.load(open('$CFG'))['$1'])"; }

VAULT=$(j vault); IDRX=$(j idrx); AKAD=$(j akad)
STETH=$(j stETH); EETH=$(j eETH); CHAIN=$(j chainId)

WAQIF=$(cast wallet address --private-key "$WAQIF_PK")
KEEPER=$(cast wallet address --private-key "$KEEPER_PK")
NAZIR=$(cast call "$VAULT" "nazir()(address)" --rpc-url "$RPC")

AMT=10000000  # Rp 100,000.00 in 2-decimal base units

r() { cast call "$VAULT" "$1" --rpc-url "$RPC" | cut -d' ' -f1; }
ra() { cast call "$VAULT" "$1" "$2" --rpc-url "$RPC" | cut -d' ' -f1; }
bal() { cast call "$IDRX" "balanceOf(address)(uint256)" "$1" --rpc-url "$RPC" | cut -d' ' -f1; }
wq() { cast call "$VAULT" "balanceOf(address)(uint256)" "$1" --rpc-url "$RPC" | cut -d' ' -f1; }
# nth field of the Position tuple, 1-indexed, with cast's "[1.01e7]" annotation stripped.
pos_field() {
  cast call "$VAULT" \
    "getPosition(address,uint256)((uint128,uint128,uint64,uint64,uint64,uint64,uint64,uint8,bool))" \
    "$WAQIF" "$2" --rpc-url "$RPC" | tr -d '()' | cut -d',' -f"$1" | awk '{print $1}'
}
send() { cast send "$@" --rpc-url "$RPC" >/dev/null; }

# The waits come from the vault, not from constants here. The deployed ladder is an owner-settable
# parameter, so hardcoding it would leave this script quietly asserting the wrong thing.
TENOR=$(ra "tenorOptions(uint256)(uint256)" 0)
UNBONDING=$(r 'unbondingPeriod()(uint256)')
TENOR_LABEL=$((TENOR / 86400))

# anvil only. A live chain cannot time-travel, and the tenor is now a real endowment term, so the
# steps that need this are skipped there rather than slept through.
advance() {
  cast rpc evm_increaseTime "$1" --rpc-url "$RPC" >/dev/null
  cast rpc evm_mine --rpc-url "$RPC" >/dev/null
  # The warp pushes the mock feed past its staleness window, so refresh it before reading NAV.
  send "$(j feed)" "poke()" --private-key "$WAQIF_PK"
}

echo "=== SWR smoke test  (chain $CHAIN)"
echo "vault $VAULT"

echo
echo "-- 1. deposit Rp 100,000 on the shortest tenor (${TENOR}s / ${TENOR_LABEL}d)"
WQ_BEFORE=$(wq "$WAQIF")
send "$IDRX" "faucet()" --private-key "$WAQIF_PK"
send "$IDRX" "approve(address,uint256)" "$VAULT" "$AMT" --private-key "$WAQIF_PK"
send "$VAULT" "deposit(uint256,uint256)" "$AMT" 0 --private-key "$WAQIF_PK"

# Deltas and the actual position id, not absolutes and a hardcoded 0. The waqif wallet may already
# hold positions from an earlier run, and against a live deployment it usually does.
POS=$(($(cast call "$VAULT" "positionCount(address)(uint256)" "$WAQIF" --rpc-url "$RPC" \
        | cut -d' ' -f1) - 1))
MINTED=$(($(wq "$WAQIF") - WQ_BEFORE))
[ "$MINTED" = "$AMT" ] || { echo "FAIL: wqIDRX not minted 1:1 ($MINTED != $AMT)"; exit 1; }
echo "   position id              $POS"
echo "   wqIDRX minted 1:1        OK"
echo "   akad certificate         $(cast call "$AKAD" 'ownerOf(uint256)(address)' \
                                    "$(pos_field 7 "$POS")" --rpc-url "$RPC")"
echo "   NAV / floor              $(r 'totalNavIDRX()(uint256)') / $(r 'harvestFloor()(uint256)')"

echo
echo "-- 2. simulate validator rewards (+30% on both legs)"
send "$STETH" "accrueBps(uint256)" 3000 --private-key "$WAQIF_PK"
send "$EETH"  "accrueBps(uint256)" 3000 --private-key "$WAQIF_PK"
echo "   NAV                      $(r 'totalNavIDRX()(uint256)')"
echo "   solvency (bps)           $(r 'solvencyRatioBps()(uint256)')"

echo
echo "-- 3. harvest from a NON-owner wallet"
NAZ_BEFORE=$(bal "$NAZIR")
send "$VAULT" "harvest()" --private-key "$KEEPER_PK"
NAZ_AFTER=$(bal "$NAZIR")
NAV=$(r 'totalNavIDRX()(uint256)'); FLOOR=$(r 'harvestFloor()(uint256)')
[ "$NAZ_AFTER" -gt "$NAZ_BEFORE" ] || { echo "FAIL: nazir received nothing"; exit 1; }
[ "$NAV" -ge "$FLOOR" ] || { echo "FAIL: harvest dipped below floor ($NAV < $FLOOR)"; exit 1; }
echo "   nazir received          $((NAZ_AFTER - NAZ_BEFORE))"
echo "   keeper bounty            $(bal "$KEEPER")"
echo "   NAV >= floor after       OK  ($NAV >= $FLOOR)"

echo
if [ "$CHAIN" != "31337" ]; then
  # A live chain cannot warp, and the tenor is a real endowment term, so there is nothing to sit
  # through here. Assert the half that a live chain *can* prove: the vault refuses to release
  # principal early. That is the property the tenor exists for.
  echo "-- 4. tenor lock (live chain, cannot warp ${TENOR}s)"
  # `if` rather than `&&`, so `set -e` does not treat the expected revert as a script failure.
  if OUT=$(cast call "$VAULT" "requestUnstake(uint256)" "$POS" \
           --from "$WAQIF" --rpc-url "$RPC" 2>&1); then
    echo "FAIL: requestUnstake succeeded before the tenor elapsed"; exit 1
  fi
  case "$OUT" in
    *TenorNotElapsed*|*35d7d6b5*) ;;
    *) echo "FAIL: expected TenorNotElapsed, got: $OUT"; exit 1 ;;
  esac
  echo "   requestUnstake reverted  OK  (TenorNotElapsed)"
  echo
  echo "-- 5. skipped. Maturity and claim need anvil:"
  echo "     ./script/smoke.sh http://127.0.0.1:8545 <waqif-pk> <keeper-pk>"
  echo
  echo "=== all checks passed (steps 1-4)"
  exit 0
fi

echo "-- 4. wait out the tenor, then request unstake"
advance $((TENOR + 10))
send "$VAULT" "requestUnstake(uint256)" "$POS" --private-key "$WAQIF_PK"
echo "   reservedForClaims        $(r 'reservedForClaims()(uint256)')"

echo
echo "-- 5. wait out unbonding, then claim"
advance $((UNBONDING + 10))
BEFORE=$(bal "$WAQIF")
send "$VAULT" "claim(uint256)" "$POS" --private-key "$WAQIF_PK"
AFTER=$(bal "$WAQIF")
PAYOUT=$((AFTER - BEFORE))
[ "$PAYOUT" = "$AMT" ] || { echo "FAIL: principal not fully returned ($PAYOUT != $AMT)"; exit 1; }
echo "   payout                   $PAYOUT  (100% of principal)"
echo "   wqIDRX burned            $((MINTED - ($(wq "$WAQIF") - WQ_BEFORE)))  of $MINTED"
echo "   deficit                  $(r 'deficit()(uint256)')"

echo
echo "=== all checks passed"
