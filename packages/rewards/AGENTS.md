# @rosie/rewards

The shared **gamification** subsystem: stars, coin wallet, vouchers. Used by
admin/vouchers/today/math/english — it is NOT calc-specific (despite some `useCalc*` names).

**Contents:** `StarHud`/`StarHudProvider`/`useStarHud`, `ColoredStar`, `StarBurst`,
`StarProgressBar`, `star-types`/`star-audio`, and the hooks `useStarEarning`, `useCalcWallet`
(coin wallet), `useVoucherCatalog`, `useCalcVouchers`.

**Depends on:** `@rosie/core` + npm. Never a subject module (the one calc coupling — `levelKey`
— was inlined to keep it independent).

**Tables:** `calc_sessions`, voucher/wallet tables. Barrel: `import { … } from '@rosie/rewards'`.

Personal draw pools are shared by /draw, /setting/draw-pools and the life tree.
`/draw` embeds the user-approved lucky-wheel renderer under `apps/web/public/draw-wheel/`;
its React host owns authentication, LoadingOverlay, AppDialog confirmations and the
same-origin/source-checked message bridge. Credentials never enter the renderer.
This isolated route intentionally preserves the supplied demo's exact visual styling.

`drawWorkshop.ts` owns the per-user `draw_workshop` session store and authenticated
`/api/draw-wheel/workshop` reads/mutations. Persistent preferences, catalog metadata and
history live in Supabase. `change_draw_workshop` is service-only; web derives the owner.
Both pool rows are locked reward → penalty, then the profile; catalog triggers advance
its revision for tree and legacy edits too. Mutation UUID receipts prevent duplicate
draws on transport retries; the server selects by weight and returns a frozen wheel
for the animation. Stale edits fail and require a fresh read. Defaults seed only a new,
completely empty shared catalog; deliberately emptied lists stay empty.

Rewards and penalties are repeatable by default. noRepeatMode disables a selected item;
全亮 re-enables available items. History fulfilment changes only its stamp, never deletes
the catalog item. The latest 80 non-cleared results are shown, matching the supplied demo.
History snapshots survive rename/delete/reset; clearing archives history without erasing
operation receipts. Pending life-tree results can only be redeemed in the tree.

Enabled and available rewards automatically appear in the life-tree box wheel.
The tree freezes the candidate wheel and reserves its result using the shared reward pool lock and weights. Reservation prevents
workshop drawing/editing/deletion/reset. noRepeatMode disables the selected tree reward
at reservation; acceptance releases tree_ticket, retains the entry and stamps history.
The legacy change_draw_pool signature and GET /api/draw-wheel remain compatible; old
pending tickets are migrated into history and accepting them no longer deletes entries.

Migration `20261114122234_draw_wheel_workshop` is applied to the hosted database.
See `docs/draw-wheel.md` for the manual acceptance cases. Do not run build/tests without a user request. Required task migrations are
automatically executed under the user’s standing authorization in root AGENTS.md.
