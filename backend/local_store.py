"""
LocalStore: lightweight filesystem-backed store for assessments.

Provides simple atomic save, load, list, and delete operations.
Used as a fallback when Firebase is unavailable.
"""
from pathlib import Path
import json
from typing import Optional, List

BASE = Path(__file__).resolve().parent / "local_storage" / "assessments"
BASE.mkdir(parents=True, exist_ok=True)


def _atomic_write(path: Path, data: dict):
    tmp = path.with_suffix('.tmp')
    with tmp.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    tmp.replace(path)


def save_assessment(assessment: dict) -> bool:
    """Save assessment dict to filesystem using assessment_id as filename."""
    aid = assessment.get('assessment_id')
    if not aid:
        return False
    path = BASE / f"{aid}.json"
    try:
        _atomic_write(path, assessment)
        return True
    except Exception:
        return False


def get_assessment(assessment_id: str) -> Optional[dict]:
    path = BASE / f"{assessment_id}.json"
    if not path.exists():
        return None
    try:
        with path.open('r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        # attempt simple recovery by trimming to last closing brace
        try:
            text = path.read_text(encoding='utf-8')
            last_rc = text.rfind('}')
            if last_rc != -1:
                candidate = text[: last_rc + 1]
                data = json.loads(candidate)
                _atomic_write(path, data)
                return data
        except Exception:
            return None
    except Exception:
        return None


def list_assessments(user_id: Optional[str] = None) -> List[dict]:
    results = []
    for p in BASE.glob('*.json'):
        try:
            with p.open('r', encoding='utf-8') as f:
                a = json.load(f)
                if user_id is None or a.get('user_id') == user_id:
                    results.append(a)
        except Exception:
            continue
    # sort by created_at if available
    try:
        results.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    except Exception:
        pass
    return results


def delete_assessment(assessment_id: str) -> bool:
    path = BASE / f"{assessment_id}.json"
    try:
        if path.exists():
            path.unlink()
        return True
    except Exception:
        return False
