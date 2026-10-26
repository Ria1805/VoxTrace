import argparse, csv, json, os, sys, time
from pathlib import Path
 
import numpy as np
from joblib import Parallel, delayed
from sklearn.metrics import roc_curve
 
from voxtrace.audio_detector import AudioDetector, extract_features, load_audio, SR
from voxtrace.attacks import telephony_bandlimit
from voxtrace.evaluate import report
 
 
def feat_clean(path):
    try:
        return extract_features(load_audio(path))
    except Exception:
        return None
 
 
def feat_phone(path):
    try:
        return extract_features(telephony_bandlimit(load_audio(path), SR))
    except Exception:
        return None
 
 
def extract_all(paths, fn, jobs, what):
    print(f"[train] extracting {what} features for {len(paths)} clips (jobs={jobs}) ...", flush=True)
    t0 = time.time()
    out = Parallel(n_jobs=jobs, verbose=5)(delayed(fn)(p) for p in paths)
    print(f"[train] done in {(time.time() - t0) / 60:.1f} min", flush=True)
    return out
 
 
def equal_error_rate(y, scores):
    fpr, tpr, _ = roc_curve(y, scores)
    fnr = 1 - tpr
    i = int(np.nanargmin(np.abs(fnr - fpr)))
    return float((fpr[i] + fnr[i]) / 2)
 
 
def stack(feats, dim=None):
    dim = dim or next(f.shape[0] for f in feats if f is not None)
    return np.stack([f if f is not None else np.zeros(dim) for f in feats])
 
 
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="data/itw/release_in_the_wild")
    ap.add_argument("--out", default="models/audio.joblib")
    ap.add_argument("--test-frac", type=float, default=0.3, help="fraction of SPEAKERS held out")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--limit", type=int, default=0, help="use only N random clips (quick trial)")
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    ap.add_argument("--cache", default="models/audio_features_cache.npz")
    ap.add_argument("--phone-aug", action="store_true",
                    help="also train on band-limited (phone-like) copies of the training clips")
    args = ap.parse_args()
 
    data_dir = Path(args.data_dir)
    meta_path = data_dir / "meta.csv"
    if not meta_path.exists():
        sys.exit(f"Cannot find {meta_path}. Run this from the voxtrace/ folder, or pass --data-dir.")
 
    rows = []
    with open(meta_path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            lab = r["label"].strip().lower()
            if lab not in ("spoof", "bona-fide"):
                sys.exit(f"Unexpected label {lab!r} in meta.csv")
            p = data_dir / r["file"]
            if p.exists():
                rows.append((r["file"], r["speaker"].strip(), int(lab == "spoof"), str(p)))
    print(f"[train] {len(rows)} clips found on disk")
 
    if args.limit:
        rng0 = np.random.default_rng(args.seed)
        idx = rng0.choice(len(rows), size=min(args.limit, len(rows)), replace=False)
        rows = [rows[i] for i in sorted(idx)]
        args.cache = args.cache.replace(".npz", f"_limit{args.limit}.npz")
 
    stem = ("audio_trial" if args.limit else "audio") + ("_phoneaug" if args.phone_aug else "")
    if args.out == "models/audio.joblib":          # default: pick a name that never overwrites another run
        args.out = f"models/{stem}.joblib"
    files = np.array([r[0] for r in rows]); spk = np.array([r[1] for r in rows])
    y = np.array([r[2] for r in rows]); paths = [r[3] for r in rows]
 
    speakers = np.array(sorted(set(spk)))
    np.random.default_rng(args.seed).shuffle(speakers)
    test_spk = sorted(speakers[:max(1, int(round(len(speakers) * args.test_frac)))])
    is_test = np.isin(spk, test_spk)
    for name, m in (("train", ~is_test), ("test", is_test)):
        print(f"[train] {name}: {int(m.sum())} clips, {len(set(spk[m]))} speakers, "
              f"{int(y[m].sum())} fake / {int((1 - y[m]).sum())} real")
    if len(set(y[~is_test])) < 2 or len(set(y[is_test])) < 2:
        sys.exit("Train or test split has only one class. Try another --seed, or a larger --limit.")
 
    os.makedirs("models", exist_ok=True)
    cache, X, ok = Path(args.cache), None, None
    if cache.exists():
        z = np.load(cache, allow_pickle=True)
        if list(z["paths"]) == paths:
            X, ok = z["X"], z["ok"]
            print(f"[train] loaded cached features from {cache}")
    if X is None:
        feats = extract_all(paths, feat_clean, args.jobs, "clean")
        ok = np.array([f is not None for f in feats]); X = stack(feats)
        np.savez(cache, paths=np.array(paths, dtype=object), X=X, ok=ok)
    if (~ok).any():
        print(f"[train] WARNING: {int((~ok).sum())} unreadable clips skipped")
 
    tr, te = (~is_test) & ok, is_test & ok
 
    # phone-quality features: needed for the test set always, and for training with --phone-aug
    pcache, Xp, okp_all = Path(args.cache.replace(".npz", "_phone.npz")), None, None
    if pcache.exists():
        z = np.load(pcache, allow_pickle=True)
        if list(z["paths"]) == paths:
            Xp, okp_all = z["X"], z["ok"]
            print(f"[train] loaded cached phone features from {pcache}")
    if Xp is None:
        need = np.where(ok if args.phone_aug else te)[0]
        fp_ = extract_all([paths[i] for i in need], feat_phone, args.jobs, "phone band-limited")
        Xp = np.zeros_like(X); okp_all = np.zeros(len(paths), dtype=bool)
        for i, f in zip(need, fp_):
            if f is not None:
                Xp[i] = f; okp_all[i] = True
        if args.phone_aug:   # only cache when complete, so a later run never mixes partial caches
            np.savez(pcache, paths=np.array(paths, dtype=object), X=Xp, ok=okp_all)
 
    det = AudioDetector()
    if args.phone_aug:
        trp = tr & okp_all
        det.model.fit(np.vstack([X[tr], Xp[trp]]), np.concatenate([y[tr], y[trp]]))
        print(f"[train] training on {int(tr.sum())} clean + {int(trp.sum())} phone-quality clips")
    else:
        det.model.fit(X[tr], y[tr])
    det.trained = True
    det.save(args.out)
    print(f"[train] saved model -> {args.out}")
 
    s_clean = det.model.predict_proba(X[te])[:, 1]
    res = {"n_train": int(tr.sum()), "n_test": int(te.sum()), "train_speakers": len(set(spk[tr])),
           "test_speakers": [str(s) for s in test_spk], "seed": args.seed, "phone_aug": bool(args.phone_aug), "clean": report(y[te], s_clean)}
    res["clean"]["eer"] = equal_error_rate(y[te], s_clean)
 
    te_idx = np.where(te)[0]
    okp = okp_all[te_idx]
    s_phone = np.full(len(te_idx), np.nan)
    s_phone[okp] = det.model.predict_proba(Xp[te_idx][okp])[:, 1]
    res["phone_band_limited"] = report(y[te][okp], s_phone[okp])
    res["phone_band_limited"]["eer"] = equal_error_rate(y[te][okp], s_phone[okp])
 
    with open(f"models/{stem}_test_scores.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["file", "speaker", "y_true", "score_clean", "score_phone"])
        for k, i in enumerate(te_idx):
            w.writerow([files[i], spk[i], int(y[i]), f"{s_clean[k]:.6f}", f"{s_phone[k]:.6f}"])
    with open(f"models/{stem}_eval.json", "w") as f:
        json.dump(res, f, indent=2, default=float)
 
    def row(name, r):
        print(f"  {name:<20} acc={r['accuracy']:.3f} prec={r['precision']:.3f} rec={r['recall']:.3f} "
              f"f1={r['f1']:.3f} auc={r['roc_auc']:.3f} eer={r['eer']:.3f}")
    print("\n[train] HELD-OUT SPEAKERS (never seen in training):")
    row("clean audio", res["clean"]); row("phone band-limited", res["phone_band_limited"])
    print(f"\n[train] wrote models/{stem}_eval.json and models/{stem}_test_scores.csv")
 
 
if __name__ == "__main__":
    main()
