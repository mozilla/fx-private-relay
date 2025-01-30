"""Tests for privaterelay/crux.py"""

import re
from datetime import date, timedelta
from typing import Any

import pytest
import responses

from ..crux import (
    CruxApiRequester,
    CruxFloatHistogram,
    CruxQuery,
    CruxQuerySpecification,
    CruxRecordKey,
    CruxResult,
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


_BASIC_QUERY = CruxQuery("https://example.com", metrics=["cumulative_layout_shift"])
_BASIC_REQUEST = StubbedRequest(
    url=CruxApiRequester.API_URL,
    params={"key": "API_KEY"},
    data={"origin": "https://example.com", "metrics": ["cumulative_layout_shift"]},
    timeout=CruxApiRequester.DEFAULT_TIMEOUT,
)


def create_crux_api_record(query: CruxQuery) -> dict[str, Any]:
    """Create a test CrUX API record based on the query"""

    key = {"origin": query.origin}

    assert isinstance(query.metrics, list)
    metrics: dict[str, Any] = {}
    for metric in query.metrics:
        if metric == "cumulative_layout_shift":
            data = {
                "histogram": [
                    {"start": "0.00", "end": "0.10", "density": 0.8077},
                    {"start": "0.10", "end": "0.25", "density": 0.1003},
                    {"start": "0.25", "density": 0.092},
                ],
                "percentiles": {"p75": "0.07"},
            }
            metrics[metric] = data
        else:
            raise ValueError(f"need handler for metric {metric}")

    today = date.today()
    first_date = today - timedelta(days=30)
    last_date = today - timedelta(days=2)

    def date_as_dict(date: date) -> dict[str, int]:
        return {"year": date.year, "month": date.month, "day": date.day}

    collection_period = {
        "firstDate": date_as_dict(first_date),
        "lastDate": date_as_dict(last_date),
    }

    record = {
        "key": key,
        "metrics": metrics,
        "collectionPeriod": collection_period,
    }
    return {"record": record}


def test_crux_api_requester_raw_query_success() -> None:
    record = create_crux_api_record(_BASIC_QUERY)
    action = StubbedRequestAction(200, record)
    engine = StubbedEngine()
    engine.expect_request(_BASIC_REQUEST, action)
    requester = CruxApiRequester("API_KEY", engine)
    status_code, data = requester.raw_query(_BASIC_QUERY)
    assert status_code == 200
    assert data == record


def test_crux_result_from_raw_query_origin_query() -> None:
    record = create_crux_api_record(_BASIC_QUERY)
    result = CruxResult.from_raw_query(record)
    expected = CruxResult(
        key=CruxRecordKey(origin="https://example.com"),
        cumulative_layout_shift=CruxFloatHistogram(
            intervals=[0.0, 0.1, 0.25], densities=[0.8077, 0.1003, 0.092], p75=0.07
        ),
        first_date=date.today() - timedelta(days=30),
        last_date=date.today() - timedelta(days=2),
    )
    assert result == expected


def test_crux_result_from_raw_query_unknown_key_raises() -> None:
    with pytest.raises(ValueError, match="At top level, unexpected key 'foo'"):
        CruxResult.from_raw_query({"foo": "bar"})


def test_crux_result_from_raw_query_no_record_raises() -> None:
    with pytest.raises(ValueError, match="At top level, no key 'record'"):
        CruxResult.from_raw_query({})


def test_crux_result_from_raw_query_no_record_key_raises() -> None:
    record = create_crux_api_record(_BASIC_QUERY)
    del record["record"]["key"]
    with pytest.raises(ValueError, match="In record, no key 'key'"):
        CruxResult.from_raw_query(record)


def test_crux_record_key_from_raw_query_origin_only() -> None:
    key = CruxRecordKey.from_raw_query({"origin": "https://example.com"})
    assert repr(key) == "CruxRecordKey(origin='https://example.com')"
    assert key == CruxRecordKey(origin="https://example.com")


def test_crux_record_key_from_raw_query_url_only() -> None:
    key = CruxRecordKey.from_raw_query({"url": "https://example.com/"})
    assert repr(key) == "CruxRecordKey(url='https://example.com/')"
    assert key == CruxRecordKey(url="https://example.com/")


def test_crux_record_key_from_raw_query_with_form_factor() -> None:
    key = CruxRecordKey.from_raw_query(
        {"url": "https://example.com/", "formFactor": "PHONE"}
    )
    assert repr(key) == "CruxRecordKey(url='https://example.com/', form_factor='PHONE')"
    assert key == CruxRecordKey(url="https://example.com/", form_factor="PHONE")


def test_crux_record_key_no_origin_or_url_raises() -> None:
    with pytest.raises(ValueError, match="Either origin or url must be set"):
        CruxRecordKey.from_raw_query({})


def test_crux_record_key_both_origin_and_url_raises() -> None:
    with pytest.raises(ValueError, match="Can not set both origin and url"):
        CruxRecordKey.from_raw_query(
            {"origin": "https://example.com", "url": "https://example.com/faq"}
        )


def test_crux_record_key_from_raw_query_invalid_form_factor_raises() -> None:
    with pytest.raises(ValueError, match="'VR' is not a valid formFactor"):
        CruxRecordKey.from_raw_query(
            {"origin": "https://example.com", "formFactor": "VR"}
        )


def test_crux_record_key_from_raw_query_unknown_key_raises() -> None:
    with pytest.raises(ValueError, match="Unknown key 'foo'"):
        CruxRecordKey.from_raw_query({"origin": "https://example.com", "foo": "bar"})


def create_crux_error_service_disabled() -> dict[str, Any]:
    proj_num = "1234567890"
    enable_url = (
        "https://console.developers.google.com/apis/api/chromeuxreport.googleapis.com"
        f"/overview?project={proj_num}"
    )
    err_msg = (
        f"Chrome UX Report API has not been used in project {proj_num} before or it"
        f" is disabled. Enable it by visiting {enable_url} then retry. If you enabled"
        " this API recently, wait a few minutes for the action to propagate to our"
        " systems and retry."
    )
    error = {
        "code": 403,
        "message": err_msg,
        "status": "PERMISSION_DENIED",
        "details": [
            # Details omitted for tests
            # "@type": "type.googleapis.com/google.rpc.ErrorInfo"
            # "@type": "type.googleapis.com/google.rpc.LocalizedMessage",
            # "@type": "type.googleapis.com/google.rpc.Help",
        ],
    }
    return {"error": error}


def test_crux_api_requester_raw_query_permission_denied() -> None:
    query = CruxQuery("https://example.com", metrics=["cumulative_layout_shift"])
    expected_request = StubbedRequest(
        url=CruxApiRequester.API_URL,
        params={"key": "API_KEY"},
        data={"origin": "https://example.com", "metrics": ["cumulative_layout_shift"]},
        timeout=CruxApiRequester.DEFAULT_TIMEOUT,
    )
    error = create_crux_error_service_disabled()
    action = StubbedRequestAction(error["error"]["code"], error)
    engine = StubbedEngine()
    engine.expect_request(expected_request, action)
    requester = CruxApiRequester("API_KEY", engine)
    status_code, data = requester.raw_query(query)
    assert status_code == 403
    assert data == error


def test_main() -> None:
    expected_request = StubbedRequest(
        url=CruxApiRequester.API_URL,
        params={"key": "API_KEY"},
        data={"origin": "https://example.com"},
        timeout=CruxApiRequester.DEFAULT_TIMEOUT,
    )
    action = StubbedRequestAction(200, {"fake": "data"})
    engine = StubbedEngine()
    engine.expect_request(expected_request, action)
    requester = CruxApiRequester("API_KEY", engine)
    result = main("https://example.com", requester)
    assert result == '{"fake": "data"}'
