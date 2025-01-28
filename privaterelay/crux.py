"""
Interface to Chrome User Experience (CrUX) API

https://developer.chrome.com/docs/crux/api
"""

from typing import Any


def main(crux_api_requester: Any) -> str:
    qp = get_main_query_parameters()
    results = gather_api_results(qp, crux_api_requester)
    report = create_command_line_report(results)
    return report


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
