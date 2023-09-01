"""
Typing hints for python-decouple 3.6

Generated with:
stubgen -o mypy_stubs -p decouple

Changes:
* Deleted globals and classes unused by Relay
* Converted config from instance of callable AutoConfig to a function
* Simplified interfaces of Csv and Choices to our usage
"""
from collections.abc import Sequence
from typing import Any, Callable, Generic, TypeVar, Union, overload

# Unreleased as of 3.6 - accepts a bool
# def strtobool(value: Union[str, bool]) -> bool: ...
def strtobool(value: str) -> bool: ...

_DefaultType = TypeVar("_DefaultType")
_CastReturnType = TypeVar("_CastReturnType")

@overload
def config(option: str) -> str: ...
@overload
def config(option: str, default: str) -> str: ...
@overload
def config(option: str, default: _DefaultType) -> Union[str, _DefaultType]: ...
@overload
def config(
    option: str, default: _DefaultType, cast: Callable[[_DefaultType], _CastReturnType]
) -> _CastReturnType: ...

class Csv:
    # Note: there are additional parameters that Relay (currently) doesn't use:
    # cast, delimiter, strip, post_process
    def __init__(self) -> None: ...
    def __call__(self, value: str) -> list[str]: ...

class Choices(Generic[_CastReturnType]):
    # Note: there are additional parameters that Relay (currently) doesn't use:
    # choices
    def __init__(
        self, flat: Sequence[_CastReturnType], cast: Callable[[Any], _CastReturnType]
    ) -> None: ...
    def __call__(self, value: Any) -> _CastReturnType: ...
