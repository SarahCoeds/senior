from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Any, Optional
import json
import re
import time
import requests


@dataclass
class RequirementRecord:
    name: str
    kind: str = "game"  
    min_ram: int = 8
    recommended_ram: int = 16
    cpu_cores: int = 4
    gpu_vram: int = 4
    storage_type: str = "SSD"
    notes: str = ""
    source_url: str = ""
    fetched_at_utc: int = 0


def _norm(name: str) -> str:
    return re.sub(r"\s+", " ", (name or "").strip().lower())


def _cache_key(name: str, kind: str) -> str:
    k = (kind or "game").strip().lower()
    return f"{k}::{_norm(name)}"


def load_cache(path: Path) -> Dict[str, Any]:
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return {}


def save_cache(cache: Dict[str, Any], path: Path) -> None:
    try:
        path.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


def _extract_ram_gb(text: str) -> Optional[int]:
    t = (text or "").lower()
    m = re.search(r"(\d{1,3})\s*gb\s*ram", t)
    if m:
        return int(m.group(1))
    m2 = re.search(r"memory:\s*(\d{1,3})\s*gb", t)
    if m2:
        return int(m2.group(1))
    return None


def _extract_vram_gb(text: str) -> Optional[int]:
    t = (text or "").lower()
    m = re.search(r"(\d{1,3})\s*gb\s*vram", t)
    if m:
        return int(m.group(1))
    return None


def _infer_cpu_cores(text: str) -> Optional[int]:
    t = (text or "").lower()
    if any(k in t for k in ["i9", "ryzen 9"]):
        return 12
    if any(k in t for k in ["i7", "ryzen 7"]):
        return 8
    if any(k in t for k in ["i5", "ryzen 5"]):
        return 6
    if any(k in t for k in ["i3", "ryzen 3"]):
        return 4
    return None


def _steam_store_search(term: str) -> Optional[int]:
    try:
        url = "https://store.steampowered.com/api/storesearch/"
        r = requests.get(url, params={"term": term, "l": "english", "cc": "us"}, timeout=10)
        r.raise_for_status()
        data = r.json()
        items = data.get("items") or []
        if not items:
            return None
        appid = items[0].get("id")
        if isinstance(appid, int):
            return appid
        if isinstance(appid, str) and appid.isdigit():
            return int(appid)
        return None
    except Exception:
        return None


def _steam_appdetails(appid: int) -> Optional[Dict[str, Any]]:
    try:
        url = "https://store.steampowered.com/api/appdetails"
        r = requests.get(url, params={"appids": appid, "l": "english", "cc": "us"}, timeout=10)
        r.raise_for_status()
        payload = r.json()
        block = payload.get(str(appid), {})
        if not block.get("success"):
            return None
        return block.get("data", {})
    except Exception:
        return None


def _strip_html(text: str) -> str:
    t = re.sub(r"<br\s*/?>", "\n", text or "", flags=re.IGNORECASE)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def resolve_unknown_requirements(
    name: str,
    kind: str,
    allow_web: bool,
    cache: Dict[str, Any],
    cache_path: Path,
) -> RequirementRecord:
    if not (name or "").strip():
        return RequirementRecord(name=name or "", kind=kind or "game", notes="No name provided.", fetched_at_utc=int(time.time()))

    kind = (kind or "game").strip().lower()
    key_new = _cache_key(name, kind)
    key_old_plain = _norm(name)  

    # cache hit (new)
    if key_new in cache:
        try:
            return RequirementRecord(**cache[key_new])
        except Exception:
            pass

    # cache hit (old)
    if key_old_plain in cache:
        try:
            rec = RequirementRecord(**cache[key_old_plain])
            rec.kind = kind
            cache[key_new] = asdict(rec)
            save_cache(cache, cache_path)
            return rec
        except Exception:
            pass

    def heuristic() -> RequirementRecord:
        nm = name.lower()
        base = RequirementRecord(name=name, kind=kind, fetched_at_utc=int(time.time()))
        if "battlefield" in nm:
            base.min_ram, base.recommended_ram, base.cpu_cores, base.gpu_vram = 16, 32, 6, 8
            base.notes = "Offline estimate based on typical modern AAA shooter requirements."
            return base
        if "valorant" in nm:
            base.min_ram, base.recommended_ram, base.cpu_cores, base.gpu_vram = 8, 16, 4, 2
            base.notes = "Offline estimate (Valorant generally runs on modest hardware)."
            return base
        if "matlab" in nm:
            base.min_ram, base.recommended_ram, base.cpu_cores, base.gpu_vram = 16, 32, 8, 0
            base.notes = "Offline estimate for MATLAB: CPU/RAM heavy; GPU depends on toolboxes."
            return base
        base.min_ram, base.recommended_ram, base.cpu_cores, base.gpu_vram = 8, 16, 6, 6
        base.notes = "Offline estimate (balanced defaults)."
        return base

    # Web lookup
    if allow_web and kind == "game":
        appid = _steam_store_search(name)
        if appid:
            data = _steam_appdetails(appid)
            if data:
                reqs = data.get("pc_requirements", {}) or {}
                min_html = reqs.get("minimum", "") or ""
                rec_html = reqs.get("recommended", "") or ""

                min_text = _strip_html(min_html)
                rec_text = _strip_html(rec_html)

                min_ram = _extract_ram_gb(min_text) or 8
                rec_ram = _extract_ram_gb(rec_text) or max(16, min_ram)

                gpu_vram = _extract_vram_gb(rec_text) or _extract_vram_gb(min_text) or 6
                cpu_cores = _infer_cpu_cores(rec_text) or _infer_cpu_cores(min_text) or 6

                url = f"https://store.steampowered.com/app/{appid}/"
                rec = RequirementRecord(
                    name=name,
                    kind=kind,
                    min_ram=min_ram,
                    recommended_ram=rec_ram,
                    cpu_cores=cpu_cores,
                    gpu_vram=gpu_vram,
                    storage_type="SSD",
                    notes="Parsed from Steam system requirements (best-effort).",
                    source_url=url,
                    fetched_at_utc=int(time.time()),
                )
                cache[key_new] = asdict(rec)
                save_cache(cache, cache_path)
                return rec

    rec = heuristic()
    cache[key_new] = asdict(rec)
    save_cache(cache, cache_path)
    return rec
