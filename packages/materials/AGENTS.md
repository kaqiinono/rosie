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
  Text/link are implemented; provider scanning/uploads/file proxy are follow-up Tasks8/9, not client credentials.
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
