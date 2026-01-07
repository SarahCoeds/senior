import os
import sys
from pathlib import Path
from lookup_requirements import load_cache, resolve_unknown_requirements

BASE_DIR = Path(__file__).resolve().parent
CACHE_PATH = BASE_DIR / "requirements_cache.json"

def main():
    allow_web = os.getenv("ALLOW_WEB_LOOKUP", "0").strip() == "1"
    cache = load_cache(CACHE_PATH)

    targets = sys.argv[1:]
    if not targets:
        print('Usage: python warm_cache.py "game::Battlefield 6" "app::MATLAB" "Valorant" "SolidWorks"')
        print('Tip: if you omit prefix, it defaults to game::')
        return

    for raw in targets:
        raw = (raw or "").strip()
        kind = "game"
        name = raw

        if "::" in raw:
            prefix, rest = raw.split("::", 1)
            prefix = prefix.strip().lower()
            rest = rest.strip()
            if prefix in ("game", "app") and rest:
                kind = prefix
                name = rest

        rec = resolve_unknown_requirements(
            name=name,
            kind=kind,
            allow_web=allow_web,
            cache=cache,
            cache_path=CACHE_PATH,
        )

        url = rec.source_url or ""
        print(f"- {rec.kind}::{rec.name}: minRAM={rec.min_ram} recRAM={rec.recommended_ram} cores={rec.cpu_cores} vram={rec.gpu_vram} {url}")

if __name__ == "__main__":
    main()
