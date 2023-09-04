# Type stubs for Django waffle
# https://github.com/django-waffle/django-waffle/blob/v3.0.0/waffle/managers.py
# Can be removed once type hints ship in the release after v3.0.0

from typing import TypeVar

from django.db import models

from waffle.models import BaseModel

_BASE_T = TypeVar("_BASE_T", bound=BaseModel)

class BaseManager(models.Manager[_BASE_T]):
    KEY_SETTING: str

    def get_by_natural_key(self, name: str) -> _BASE_T: ...
    def create(self, *args, **kwargs) -> _BASE_T: ...

class FlagManager(BaseManager): ...
class SwitchManager(BaseManager): ...
class SampleManager(BaseManager): ...
