# Type stubs for Django waffle
# https://github.com/django-waffle/django-waffle
# Can be removed once type hints ship in the release after v3.0.0

from typing import Literal, overload

from django.http import HttpRequest
from waffle.models import Flag, Switch, Sample

VERSION: tuple[int, ...]

def flag_is_active(  # noqa: E302 # Expected 2 blank lines
    request: HttpRequest, flag_name: str, read_only: bool = False
) -> bool | None: ...
def switch_is_active(switch_name: str) -> bool | None: ...
def sample_is_active(sample_name: str) -> bool | None: ...
def get_waffle_flag_model() -> Flag: ...
def get_waffle_switch_model() -> Switch: ...
def get_waffle_sample_model() -> Sample: ...
@overload
def get_waffle_model(setting_name: Literal["FLAG_MODEL"]) -> Flag: ...
@overload
def get_waffle_model(setting_name: Literal["SWITCH_MODEL"]) -> Switch: ...
@overload
def get_waffle_model(setting_name: Literal["SAMPLE_MODEL"]) -> Sample: ...
