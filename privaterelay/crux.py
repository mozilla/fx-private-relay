"""
Interface to Chrome User Experience (CrUX) API

https://developer.chrome.com/docs/crux/api
"""

from typing import Any, Literal


def main(crux_api_requester: Any) -> str:
    qp = get_main_query_parameters()
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
        metrics: list[CRUX_METRIC] | None = None,
    ) -> None:
        self.origin = origin
        self.form_factor = form_factor
        self.metrics = metrics

    def __repr__(self) -> str:
        args = [repr(self.origin)]
        if self.form_factor is not None:
            args.append(f"form_factor={self.form_factor!r}")
        if self.metrics is not None:
            args.append(f"metrics={sorted(self.metrics)!r}")
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
            result["metrics"] = sorted(self.metrics)
        return result


CRUX_PATH_SPECIFICATION = list[str] | Literal["COMBINED"]
CRUX_FORM_FACTOR_SPECIFICATION = CRUX_FORM_FACTOR | Literal["COMBINED", "EACH_FORM"]
CRUX_METRICS_SPECIFICATION = list[CRUX_METRIC] | Literal["ALL"]


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
        if isinstance(paths, list) and not all(path.startswith("/") for path in paths):
            raise ValueError("in paths, every path should start with a slash")

        self.origin = origin
        self.paths = paths
        self.form_factor = form_factor
        self.metrics = metrics

    def __repr__(self) -> str:
        args = [f"{self.origin!r}"]
        if self.paths != "COMBINED":
            args.append(f"paths={self.paths!r}")
        return f"{self.__class__.__name__}({', '.join(args)})"

    def queries(self) -> list[CruxQuery]:
        path_options: list[str] = [""]
        if isinstance(self.paths, list):
            path_options = self.paths[:]

        return [CruxQuery(self.origin + path) for path in path_options]


def get_main_query_parameters() -> Any:
    return "main_query_parameters"


def gather_api_results(query_parameters: Any, crux_api_requester: Any) -> Any:
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
    result = main(requester)
    print(result)
