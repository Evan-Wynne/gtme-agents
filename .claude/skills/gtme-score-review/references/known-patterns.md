# Known failure patterns

Each one was found in a real review. Staffviser v1 (2026-10-19): 38 qualified, about 16 clean,
6 maybe, 16 no. After the v2 fixes on the same 325 job ads: 21 qualified, mostly clean.

| # | Pattern | How to spot it | Fix that worked |
|---|---|---|---|
| 1 | **Confounded question.** Jev answers from a nearby clue instead of the property asked. | Split the question's probabilities by a variable that shouldn't matter. On-site ads averaged 0.66 on "offshorable", remote ads 0.92; customer success roles passed only 1 to 3 of 15. | Say what to judge and what to ignore ("judge the tasks, ignore the office policy"): customer success → 14/15, executive assistants → 9/15. |
| 2 | **Paid lookups wasted on obvious misses.** | Lookups landing outside the target: 96 of 148. | Jev `large_enterprise` pre-screen (≥ 0.8 skips the lookup) and a lookup cache with a recheck period. |
| 3 | **Required trait never enforced.** The ICP says VC-backed; nothing checks it. | Law firms, CPA firms, a manufacturer and an HMO among the qualified. | Company-level Jev `startup_or_scaleup` (reject < 0.5) from the LinkedIn description and age; a real VC flag from a data source where available. |
| 4 | **Size band lags growth.** | LinkedIn member count above the company's own band (16 companies; one at 2,148 in a smaller band). | Use the member count when it's above the band. |
| 5 | **Public companies and subsidiaries pass.** | Company type "Public Company"; names that are a parent's division. | Reject public company types; Jev `part_of_larger_group` ≥ 0.7. |
| 6 | **Inflated multi-role bonus.** | The "2+ roles" bonus came from the same job in two cities or "future opening" posts (5 of 8). | Count distinct normalised titles, drop evergreen posts, dedupe company+title at scrape time. |
| 7 | **Score is mostly static points.** | 69% of points came from the role and industry tables, so the ranking mostly mirrored the role list. | Weight live signals more; show the score make-up in the review. |
| 8 | **Signals that never fire.** | The freelancer and outsourcing-exit signals never fired on 325 job ads. | Keep as a bonus; don't count on it. Find the signal in a better source. |
| 9 | **Missing data treated as a pass.** | No HQ on LinkedIn defaulted to the target country. | Unknown is its own value; store as `hold`. |
| 10 | **Exemption too wide.** | Agencies skipped the startup check, so tiny studios got through. | Narrow the exemption or add a minimum real headcount (members on LinkedIn). |
| 11 | **Good lead just under a threshold.** | A VC-backed fintech at `startup_p` 0.42 against a 0.5 bar. | Review the borderline band each run; consider a `hold` band instead of a hard reject. |
| 12 | **Jev guesses facts it can't see.** | Company size guessed from the job ad was wrong for several companies. | Never ask Jev for facts that a lookup can supply. Ask it about the text it's given. |
| 13 | **Stale test data left behind.** | Contacts pulled for companies that a later fix rejects. | List them after every re-run for Evan to clear. |

Patterns to check that haven't bitten yet: Choice first-option lean (re-run with options
reversed), a model alias moving between runs (compare `jev_model` on old and new rows), and
non-English ads scoring lower (Jev is best in English).
