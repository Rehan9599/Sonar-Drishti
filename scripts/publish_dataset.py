"""
Make rehan9599/drishti-sss a public, licence-clean CC-BY-SA-4.0 dataset.

  1. delete every crab_pot (cp_*) tile — gated source, filtered class
  2. squash history so the removed data is not retrievable from old commits
  3. push the rewritten dataset card
  4. flip the repo public

Run:  python scripts/publish_dataset.py            # does it
      python scripts/publish_dataset.py --dry-run  # just prints the plan
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from huggingface_hub import HfApi

RID = "rehan9599/drishti-sss"
CARD = Path(__file__).resolve().parents[1] / "docs" / "hf" / "dataset_card.md"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    api = HfApi()
    me = api.whoami()["name"]
    print(f"authenticated as: {me}")

    info = api.repo_info(RID, repo_type="dataset", files_metadata=True)
    print(f"repo: {RID}  private={info.private}  files={len(info.siblings)}")

    cp = [s.rfilename for s in info.siblings
          if s.rfilename.split("/")[-1].startswith("cp_")]
    print(f"crab_pot files to remove: {len(cp)}")
    for split in ("train", "val", "test"):
        n = sum(1 for f in cp if f.startswith(f"{split}/"))
        print(f"    {split}: {n}")

    if args.dry_run:
        print("\n[dry-run] would: delete crab_pot -> squash history -> "
              "push card -> set public")
        return

    # 1 · delete crab_pot tiles ------------------------------------------------
    patterns = [f"{s}/{k}/cp_*"
                for s in ("train", "val", "test")
                for k in ("images", "labels")]
    res = api.delete_files(
        repo_id=RID, repo_type="dataset", delete_patterns=patterns,
        commit_message="Remove crab_pot tiles (gated source, filtered class) "
                       "for public CC-BY-SA-4.0 release",
    )
    print(f"\n[1/4] deleted — {getattr(res, 'commit_url', res)}")

    # 2 · squash history ----------------------------------------------------------
    api.super_squash_history(
        repo_id=RID, repo_type="dataset",
        commit_message="DRISHTI side-scan sonar splits — public CC-BY-SA-4.0 release",
    )
    print("[2/4] history squashed to a single commit")

    # 3 · push the rewritten card ----------------------------------------------
    if not CARD.exists():
        sys.exit(f"missing card: {CARD}")
    api.upload_file(
        path_or_fileobj=str(CARD), path_in_repo="README.md",
        repo_id=RID, repo_type="dataset",
        commit_message="Dataset card: CC-BY-SA-4.0, attribution, updated counts",
    )
    print("[3/4] dataset card pushed")

    # 4 · flip public --------------------------------------------------------
    api.update_repo_settings(repo_id=RID, repo_type="dataset", private=False)
    print("[4/4] repo is now PUBLIC")

    final = api.repo_info(RID, repo_type="dataset", files_metadata=True)
    total = sum((s.size or 0) for s in final.siblings)
    print(f"\ndone. https://huggingface.co/datasets/{RID}")
    print(f"      private={final.private}  files={len(final.siblings)}  "
          f"{total/1e9:.2f} GB")
    for split in ("train", "val", "test"):
        n = sum(1 for s in final.siblings
                if s.rfilename.startswith(f"{split}/images/"))
        print(f"      {split}: {n} images")


if __name__ == "__main__":
    main()
