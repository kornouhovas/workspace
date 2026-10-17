# Issue 29: Exact scalar grouping

Baseline: `89e20e8b` (`new-workspace`). Execution, CI and acceptance: [GitHub #29](https://github.com/kornouhovas/workspace/issues/29).

## Contract

Each view owns an active nullable grouping property and separate settings for each scalar property. Switching grouping or returning to ungrouped retains the other settings. Duplicate copies settings independently. Name and Text use exact authored, case-sensitive values, including whitespace. Number uses the validated numeric result; Date uses canonical calendar dates. No ranges, calendar buckets or filesystem mutations are inferred.

The owner confirmed in this session: missing Text/Number/Date and zero-length Text use one No value group. Whitespace Text and Number zero are ordinary values. Name has no empty group. Empty sorts last in default/ascending/descending and can move anywhere manually. Default and ascending use numeric comparison for Number and deterministic lexical comparison for strings/canonical dates, independent of UI locale; descending reverses nonempty groups. Manual keys come first in saved order; newly discovered keys follow in ascending order. Keys encode exact scalar JSON values, distinguishing strings, numbers and null. Key validation preserves the existing Text value domain, including long values and JSON escape expansion; it adds no independent string-length limit.

Group candidates come from the unfiltered lifecycle projection (including retained projects on Active), plus the ordinary empty group. Filters select members, not groups. Thus a filter can leave an existing group empty, and hide-empty controls its presentation. A scalar group with no remaining value anywhere in that lifecycle disappears; saved settings for its key remain if it returns. Hidden and collapsed settings never change project values or the filter result IDs. Active and Archived share view settings but have separate candidate sets. Reads reject malformed configuration without rewriting it; an explicit replacement can repair it. Unsupported/unavailable property references fail visibly.

No bb module or dependency is copied. The owner explicitly authorized publication to the current public repository for this issue despite the private-source policy.

## Scenarios and agreed seams

The issue defines the public seams: typed Workspace service using disposable real SQLite/filesystem, production IPC, and EN/RU keyboard UI in both layouts.

- Exact Name/Text/Number/Date membership, case, whitespace, zero, empty and calendar dates; edits refresh membership.
- Numeric/date ordering, empty-last, stable manual order and new values.
- Hidden/collapsed/hide-empty groups independent of filters and values.
- Per-view/per-workspace ownership, grouping changes, duplication, layout and restart.
- Strict payload/type/key validation, unavailable references, corrupt storage, failed transactional save and explicit repair.
- Migration 0020 preserves populated views, filters, selection and values; package/build inventories agree.
- Both layouts consume the service projection; loading/error/retry, empty/hidden groups and keyboard controls remain accessible in both languages and narrow screens.
- Focused regressions, typecheck/lint/docs, visual inspection, independent Standards/Spec review, then one final full suite. CI and integration remain subject to their actual acceptance evidence.
