from __future__ import annotations

import os
import json
import requests
from typing import Dict, Any, List, Optional


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _ollama_generate(prompt: str, temperature: float = 0.4, num_predict: int = 350) -> Optional[str]:
    provider = _env("LLM_PROVIDER", "ollama")
    if provider.lower() != "ollama":
        return None

    model = _env("OLLAMA_MODEL", "llama3.1:8b")
    url = _env("OLLAMA_URL", "http://127.0.0.1:11434")

    try:
        resp = requests.post(
            f"{url}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": float(temperature),
                    "num_predict": int(num_predict),
                }
            },
            timeout=25
        )
        resp.raise_for_status()
        text = (resp.json().get("response") or "").strip()
        return text or None
    except Exception:
        return None


def llm_pick_build(
    message: str,
    budget: int,
    assumed_budget: bool,
    platform: str,
    requirements: Dict[str, Any],
    locked_parts: Dict[str, Any],
    candidates: Dict[str, List[Dict[str, Any]]],
    avoid_part_ids: List[str],
) -> Optional[Dict[str, str]]:
    """
    Returns: { "CPU": "cpu_04", "GPU": "gpu_15", ... } for missing categories only.
    If LLM fails, returns None.
    """
    provider = _env("LLM_PROVIDER", "ollama")
    if provider.lower() != "ollama":
        return None

    compact_candidates: Dict[str, List[Dict[str, Any]]] = {}
    for cat, items in candidates.items():
        if not items:
            continue
        compact_candidates[cat] = [
            {
                "id": str(p.get("id", "")),
                "name": f"{p.get('brand','')} {p.get('model','')}".strip(),
                "price": float(p.get("price_usd") or 0),
                "socket": p.get("socket", ""),
                "ram_type": p.get("ram_type", ""),
                "vram_gb": p.get("vram_gb", ""),
                "capacity_gb": p.get("capacity_gb", ""),
                "psu_wattage": p.get("psu_wattage", ""),
                "form_factor": p.get("form_factor", ""),
            }
            for p in items
        ]

    locked_summary = {
        k: f"{v.get('brand','')} {v.get('model','')}".strip()
        for k, v in (locked_parts or {}).items()
        if isinstance(v, dict)
    }

    system = (
        "You are an expert PC builder AI.\n"
        "You MUST pick parts ONLY from the provided candidate lists.\n"
        "Return ONLY strict JSON (no markdown, no explanation).\n"
        "Rules:\n"
        "- Do NOT change locked parts.\n"
        "- Choose a sensible build that matches the user's needs.\n"
        "- Stay under the total budget.\n"
        "- Prefer compatibility: CPU socket with motherboard, RAM type with motherboard.\n"
        "- Return JSON mapping category -> chosen_part_id (only missing categories).\n"
        "- Avoid part ids in avoid_part_ids when reasonable.\n"
    )

    user = {
        "user_request": message,
        "platform": platform,
        "budget_usd": budget,
        "budget_was_assumed": assumed_budget,
        "requirements": requirements,
        "locked_parts": locked_summary,
        "avoid_part_ids": avoid_part_ids[-12:],
        "candidates": compact_candidates,
    }

    prompt = system + "\nINPUT:\n" + json.dumps(user, ensure_ascii=False)
    text = _ollama_generate(prompt, temperature=0.30, num_predict=260)
    if not text:
        return None

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    try:
        obj = json.loads(text[start:end + 1])
    except Exception:
        return None

    if not isinstance(obj, dict):
        return None

    allowed_ids = set()
    for _, items in compact_candidates.items():
        for p in items:
            allowed_ids.add(p["id"])

    clean: Dict[str, str] = {}
    for cat, pid in obj.items():
        if not isinstance(cat, str) or not isinstance(pid, str):
            continue
        if pid in allowed_ids:
            clean[cat] = pid

    return clean if clean else None


def llm_format_build(
    user_message: str,
    platform: str,
    budget: int,
    budget_was_assumed: bool,
    requirements: Dict[str, Any],
    build_parts: Dict[str, Any],
    format_flags: Dict[str, bool],
    compat_issues: str = "",
    external_reqs: Optional[List[Any]] = None,
    locked_parts: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    LLM writes the FINAL answer in the required format.
    """
    provider = _env("LLM_PROVIDER", "ollama")
    if provider.lower() != "ollama":
        return None

    parts_payload = []
    for cat, p in (build_parts or {}).items():
        if not isinstance(p, dict) or not p:
            continue
        parts_payload.append({
            "category": str(cat),
            "id": str(p.get("id", "")),
            "name": f"{p.get('brand','')} {p.get('model','')}".strip(),
            "price": float(p.get("price_usd") or 0),
        })

    locked_ids = set()
    if locked_parts:
        for _, p in locked_parts.items():
            if isinstance(p, dict) and p.get("id"):
                locked_ids.add(str(p["id"]))

    ext_payload = []
    for r in external_reqs or []:
        try:
            ext_payload.append({
                "name": getattr(r, "name", ""),
                "min_ram": getattr(r, "min_ram", 0),
                "recommended_ram": getattr(r, "recommended_ram", 0),
                "cpu_cores": getattr(r, "cpu_cores", 0),
                "gpu_vram": getattr(r, "gpu_vram", 0),
                "source_url": getattr(r, "source_url", ""),
            })
        except Exception:
            pass

    names_only = bool(format_flags.get("names_only", False))
    no_prices = bool(format_flags.get("no_prices", False))
    no_explain = bool(format_flags.get("no_explain", False))

    system = (
        "You are the SAME PC-building AI assistant talking to the user.\n"
        "Write a helpful, non-repetitive answer.\n"
        "\n"
        "CRITICAL OUTPUT FORMAT RULES:\n"
        "- You MUST list EVERY provided part exactly once (do not omit any).\n"
        "- Exactly one line per category.\n"
        "- If prices are enabled: each line MUST be: <Category>: <Part Name> — $<Price>\n"
        "- If prices are disabled: each line MUST be: <Category>: <Part Name>\n"
        "- If 'names only' is enabled: output ONLY part lines (no total, no explanation, no extra text).\n"
        "- Include a 'Total: $####' line unless 'names only' is enabled.\n"
        "- After Total, include a VERY BRIEF explanation (2-4 lines max) unless explanation is disabled.\n"
        "- IMPORTANT: The explanation MUST be numbered lines like:\n"
        "  1) ...\n"
        "  2) ...\n"
        "  (Do NOT use '*' or '-' bullets. No markdown.)\n"
        "- Do NOT use markdown.\n"
        "\n"
        "GROUNDING RULES (IMPORTANT):\n"
        "- Do NOT invent specs (cores, VRAM, wattage, exact requirements) unless those exact numbers are explicitly in INPUT.\n"
        "- Only say things directly implied by the parts list (e.g., '32GB RAM', '2TB SSD', 'strong GPU').\n"
        "\n"
        "Do NOT invent parts. Use ONLY the provided parts.\n"
        "Keep it concise.\n"
    )

    user = {
        "user_message": user_message,
        "platform": platform,
        "budget_usd": budget,
        "budget_was_assumed": budget_was_assumed,
        "requirements": requirements,
        "format_flags": {"names_only": names_only, "no_prices": no_prices, "no_explain": no_explain},
        "compatibility_notes": compat_issues,
        "external_requirements_used": ext_payload,
        "parts": parts_payload,
        "locked_part_ids": sorted(list(locked_ids)),
    }

    prompt = system + "\nINPUT:\n" + json.dumps(user, ensure_ascii=False)
    return _ollama_generate(prompt, temperature=0.40, num_predict=420)


def llm_rewrite_build_response(
    bad_response: str,
    required_categories: List[str],
    must_show_prices: bool,
    must_show_total: bool,
    parts_payload: List[Dict[str, Any]],
) -> Optional[str]:
    """
    If the LLM output is missing categories/prices/total/format, ask it to rewrite correctly.
    """
    rules = [
        "Rewrite the response to strictly follow the required format.",
        "Do NOT invent parts. Use ONLY the provided parts list.",
        "Include EVERY category found in parts list exactly once.",
        "Use exactly one line per category.",
        ("Each part line must be: Category: Part Name — $Price" if must_show_prices
         else "Each part line must be: Category: Part Name"),
        ("Include Total: $#### line." if must_show_total else "Do NOT include Total line."),
        "Do NOT use markdown.",
        "Do NOT use '*' bullets or '-' bullets.",
        "If explanation is included, use numbered lines only: 1) ... 2) ... (max 4).",
        "Do NOT invent cores/VRAM/wattage/specs."
    ]

    system = "You are a PC builder AI. Follow rules exactly.\n" + "\n".join(f"- {r}" for r in rules)

    user = {
        "bad_response": bad_response,
        "required_categories": required_categories,
        "parts": parts_payload,
    }

    prompt = system + "\nINPUT:\n" + json.dumps(user, ensure_ascii=False)
    return _ollama_generate(prompt, temperature=0.15, num_predict=420)
