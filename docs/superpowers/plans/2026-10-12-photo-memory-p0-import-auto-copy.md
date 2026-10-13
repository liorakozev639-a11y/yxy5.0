# Photo Memory P0 Import and Auto-Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver reliable single and batch photo import, persisted title and mood, user-authorized topic-based long-term-copy auto-collection, and synchronized PRD/technical Word documents.

**Architecture:** PostgreSQL stores memory fields and durable per-topic/per-copy policy; NestJS is the single source of truth for validation and long-term-copy links. React handles the authorization dialogs and a sequential, partially successful upload queue while reusing the existing media and memory endpoints.

**Tech Stack:** React, TypeScript, Vite, Vitest, NestJS, Prisma, PostgreSQL 18, native file inputs, existing EXIF parser, python-docx/document rendering tools.

**Spec:** `docs/superpowers/specs/2026-10-12-photo-memory-p0-import-auto-copy-design.md`

## Global Constraints

- Keep all project code and generated documents under `D:\yxy5.0`; do not copy the project to C drive.
- Keep one photo per memory and allow duplicate photo imports.
- EXIF capture time takes precedence; current import time is the fallback.
- Title, note, mood, statuses, and topics are all optional; no pending-memory state or badge exists.
- “无” never creates or prompts for a long-term copy.
- One user/topic pair has at most one long-term copy.
- Batch import uses existing per-file endpoints; a failed item must not roll back successful items.
- Existing PostgreSQL data must survive migration with empty-string defaults for title and mood.
- The directory is not a Git repository; replace commit steps with explicit test checkpoints and do not initialize Git without user authorization.

## Review Focus

- A custom topic created while editing must be selected immediately even when the create request resolves asynchronously.
- Editing a memory from topic A to topic B must remove the A-copy link and add the eligible B-copy link atomically.
- A batch whose topic-policy setup fails must not start uploading files; an individual file failure after setup must not stop later files.
- More than 50 memories must reload completely through cursor pagination without duplicates or an infinite loop.
- A paused/completed/archived or auto-disabled copy must not receive new memories until explicitly re-enabled and active.

---

### Task 1: Database schema and migration

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/0002_memory_fields_and_copy_policy/migration.sql`
- Modify: `server/prisma/seed.ts`
- Test: `server/test/memories.service.spec.ts`
- Test: `server/test/long-term-copies.service.spec.ts`

**Interfaces:**
- Produces: `Memory.title: string`, `Memory.mood: string`, `Topic.suppressLongTermPrompt: boolean`, `LongTermCopy.autoCollectEnabled: boolean`.
- Produces: unique database constraint for `(LongTermCopy.userId, LongTermCopy.topicId)`.

- [ ] **Step 1: Add failing service expectations for the new persisted fields**

Add assertions that created memory data contains `title` and `mood`, topic views contain `suppressLongTermPrompt`, and copy views contain `autoCollectEnabled`; remove assertions that depend on `isPending`.

- [ ] **Step 2: Run the focused server tests and verify failure**

Run: `npm --prefix server test -- run test/memories.service.spec.ts test/long-term-copies.service.spec.ts`  
Expected: FAIL because the new fields and rules do not exist.

- [ ] **Step 3: Update Prisma schema and add migration 0002**

Add the four new fields, remove `Memory.isPending`, and add `@@unique([userId, topicId])` to `LongTermCopy`. Migration must use defaults before enforcing non-null values so existing rows remain readable.

- [ ] **Step 4: Regenerate and validate Prisma**

Run: `npx prisma validate` and `npx prisma generate` from `server`.  
Expected: both exit 0.

- [ ] **Step 5: Record checkpoint**

Confirm the migration only changes the intended columns/index and leaves media, notes, statuses, topics, and copy links intact.

### Task 2: Backend topic and long-term-copy policy APIs

**Files:**
- Modify: `server/src/topics/topics.service.ts`
- Modify: `server/src/topics/topics.controller.ts`
- Modify: `server/src/long-term-copies/long-term-copies.service.ts`
- Modify: `server/src/long-term-copies/long-term-copies.controller.ts`
- Modify: `server/test/topics.service.spec.ts`
- Modify: `server/test/long-term-copies.service.spec.ts`

**Interfaces:**
- Consumes: Prisma fields from Task 1.
- Produces: `TopicsService.update(userId, id, input)` supports `suppressLongTermPrompt`.
- Produces: `LongTermCopyInput.autoCollectEnabled?: boolean` on create/update.
- Produces: duplicate topic-copy creation returns HTTP conflict rather than a second copy.

- [ ] **Step 1: Write failing policy tests**

Add tests named `updates_topic_prompt_suppression`, `creates_copy_with_auto_collect_default_true`, `allows_auto_collect_to_be_disabled`, and `rejects_duplicate_topic_copy` with exact boolean and conflict assertions.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm --prefix server test -- run test/topics.service.spec.ts test/long-term-copies.service.spec.ts`  
Expected: FAIL on missing policy behavior.

- [ ] **Step 3: Implement topic suppression persistence**

Keep `TopicInput` compatible with `name`, `color`, `icon`, `isNone`, and `suppressLongTermPrompt`; expose PATCH without allowing cross-user updates.

- [ ] **Step 4: Implement copy auto-collect and uniqueness validation**

Create defaults to true, update accepts explicit false, and create checks the user/topic pair before inserting. Use `ConflictException` for duplicates.

- [ ] **Step 5: Run focused tests**

Run: `npm --prefix server test -- run test/topics.service.spec.ts test/long-term-copies.service.spec.ts`  
Expected: PASS.

### Task 3: Backend memory persistence, search, and link synchronization

**Files:**
- Modify: `server/src/memories/memories.service.ts`
- Modify: `server/src/memories/memories.controller.ts`
- Modify: `server/test/memories.service.spec.ts`
- Modify: `server/test/memories.e2e.spec.ts`

**Interfaces:**
- Consumes: `MemoryInput { mediaId, title?, note?, mood?, eventAt?, timezone?, statuses?, topics? }`.
- Produces: `MemoryView` with `title`, `mood`, topic IDs/objects, and no `isPending`.
- Produces: private transactional link synchronization based on current topic IDs, `ACTIVE`, and `autoCollectEnabled === true`.

- [ ] **Step 1: Write failing memory regression tests**

Cover title/mood round-trip, only-active-and-enabled linking, removal of stale links on edit, multi-topic linking, empty optional fields, and keyword search over title/mood/status/topic.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm --prefix server test -- run test/memories.service.spec.ts test/memories.e2e.spec.ts`  
Expected: FAIL on title/mood and policy-aware synchronization.

- [ ] **Step 3: Implement create mapping and automatic links**

Normalize title, note, mood, statuses, and topics; create links only for matching active auto-enabled copies inside the memory transaction.

- [ ] **Step 4: Implement atomic update synchronization**

Validate event time, replace topics, delete copy links whose copy topic is no longer selected, and create missing eligible links with `skipDuplicates` in one transaction.

- [ ] **Step 5: Expand list search and response mapping**

Add title and mood string filters plus status/topic filters; include title and mood in every memory view.

- [ ] **Step 6: Run focused and complete server tests**

Run: `npm --prefix server test -- run`  
Expected: all server tests pass.

### Task 4: Frontend domain models, repositories, pagination, and policy calculation

**Files:**
- Modify: `src/domain/memory.ts`
- Modify: `src/domain/topic.ts`
- Modify: `src/repositories/api-memory-repository.ts`
- Modify: `src/repositories/api-topic-repository.ts`
- Modify: `src/repositories/api-long-term-copy-repository.ts`
- Create: `src/domain/long-term-copy-policy.ts`
- Create: `src/domain/long-term-copy-policy.test.ts`
- Modify: `src/repositories/api-memory-repository.test.ts`
- Modify: `src/repositories/api-long-term-copy-repository.test.ts`

**Interfaces:**
- Produces: `Topic.suppressLongTermPrompt?: boolean`.
- Produces: `LongTermCopy.autoCollectEnabled: boolean`.
- Produces: `ApiTopicRepository.update(id, input)`.
- Produces: `ApiMemoryRepository.getAll()` follows `nextCursor` until absent.
- Produces: `findCopyDecisionCandidates(topicIds, topics, copies): CopyDecisionCandidate[]`.

- [ ] **Step 1: Write failing repository and policy tests**

Assert title/mood request mapping, topic-based search data, two-page pagination without duplicates, and decision filtering for none/suppressed/active-enabled/disabled/missing-copy cases.

- [ ] **Step 2: Run focused frontend tests and verify failure**

Run: `npm test -- --run src/repositories/api-memory-repository.test.ts src/repositories/api-long-term-copy-repository.test.ts src/domain/long-term-copy-policy.test.ts`  
Expected: FAIL on missing fields, pagination, and policy utility.

- [ ] **Step 3: Implement types and repository mappings**

Send and map title/mood directly; stop folding mood into statuses; add topic update and copy flag support.

- [ ] **Step 4: Implement safe cursor pagination**

Continue while `nextCursor` is present, track seen cursors to prevent an infinite loop, and concatenate pages in server order.

- [ ] **Step 5: Implement pure policy calculation**

Return candidates only for selected non-none, non-suppressed topics that lack an active auto-enabled copy; include the existing copy when one exists.

- [ ] **Step 6: Run focused tests**

Run the command from Step 2.  
Expected: PASS.

### Task 5: Single-memory topic creation and authorization dialog

**Files:**
- Modify: `src/components/MemoryForm.tsx`
- Create: `src/components/LongTermCopyDecisionDialog.tsx`
- Create: `src/components/LongTermCopyDecisionDialog.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `findCopyDecisionCandidates` from Task 4.
- Produces: `MemoryForm.onAddTopic(value): Promise<Topic>` and immediately selects the returned ID.
- Produces: `CopyDecisionResult[]` with action `enable | skip | suppress` for every candidate.

- [ ] **Step 1: Write failing component tests**

Test asynchronous custom-topic selection, one dialog containing multiple themes, all choices required before continue, and the `suppress` decision.

- [ ] **Step 2: Run component tests and verify failure**

Run: `npm test -- --run src/components/LongTermCopyDecisionDialog.test.tsx`  
Expected: FAIL because the dialog and async contract do not exist.

- [ ] **Step 3: Implement asynchronous topic creation in MemoryForm**

Disable the add button while creating, keep the input on failure, clear it on success, and append the returned topic ID to current selection.

- [ ] **Step 4: Implement the consolidated decision dialog**

Render each candidate once, distinguish missing copy from disabled/non-active copy, and include “以后不再询问此主题” as a per-topic choice.

- [ ] **Step 5: Integrate pre-save policy application in App**

Before `repository.put`, apply decisions: create a same-name active copy with start date equal to the memory event date; update an existing copy to active/auto-enabled; or update topic suppression. Refresh topics/copies after policy changes, then save the memory.

- [ ] **Step 6: Run component and repository tests**

Run: `npm test -- --run`  
Expected: all current frontend tests pass at this checkpoint.

### Task 6: Batch import queue and UI

**Files:**
- Create: `src/domain/batch-import.ts`
- Create: `src/domain/batch-import.test.ts`
- Create: `src/components/BatchImportDialog.tsx`
- Create: `src/components/BatchImportDialog.test.tsx`
- Modify: `src/components/MemoryForm.tsx`
- Modify: `src/App.tsx`
- Modify: `src/app-state.ts`
- Modify: `src/app-state.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `BatchImportItem { id, file, status, eventAt?, memory?, error? }`.
- Produces: `runBatchImport(items, topicId, saveOne, onItemChange): Promise<BatchImportItem[]>`.
- Produces: `AppAction { type: 'upsertedMany'; memories: Memory[] }`.

- [ ] **Step 1: Write failing queue tests**

Assert EXIF/fallback time is passed to each save, blank title/note/mood/statuses, optional shared topic, ordered progress events, continuation after one rejection, and retry only for failed items.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run src/domain/batch-import.test.ts src/components/BatchImportDialog.test.tsx src/app-state.test.ts`  
Expected: FAIL on missing batch flow.

- [ ] **Step 3: Implement pure sequential queue**

Keep file objects only in in-memory dialog state, update each item independently, and return successful memories plus failed items without throwing the entire batch.

- [ ] **Step 4: Implement batch dialog setup**

Ask whether to use one topic; when yes, allow existing topic selection or async creation. Resolve long-term-copy decisions once before starting uploads. For a batch-created copy, use the earliest resolved capture time as its start date.

- [ ] **Step 5: Implement progress, failure details, and retry**

Show total/success/failed/current counts, list failed filenames and messages, and call the queue only with failed items on retry.

- [ ] **Step 6: Integrate multiple file selection**

Use `multiple` on the new-memory file input. One selected file stays in the normal form; two or more files hand off to the batch dialog and do not create multiple forms.

- [ ] **Step 7: Update reducer for bulk success**

Add one sorted state update for all successful imports to avoid repeated UI churn.

- [ ] **Step 8: Run focused and complete frontend tests**

Run: `npm test -- --run`  
Expected: all frontend tests pass.

### Task 7: Remove pending behavior and complete display/search consistency

**Files:**
- Modify: `src/domain/memory.ts`
- Modify: `src/domain/memory.test.ts`
- Modify: `src/components/MemoryCard.tsx`
- Modify: `src/components/MemoryDetail.tsx`
- Modify: `src/components/LongTermCopyTimeline.tsx`
- Modify: `src/repositories/api-long-term-copy-repository.ts`
- Modify: `src/components/HomeView.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: title, mood, topic fields from Tasks 1–4.
- Produces: search across `title`, `note`, `mood`, `statuses`, and `topics[].name`.
- Produces: long-term timeline items with `title` and `mood`.

- [ ] **Step 1: Write failing search/display tests**

Add domain assertions for topic-name search and rendering assertions for title/mood; add a source scan assertion or test that no pending badge text is rendered.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run src/domain/memory.test.ts`  
Expected: FAIL on topic search or old pending behavior.

- [ ] **Step 3: Remove pending code and styles**

Delete `isPendingMemory`, `pending-badge`, `pending-inline`, and every API/type reference to `isPending`.

- [ ] **Step 4: Complete display and search mapping**

Render title and mood in cards/details/timelines and include topic names in client-side search.

- [ ] **Step 5: Run source scan and frontend tests**

Run: `rg "isPending|pending-badge|pending-inline|待补充" src server/src server/prisma`  
Expected: no product-code matches.  
Run: `npm test -- --run`  
Expected: PASS.

### Task 8: Update PRD and consolidated frontend/backend technical plan

**Files:**
- Modify: `tools/build_prd_v2.py`
- Modify: `tools/build_fullstack_plan.py`
- Regenerate: `docs/照片记忆本产品需求文档_PRD_V2.docx`
- Regenerate: `docs/照片记忆本产品需求文档_PRD_V2_a11y.json`
- Regenerate: `docs/照片记忆本前后端技术方案.docx`
- Regenerate: `docs/照片记忆本前后端技术方案_a11y.json`

**Interfaces:**
- Consumes: the confirmed spec and final implemented interfaces.
- Produces: Word documents describing only the current product behavior, with no pending-memory flow.

- [ ] **Step 1: Load and follow the documents skill**

Read the complete local `documents` skill before editing or generating `.docx` files.

- [ ] **Step 2: Update PRD source content**

Cover product positioning, target users, memory fields, single/batch import, topic authorization, copy auto-collection, business rules, P0 acceptance criteria, and future summary scope.

- [ ] **Step 3: Update consolidated technical-plan source content**

Cover React component boundaries, queue state, API contracts, NestJS services, Prisma migration, PostgreSQL rules, failures, tests, and local startup/migration commands.

- [ ] **Step 4: Generate DOCX and accessibility manifests**

Use the existing generator pattern and keep all outputs under `D:\yxy5.0\docs`.

- [ ] **Step 5: Render and visually inspect every DOCX**

Use `render_docx.py` from the documents workflow, inspect every generated page for clipping, overlaps, orphaned headings, broken tables, and unreadable text, then repair and rerender until clean.

### Task 9: Database application, full verification, and code review

**Files:**
- Review: all files under `src`, `server/src`, `server/prisma`, `server/test`, and changed `tools` scripts.
- Modify: `README.md` if startup or migration instructions are stale.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified application and explicit final risk report.

- [ ] **Step 1: Apply migration to the configured local PostgreSQL database**

Run from `server`: `npx prisma migrate deploy`.  
Expected: migration 0002 applied successfully on the configured `DATABASE_URL`.

- [ ] **Step 2: Run static schema and source checks**

Run: `npx prisma validate`, `npx prisma generate`, and the pending-code `rg` scan.  
Expected: exit 0 and no obsolete product-code matches.

- [ ] **Step 3: Run all automated tests**

Run: `npm test -- --run` and `npm --prefix server test -- run`.  
Expected: zero failed tests.

- [ ] **Step 4: Run production builds**

Run: `npm run build` and `npm --prefix server run build`.  
Expected: both exit 0.

- [ ] **Step 5: Run local API smoke tests**

Verify health, topic creation/update, copy creation/update, single memory create/edit/search, and timeline retrieval against PostgreSQL. Confirm title and mood persist after reread and topic removal removes the old timeline node.

- [ ] **Step 6: Review the whole project**

Inspect every source file for stale contracts, unhandled promise rejections, object URL leaks, invalid empty selections, duplicate React keys, pagination loops, and misleading UI copy. Fix only issues caused by or directly blocking this feature, with regression tests.

- [ ] **Step 7: Perform final independent code review**

Use the requesting-code-review workflow or an available reviewer, then verify every reported issue directly before changing code.

- [ ] **Step 8: Re-run the complete verification suite after review fixes**

Repeat Steps 2–5. Completion requires fresh passing output from the final code state.

