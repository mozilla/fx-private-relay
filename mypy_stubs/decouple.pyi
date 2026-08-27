"""
Typing hints for python-decouple 3.6

Generated with:
stubgen -o mypy_stubs -p decouple

Changes:
* Deleted globals and classes unused by Relay
* Converted config from instance of callable AutoConfig to a function
* Simplified interfaces of Csv and Choices to our usage
"""

from collections.abc import Callable, Sequence
from typing import Any, overload

# Unreleased as of 3.6 - accepts a bool
# def strtobool(value: Union[str, bool]) -> bool: ...
def strtobool(value: str) -> bool: ...
@overload
def config(option: str) -> str: ...
@overload
def config(option: str, default: str) -> str: ...
@overload
def config[DefaultType](option: str, default: DefaultType) -> str | DefaultType: ...
@overload
def config[DefaultType, CastReturnType](
    option: str, default: DefaultType, cast: Callable[[DefaultType], CastReturnType]
) -> CastReturnType: ...

class Csv:
    # Note: there are additional parameters that Relay (currently) doesn't use:
    # cast, delimiter, strip, post_process
    def __init__(self) -> None: ...
    def __call__(self, value: str) -> list[str]: ...

class Choices[CastReturnType]:
    # Note: there are additional parameters that Relay (currently) doesn't use:
    # choices
    def __init__(
        self, flat: Sequence[CastReturnType], cast: Callable[[Any], CastReturnType]
    ) -> None: ...
    def __call__(self, value: Any) -> CastReturnType: ...
