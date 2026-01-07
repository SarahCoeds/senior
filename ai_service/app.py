# app.py
from __future__ import annotations

import os
import re
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Set

import pandas as pd
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from compat import (
    check_full_build_compatibility,
    get_requirements_analysis,
    recommend_parts_for_requirements,
    get_app_requirement,
    get_game_requirement,
    has_app,
    has_game,
)

from lookup_requirements import load_cache, resolve_unknown_requirements

# ----------------------
# Init
# ----------------------
load_dotenv()

app = FastAPI()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pc-builder")

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
ALLOW_WEB_LOOKUP = os.getenv("ALLOW_WEB_LOOKUP", "0").strip() == "1"

BASE_DIR = Path(__file__).resolve().parent
CACHE_PATH = BASE_DIR / "requirements_cache.json"
REQ_CACHE = load_cache(CACHE_PATH)

# Simple in-memory session memory (demo-friendly)
SESSION_MEM: Dict[str, Dict[str, Any]] = {}

SYSTEM_PROMPT = """
You are Bear, a friendly, confident PC building assistant.

Hard domain:
- Laptops
- Pre-built desktop PCs
- Custom-built desktop PCs (from parts)

Style:
- Sound natural, not robotic.
- Do not output multiple options per category.
- Keep each "Why" short (one sentence).

Rules:
- NEVER change part names or prices provided by the backend.
- NEVER do arithmetic for totals.
- You MAY talk about compatibility generally, but do not claim a specific incompatibility unless the backend says so.
""".strip()


# ----------------------
# Load parts
# ----------------------
try:
    df = pd.read_csv("parts.csv").fillna("")
    PARTS = df.to_dict(orient="records")
    logger.info("Parts loaded: %d", len(PARTS))
except Exception as e:
    PARTS = []
    logger.error("Failed loading parts.csv: %s", e)


# ----------------------
# Small utils
# ----------------------
def money(v) -> float:
    try:
        return float(v or 0)
    except Exception:
        return 0.0


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def compact(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", norm(s))


def run_ollama_chat(user_message: str, system_message: str = SYSTEM_PROMPT) -> str:
    if LLM_PROVIDER != "ollama":
        return ""

    endpoint = f"{OLLAMA_URL.rstrip('/')}/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
    }

    try:
        resp = requests.post(endpoint, json=payload, timeout=120)
        if resp.status_code != 200:
            logger.error("Ollama error %s: %s", resp.status_code, resp.text)
            return ""
        data = resp.json()
        msg = (data.get("message") or {}).get("content", "")
        return msg.strip() if msg else ""
    except Exception as e:
        logger.error("Ollama call failed: %s", e)
        return ""


def parts_by_category(parts: List[dict], category: str) -> List[dict]:
    return [p for p in parts if str(p.get("category") or "").strip() == category]


def wants_rgb(message: str) -> bool:
    t = norm(message)
    return any(k in t for k in ["rgb", "lighting", "led"])


def wants_quiet(message: str) -> bool:
    t = norm(message)
    return any(k in t for k in ["quiet", "silent", "low noise", "low-noise"])


def session_get(session_id: str) -> Dict[str, Any]:
    sid = (session_id or "").strip()
    if not sid:
        return {}
    return SESSION_MEM.setdefault(sid, {})


def ram_type_set(value: Any) -> Set[str]:
    """
    Normalize RAM type fields like:
    - "DDR4"
    - "DDR5"
    - "DDR4/DDR5"
    into a set: {"DDR4","DDR5"}
    """
    s = str(value or "").upper()
    out: Set[str] = set()
    if "DDR4" in s:
        out.add("DDR4")
    if "DDR5" in s:
        out.add("DDR5")
    return out


# ----------------------
# Intent routing
# ----------------------
INTENT_CUSTOM_PC = "custom_pc"
INTENT_LAPTOP = "laptop"
INTENT_PREBUILT = "prebuilt_pc"
INTENT_SYSTEM_REQUIREMENTS = "system_requirements"
INTENT_HARDWARE_SPECS = "hardware_specs"
INTENT_OUT_OF_SCOPE = "out_of_scope"

PREBUILT_PHRASES = ["prebuilt", "pre build", "pre-built", "pre built", "prebuild", "ready made", "ready-made"]

REQ_KEYWORDS = [
    "system requirements",
    "software requirements",
    "game requirements",
    "minimum requirements",
    "recommended requirements",
    "requirements",
]

SPEC_WORDS = ["specs", "specifications", "specification"]

LEVEL_MIN = ["minimum", "min "]
LEVEL_REC = ["recommended", "rec "]
LEVEL_HIGH = ["high end", "high-end", "ultra", "max", "future proof", "future-proof", "overkill"]


def detect_level(message: str) -> str:
    t = norm(message)
    if any(k in t for k in LEVEL_HIGH):
        return "high_end"
    if any(k in t for k in LEVEL_MIN):
        return "minimum"
    if any(k in t for k in LEVEL_REC):
        return "recommended"
    return "both"


PC_RELATED_KEYWORDS = [
    # general
    "pc", "computer", "desktop", "build", "rig", "setup",
    # parts
    "cpu", "gpu", "graphics card", "motherboard", "ram", "memory",
    "ssd", "hdd", "nvme", "storage", "psu", "power supply", "case", "cooler",
    "intel", "amd", "nvidia", "rtx", "gtx", "radeon", "arc",
    # device categories
    "laptop", "notebook",
    # prebuilt wording
    "prebuilt", "pre-built", "pre build", "prebuild",
    # common request terms
    "requirements", "specs", "specifications",
]


def is_pc_related(message: str) -> bool:
    t = norm(message)
    return any(k in t for k in PC_RELATED_KEYWORDS)


def detect_intent(message: str) -> str:
    t = norm(message)

    # Explicit requirements
    if any(k in t for k in REQ_KEYWORDS):
        return INTENT_SYSTEM_REQUIREMENTS

    # Specs wording:
    # If they mention "my pc/my build" => hardware specs guidance
    # Otherwise treat specs as requirements for a game/app
    if any(w in t for w in SPEC_WORDS):
        if any(k in t for k in ["my pc", "my laptop", "my build", "my setup", "my rig"]):
            return INTENT_HARDWARE_SPECS
        return INTENT_SYSTEM_REQUIREMENTS

    # Device categories
    if "laptop" in t or "notebook" in t:
        return INTENT_LAPTOP
    if any(k in t for k in PREBUILT_PHRASES):
        return INTENT_PREBUILT

    # Hard gate: if it's not PC-related, do NOT build
    if not is_pc_related(message):
        return INTENT_OUT_OF_SCOPE

    # Default: custom PC
    return INTENT_CUSTOM_PC


def out_of_scope_reply() -> str:
    return (
        "Hey! I’m specialized in *PC builds, laptops, prebuilts, and hardware questions*, so I can’t help with that topic.\n\n"
        "If you’re looking for help choosing or building a PC, I’d love to help. Just share:\n"
        "- your budget\n"
        "- what you’ll use the PC for (gaming / coding / CAD / editing)\n"
        "- and whether you already own any parts\n\n"
        "Once I have that, I’ll create a setup that fits your needs perfectly."
    )


def extract_budget(message: str) -> Optional[int]:
    t = norm(message)
    m = re.search(r"\$\s*(\d{3,5})", t)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d{3,5})\s*\$", t)
    if m:
        return int(m.group(1))
    m = re.search(r"(?:budget|for)\s*(\d{3,5})", t)
    if m:
        return int(m.group(1))
    return None


# ----------------------
# Title extraction (apps/games + unknown)
# ----------------------
def extract_known_titles(message: str) -> Tuple[List[str], List[str]]:
    t = norm(message)
    apps_found: List[str] = []
    games_found: List[str] = []
    words = t.split()

    for n in [6, 5, 4, 3, 2, 1]:
        for i in range(0, len(words) - n + 1):
            phrase = " ".join(words[i : i + n]).strip()
            if len(phrase) < 2:
                continue
            if has_app(phrase) and phrase not in apps_found:
                apps_found.append(phrase)
            if has_game(phrase) and phrase not in games_found:
                games_found.append(phrase)

    return apps_found, games_found


def extract_unknown_title(message: str) -> str:
    t = norm(message)
    patterns = [
        r"(?:requirements|specs|specifications)\s+(?:for|of)\s+(.+)$",
        r"(?:can i run)\s+(.+)$",
        r"(?:run)\s+(.+)$",
        r"(?:for)\s+(.+)$",
    ]
    for pat in patterns:
        m = re.search(pat, t)
        if m:
            s = m.group(1).strip()
            s = re.sub(r"[?.!]+$", "", s).strip()
            return s[:60] if s else ""
    return ""


def pick_target_name(message: str) -> Tuple[str, str]:
    """
    Returns (kind, name) where kind is 'game' or 'app' (best guess).
    """
    apps, games = extract_known_titles(message)
    if games:
        return "game", games[0]
    if apps:
        return "app", apps[0]

    unknown = extract_unknown_title(message)
    if unknown:
        t = norm(message)
        kind = "app" if ("software" in t or "application" in t) else "game"
        return kind, unknown

    return "game", (message.strip()[:60] if message.strip() else "unknown")


# ----------------------
# Owned part detection (ONLY if ownership intent exists)
# ----------------------
OWNERSHIP_PHRASES = [
    "i have",
    "i own",
    "already have",
    "already own",
    "i bought",
    "i already bought",
    "my gpu is",
    "my cpu is",
    "my motherboard is",
    "my ram is",
    "my psu is",
    "my case is",
]

_STOP = {
    "atx",
    "itx",
    "matx",
    "e",
    "eatx",
    "gold",
    "platinum",
    "bronze",
    "titanium",
    "modular",
    "non",
    "semi",
    "airflow",
    "flow",
    "wifi",
    "rgb",
    "plus",
    "pro",
    "prime",
    "black",
    "white",
    "ddr4",
    "ddr5",
    "nvme",
    "ssd",
    "hdd",
    "gb",
    "tb",
    "w",
    "watt",
    "watts",
}


def _tokens(s: str) -> List[str]:
    toks = re.findall(r"[a-z0-9]+", norm(s))
    return [t for t in toks if len(t) >= 3 and t not in _STOP]


def contains_ownership(message: str) -> bool:
    t = norm(message)
    return any(p in t for p in OWNERSHIP_PHRASES)


def find_part_in_message(category: str, message: str) -> Optional[dict]:
    msg_c = compact(message)
    msg_tokens = set(_tokens(message))

    candidates = [p for p in PARTS if p.get("category") == category]
    if not candidates:
        return None

    # direct compact match
    for p in candidates:
        brand = str(p.get("brand", "")).strip()
        model = str(p.get("model", "")).strip()
        bm = compact(f"{brand} {model}")
        mo = compact(model)
        if bm and bm in msg_c:
            return p
        if mo and mo in msg_c:
            return p

    # token overlap fallback
    scored = []
    for p in candidates:
        model = str(p.get("model", ""))
        mt = set(_tokens(model))
        if not mt:
            continue
        overlap = len(mt.intersection(msg_tokens))
        if overlap >= 2:
            scored.append((overlap, money(p.get("price_usd")), p))

    if scored:
        scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return scored[0][2]

    return None


def detect_owned_parts(message: str) -> Dict[str, dict]:
    if not contains_ownership(message):
        return {}

    owned: Dict[str, dict] = {}
    msg_c = compact(message)
    msg_n = norm(message)

    for cat in ["CPU", "GPU", "Motherboard", "RAM", "Storage", "Case", "PSU"]:
        p = find_part_in_message(cat, message)
        if p:
            owned[cat] = p

    # tolerate RTX3090 typo variations if explicitly owned
    if ("rtx3090" in msg_c) or ("rdx3090" in msg_c):
        owned["GPU"] = {"category": "GPU", "brand": "NVIDIA", "model": "GeForce RTX 3090", "price_usd": ""}

    # generic GPU regex if ownership wording exists
    if "GPU" not in owned and any(k in msg_n for k in OWNERSHIP_PHRASES):
        m = re.search(r"\b(rtx|rdx|gtx|rx|arc)\s*[-]?\s*(\d{3,4})\b", msg_n, flags=re.IGNORECASE)
        if m:
            prefix = m.group(1).upper()
            num = m.group(2)
            if prefix in ["RTX", "RDX", "GTX"]:
                owned["GPU"] = {
                    "category": "GPU",
                    "brand": "NVIDIA",
                    "model": f"GeForce {('RTX' if prefix=='RDX' else prefix)} {num}",
                    "price_usd": "",
                }
            elif prefix == "RX":
                owned["GPU"] = {"category": "GPU", "brand": "AMD", "model": f"Radeon RX {num}", "price_usd": ""}
            elif prefix == "ARC":
                owned["GPU"] = {"category": "GPU", "brand": "Intel", "model": f"Arc {num}", "price_usd": ""}

    return owned


# ----------------------
# Requirements formatting (min/rec/high)
# ----------------------
def format_requirements(kind: str, title: str, level: str) -> Dict[str, Any]:
    """
    Returns dict with:
    - text (formatted string)
    - requirements (structured)
    """
    title_norm = str(title or "").strip()
    g = get_game_requirement(title_norm)
    a = get_app_requirement(title_norm)

    # If not in CSV, use cache/Steam/heuristic (via lookup_requirements.py)
    if not g and not a:
        rec = resolve_unknown_requirements(
            name=title_norm,
            kind=kind,
            allow_web=ALLOW_WEB_LOOKUP,
            cache=REQ_CACHE,
            cache_path=CACHE_PATH,
        )

        # lookup_requirements.RequirementRecord in your code does NOT include storage_type/kind
        # so we provide safe defaults here:
        storage_type = "SSD"

        lines = [f"{title_norm}"]
        if level in ("minimum", "both"):
            lines += [
                "",
                "Minimum Requirements:",
                f"- RAM: {int(rec.min_ram)} GB",
                f"- CPU: {int(rec.cpu_cores)} cores (class)",
                f"- GPU: {int(rec.gpu_vram)} GB VRAM (class)",
                f"- Storage: {storage_type}",
            ]
        if level in ("recommended", "both", "high_end"):
            lines += [
                "",
                "Recommended Requirements:",
                f"- RAM: {int(rec.recommended_ram)} GB",
                f"- CPU: {int(rec.cpu_cores)}+ cores (class)",
                f"- GPU: {int(rec.gpu_vram)}+ GB VRAM (class)",
                f"- Storage: {storage_type}",
            ]
        if level == "high_end":
            lines += [
                "",
                "High-End (Future-Proof) Suggestion:",
                "- RAM: 32 GB+",
                "- GPU: 16 GB VRAM class",
                "- Storage: NVMe SSD preferred",
            ]

        return {
            "text": "\n".join(lines).strip(),
            "requirements": {
                "kind": kind,
                "name": rec.name,
                "min_ram": rec.min_ram,
                "recommended_ram": rec.recommended_ram,
                "cpu_cores": rec.cpu_cores,
                "gpu_vram": rec.gpu_vram,
                "storage_type": storage_type,
                "source_url": rec.source_url,
                "notes": rec.notes,
            },
        }

    # CSV game
    if g:
        name = str(g.get("name", title_norm))
        minimum = {"gpu": str(g.get("min_gpu", "")), "ram": int(g.get("min_ram") or 0), "storage": int(g.get("storage") or 0)}
        recommended = {
            "gpu": str(g.get("recommended_gpu", "")),
            "ram": int(g.get("recommended_ram") or 0),
            "storage": int(g.get("storage") or 0),
        }

        lines = [f"{name}"]
        if level in ("minimum", "both"):
            lines += ["", "Minimum Requirements:", f"- GPU: {minimum['gpu']}", f"- RAM: {minimum['ram']} GB", f"- Storage: {minimum['storage']} GB"]
        if level in ("recommended", "both", "high_end"):
            lines += [
                "",
                "Recommended Requirements:",
                f"- GPU: {recommended['gpu']}",
                f"- RAM: {recommended['ram']} GB",
                f"- Storage: {recommended['storage']} GB",
            ]
        if level == "high_end":
            lines += ["", "High-End (Future-Proof) Suggestion:", "- RAM: 32 GB+", "- GPU: 16 GB VRAM class", "- Storage: NVMe SSD preferred"]

        return {"text": "\n".join(lines).strip(), "requirements": g}

    # CSV app
    name = str(a.get("name", title_norm))
    minimum = {
        "ram": int(a.get("min_ram") or 8),
        "cpu_cores": int(a.get("cpu_cores") or 4),
        "gpu_vram": int(a.get("gpu_vram") or 0),
        "storage": str(a.get("storage_type") or "SSD"),
    }
    recommended = {
        "ram": int(a.get("recommended_ram") or 16),
        "cpu_cores": int(a.get("cpu_cores") or 4),
        "gpu_vram": int(a.get("gpu_vram") or 0),
        "storage": str(a.get("storage_type") or "SSD"),
    }

    lines = [f"{name}"]
    if level in ("minimum", "both"):
        lines += [
            "",
            "Minimum Requirements:",
            f"- CPU: {minimum['cpu_cores']} cores (class)",
            f"- GPU: {minimum['gpu_vram']} GB VRAM (class)",
            f"- RAM: {minimum['ram']} GB",
            f"- Storage: {minimum['storage']}",
        ]
    if level in ("recommended", "both", "high_end"):
        lines += [
            "",
            "Recommended Requirements:",
            f"- CPU: {recommended['cpu_cores']}+ cores (class)",
            f"- GPU: {recommended['gpu_vram']}+ GB VRAM (class)",
            f"- RAM: {recommended['ram']} GB",
            f"- Storage: {recommended['storage']}",
        ]
    if level == "high_end":
        lines += ["", "High-End (Future-Proof) Suggestion:", "- RAM: 32 GB+", "- GPU: 12–16 GB VRAM class", "- Storage: NVMe SSD preferred"]

    return {"text": "\n".join(lines).strip(), "requirements": a}


# ----------------------
# Build generator (always outputs)
# ----------------------
def pick_best_within(items: List[dict], cap: float, score_fn) -> Optional[dict]:
    best = None
    best_score = -1e18
    for it in items:
        price = money(it.get("price_usd"))
        if price <= 0:
            continue
        if price > cap:
            continue
        sc = score_fn(it)
        if sc > best_score:
            best_score = sc
            best = it
    return best


def gpu_score(g):
    return int(g.get("vram_gb") or 0) * 10000 + money(g.get("price_usd"))


def cpu_score(c):
    return money(c.get("price_usd"))


def storage_score(s):
    cap = int(s.get("capacity_gb") or 0)
    ff = str(s.get("form_factor") or "").lower()
    nvme_bonus = 5000 if ("nvme" in ff or "m.2" in ff) else 0
    return cap + nvme_bonus + money(s.get("price_usd"))


def ram_score(r, prefer_rgb: bool):
    cap = int(r.get("capacity_gb") or 0)
    rgb_bonus = 5000 if (prefer_rgb and "rgb" in norm(r.get("model", ""))) else 0
    return cap * 100 + rgb_bonus + money(r.get("price_usd"))


def pick_mobo_for_cpu(cpu: dict, pool: List[dict], preferred_ram: Optional[str] = None) -> Optional[dict]:
    mobos = parts_by_category(pool, "Motherboard")
    sock = str(cpu.get("socket") or "").strip()

    candidates = [m for m in mobos if str(m.get("socket") or "").strip() == sock]
    if preferred_ram:
        pr = ram_type_set(preferred_ram)
        candidates = [m for m in candidates if (not pr) or (ram_type_set(m.get("ram_type")) & pr)]

    candidates.sort(key=lambda x: money(x.get("price_usd")))
    return candidates[-1] if candidates else None


def pick_ram_for_mobo(mobo: dict, pool: List[dict], need_gb: int, prefer_rgb: bool, cap: float) -> Optional[dict]:
    rams = parts_by_category(pool, "RAM")
    mset = ram_type_set(mobo.get("ram_type"))
    candidates = [r for r in rams if (not mset) or (ram_type_set(r.get("ram_type")) & mset)]
    candidates = [r for r in candidates if int(r.get("capacity_gb") or 0) >= need_gb]
    candidates.sort(key=lambda x: money(x.get("price_usd")))
    return pick_best_within(candidates, cap, lambda r: ram_score(r, prefer_rgb)) or (candidates[0] if candidates else None)


def pick_case_for_gpu(gpu: Optional[dict], pool: List[dict]) -> Optional[dict]:
    cases = parts_by_category(pool, "Case")
    if not cases:
        return None
    if not gpu or not gpu.get("length_mm"):
        cases.sort(key=lambda x: money(x.get("price_usd")))
        return cases[-1]
    gl = money(gpu.get("length_mm"))
    fit = [c for c in cases if money(c.get("max_gpu_length_mm")) >= gl]
    fit = fit or cases
    fit.sort(key=lambda x: money(x.get("price_usd")))
    return fit[-1]


def pick_psu_for_gpu(gpu: Optional[dict], pool: List[dict], quiet: bool) -> Optional[dict]:
    psus = parts_by_category(pool, "PSU")
    if not psus:
        return None
    need = int(gpu.get("psu_wattage") or 650) if gpu else 650
    candidates = [p for p in psus if int(p.get("psu_wattage") or 0) >= need] or psus
    candidates.sort(key=lambda x: money(x.get("price_usd")))
    return candidates[-1] if quiet else candidates[min(len(candidates) - 1, 2)]


def build_always(message: str, budget: int, owned: Dict[str, dict], level: str) -> Tuple[Dict[str, Optional[dict]], float]:
    apps, games = extract_known_titles(message)
    reqs = get_requirements_analysis(apps, games, usage=message)

    # Tier tuning
    if level == "minimum":
        reqs["recommended_ram"] = max(16, int(reqs.get("min_ram") or 8))
    elif level == "high_end":
        reqs["recommended_ram"] = max(32, int(reqs.get("recommended_ram") or 16))
        reqs["min_gpu_tier"] = "high"
        reqs["storage_type"] = "NVMe"

    prefer_rgb = wants_rgb(message)
    prefer_quiet = wants_quiet(message)

    filtered = recommend_parts_for_requirements(reqs, PARTS, budget) or PARTS

    categories = ["GPU", "CPU", "Motherboard", "RAM", "Storage", "PSU", "Case"]
    build: Dict[str, Optional[dict]] = {c: None for c in categories}

    # locked (owned)
    for cat in categories:
        if cat in owned:
            build[cat] = owned[cat]

    # Budget weights
    present = [c for c in categories if c not in owned]
    weights = {"GPU": 0.42, "CPU": 0.20, "Motherboard": 0.12, "RAM": 0.10, "Storage": 0.08, "PSU": 0.05, "Case": 0.03}
    weight_sum = sum(weights[c] for c in present) if present else 1.0

    def alloc(cat):
        return float(budget) * (weights[cat] / weight_sum)

    # CPU
    if "CPU" not in owned:
        cpus = parts_by_category(filtered, "CPU")
        cpu_cap = min(float(budget), alloc("CPU") * (1.25 if level == "high_end" else 1.10))
        build["CPU"] = pick_best_within(cpus, cpu_cap, cpu_score) or (sorted(cpus, key=lambda x: money(x.get("price_usd")))[0] if cpus else None)

    # Motherboard
    if "Motherboard" not in owned:
        cpu = build.get("CPU") if isinstance(build.get("CPU"), dict) else {}
        preferred_ram = "DDR5" if budget >= 900 else "DDR4"
        mobo = pick_mobo_for_cpu(cpu, filtered, preferred_ram=preferred_ram) or pick_mobo_for_cpu(cpu, filtered, preferred_ram=None)
        if not mobo:
            mobos = parts_by_category(filtered, "Motherboard")
            mobos.sort(key=lambda x: money(x.get("price_usd")))
            mobo = mobos[0] if mobos else None
        build["Motherboard"] = mobo

    # RAM
    if "RAM" not in owned:
        mobo = build.get("Motherboard") if isinstance(build.get("Motherboard"), dict) else {}
        need_gb = int(reqs.get("recommended_ram", 16) or 16)
        if level == "high_end":
            need_gb = max(32, need_gb)
        ram_cap = min(float(budget), alloc("RAM") * 1.25)
        build["RAM"] = pick_ram_for_mobo(mobo, filtered, need_gb, prefer_rgb, ram_cap)
        if not build["RAM"]:
            rams = parts_by_category(filtered, "RAM")
            rams.sort(key=lambda x: money(x.get("price_usd")))
            build["RAM"] = rams[0] if rams else None

    # GPU
    if "GPU" not in owned:
        gpus = parts_by_category(filtered, "GPU")
        gpu_cap = min(float(budget), alloc("GPU") * (1.30 if level == "high_end" else 1.20))
        build["GPU"] = pick_best_within(gpus, gpu_cap, gpu_score) or (sorted(gpus, key=lambda x: money(x.get("price_usd")))[0] if gpus else None)
        if not build["GPU"]:
            gpus_all = parts_by_category(PARTS, "GPU")
            gpus_all.sort(key=lambda x: money(x.get("price_usd")))
            build["GPU"] = gpus_all[0] if gpus_all else None

    # Storage
    if "Storage" not in owned:
        stor = parts_by_category(filtered, "Storage")
        desired = str(reqs.get("storage_type", "SSD")).lower()
        need_gb = 2000 if (budget >= 1800 or level == "high_end") else 1000

        def ok(s):
            cap = int(s.get("capacity_gb") or 0)
            ff = str(s.get("form_factor") or "").lower()
            if cap < need_gb:
                return False
            if desired == "nvme":
                return ("nvme" in ff) or ("m.2" in ff)
            if desired == "ssd":
                return "hdd" not in ff
            return True

        candidates = [s for s in stor if ok(s)] or stor
        storage_cap = min(float(budget), alloc("Storage") * 1.30)
        build["Storage"] = pick_best_within(candidates, storage_cap, storage_score) or (sorted(candidates, key=lambda x: money(x.get("price_usd")))[0] if candidates else None)

    # Case
    if "Case" not in owned:
        build["Case"] = pick_case_for_gpu(build.get("GPU") if isinstance(build.get("GPU"), dict) else None, filtered)

    # PSU
    if "PSU" not in owned:
        build["PSU"] = pick_psu_for_gpu(build.get("GPU") if isinstance(build.get("GPU"), dict) else None, filtered, prefer_quiet)

    # Ensure nothing is None by falling back to cheapest per category
    for cat in categories:
        if build.get(cat) is None:
            pool = parts_by_category(PARTS, cat)
            pool.sort(key=lambda x: money(x.get("price_usd")))
            build[cat] = pool[0] if pool else {}

    # Total of missing only
    total = 0.0
    for cat, part in build.items():
        if cat in owned:
            continue
        total += money((part or {}).get("price_usd"))

    # If above budget, downgrade cheapest best-effort (still returns build)
    if total > budget:
        priority = ["GPU", "CPU", "Motherboard", "RAM", "Storage", "PSU", "Case"]
        for cat in priority:
            if total <= budget:
                break
            if cat in owned:
                continue
            cur = build.get(cat) or {}
            cur_price = money(cur.get("price_usd"))
            pool = parts_by_category(PARTS, cat)
            cheaper = [p for p in pool if 0 < money(p.get("price_usd")) < cur_price]
            cheaper.sort(key=lambda x: money(x.get("price_usd")))
            if cheaper:
                build[cat] = cheaper[0]
                total = 0.0
                for c2, p2 in build.items():
                    if c2 in owned:
                        continue
                    total += money((p2 or {}).get("price_usd"))

    return build, total


# ----------------------
# LLM reasons (short, non-repetitive)
# ----------------------
def generate_reasons(build_items: List[Dict[str, Any]], user_message: str) -> Dict[str, str]:
    if not build_items:
        return {}

    lines = []
    for it in build_items:
        lines.append(f"- {it['category']}: {it['name']} (${it['price_usd']})")

    prompt = f"""
User request: {user_message}

Write ONE short "Why" sentence per component (same order).
Rules:
- Output exactly {len(build_items)} lines.
- Each line must be: <Category>: <Why sentence>
- Do NOT change part names or prices.
- Keep it natural, not repetitive.
- No markdown, no bullets.

Parts:
{chr(10).join(lines)}
""".strip()

    raw = run_ollama_chat(prompt)
    out: Dict[str, str] = {}

    if raw:
        for line in raw.splitlines():
            line = line.strip()
            if not line or ":" not in line:
                continue
            cat, why = line.split(":", 1)
            cat = cat.strip()
            why = why.strip()
            if cat and why:
                out[cat] = why

    for it in build_items:
        cat = it["category"]
        if cat not in out:
            out[cat] = "Chosen for strong value and a balanced, practical build."
    return out


def category_slug(cat: str) -> str:
    m = {
        "CPU": "cpu",
        "GPU": "gpu",
        "Motherboard": "motherboard",
        "RAM": "ram",
        "Storage": "storage",
        "PSU": "psu",
        "Case": "case",
        "Cooler": "cooler",
    }
    return m.get(cat, (cat or "").lower())


def format_build_response(build: Dict[str, dict], total: float, user_message: str, owned: Dict[str, dict]) -> Tuple[str, Dict[str, Any]]:
    order = ["CPU","GPU","RAM","Storage","Motherboard","PSU","Case"]

    items_all: List[Dict[str, Any]] = []
    for cat in order:
        part = build.get(cat) or {}
        name = f"{part.get('brand','')} {part.get('model','')}".strip()
        items_all.append({
            "category": cat,
            "category_slug": category_slug(cat),
            "csv_id": str(part.get("id", "")),
            "name": name,
            "price_usd": money(part.get("price_usd")),
            "owned": (cat in owned),
        })

    # Only items NOT owned will be shown + sent for cart
    items_to_buy = [it for it in items_all if not it["owned"]]
    owned_items = [it for it in items_all if it["owned"]]

    # Reasons only for buy-items (avoid weird “why” on owned parts)
    reasons = generate_reasons(items_to_buy, user_message)

    # professor-friendly output: only buy-items in the main list
    lines = ["Custom PC Build", ""]
    for it in items_to_buy:
        price = it["price_usd"]
        why = reasons.get(it["category"], "")
        lines.append(
            f"{it['category']}: {it['name']} — ${int(price) if float(price).is_integer() else round(price,2)} | Why: {why}"
        )

    # Optional: keep owned parts visible but NOT in the list/cart
    if owned_items:
        lines += ["", "Owned parts (excluded from cart):"]
        for it in owned_items:
            lines.append(f"- {it['category']}: {it['name']}")

    lines += ["", f"Total: ${int(total) if float(total).is_integer() else round(total,2)}"]
    lines += [
        "",
        "Summary:",
        "1) Parts shown above are the ones you still need to buy.",
        "2) Say 'DDR4' or 'DDR5' to force RAM/motherboard type.",
        "3) Want cheaper or stronger? Say 'minimum' or 'high-end'.",
    ]

    payload = {
        # Frontend “add to cart” must use ONLY these items now
        "items": [
            {
                **it,
                "reason": reasons.get(it["category"], ""),
                "product_match_query": it["name"],
            }
            for it in items_to_buy
        ],
        "total_usd": round(float(total), 2),
        "owned_items": owned_items,  # optional: if frontend ever wants to show them separately
    }

    return "\n".join(lines).strip(), payload



# ----------------------
# Laptop / Prebuilt (3-line)
# ----------------------
def normalize_three_line_device_answer(raw: str) -> str:
    lines = [l.strip() for l in raw.splitlines() if l.strip()]
    while len(lines) < 3:
        lines.append("")
    name_line, price_line, why_line = lines[0], lines[1], lines[2]

    if not name_line.lower().startswith("name:"):
        name_line = f"Name: {name_line}".strip()
    if not price_line.lower().startswith("price:"):
        price_line = f"Price: {price_line}".strip()
    if not why_line.lower().startswith("why:"):
        why_line = f"Why: {why_line}".strip()

    return "\n".join([name_line, price_line, why_line]).strip()


def format_laptop_or_prebuilt(message: str, kind: str) -> str:
    raw = run_ollama_chat(
        f"""
User asked for a {kind} recommendation.

Output MUST be exactly 3 lines:
Name: <one specific model name>
Price: <$XXXX>
Why: <one short sentence why it fits>

No extra lines.
User request: {message}
""".strip()
    )
    return normalize_three_line_device_answer(raw) if raw else "Name: (Unavailable)\nPrice: $0\nWhy: Could not reach the model."


# ----------------------
# API
# ----------------------
@app.post("/chat")
async def chat(req: Request):
    data = await req.json()
    message = data.get("message", "")
    session_id = str(data.get("session_id", "") or "").strip()

    if not message:
        raise HTTPException(400, "Message required")

    mem = session_get(session_id)

    intent = detect_intent(message)
    level = detect_level(message)

    # ✅ OUT OF SCOPE => never build
    if intent == INTENT_OUT_OF_SCOPE:
        return {"intent": intent, "type": "out_of_scope", "response": out_of_scope_reply()}

    mem["last_level"] = level

    # Requirements
    if intent == INTENT_SYSTEM_REQUIREMENTS:
        kind, title = pick_target_name(message)
        out = format_requirements(kind, title, level)
        return {
            "intent": intent,
            "type": "requirements",
            "level": level,
            "response": out["text"],
            "requirements": out["requirements"],
        }

    # Hardware specs guidance
    if intent == INTENT_HARDWARE_SPECS:
        kind, title = pick_target_name(message)
        out = format_requirements(kind, title, level)
        guidance = (
            f"{out['text']}\n\n"
            "If you want, say: 'Build me a PC for this' + your budget, and I will generate a full parts list."
        )
        return {"intent": intent, "type": "specs", "level": level, "response": guidance}

    # Laptop / Prebuilt
    if intent == INTENT_LAPTOP:
        return {"intent": intent, "type": "laptop", "response": format_laptop_or_prebuilt(message, "laptop")}

    if intent == INTENT_PREBUILT:
        return {"intent": intent, "type": "prebuilt", "response": format_laptop_or_prebuilt(message, "prebuilt PC")}

    # Build intent (always outputs a build for PC-related content)
    extracted = extract_budget(message)
    budget_provided = extracted is not None

    if extracted is None:
        extracted = int(mem.get("last_budget") or 1500)

    budget = int(extracted)
    mem["last_budget"] = budget

    owned = detect_owned_parts(message)
    mem["last_owned_categories"] = sorted(list(owned.keys()))

    build, total_missing = build_always(message, budget, owned, level=level)

    chk = check_full_build_compatibility(
        {
            "CPU": build.get("CPU"),
            "Motherboard": build.get("Motherboard"),
            "RAM": build.get("RAM"),
            "GPU": build.get("GPU"),
            "Case": build.get("Case"),
            "PSU": build.get("PSU"),
            "Storage": build.get("Storage"),
        }
    )

    response_text, build_payload = format_build_response(build, total_missing, message, owned)

    if budget_provided and total_missing > budget:
        response_text += (
            "\n\nNote: Your budget is below the cheapest full build using the current inventory. "
            "This is the closest complete build available."
        )

    if not chk.get("compatible", True):
        issues = chk.get("issues") or []
        if issues:
            response_text += "\n\nCompatibility note (best-effort): " + "; ".join(issues[:2])

    return {
        "intent": intent,
        "type": "custom_pc",
        "level": level,
        "response": response_text,
        "build": build_payload,
        "owned_detected": sorted(list(owned.keys())),
        "budget_provided": budget_provided,
        "budget_used": budget,
        "session_id": session_id,
    }


@app.get("/health")
def health():
    return {"status": "ok", "parts_loaded": len(PARTS)}


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
