"""
Interface to Chrome User Experience (CrUX) API

https://developer.chrome.com/docs/crux/api
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections import deque
from collections.abc import Iterable
from itertools import product
from typing import Any, Literal, NamedTuple, get_args

import requests


def main(domain: str, crux_api_requester: Any) -> str:
    qp = get_main_query_parameters(domain)
    results = gather_api_results(qp, crux_api_requester)
    report = create_command_line_report(results)
    return report


CRUX_FORM_FACTOR = Literal["PHONE", "TABLET", "DESKTOP"]
CRUX_METRIC = Literal[
    "cumulative_layout_shift",
    "first_contentful_paint",
    "interaction_to_next_paint",
    "largest_contentful_paint",
    "experimental_time_to_first_byte",
    "navigation_types",
    "form_factors",
    "round_trip_time",
]


class CruxQuery:
    """Represents a CrUX API query body"""

    def __init__(
        self,
        origin: str,
        form_factor: CRUX_FORM_FACTOR | None = None,
        metrics: Iterable[CRUX_METRIC] | None = None,
    ) -> None:
        self.origin = origin
        self.form_factor = form_factor
        self.metrics = sorted(metrics) if metrics else None

    def __repr__(self) -> str:
        args = [repr(self.origin)]
        if self.form_factor is not None:
            args.append(f"form_factor={self.form_factor!r}")
        if self.metrics is not None:
            args.append(f"metrics={self.metrics!r}")
        return f"{self.__class__.__name__}({', '.join(args)})"

    def __eq__(self, other: Any) -> bool:
        return (
            isinstance(other, CruxQuery)
            and self.origin == other.origin
            and self.form_factor == other.form_factor
            and self.metrics == other.metrics
        )

    def as_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"origin": self.origin}
        if self.form_factor is not None:
            result["form_factor"] = self.form_factor
        if self.metrics is not None:
            result["metrics"] = self.metrics
        return result


CRUX_PATH_SPECIFICATION = Iterable[str] | Literal["COMBINED"]
CRUX_FORM_FACTOR_SPECIFICATION = CRUX_FORM_FACTOR | Literal["COMBINED", "EACH_FORM"]
CRUX_METRICS_SPECIFICATION = Iterable[CRUX_METRIC] | Literal["ALL"]


class CruxQuerySpecification:
    """Represents a family of CrUX API queries"""

    def __init__(
        self,
        origin: str,
        paths: CRUX_PATH_SPECIFICATION = "COMBINED",
        form_factor: CRUX_FORM_FACTOR_SPECIFICATION = "COMBINED",
        metrics: CRUX_METRICS_SPECIFICATION = "ALL",
    ) -> None:
        if not (origin.startswith("http://") or origin.startswith("https://")):
            raise ValueError("origin should start with 'http://' or 'https://'")
        if origin.endswith("/"):
            raise ValueError("origin should not end with a slash")
        if origin.count("/") > 2:
            raise ValueError("origin should not include a path")
        if isinstance(paths, str) and paths != "COMBINED":
            raise ValueError("paths should be a list of path strings")
        if (
            isinstance(paths, Iterable)
            and not isinstance(paths, str)
            and not all(path.startswith("/") for path in paths)
        ):
            raise ValueError("in paths, every path should start with a slash")

        self.origin = origin
        self.paths = sorted(paths) if paths != "COMBINED" else "COMBINED"
        self.form_factor = form_factor
        self.metrics: CRUX_METRICS_SPECIFICATION = (
            sorted(metrics) if metrics != "ALL" else "ALL"
        )

    def __repr__(self) -> str:
        args = [f"{self.origin!r}"]
        if self.paths != "COMBINED":
            args.append(f"paths={self.paths!r}")
        if self.form_factor != "COMBINED":
            args.append(f"form_factor={self.form_factor!r}")
        if self.metrics != "ALL":
            args.append(f"metrics={self.metrics!r}")
        return f"{self.__class__.__name__}({', '.join(args)})"

    def queries(self) -> list[CruxQuery]:
        path_options: list[str] = [""]
        if isinstance(self.paths, list):
            path_options = self.paths

        if self.form_factor == "COMBINED":
            form_options: list[CRUX_FORM_FACTOR] | list[None] = [None]
        elif self.form_factor == "EACH_FORM":
            form_options = sorted(get_args(CRUX_FORM_FACTOR))
        else:
            form_options = [self.form_factor]

        metrics = None if self.metrics == "ALL" else self.metrics

        return [
            CruxQuery(self.origin + path, form_factor=form_factor, metrics=metrics)
            for path, form_factor in product(path_options, form_options)
        ]


class RequestEngine(ABC):
    @abstractmethod
    def post(
        self, url: str, params: dict[str, str], data: dict[str, Any], timeout: float
    ) -> ResponseWrapper:
        pass


class ResponseWrapper(ABC):
    @property
    @abstractmethod
    def status_code(self) -> int:
        pass

    @abstractmethod
    def json(self) -> dict[str, Any]:
        pass


class RequestsEngine(RequestEngine):
    def post(
        self, url: str, params: dict[str, str], data: dict[str, Any], timeout: float
    ) -> ResponseWrapper:
        return RequestsResponse(
            requests.post(url=url, params=params, data=data, timeout=timeout)
        )


class RequestsResponse(ResponseWrapper):
    def __init__(self, response: requests.Response) -> None:
        self._response = response

    @property
    def status_code(self) -> int:
        return self._response.status_code

    def json(self) -> dict[str, Any]:
        data = self._response.json()
        if not isinstance(data, dict):
            raise ValueError(f"response.json() returned {type(data)}, not dict")
        return data


class StubbedRequest(NamedTuple):
    url: str
    params: dict[str, str]
    data: dict[str, Any]
    timeout: float


class StubbedRequestAction(NamedTuple):
    status_code: int
    data: dict[str, Any]


class StubbedEngine(RequestEngine):
    def __init__(self) -> None:
        self.requests: list[StubbedRequest] = []
        self._expected_requests: deque[tuple[StubbedRequest, StubbedRequestAction]] = (
            deque()
        )

    def expect_request(
        self, request: StubbedRequest, action: StubbedRequestAction
    ) -> None:
        self._expected_requests.append((request, action))

    def post(
        self,
        url: str,
        params: dict[str, str],
        data: dict[str, Any],
        timeout: float = 1.0,
    ) -> ResponseWrapper:
        request = StubbedRequest(url, params, data, timeout)
        self.requests.append(request)
        expected_request, action = self._expected_requests.popleft()
        if request != expected_request:
            raise RuntimeError(f"Expected {expected_request}, got {request}")
        return StubbedResponse(action.status_code, action.data)


class StubbedResponse(ResponseWrapper):
    def __init__(self, status_code: int, data: dict[str, Any]) -> None:
        self._status_code = status_code
        self._data = data

    @property
    def status_code(self) -> int:
        return self._status_code

    def json(self) -> dict[str, Any]:
        return self._data


def get_main_query_parameters(domain: str) -> list[CruxQuery]:
    return CruxQuerySpecification(domain).queries()


def gather_api_results(
    query_parameters: list[CruxQuery], crux_api_requester: Any
) -> Any:
    return "api_results"


def create_command_line_report(results: Any) -> str:
    return "to do"


def get_crux_api_requester(api_key: str) -> Any:
    return "crux_api_requester"


if __name__ == "__main__":
    import os
    import sys

    api_key = os.environ.get("CRUX_API_KEY")
    if not api_key:
        print("Set CRUX_API_KEY to the API key")
        sys.exit(1)

    requester = get_crux_api_requester(api_key)
    result = main("https://relay.firefox.com", requester)
    print(result)
