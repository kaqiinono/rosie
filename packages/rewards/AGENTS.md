# @rosie/rewards

The shared **gamification** subsystem: stars, coin wallet, vouchers. Used by
admin/vouchers/today/math/english — it is NOT calc-specific (despite some `useCalc*` names).

**Contents:** `StarHud`/`StarHudProvider`/`useStarHud`, `ColoredStar`, `StarBurst`,
`StarProgressBar`, `star-types`/`star-audio`, and the hooks `useStarEarning`, `useCalcWallet`
(coin wallet), `useVoucherCatalog`, `useCalcVouchers`.

**Depends on:** `@rosie/core` + npm. Never a subject module (the one calc coupling — `levelKey`
— was inlined to keep it independent).

**Tables:** `calc_sessions`, voucher/wallet tables. Barrel: `import { … } from '@rosie/rewards'`.
