"""Shared HTTP client infrastructure for data fetchers."""

import sys
import requests
from typing import Optional


def get(
    url: str,
    params=None,
    headers: Optional[dict] = None,
    timeout: int = 15,
) -> Optional[requests.Response]:
    """GET request with built-in error handling. Returns None on failure."""
    if headers is None:
        from src.config import DEFAULT_USER_AGENT
        headers = {"User-Agent": DEFAULT_USER_AGENT}
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=timeout)
        resp.raise_for_status()
        return resp
    except Exception as e:
        print(f"Request error ({url}): {e}", file=sys.stderr)
        return None
