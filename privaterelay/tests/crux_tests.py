"""Tests for privaterelay/crux.py"""

from ..crux import main


def test_main() -> None:
    result = main("API_KEY")
    assert result == "to do"
