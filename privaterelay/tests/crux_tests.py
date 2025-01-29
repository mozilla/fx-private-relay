"""Tests for privaterelay/crux.py"""

import pytest

from ..crux import CruxQuery, CruxQuerySpecification, main


def test_crux_query_only_origin() -> None:
    query = CruxQuery("https://example.com")
    assert query.as_dict() == {"origin": "https://example.com"}
    assert repr(query) == "CruxQuery('https://example.com')"


def test_crux_query_form_factor() -> None:
    query = CruxQuery("https://example.com", form_factor="PHONE")
    assert query.as_dict() == {"origin": "https://example.com", "form_factor": "PHONE"}
    assert repr(query) == "CruxQuery('https://example.com', form_factor='PHONE')"


def test_crux_query_metric() -> None:
    query = CruxQuery(
        "https://example.com",
        metrics=["largest_contentful_paint", "first_contentful_paint"],
    )
    assert query.as_dict() == {
        "origin": "https://example.com",
        "metrics": ["first_contentful_paint", "largest_contentful_paint"],
    }
    assert repr(query) == (
        "CruxQuery('https://example.com',"
        " metrics=['first_contentful_paint', 'largest_contentful_paint'])"
    )


def test_crux_query_specification_origin_only() -> None:
    query_spec = CruxQuerySpecification("https://example.com")
    assert repr(query_spec) == "CruxQuerySpecification('https://example.com')"
    assert query_spec.queries() == [CruxQuery("https://example.com")]


def test_crux_query_specification_origin_invalid_protocol_raises() -> None:
    with pytest.raises(
        ValueError, match="origin should start with 'http://' or 'https://'"
    ):
        CruxQuerySpecification("ftp://example.com")


def test_crux_query_specification_origin_trailing_slash_raises() -> None:
    with pytest.raises(ValueError, match="origin should not end with a slash"):
        CruxQuerySpecification("https://example.com/")


def test_crux_query_specification_origin_is_path_raises() -> None:
    with pytest.raises(ValueError, match="origin should not include a path"):
        CruxQuerySpecification("https://example.com/faq")


def test_crux_query_specification_paths_specified() -> None:
    query_spec = CruxQuerySpecification("https://example.com", paths=["/foo", "/bar"])
    assert repr(query_spec) == (
        "CruxQuerySpecification('https://example.com', paths=['/bar', '/foo'])"
    )
    assert query_spec.queries() == [
        CruxQuery("https://example.com/bar"),
        CruxQuery("https://example.com/foo"),
    ]


def test_crux_query_specification_paths_no_leading_slash_raises() -> None:
    with pytest.raises(
        ValueError, match="in paths, every path should start with a slash"
    ):
        CruxQuerySpecification("http://example.com", paths=["foo"])


def test_crux_query_specification_paths_path_as_string_raises() -> None:
    with pytest.raises(ValueError, match="paths should be a list of path strings"):
        CruxQuerySpecification("http://example.com", paths="foo")


def test_main() -> None:
    result = main("crux_api_requester")
    assert result == "to do"
