# @rosie/rewards

The shared **gamification** subsystem: stars, coin wallet, vouchers. Used by
admin/vouchers/today/math/english — it is NOT calc-specific (despite some `useCalc*` names).

**Contents:** `StarHud`/`StarHudProvider`/`useStarHud`, `ColoredStar`, `StarBurst`,
`StarProgressBar`, `star-types`/`star-audio`, and the hooks `useStarEarning`, `useCalcWallet`
(coin wallet), `useVoucherCatalog`, `useCalcVouchers`.

**Depends on:** `@rosie/core` + npm. Never a subject module (the one calc coupling — `levelKey`
— was inlined to keep it independent).

**Tables:** `calc_sessions`, voucher/wallet tables. Barrel: `import { … } from '@rosie/rewards'`.

Personal draw pools power the home DrawCard and /setting/draw-pools. Pool mutations
use change_draw_pool, which serializes changes per account and pool. Accept with
the draw ticket, not the entry ID. Penalties track accepted rounds independently
of the wallet and voucher system.

The parent can mark reward entries tree_eligible in /setting/draw-pools. The life-tree blind box
reserves a separate tree_ticket under the same owner/reward pool lock as the home draw.
Both draws skip each other's reservation and acceptance consumes the shared entry.
