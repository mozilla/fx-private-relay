"""Tests for privaterelay/crux.py"""

import re

import pytest
import responses

from ..crux import (
    CruxApiRequester,
    CruxQuery,
    CruxQuerySpecification,
    RequestsEngine,
    StubbedEngine,
    StubbedRequest,
    StubbedRequestAction,
    main,
)


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


def test_crux_query_specification_paths_as_string_raises() -> None:
    with pytest.raises(ValueError, match="paths should be a list of path strings"):
        CruxQuerySpecification("http://example.com", paths="foo")


def test_crux_query_specification_form_factor_single() -> None:
    query_spec = CruxQuerySpecification("https://example.com", form_factor="DESKTOP")
    assert repr(query_spec) == (
        "CruxQuerySpecification('https://example.com', form_factor='DESKTOP')"
    )
    assert query_spec.queries() == [
        CruxQuery("https://example.com", form_factor="DESKTOP")
    ]


def test_crux_query_specification_form_factor_each_form() -> None:
    query_spec = CruxQuerySpecification("https://example.com", form_factor="EACH_FORM")
    assert repr(query_spec) == (
        "CruxQuerySpecification('https://example.com', form_factor='EACH_FORM')"
    )
    assert query_spec.queries() == [
        CruxQuery("https://example.com", form_factor="DESKTOP"),
        CruxQuery("https://example.com", form_factor="PHONE"),
        CruxQuery("https://example.com", form_factor="TABLET"),
    ]


def test_crux_query_specification_metric_specified() -> None:
    query_spec = CruxQuerySpecification(
        "http://example.com",
        metrics=[
            "largest_contentful_paint",
            "interaction_to_next_paint",
            "cumulative_layout_shift",
        ],
    )
    assert repr(query_spec) == (
        "CruxQuerySpecification('http://example.com',"
        " metrics=['cumulative_layout_shift', 'interaction_to_next_paint',"
        " 'largest_contentful_paint'])"
    )
    assert query_spec.queries() == [
        CruxQuery(
            "http://example.com",
            metrics=[
                "cumulative_layout_shift",
                "interaction_to_next_paint",
                "largest_contentful_paint",
            ],
        )
    ]


def test_requests_engine_json_response_OK():
    url = "https://example.com/foo"
    engine = RequestsEngine()
    with responses.RequestsMock() as mocks:
        mock = mocks.post(
            url, body='{"foo": "bar"}', status=200, content_type="application/json"
        )
        resp = engine.post(url, {"key": "API_KEY"}, {"query": "foo"}, 1.0)
    assert mock.calls[0].request.url == "https://example.com/foo?key=API_KEY"
    assert resp.status_code == 200
    assert resp.json() == {"foo": "bar"}


def test_requests_engine_string_response_raises():
    url = "https://example.com"
    engine = RequestsEngine()
    with responses.RequestsMock() as mocks:
        mocks.post(url, body='"a string"', status=400, content_type="application/json")
        resp = engine.post(url, {}, {}, 2.0)
    assert resp.status_code == 400
    with pytest.raises(
        ValueError, match=re.escape("response.json() returned <class 'str'>, not dict")
    ):
        resp.json()


def test_stubbed_engine_expected_request() -> None:
    url = "https://example.com"
    params = {"key": "API_KEY"}
    data = {"query": "foo"}
    expected_request = StubbedRequest(url, params, data, 1.5)
    stubbed_action = StubbedRequestAction(200, {"foo": "bar"})
    engine = StubbedEngine()
    engine.expect_request(expected_request, stubbed_action)
    resp = engine.post(url, params, data, 1.5)
    assert resp.status_code == 200
    assert resp.json() == {"foo": "bar"}
    assert engine.requests == [expected_request]


def test_stubbed_engine_no_expected_requests() -> None:
    url = "https://example.com"
    params = {"key": "API_KEY"}
    data = {"query": "foo"}
    expected_request = StubbedRequest(url, params, data, 1.5)
    engine = StubbedEngine()
    with pytest.raises(IndexError):
        engine.post(url, params, data, 1.5)
    assert engine.requests == [expected_request]


def test_stubbed_engine_unexpected_request() -> None:
    url = "https://example.com"
    params = {"key": "API_KEY"}
    data = {"query": "foo"}
    expected_request = StubbedRequest(url, params, data, 1.5)
    engine = StubbedEngine()
    engine.expect_request(
        StubbedRequest(url, {}, data, 1.5), StubbedRequestAction(200, {})
    )
    with pytest.raises(RuntimeError):
        engine.post(url, params, data, 1.5)
    assert engine.requests == [expected_request]


def test_main() -> None:
    engine = StubbedEngine()
    expected_request = StubbedRequest(
        url=CruxApiRequester.API_URL,
        params={"key": "API_KEY"},
        data={"origin": "https://example.com"},
        timeout=CruxApiRequester.DEFAULT_TIMEOUT,
    )
    action = StubbedRequestAction(200, {"fake": "data"})
    engine.expect_request(expected_request, action)
    requester = CruxApiRequester("API_KEY", engine)
    result = main("https://example.com", requester)
    assert result == r'[[200, {"fake": "data"}]]'
