# Type stubs for Django waffle
# https://github.com/django-waffle/django-waffle/blob/v3.0.0/waffle/utils.py
# Can be removed once type hints ship in the release after v3.0.0

from typing import Any

from django.core.cache.backends.base import BaseCache

def get_setting(name: str, default: Any | None = None) -> Any: ...
def keyfmt(k: str, v: str | None = None) -> str: ...
def get_cache() -> BaseCache: ...
