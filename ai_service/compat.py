# compat.py
from __future__ import annotations

import pandas as pd
from typing import Dict, Any, List, Tuple, Set


def load_requirements_data():
    try:
        apps = pd.read_csv("applications.csv").fillna("")
        games = pd.read_csv("games.csv").fillna("")

        application_requirements = {
            str(row["name"]).strip().lower(): row.to_dict()
            for _, row in apps.iterrows()
            if str(row.get("name", "")).strip()
        }
        game_requirements = {
            str(row["name"]).strip().lower(): row.to_dict()
            for _, row in games.iterrows()
            if str(row.get("name", "")).strip()
        }

        return application_requirements, game_requirements

    except Exception as e:
        print("Failed loading requirement CSVs:", e)
        return {}, {}


APPLICATION_REQUIREMENTS, GAME_REQUIREMENTS = load_requirements_data()


def has_app(name: str) -> bool:
    return str(name or "").strip().lower() in APPLICATION_REQUIREMENTS


def has_game(name: str) -> bool:
    return str(name or "").strip().lower() in GAME_REQUIREMENTS


def get_app_requirement(name: str):
    return APPLICATION_REQUIREMENTS.get(str(name or "").strip().lower())


def get_game_requirement(name: str):
    return GAME_REQUIREMENTS.get(str(name or "").strip().lower())



def ram_type_set(v: str) -> Set[str]:
    """
    parts.csv sometimes has DDR4/DDR5.
    Normalize into a set like {"DDR4","DDR5"}.
    """
    s = str(v or "").upper().strip()
    if not s:
        return set()
    if "/" in s:
        return {x.strip() for x in s.split("/") if x.strip()}
    if "," in s:
        return {x.strip() for x in s.split(",") if x.strip()}
    return {s}



def cpu_mobo(cpu, mobo):
    if not cpu or not mobo:
        return False, "CPU or motherboard missing"

    if str(cpu.get("socket") or "").strip() != str(mobo.get("socket") or "").strip():
        return False, f"Socket mismatch ({cpu.get('socket')} vs {mobo.get('socket')})"

    return True, ""


def ram_mobo(ram, mobo):
    if not ram or not mobo:
        return False, "RAM or motherboard missing"

    rset = ram_type_set(ram.get("ram_type"))
    mset = ram_type_set(mobo.get("ram_type"))
    if rset and mset and not (rset & mset):
        return False, f"RAM type mismatch ({ram.get('ram_type')} vs {mobo.get('ram_type')})"

    return True, ""


def gpu_case(gpu, case):
    if not gpu or not case:
        return True, ""

    try:
        gpu_len = float(gpu.get("length_mm", 0) or 0)
        case_len = float(case.get("max_gpu_length_mm", 9999) or 9999)
        if gpu_len > case_len:
            return False, f"GPU too long ({gpu_len}mm > {case_len}mm)"
    except Exception:
        pass

    return True, ""


def check_full_build_compatibility(build):
    issues = []

    ok, msg = cpu_mobo(build.get("CPU"), build.get("Motherboard"))
    if not ok:
        issues.append(msg)

    ok, msg = ram_mobo(build.get("RAM"), build.get("Motherboard"))
    if not ok:
        issues.append(msg)

    ok, msg = gpu_case(build.get("GPU"), build.get("Case"))
    if not ok:
        issues.append(msg)

    return {
        "compatible": len(issues) == 0,
        "issues": issues
    }


def _infer_gpu_tier_from_text(gpu_text: str) -> str:
    s = str(gpu_text or "").upper()
    if "RTX" in s:
        return "high"
    if "GTX" in s or "RX" in s or "ARC" in s:
        return "mid"
    if "HD" in s or "INTEL" in s:
        return "low"
    return "mid"


def get_requirements_analysis(applications, games, usage=""):
    """
    Returns a lightweight requirements profile used for part filtering and sizing.
    """
    analysis = {
        "min_ram": 8,
        "recommended_ram": 16,
        "cpu_cores": 4,
        "gpu_vram": 0,  
        "min_gpu_tier": "low",
        "storage_type": "SSD",
        "notes": []
    }


    for app in applications or []:
        key = str(app).strip().lower()
        if key in APPLICATION_REQUIREMENTS:
            r = APPLICATION_REQUIREMENTS[key]
            try:
                analysis["min_ram"] = max(analysis["min_ram"], int(r.get("min_ram") or 0))
            except Exception:
                pass
            try:
                analysis["recommended_ram"] = max(analysis["recommended_ram"], int(r.get("recommended_ram") or 16))
            except Exception:
                pass
            try:
                analysis["cpu_cores"] = max(analysis["cpu_cores"], int(r.get("cpu_cores") or 4))
            except Exception:
                pass
            try:
                analysis["gpu_vram"] = max(analysis["gpu_vram"], int(r.get("gpu_vram") or 0))
            except Exception:
                pass

            st = str(r.get("storage_type") or "").strip().upper()
            if st == "NVME":
                analysis["storage_type"] = "NVMe"


    tiers = {"low": 0, "mid": 1, "high": 2}
    for game in games or []:
        key = str(game).strip().lower()
        if key in GAME_REQUIREMENTS:
            g = GAME_REQUIREMENTS[key]
            rec_tier = _infer_gpu_tier_from_text(g.get("recommended_gpu", ""))
            min_tier = _infer_gpu_tier_from_text(g.get("min_gpu", ""))

            best = max([analysis["min_gpu_tier"], rec_tier, min_tier], key=lambda x: tiers.get(x, 1))
            analysis["min_gpu_tier"] = best

            try:
                analysis["min_ram"] = max(analysis["min_ram"], int(g.get("min_ram") or 0))
            except Exception:
                pass
            try:
                analysis["recommended_ram"] = max(analysis["recommended_ram"], int(g.get("recommended_ram") or 16))
            except Exception:
                pass


    u = str(usage or "").lower()
    if any(k in u for k in ["editing", "premiere", "davinci", "after effects"]):
        analysis["recommended_ram"] = max(analysis["recommended_ram"], 32)
        analysis["min_gpu_tier"] = "high"
        analysis["storage_type"] = "NVMe"

    return analysis


def recommend_parts_for_requirements(requirements, parts, budget=None):
    """
    Fast filter: removes obviously underpowered candidates BEFORE picking.
    NOTE: intentionally DOES NOT remove cheap parts too aggressively, to help low budgets.
    """
    filtered = []
    budget = int(budget or 0)

    req_ram = int(requirements.get("recommended_ram") or 16)
    req_vram = int(requirements.get("gpu_vram") or 0)
    tier = requirements.get("min_gpu_tier", "mid")

    for p in parts:
        cat = p.get("category")

        if cat == "RAM":
            cap = int(p.get("capacity_gb") or 0)
            if cap < min(req_ram, 32):
                continue

        if cat == "GPU":
            vram = int(p.get("vram_gb") or 0)
            price = float(p.get("price_usd") or 0)

            if req_vram > 0 and vram < req_vram:
                continue

            if tier == "high" and vram < 12:
                continue
            if tier == "mid" and vram < 8:
                continue
            if tier == "low" and vram < 4:
                continue


            if budget and tier != "high" and price > budget * 0.80:
                continue

        filtered.append(p)

    return filtered
