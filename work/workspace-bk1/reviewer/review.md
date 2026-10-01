# Independent review workspace-bk1

Verdict: **принято в объёме workspace-bk1**. Frozen code matches the reviewed diff, no actionable finding in this bugfix. Runtime resize/scroll/split gates completed after explicit user authorization for scoped CDP/Playwright input. A scoped local commit may follow; reviewer made no commit.

Reviewed checkout: `codex/workspace-jqv-live-bb-visual`, HEAD `69595cb84f6eefbfe3829f48a3b4c1c83fa066c9`. Exact frozen diff `task.diff` equals `git diff -- src/styles.css src/components/workspace/project-detail-panel.tsx test/dashboardStructure.test.js`. Hashes and all 12 native shot dimensions/digests are in `state.json`. No product/Beads edits performed; only reviewer artifacts. Foreign dirty files and runtime PID87347 were preserved.

## Criteria and evidence

| Criterion | Independent result |
| --- | --- |
| Root strip cause established | Confirmed. Before project geometry: viewport1440, html1429, body/shell1418; html/body stable gutter, scrollHeight960=viewport960. Two unused11px reservations. Initial1358 viewport measurements independently show the same22px loss. |
| Strip removed by cause, necessary scroll hosts retained | Confirmed static/runtime. Only two root scrollbar-gutter declarations removed. Current readonly geometry: html/body/root/shell1440, scrollHeight960; Board auto overflow780x3406 in517x873 client; project auto overflow1520px in912px client. No global scrollbar hiding introduced. Actual scroll input subsequently verified as recorded below. |
| Adaptive, aligned borderless details | Confirmed in preview352px/560px snapshots and code. Shared12px top,24–32px inline,24px bottom container-relative padding; visible/hidden/Add property shared96–160px label columns. Add property wraps at352, Notes wraps and file names truncate inside host. No new grid borders. Dynamic width and narrow/wide split coverage subsequently verified as recorded below. |
| Table/Board/open project Light/Dark1440×960 and1024×720 | Twelve matching PNG dimensions plus exact fixture PID/CG logs validated. Representative Table/Board images and all four project images inspected visually. Before dark Table1024 and project1440 inspected; edge strip visible. These prove static preview states, not split/expanded interaction. |
| Actual resize/scroll/split | Verified after scoped authorization; offsets, widths and split geometry below. |
| Reproducible evidence | Executor report and scripts define isolated source/metadata/runtime9266/9267, scenario surfaces, helper exact-PID native capture and invalid miniature rejection. Readonly current measurement reproduced. Supplementary table-scrolled filename is not accepted as scroll proof. |
| Programs and diff | Executor completed evidence read:34/34 profile tests, typecheck, renderer build; full npm291/292 with same pre-existing ViewFilter regex failure reproduced in before/node-baseline.txt and after dashboard-structure.txt. Inset assertion update is task-scoped; no unrelated assertion changed. Independent git diff --check completed exit0. Full suite is not green. |
| Independent acceptance/local commit | Independent acceptance complete for the frozen diff. Coordinator owns the subsequent scoped local commit; none made by reviewer. |

## Bounded CUA attempt

Fresh `cua.getApp("/tmp/Workspace-bk1.app")` selected the fixture and exposed Board/Operations/stress data from this checkout dist URL. Native AX click36 opened Project Alpha; AX showed splitter560, Properties, Hidden properties,42 file items. CUA screenshot then returned tilted Stage Manager miniature320×328. Exact-PID native capture returned CG160×162 and pixels160×162 although renderer remained1440×960 (`current-measure.json`, `current-native.png`); that capture is invalid acceptance evidence.

AX splitter328 `setValue("360")` failed with -10005 (not settable). A fresh AX splitter click plus Left focused Notes editor instead of the splitter; width stayed560 and no text was typed. Coordinates/focus are therefore unreliable. No CDP/Playwright UI input was used. Input stopped after these bounded attempts; readonly review continued.

Remaining required gates: actual right-panel resize to narrow/wide bounds, verify aligned Properties/Hidden/File tree and unclipped Add property at those widths; Table and Board horizontal+vertical scroll with measured offset changes and bottom/far-column access; Project Detail bottom reach; create/restore/resize split and inspect narrow/wide project hosts. Existing screenshots and reducer tests do not prove these.

The CUA failure above is a historical intermediate blocker. User later explicitly authorized CDP/Playwright input only isolated PID5166/CDP9266 for these gates. Input remained scoped to that fixture. No miniature capture was accepted.

## Completed scoped runtime acceptance

- `runtime-gates.json`: Home/End set preview280/1120, ArrowRight296, pointer drag296→496. Insets24/32/24px, matching visible/hidden/Add grids, borderless layout. At280 content269=scrollWidth269 and full Add property221px action wraps to48px height. At1120 content1108=scrollWidth1108. Last read after verification confirmed all frozen file hashes unchanged and exact task.diff equality; git diff --check exit0.
- Detail wheel reached last-file bottom: scrollTop608 equals1520−912.
- Board wheel reached both ends: scrollLeft199 equals780−581, scrollTop2533 equals3406−873.
- `table-scroll.json`: nested shadcn table scroll wrapper retains horizontal scrolling: left183 equals668−485. Outer Table host retains vertical scrolling: top431.5 at1331/899 dimensions (fractional CSS pixels). Initial simultaneous wheel had moved the nested host; the first probe incorrectly waited for horizontal movement of the outer host. No product bug inferred from that probe timeout.
- Expanded Alpha opened through existing maximize action. Split created by Ctrl+pointer drag of retained project tab to the right pane edge; modifier avoids the Radix tab mouse-down selection expanding before drop. `split-initial.json` records Workspace+Alpha leaves. Split keyboard resize50→70→50 confirmed.
- `split-supported.json`: after hiding retained Navigation600, split Alpha is351.5px at1024×720 and559.5px at1440×960. Content341=sw341 and549=sw549 respectively, inset12/24/24, matching four property grids and complete Add property293/501px without clipping. `split-renderer-1440.png` visually inspected as renderer evidence only, not native capture. Earlier native12shot matrix validates the same component/theme/viewport surfaces. No additional native split claim.

Known limit outside this bugfix: retaining Navigation600 plus a70% split compresses Alpha to155px at1440 and31px at1024. Horizontal content overflow appears below the working preview minimum280. This limit already follows baseline grid minimum136px +8px gap +40px padding + scrollbar (greater than155px); baseline cannot fit that geometry either. New24px inset increases the content budget there. This review does not claim arbitrary tiny split hosts have unclipped layout. Working split259px (Navigation visible at50%),351px/559px and preview280–1120 were verified. No new split constraint or responsive subsystem is part of the authorized gutter/inset fix.

Program limitation remains explicit: npm291/292, pre-existing ViewFilter source-regex failure; relevant34, typecheck and renderer build are completed in executor evidence. Acceptance is for scoped task criteria and observed runtime, not a claim that the repository full suite is green.
