# @rosie/materials

Shared authenticated asset catalog and user-private many-to-many course links. Depends only on core;
never import tasks or subject packages. The application injects pickers and narrow catalog projections.

- `MaterialScope` is structural, stable keys only: all/unit/lessons/segments/problems; the problem variant is
  `problems` with `problem_keys` containing complete lesson:group:real-ID identities.
- `useMaterialData` uses the per-user `shared-materials` session store and patches successful mutations.
  Asset reads are shared; links are owner-only. New selections exclude archived/non-ready assets.
- RPCs own writes. Asset creation is authenticated; metadata/archive maintenance is creator or app_metadata
  admin only. Content replacement creates a new asset; no hard-delete interface. Never publish private recordings.
- Existing references may read archived assets. Removing a link never deletes an asset/provider file.
- Preview/download access is authenticated through application `/api/materials/[id]/access` and no-store.
  Text/link and application-owned provider scanning/uploads/file proxy are implemented. Never expose client credentials.
- Use theme utilities, labeled native controls, local validation, explicit loading/error/empty states.
  Native select geometry is OS-owned. Search/filter/paging are transient inspection state, not persistent data.

- Forecast `readyData` awaits the latest actual read across consumers and rejects refresh errors,
  even when the session store deliberately keeps ready display data. Do not use display status alone.
- Once/weekly tasks resolve explicit/none selectors with a null course through the same canonical
  resolver. Generators explicitly snapshot effective selectors on intentional revision; triggers
  must not rebase that policy from unrelated binding or progress changes.

- DirectoryImport consumes application-owned course projections and never imports tasks. Suggestions
  are advisory and start unselected; explicit confirmation calls Task7's atomic material_link_course.
- Scan state lives server-side, not localStorage. Keep the scan number to resume after a reload.
  Partial enumeration never archives absent assets or removes links. Provider offset listing has no
  snapshot guarantee, so even completed enumeration cannot prove absence under concurrent moves.

- Result transport is separate from scan enumeration: at most100 entries/120KiB page data,128KiB
  full recovery envelope. GET offset pages require a matching revision; no state/queue is browser data.
  Preserve reviewed exact file identities across pages/recovery; filename aliases require a complete
  normalized stem so hyphenated subquestions never match their parent alias.

- Uploads use Worker complete ordered MD5 before init, raw4MiB parts/max2 lanes. Server-only durable
  session RPC uses Task8 credential-row serialization; uncertain prepare/create verifies only, with
  explicit cancel/restart if absent. Never repeat an unknown merge or publish before verification.
- File preview/download uses scoped HttpOnly material session then authenticated streaming content;
  passive MIME allowlist, all other content attachment. No blob-buffered large downloads, provider
  credentials/redirects or SW cache. Upload completion refreshes the existing shared-materials store.

## 课程/任务池/共享物料与容量交付（2026-10-30）

本分支本地实现，远程迁移、Cron、百度真实写入与部署尚未执行。上线、映射统计、停用和恢复清单见 `docs/task-module-rollout.md`，物料权限与传输见 `docs/baidu-materials.md`。任务不回写原学科进度或 `/today`；tasks 仅依赖 core/player，materials 仅依赖 core，应用层桥接目录/物料。旧个人材料和录音不会自动共享。

最终本地验收使用 `node scripts/tmp/task15-acceptance-validation.mjs`（25个相关迁移、全部SQL fixtures、真实MVCC快照与canonical builder/solver发布/采用/恢复）；`--intentional-failure` 清理后应退出1。该临时工具使用独立本机 PostgreSQL，不读 env。`--serve` 提供127.0.0.1:3915的合成身份测试adapter，只供本地验收，不是生产Auth/API。运行时状态须区分未配置、过期与已配置但未证实送达。严禁依据本地测试宣称托管Cron已启用。

## Passive scan metadata repair (2026-10-30)

Forward migration `20261030130524_materials_passive_scan_metadata.sql` normalizes trusted provider
path extensions for MP3/M4A/WAV/OGG, JPEG/PNG/GIF/WebP/AVIF, MP4/WebM/OGV and PDF. Service scan MIME,
SQL publication kind/MIME, native preview and passive delivery agree. SVG/HTML and unknown formats
remain generic attachments; provider/client MIME claims do not broaden the allowlist.
Existing generic Baidu assets are repaired only when a saved scan entry proves account/fs_id/path
provenance. No asset IDs, versions, paths, fs_ids, links, task snapshots or progress are replaced.
The repair is idempotent; uploads and non-generic metadata are excluded. Run only through the normal
reviewed migration rollout; no hosted migration was executed in local acceptance. The full local
harness now installs25 related migrations; its final integration fixture checks typed publication,
account-switch epoch invalidation and fresh stored results, plus archived reference readability.
