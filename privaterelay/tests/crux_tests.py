"""Tests for privaterelay/crux.py"""

import re
from datetime import date, timedelta
from typing import Any

import pytest
import responses

from ..crux import (
    CruxApiRequester,
    CruxFloatHistogram,
    CruxFloatPercentiles,
    CruxFractions,
    CruxHistogram,
    CruxIntPercentiles,
    CruxMetrics,
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
    """Create a test CrUX API record based on 2025-01-27 data and the query"""

    key = {"origin": query.origin}

    assert isinstance(query.metrics, list)
    metrics: dict[str, Any] = {}
    for metric in query.metrics:
        if metric == "experimental_time_to_first_byte":
            metrics[metric] = {
                "histogram": [
                    {"start": 0, "end": 800, "density": 0.7425},
                    {"start": 800, "end": 1800, "density": 0.1969},
                    {"start": 1800, "density": 0.0606},
                ],
                "percentiles": {"p75": 817},
            }
        elif metric == "first_contentful_paint":
            metrics[metric] = {
                "histogram": [
                    {"start": 0, "end": 1800, "density": 0.6787},
                    {"start": 1800, "end": 3000, "density": 0.1922},
                    {"start": 3000, "density": 0.1291},
                ],
                "percentiles": {"p75": 2136},
            }
        elif metric == "form_factors":
            metrics[metric] = {
                "fractions": {"phone": 0.4959, "tablet": 0.0148, "desktop": 0.4893}
            }
        elif metric == "interaction_to_next_paint":
            metrics[metric] = {
                "histogram": [
                    {"start": 0, "end": 200, "density": 0.905},
                    {"start": 200, "end": 500, "density": 0.067},
                    {"start": 500, "density": 0.028},
                ],
                "percentiles": {"p75": 102},
            }
        elif metric == "largest_contentful_paint":
            metrics[metric] = {
                "histogram": [
                    {"start": 0, "end": 2500, "density": 0.7916},
                    {"start": 2500, "end": 4000, "density": 0.134},
                    {"start": 4000, "density": 0.0744},
                ],
                "percentiles": {"p75": 2261},
            }
        elif metric == "round_trip_time":
            metrics[metric] = {"percentiles": {"p75": 138}}
        elif metric == "cumulative_layout_shift":
            metrics[metric] = {
                "histogram": [
                    {"start": "0.00", "end": "0.10", "density": 0.8077},
                    {"start": "0.10", "end": "0.25", "density": 0.1003},
                    {"start": "0.25", "density": 0.092},
                ],
                "percentiles": {"p75": "0.07"},
            }
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


def test_crux_result_from_raw_query_basic_query() -> None:
    record = create_crux_api_record(_BASIC_QUERY)
    result = CruxResult.from_raw_query(record)
    expected = CruxResult(
        key=CruxRecordKey(origin="https://example.com"),
        metrics=CruxMetrics(
            cumulative_layout_shift=CruxFloatHistogram(
                intervals=[0.0, 0.1, 0.25],
                densities=[0.8077, 0.1003, 0.092],
                percentiles=CruxFloatPercentiles(p75=0.07),
            )
        ),
        first_date=date.today() - timedelta(days=30),
        last_date=date.today() - timedelta(days=2),
    )
    assert result == expected


def test_crux_result_from_raw_query_experimental_time_to_first_byte() -> None:
    query = CruxQuery(
        origin="https://example.com", metrics=["experimental_time_to_first_byte"]
    )
    record = create_crux_api_record(query)
    result = CruxResult.from_raw_query(record)
    expected = CruxResult(
        key=CruxRecordKey(origin="https://example.com"),
        metrics=CruxMetrics(
            experimental_time_to_first_byte=CruxHistogram(
                intervals=[0, 800, 1800],
                densities=[0.7425, 0.1969, 0.0606],
                percentiles=CruxFloatPercentiles(p75=817),
            )
        ),
        first_date=date.today() - timedelta(days=30),
        last_date=date.today() - timedelta(days=2),
    )
    assert result == expected


def test_crux_result_from_raw_query_first_contentful_paint() -> None:
    query = CruxQuery(origin="https://example.com", metrics=["first_contentful_paint"])
    record = create_crux_api_record(query)
    result = CruxResult.from_raw_query(record)
    expected = CruxResult(
        key=CruxRecordKey(origin="https://example.com"),
        metrics=CruxMetrics(
            first_contentful_paint=CruxHistogram(
                intervals=[0, 1800, 3000],
                densities=[0.6787, 0.1922, 0.1291],
                percentiles=CruxFloatPercentiles(p75=2136),
            )
        ),
        first_date=date.today() - timedelta(days=30),
        last_date=date.today() - timedelta(days=2),
    )
    assert result == expected


def test_crux_result_from_raw_query_interaction_to_next_paint() -> None:
    query = CruxQuery(
        origin="https://example.com", metrics=["interaction_to_next_paint"]
    )
    record = create_crux_api_record(query)
    result = CruxResult.from_raw_query(record)
    expected = CruxResult(
        key=CruxRecordKey(origin="https://example.com"),
        metrics=CruxMetrics(
            interaction_to_next_paint=CruxHistogram(
                intervals=[0, 200, 500],
                densities=[0.905, 0.067, 0.028],
                percentiles=CruxFloatPercentiles(p75=102),
            )
        ),
        first_date=date.today() - timedelta(days=30),
        last_date=date.today() - timedelta(days=2),
    )
    assert result == expected


def test_crux_result_from_raw_query_largest_contentful_paint() -> None:
    query = CruxQuery(
        origin="https://example.com", metrics=["largest_contentful_paint"]
    )
    record = create_crux_api_record(query)
    result = CruxResult.from_raw_query(record)
    expected = CruxResult(
        key=CruxRecordKey(origin="https://example.com"),
        metrics=CruxMetrics(
            largest_contentful_paint=CruxHistogram(
                intervals=[0, 2500, 4000],
                densities=[0.7916, 0.134, 0.0744],
                percentiles=CruxFloatPercentiles(p75=2261),
            )
        ),
        first_date=date.today() - timedelta(days=30),
        last_date=date.today() - timedelta(days=2),
    )
    assert result == expected


def test_crux_result_from_raw_query_round_trip_time() -> None:
    query = CruxQuery(origin="https://example.com", metrics=["round_trip_time"])
    record = create_crux_api_record(query)
    result = CruxResult.from_raw_query(record)
    expected = CruxResult(
        key=CruxRecordKey(origin="https://example.com"),
        metrics=CruxMetrics(round_trip_time=CruxIntPercentiles(p75=138)),
        first_date=date.today() - timedelta(days=30),
        last_date=date.today() - timedelta(days=2),
    )
    assert result == expected


def test_crux_result_from_raw_query_form_factors() -> None:
    query = CruxQuery(origin="https://example.com", metrics=["form_factors"])
    record = create_crux_api_record(query)
    result = CruxResult.from_raw_query(record)
    expected = CruxResult(
        key=CruxRecordKey(origin="https://example.com"),
        metrics=CruxMetrics(
            form_factors=CruxFractions(phone=0.4959, tablet=0.0148, desktop=0.4893)
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


@pytest.mark.parametrize("field", ("key", "collectionPeriod", "metrics"))
def test_crux_result_from_raw_query_missing_record_key_raises(field: str) -> None:
    record = create_crux_api_record(_BASIC_QUERY)
    del record["record"][field]
    with pytest.raises(ValueError, match=f"In record, no key {field!r}"):
        CruxResult.from_raw_query(record)


def test_crux_result_from_raw_query_unknown_record_key_raises() -> None:
    record = create_crux_api_record(_BASIC_QUERY)
    record["record"]["foo"] = "bar"
    with pytest.raises(ValueError, match="In record, unknown key 'foo'"):
        CruxResult.from_raw_query(record)


@pytest.mark.parametrize("field", ("firstDate", "lastDate"))
def test_crux_result_from_raw_query_no_date_raises(field: str) -> None:
    record = create_crux_api_record(_BASIC_QUERY)
    del record["record"]["collectionPeriod"][field]
    with pytest.raises(ValueError, match=f"In collectionPeriod, no key '{field}'"):
        CruxResult.from_raw_query(record)


@pytest.mark.parametrize("field", ["year", "month", "day"])
def test_crux_result_from_raw_query_missing_date_field_raises(field: str) -> None:
    record = create_crux_api_record(_BASIC_QUERY)
    del record["record"]["collectionPeriod"]["firstDate"][field]
    with pytest.raises(ValueError, match=f"In date, no key {field!r}"):
        CruxResult.from_raw_query(record)


def test_crux_result_from_raw_query_unknown_date_field_raises() -> None:
    record = create_crux_api_record(_BASIC_QUERY)
    record["record"]["collectionPeriod"]["firstDate"]["hour"] = 12
    with pytest.raises(ValueError, match="In date, unknown key 'hour'"):
        CruxResult.from_raw_query(record)


def test_crux_result_from_raw_query_unknown_metric_raises() -> None:
    record = create_crux_api_record(_BASIC_QUERY)
    record["record"]["metrics"]["pizzazz"] = "on fleek"
    with pytest.raises(ValueError, match="In metrics, unknown key 'pizzazz'"):
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


def test_crux_percentiles_from_raw_query() -> None:
    percentiles = CruxFloatPercentiles.from_raw_query({"percentiles": {"p75": "0.07"}})
    assert repr(percentiles) == "CruxFloatPercentiles(p75=0.07)"
    assert percentiles == CruxFloatPercentiles(p75=0.07)


def test_crux_percentiles_from_raw_query_no_p75_raises() -> None:
    with pytest.raises(ValueError, match="Percentiles has no key 'p75'"):
        CruxFloatPercentiles.from_raw_query({"percentiles": {}})


def test_crux_percentiles_from_raw_query_extra_percentile_raises() -> None:
    with pytest.raises(ValueError, match="Percentiles has unknown key 'p50'"):
        CruxFloatPercentiles.from_raw_query({"p50": "0.5", "p75": "0.75"})


def test_crux_float_histogram_from_raw_query() -> None:
    data = {
        "histogram": [
            {"start": "0.00", "end": "0.10", "density": 0.8077},
            {"start": "0.10", "end": "0.25", "density": 0.1003},
            {"start": "0.25", "density": 0.092},
        ],
        "percentiles": {"p75": "0.07"},
    }
    histogram = CruxFloatHistogram.from_raw_query(data)
    assert repr(histogram) == (
        "CruxFloatHistogram(intervals=[0.0, 0.1, 0.25],"
        " densities=[0.8077, 0.1003, 0.092],"
        " percentiles=CruxFloatPercentiles(p75=0.07))"
    )
    assert histogram == CruxFloatHistogram(
        intervals=[0.0, 0.1, 0.25],
        densities=[0.8077, 0.1003, 0.092],
        percentiles=CruxFloatPercentiles(p75=0.07),
    )


def test_crux_float_histogram_from_raw_query_unknown_key_raises() -> None:
    with pytest.raises(ValueError, match="Unknown key 'foo'"):
        CruxFloatHistogram.from_raw_query({"foo": "bar"})


def test_crux_float_histogram_from_raw_query_no_histogram_raises() -> None:
    with pytest.raises(ValueError, match="No key 'histogram'"):
        CruxFloatHistogram.from_raw_query({"percentiles": {"p75": "0.07"}})


def test_crux_float_histogram_from_raw_query_no_percentiles_raises() -> None:
    data = {
        "histogram": [
            {"start": "0.00", "end": "0.10", "density": 0.8077},
            {"start": "0.10", "end": "0.25", "density": 0.1003},
            {"start": "0.25", "density": 0.092},
        ],
    }
    with pytest.raises(ValueError, match="No key 'percentiles'"):
        CruxFloatHistogram.from_raw_query(data)


def test_crux_float_histogram_from_raw_query_2_bins_raises() -> None:
    data = {
        "histogram": [
            {"start": "0.00", "end": "0.25", "density": 0.9},
            {"start": "0.25", "density": 0.1},
        ],
        "percentiles": {"p75": "0.07"},
    }
    with pytest.raises(ValueError, match="Expected 3 bins, got 2"):
        CruxFloatHistogram.from_raw_query(data)


def test_crux_float_histogram_from_raw_query_bin1_end_not_bin2_start_raises() -> None:
    data = {
        "histogram": [
            {"start": "0.00", "end": "0.10", "density": 0.8077},
            {"start": "0.11", "end": "0.25", "density": 0.1003},
            {"start": "0.25", "density": 0.092},
        ],
        "percentiles": {"p75": "0.07"},
    }
    with pytest.raises(
        ValueError, match="Bin 1 end 0.1 does not match Bin 2 start 0.11"
    ):
        CruxFloatHistogram.from_raw_query(data)


def test_crux_float_histogram_from_raw_query_bin2_end_not_bin3_start_raises() -> None:
    data = {
        "histogram": [
            {"start": "0.00", "end": "0.10", "density": 0.8077},
            {"start": "0.10", "end": "0.26", "density": 0.1003},
            {"start": "0.25", "density": 0.092},
        ],
        "percentiles": {"p75": "0.07"},
    }
    with pytest.raises(
        ValueError, match="Bin 2 end 0.26 does not match Bin 3 start 0.25"
    ):
        CruxFloatHistogram.from_raw_query(data)


def test_crux_float_histogram_from_raw_query_bin3_end_set_raises() -> None:
    data = {
        "histogram": [
            {"start": "0.00", "end": "0.10", "density": 0.8077},
            {"start": "0.10", "end": "0.25", "density": 0.1003},
            {"start": "0.25", "end": "1000.0", "density": 0.092},
        ],
        "percentiles": {"p75": "0.07"},
    }
    with pytest.raises(ValueError, match="Bin 3 has end, none expected"):
        CruxFloatHistogram.from_raw_query(data)


def test_crux_float_histogram_from_raw_query_missing_start_raises() -> None:
    data = {
        "histogram": [{"end": "0.10", "density": 0.8077}],
        "percentiles": {"p75": "0.07"},
    }
    with pytest.raises(ValueError, match="Bin has no key 'start'"):
        CruxFloatHistogram.from_raw_query(data)


def test_crux_float_histogram_from_raw_query_missing_density_raises() -> None:
    data = {
        "histogram": [{"start": "0.0", "end": "0.10"}],
        "percentiles": {"p75": "0.07"},
    }
    with pytest.raises(ValueError, match="Bin has no key 'density'"):
        CruxFloatHistogram.from_raw_query(data)


def test_crux_float_histogram_from_raw_query_extra_histogram_key_raises() -> None:
    data = {
        "histogram": [{"start": "0.0", "end": "0.10", "density": 0.8, "color": "BLUE"}],
        "percentiles": {"p75": "0.07"},
    }
    with pytest.raises(ValueError, match="Unknown key 'color'"):
        CruxFloatHistogram.from_raw_query(data)


def test_crux_float_histogram_short_intervals_raises() -> None:
    with pytest.raises(ValueError, match=re.escape("len(intervals) should be 3, is 2")):
        CruxFloatHistogram(
            intervals=[0.0, 1.0],
            densities=[0.9, 0.09, 0.01],
            percentiles=CruxFloatPercentiles(p75=0.5),
        )


def test_crux_float_histogram_long_densities_raises() -> None:
    with pytest.raises(ValueError, match=re.escape("len(densities) should be 3, is 4")):
        CruxFloatHistogram(
            intervals=[0.0, 1.0, 2.0],
            densities=[0.9, 0.09, 0.01, 0.0],
            percentiles=CruxFloatPercentiles(p75=0.5),
        )


def test_crux_float_histogram_high_density_total_raises() -> None:
    with pytest.raises(
        ValueError, match=re.escape("sum(densities) should be 1.0, is 1.1")
    ):
        CruxFloatHistogram(
            intervals=[0.0, 1.0, 2.0],
            densities=[0.9, 0.09, 0.11],
            percentiles=CruxFloatPercentiles(p75=0.5),
        )


def test_crux_fractions_from_raw_query() -> None:
    fractions = CruxFractions.from_raw_query(
        {"fractions": {"phone": 0.5, "tablet": 0.1, "desktop": 0.4}}
    )
    assert repr(fractions) == "CruxFractions(phone=0.5, tablet=0.1, desktop=0.4)"
    assert fractions == CruxFractions(phone=0.5, tablet=0.1, desktop=0.4)


def test_crux_fractions_from_raw_query_no_fractions_key_raises() -> None:
    with pytest.raises(ValueError, match="No key 'fractions'"):
        CruxFractions.from_raw_query({})


def test_crux_fractions_from_raw_query_extra_key_raises() -> None:
    data = {"fractions": {"phone": 0.5, "tablet": 0.1, "desktop": 0.4}, "foo": "bar"}
    with pytest.raises(ValueError, match="Unknown key 'foo'"):
        CruxFractions.from_raw_query(data)


@pytest.mark.parametrize("device", ("phone", "tablet", "desktop"))
def test_crux_fractions_from_raw_query_no_device_key_raises(device: str) -> None:
    data = {"fractions": {"phone": 0.5, "tablet": 0.1, "desktop": 0.4}}
    del data["fractions"][device]
    with pytest.raises(ValueError, match=f"In fractions, no key '{device}'"):
        CruxFractions.from_raw_query(data)


def test_crux_fractions_from_raw_query_extra_device_key_raises() -> None:
    data = {"fractions": {"phone": 0.5, "tablet": 0.1, "desktop": 0.4, "vr": 0.001}}
    with pytest.raises(ValueError, match="In fractions, unknown key 'vr'"):
        CruxFractions.from_raw_query(data)


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
