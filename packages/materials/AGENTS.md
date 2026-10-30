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
