#!/usr/bin/env python3
"""Run a Jev question set over labelled test cases and report where it agrees.

Usage:
  jev_eval.py questions.json cases.jsonl [--model jev-1.13.0] [--swap]
              [--threshold offshorable=0.8 ...] [--out results.jsonl]

questions.json  The exact `questions` object the workflow sends: {question_id: question}.
cases.jsonl     One case per line: {"id": "...", "state": <string or object>,
                "expect": {"question_id": true | false | "option" | level_number}}.
                `expect` is optional; without it the script only prints the answers.
--swap          Ask every Choice question a second time with its options reversed and
                report answers that flip (Jev can lean towards the first option).
--threshold     Yes-threshold for a Noul (default 0.5). Repeat per question.

Reads TYPESAFE_API_KEY from the environment. Standard library only. Costs input tokens at
$0.042 per million (output is free), so 40 cases x 10 questions is a fraction of a cent.
"""
import argparse, json, os, ssl, sys, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor

API = "https://api.typesafe.ai/v1/systemone"
USD_PER_TOKEN = 0.042 / 1_000_000
BORDER = (0.3, 0.7)


def tls_context():
    # python.org builds on macOS ship without CA certificates; fall back to certifi or the system file
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    if os.path.exists("/etc/ssl/cert.pem"):
        return ssl.create_default_context(cafile="/etc/ssl/cert.pem")
    return ssl.create_default_context()


TLS = tls_context()


def call(body, key, tries=5):
    data = json.dumps(body).encode()
    for attempt in range(tries):
        req = urllib.request.Request(API, data=data, method="POST", headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=90, context=TLS) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 529) and attempt < tries - 1:
                time.sleep(2 ** attempt)
                continue
            raise SystemExit(f"HTTP {e.code} from Jev: {e.read().decode()[:500]}")


def reversed_choices(questions):
    out = {}
    for qid, q in questions.items():
        if q.get("type") == "choice" and isinstance(q.get("criteria"), dict):
            out[qid] = {**q, "criteria": dict(reversed(list(q["criteria"].items())))}
    return out


def verdict(q, ans, expected, thresholds, qid):
    """Return (got, ok, note) for one answer."""
    t = q["type"]
    if t == "noul":
        p = ans["noul"]
        got = p >= thresholds.get(qid, 0.5)
        note = f"p={p:.2f}" + (" borderline" if BORDER[0] <= p <= BORDER[1] else "")
    elif t == "choice":
        probs = sorted(ans["probabilities"].items(), key=lambda kv: -kv[1])
        got = ans["choice"]
        note = f"conf={ans['confidence']:.2f} " + ", ".join(f"{k}={v:.2f}" for k, v in probs[:2])
    elif t == "score":
        got = round(ans["score"])
        note = f"score={ans['score']:.2f} conf={ans['confidence']:.2f}"
    else:
        return None, None, f"unsupported type {t}"
    ok = None if expected is None else got == expected
    return got, ok, note


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("questions")
    ap.add_argument("cases")
    ap.add_argument("--model", default="jev-latest")
    ap.add_argument("--swap", action="store_true")
    ap.add_argument("--threshold", action="append", default=[])
    ap.add_argument("--out")
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()

    key = os.environ.get("TYPESAFE_API_KEY")
    if not key:
        sys.exit("TYPESAFE_API_KEY is not set")
    questions = json.load(open(a.questions))
    cases = [json.loads(l) for l in open(a.cases) if l.strip()]
    thresholds = {k: float(v) for k, v in (t.split("=", 1) for t in a.threshold)}
    swapped = reversed_choices(questions) if a.swap else {}

    def run(case):
        res = call({"model": a.model, "state": case["state"], "questions": questions}, key)
        if swapped:
            res["swapped"] = call({"model": a.model, "state": case["state"], "questions": swapped}, key)
        return case, res

    with ThreadPoolExecutor(a.workers) as pool:
        results = list(pool.map(run, cases))

    tokens, models = 0, set()
    stats = {qid: {"n": 0, "right": 0, "border": 0, "flips": 0, "misses": []} for qid in questions}
    out = open(a.out, "w") if a.out else None
    for case, res in results:
        models.add(res.get("model"))
        tokens += res["usage"]["input_tokens"] + res.get("swapped", {}).get("usage", {}).get("input_tokens", 0)
        row = {"id": case.get("id"), "model": res.get("model")}
        for qid, q in questions.items():
            ans = res["answers"][qid]
            expected = (case.get("expect") or {}).get(qid)
            got, ok, note = verdict(q, ans, expected, thresholds, qid)
            s = stats[qid]
            row[qid] = {"got": got, "expected": expected, "note": note}
            if "borderline" in note:
                s["border"] += 1
            if ok is not None:
                s["n"] += 1
                s["right"] += ok
                if not ok:
                    s["misses"].append(f"{case.get('id')}: got {got}, expected {expected} ({note})")
            if qid in swapped and res["swapped"]["answers"][qid]["choice"] != ans["choice"]:
                s["flips"] += 1
                s["misses"].append(f"{case.get('id')}: flips to {res['swapped']['answers'][qid]['choice']} when options are reversed")
        if out:
            out.write(json.dumps({**row, "raw": res}) + "\n")

    print(f"{len(cases)} cases · model {', '.join(sorted(m for m in models if m))} · "
          f"{tokens:,} input tokens · ${tokens * USD_PER_TOKEN:.5f}\n")
    print(f"{'question':32} {'agree':>9} {'border':>7} {'flips':>6}")
    for qid, s in stats.items():
        agree = f"{s['right']}/{s['n']}" if s["n"] else "-"
        flips = str(s["flips"]) if qid in swapped else "-"
        print(f"{qid:32} {agree:>9} {s['border']:>7} {flips:>6}")
    for qid, s in stats.items():
        if s["misses"]:
            print(f"\n{qid}:")
            for m in s["misses"]:
                print(f"  - {m}")


if __name__ == "__main__":
    main()
