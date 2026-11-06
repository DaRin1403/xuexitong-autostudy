# OCS font decoder provenance

Upstream: https://github.com/ocsjs/ocsjs

Pinned commit: `06c2af62d2708f5042b913caf4a3cabb251e66a9` (5.0 branch).

The TypeScript files in this directory are copied unchanged from `packages/scripts/src/utils/font-decrypt/`. The source files and LICENSE were obtained from the pinned GitHub revision. `bitmap.ts`, `worker.ts` and `ref-table.ts` are bundled into the userscript after stripping TypeScript declarations and module imports/exports. The upstream MIT license is included in the resulting userscript.

Reference table: https://cdn.ocsjs.com/resources/font/font_ref_cx.bin

Downloaded 2026-11-06; SHA256: `ccd62711c2b401b8c851c28fd51b9903f14fb9d10ee6bae2c043eb51cf05ec4f`.

FRB2 format, 7027 candidates, threshold 30, coarse grid 16, fine grid 24. The adapter embeds this binary as base64 and seeds the upstream memory cache, so no external runtime download is required. The upstream feature matching and worker fallback code are preserved.

Adapter: `src/font-decoder.js`. It caches each document's mapping separately, waits before extracting questions, processes new characters incrementally, preserves input nodes/listeners, reports confidence margins, and keeps encrypted markers on errors. Its text application uses upstream `decryptText` with deduplicated text nodes to avoid decoding nested regions twice.

Rebuild with Node.js 24 or newer: `node tools/build-font-decoder.cjs`.
