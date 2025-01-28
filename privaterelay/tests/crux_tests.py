"""Tests for privaterelay/crux.py"""

from ..crux import main


def test_main() -> None:
    result = main("crux_api_requester")
    assert result == "to do"
