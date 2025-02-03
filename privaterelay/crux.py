"""
Interface to Chrome User Experience (CrUX) API

https://developer.chrome.com/docs/crux/api
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from collections import deque
from collections.abc import Iterable
from datetime import date
from itertools import product
from typing import Any, Generic, Literal, NamedTuple, Self, TypeVar, cast, get_args

import requests

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
        if not isinstance(other, CruxQuery):
            return NotImplemented
        return (
            self.origin == other.origin
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


class CruxRecordKey:
    def __init__(
        self,
        origin: str | None = None,
        url: str | None = None,
        form_factor: CRUX_FORM_FACTOR | None = None,
    ) -> None:
        if origin is None and url is None:
            raise ValueError("Either origin or url must be set")
        if origin is not None and url is not None:
            raise ValueError("Can not set both origin and url")
        self.origin = origin
        self.url = url
        self.form_factor = form_factor

    def __repr__(self) -> str:
        attrs = ["origin", "url", "form_factor"]
        args = [
            f"{attr}={getattr(self, attr)!r}"
            for attr in attrs
            if getattr(self, attr, None) is not None
        ]
        return f"{self.__class__.__name__}({', '.join(args)})"

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, CruxRecordKey):
            return NotImplemented
        return (
            self.origin == other.origin
            and self.url == other.url
            and self.form_factor == other.form_factor
        )

    @classmethod
    def from_raw_query(cls, data: dict[str, str]) -> CruxRecordKey:
        origin: str | None = None
        url: str | None = None
        form_factor: CRUX_FORM_FACTOR | None = None

        for key, val in data.items():
            if key == "origin":
                origin = val
            elif key == "url":
                url = val
            elif key == "formFactor":
                if val in get_args(CRUX_FORM_FACTOR):
                    form_factor = cast(CRUX_FORM_FACTOR, val)
                else:
                    raise ValueError(f"{val!r} is not a valid formFactor")
            else:
                raise ValueError(f"Unknown key {key!r}")
        return CruxRecordKey(origin=origin, url=url, form_factor=form_factor)


FloatOrInt = TypeVar("FloatOrInt", float, int)


class GenericCruxPercentiles(Generic[FloatOrInt]):
    """Generic base class for CrUX (float or int) percentiles"""

    def __init__(self, p75: FloatOrInt) -> None:
        self.p75: FloatOrInt = p75

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(p75={self.p75!r})"

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, GenericCruxPercentiles):
            return NotImplemented
        return bool(self.p75 == other.p75)

    @classmethod
    def from_raw_query(cls, data: dict[str, Any]) -> Self:
        p75: FloatOrInt | None = None

        for key, val in data.items():
            if key == "percentiles":
                p75 = cls._parse_percentiles(val)
            else:
                raise ValueError(f"Percentiles has unknown key {key!r}")

        if p75 is None:
            raise ValueError("Percentiles has no key 'percentiles'")

        return cls(p75=p75)

    @classmethod
    def _convert(cls, val: Any) -> FloatOrInt:
        raise NotImplementedError()

    @classmethod
    def _parse_percentiles(cls, data: dict[str, FloatOrInt]) -> FloatOrInt:
        p75: FloatOrInt | None = None

        for key, val in data.items():
            if key == "p75":
                p75 = cls._convert(val)
            else:
                raise ValueError(f"Percentiles has unknown key {key!r}")

        if p75 is None:
            raise ValueError("Percentiles has no key 'p75'")
        return p75


class CruxFloatPercentiles(GenericCruxPercentiles[float]):
    """Represents a CrUX percentiles with a floating point p75."""

    @classmethod
    def _convert(cls, val: Any) -> float:
        return float(val)


class CruxIntPercentiles(GenericCruxPercentiles[float]):
    """Represents a CrUX percentiles with an integer p75."""

    @classmethod
    def _convert(cls, val: Any) -> int:
        return int(val)


class GenericCruxHistogram(Generic[FloatOrInt]):
    """
    Generic base class for CrUX histograms.

    CrUX histograms have 3 intervals:
    * "Good" (intervals[0] to intervals[1])
    * "Needs Improvement" (intervals[1] to intervals[2])
    * "Poor" (intervals[2] and above)

    The densities are the fraction of traffic in that interval, and add up to ~1.0

    Most histograms have interval boundaries in integer milliseconds.
    One (cumulative layout shift) has boundaries with unitless float values.
    """

    def __init__(
        self,
        intervals: list[FloatOrInt],
        densities: list[float],
        percentiles: CruxFloatPercentiles,
    ) -> None:
        if len(intervals) != 3:
            raise ValueError(f"len(intervals) should be 3, is {len(intervals)}")
        if len(densities) != 3:
            raise ValueError(f"len(densities) should be 3, is {len(densities)}")
        total = sum(densities)
        if not (0.998 < total < 1.002):
            raise ValueError(f"sum(densities) should be 1.0, is {total}")

        self.intervals: list[FloatOrInt] = intervals
        self.densities = densities
        self.percentiles = percentiles

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}("
            f"intervals={self.intervals!r}, "
            f"densities={self.densities!r}, "
            f"percentiles={self.percentiles!r})"
        )

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, GenericCruxHistogram):
            return NotImplemented
        return (
            self.intervals == other.intervals
            and self.densities == other.densities
            and self.percentiles == other.percentiles
        )

    @classmethod
    def from_raw_query(cls, data: dict[str, Any]) -> Self:
        intervals: list[FloatOrInt] = []
        densities: list[float] = []
        percentiles: CruxFloatPercentiles | None = None

        for key, val in data.items():
            if key == "histogram":
                intervals, densities = cls._parse_bin_list(val)
            elif key == "percentiles":
                percentiles = CruxFloatPercentiles.from_raw_query({"percentiles": val})
            else:
                raise ValueError(f"Unknown key {key!r}")

        if not intervals or not densities:
            raise ValueError("No key 'histogram'")
        if percentiles is None:
            raise ValueError("No key 'percentiles'")

        return cls(intervals=intervals, densities=densities, percentiles=percentiles)

    @classmethod
    def _parse_bin_list(
        cls, data: list[dict[str, Any]]
    ) -> tuple[list[FloatOrInt], list[float]]:
        bins: list[tuple[FloatOrInt, FloatOrInt | None, float]] = []
        for bin in data:
            bins.append(cls._parse_bin(bin))

        if len(bins) != 3:
            raise ValueError(f"Expected 3 bins, got {len(bins)}")
        if bins[0][1] != bins[1][0]:
            raise ValueError(
                f"Bin 1 end {bins[0][1]} does not match Bin 2 start {bins[1][0]}"
            )
        if bins[1][1] != bins[2][0]:
            raise ValueError(
                f"Bin 2 end {bins[1][1]} does not match Bin 3 start {bins[2][0]}"
            )
        if bins[2][1] is not None:
            raise ValueError("Bin 3 has end, none expected")

        intervals = [bin[0] for bin in bins]
        densities = [bin[2] for bin in bins]
        return intervals, densities

    @classmethod
    def _convert(cls, val: Any) -> FloatOrInt:
        raise NotImplementedError()

    @classmethod
    def _parse_bin(
        cls, data: dict[str, Any]
    ) -> tuple[FloatOrInt, FloatOrInt | None, float]:
        start: FloatOrInt | None = None
        end: FloatOrInt | None = None
        density: float | None = None

        for key, val in data.items():
            if key == "start":
                start = cls._convert(val)
            elif key == "end":
                end = cls._convert(val)
            elif key == "density":
                density = float(val)
            else:
                raise ValueError(f"Unknown key {key!r}")

        if start is None:
            raise ValueError("Bin has no key 'start'")
        if density is None:
            raise ValueError("Bin has no key 'density'")

        return start, end, density


class CruxHistogram(GenericCruxHistogram[int]):
    """
    Represents a CrUX Histogram with millisecond intervals.

    See GenericCruxHistogram for more information.
    """

    @classmethod
    def _convert(cls, val: Any) -> int:
        return int(val)


class CruxFloatHistogram(GenericCruxHistogram[float]):
    """
    Represents a CrUX Histogram with unitless float intervals.

    This is just used by cumulative layout shift.
    See GenericCruxHistogram for more information.
    """

    @classmethod
    def _convert(cls, val: Any) -> float:
        return float(val)


class CruxFractions:
    def __init__(self, phone: float, tablet: float, desktop: float) -> None:
        self.phone = phone
        self.tablet = tablet
        self.desktop = desktop

    def __repr__(self) -> str:
        args = [
            f"phone={self.phone!r}",
            f"tablet={self.tablet!r}",
            f"desktop={self.desktop!r}",
        ]
        return f"{self.__class__.__name__}({', '.join(args)})"

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, CruxFractions):
            return NotImplemented
        return (
            self.phone == other.phone
            and self.tablet == other.tablet
            and self.desktop == other.desktop
        )

    @classmethod
    def from_raw_query(cls, data: dict[str, Any]) -> CruxFractions:
        phone: float | None = None
        tablet: float | None = None
        desktop: float | None = None

        for key, val in data.items():
            if key == "fractions":
                phone, tablet, desktop = cls._parse_devices(val)
            else:
                raise ValueError(f"Unknown key {key!r}")

        if phone is None or tablet is None or desktop is None:
            raise ValueError("No key 'fractions'")

        return cls(phone=phone, tablet=tablet, desktop=desktop)

    @classmethod
    def _parse_devices(cls, data: dict[str, float]) -> tuple[float, float, float]:
        phone: float | None = None
        tablet: float | None = None
        desktop: float | None = None

        for key, val in data.items():
            if key == "phone":
                phone = float(val)
            elif key == "tablet":
                tablet = float(val)
            elif key == "desktop":
                desktop = float(val)
            else:
                raise ValueError(f"In fractions, unknown key {key!r}")

        if phone is None:
            raise ValueError("In fractions, no key 'phone'")
        if tablet is None:
            raise ValueError("In fractions, no key 'tablet'")
        if desktop is None:
            raise ValueError("In fractions, no key 'desktop'")

        return phone, tablet, desktop


class CruxMetrics:
    def __init__(
        self,
        experimental_time_to_first_byte: CruxHistogram | None = None,
        first_contentful_paint: CruxHistogram | None = None,
        form_factors: CruxFractions | None = None,
        interaction_to_next_paint: CruxHistogram | None = None,
        largest_contentful_paint: CruxHistogram | None = None,
        round_trip_time: CruxIntPercentiles | None = None,
        cumulative_layout_shift: CruxFloatHistogram | None = None,
    ) -> None:
        self.experimental_time_to_first_byte = experimental_time_to_first_byte
        self.first_contentful_paint = first_contentful_paint
        self.form_factors = form_factors
        self.interaction_to_next_paint = interaction_to_next_paint
        self.largest_contentful_paint = largest_contentful_paint
        self.round_trip_time = round_trip_time
        self.cumulative_layout_shift = cumulative_layout_shift

    def __repr__(self) -> str:
        attrs = (
            "experimental_time_to_first_byte",
            "first_contentful_paint",
            "form_factors",
            "interaction_to_next_paint",
            "largest_contentful_paint",
            "round_trip_time",
            "cumulative_layout_shift",
        )
        args = [
            f"{_attr}={val!r}"
            for _attr in attrs
            if (val := getattr(self, _attr, None)) is not None
        ]
        return f"{self.__class__.__name__}({', '.join(args)})"

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, CruxMetrics):
            return NotImplemented
        return (
            self.experimental_time_to_first_byte
            == other.experimental_time_to_first_byte
            and self.first_contentful_paint == other.first_contentful_paint
            and self.form_factors == other.form_factors
            and self.interaction_to_next_paint == other.interaction_to_next_paint
            and self.largest_contentful_paint == other.largest_contentful_paint
            and self.round_trip_time == other.round_trip_time
            and self.cumulative_layout_shift == other.cumulative_layout_shift
        )

    @classmethod
    def from_raw_query(cls, data: dict[str, Any]) -> CruxMetrics:
        experimental_time_to_first_byte: CruxHistogram | None = None
        first_contentful_paint: CruxHistogram | None = None
        form_factors: CruxFractions | None = None
        interaction_to_next_paint: CruxHistogram | None = None
        largest_contentful_paint: CruxHistogram | None = None
        round_trip_time: CruxIntPercentiles | None = None
        cumulative_layout_shift: CruxFloatHistogram | None = None

        for key, val in data.items():
            if key == "experimental_time_to_first_byte":
                experimental_time_to_first_byte = CruxHistogram.from_raw_query(val)
            elif key == "first_contentful_paint":
                first_contentful_paint = CruxHistogram.from_raw_query(val)
            elif key == "form_factors":
                form_factors = CruxFractions.from_raw_query(val)
            elif key == "interaction_to_next_paint":
                interaction_to_next_paint = CruxHistogram.from_raw_query(val)
            elif key == "largest_contentful_paint":
                largest_contentful_paint = CruxHistogram.from_raw_query(val)
            elif key == "round_trip_time":
                round_trip_time = CruxIntPercentiles.from_raw_query(val)
            elif key == "cumulative_layout_shift":
                cumulative_layout_shift = CruxFloatHistogram.from_raw_query(val)
            else:
                raise ValueError(f"In metrics, unknown key {key!r}")

        return CruxMetrics(
            experimental_time_to_first_byte=experimental_time_to_first_byte,
            first_contentful_paint=first_contentful_paint,
            form_factors=form_factors,
            interaction_to_next_paint=interaction_to_next_paint,
            largest_contentful_paint=largest_contentful_paint,
            round_trip_time=round_trip_time,
            cumulative_layout_shift=cumulative_layout_shift,
        )


class CruxResult:
    def __init__(
        self,
        key: CruxRecordKey,
        metrics: CruxMetrics,
        first_date: date,
        last_date: date,
    ) -> None:
        self.key = key
        self.metrics = metrics
        self.first_date = first_date
        self.last_date = last_date

    def __repr__(self) -> str:
        args = [
            f"key={self.key!r}",
            f"metrics={self.metrics!r}",
            f"first_date={self.first_date!r}",
            f"last_date={self.last_date!r}",
        ]
        return f"{self.__class__.__name__}({', '.join(args)})"

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, CruxResult):
            return NotImplemented
        return (
            self.key == other.key
            and self.metrics == other.metrics
            and self.first_date == other.first_date
            and self.last_date == other.last_date
        )

    @classmethod
    def from_raw_query(cls, data: dict[str, Any]) -> CruxResult:
        """
        Parse a JSON response from the CrUX API into a CruxResult

        TODO: Handle urlNormalizationDetails
        """
        record: CruxResult._RecordItems | None = None

        for key, value in data.items():
            if key == "record":
                record = cls._parse_record(value)
            else:
                raise ValueError(f"At top level, unexpected key {key!r}")

        if record is None:
            raise ValueError("At top level, no key 'record'")
        return CruxResult(
            key=record.key,
            metrics=record.metrics,
            first_date=record.first_date,
            last_date=record.last_date,
        )

    class _RecordItems(NamedTuple):
        key: CruxRecordKey
        first_date: date
        last_date: date
        metrics: CruxMetrics

    @classmethod
    def _parse_record(cls, record: dict[str, Any]) -> _RecordItems:
        record_key: CruxRecordKey | None = None
        metrics: CruxMetrics | None = None
        first_date: date | None = None
        last_date: date | None = None

        for key, val in record.items():
            if key == "key":
                record_key = CruxRecordKey.from_raw_query(val)
            elif key == "metrics":
                metrics = CruxMetrics.from_raw_query(val)
            elif key == "collectionPeriod":
                first_date, last_date = cls._parse_collection_period(val)
            else:
                raise ValueError(f"In record, unknown key {key!r}")

        if record_key is None:
            raise ValueError("In record, no key 'key'")
        if metrics is None:
            raise ValueError("In record, no key 'metrics'")
        if first_date is None or last_date is None:
            raise ValueError("In record, no key 'collectionPeriod'")

        return CruxResult._RecordItems(
            key=record_key,
            metrics=metrics,
            first_date=first_date,
            last_date=last_date,
        )

    @classmethod
    def _parse_collection_period(cls, data: dict[str, Any]) -> tuple[date, date]:
        first_date: date | None = None
        last_date: date | None = None

        for key, val in data.items():
            if key == "firstDate":
                first_date = cls._parse_date(val)
            elif key == "lastDate":
                last_date = cls._parse_date(val)
            else:
                raise ValueError(f"In collectionPeriod, unknown key {key!r}")

        if first_date is None:
            raise ValueError("In collectionPeriod, no key 'firstDate'")
        if last_date is None:
            raise ValueError("In collectionPeriod, no key 'lastDate'")
        return first_date, last_date

    @classmethod
    def _parse_date(cls, data: dict[str, int]) -> date:
        """Parse a date dict, like {"year": 2025, "month": 1, "day": 30}"""
        year: int | None = None
        month: int | None = None
        day: int | None = None

        for key, val in data.items():
            if key == "year":
                year = val
            elif key == "month":
                month = val
            elif key == "day":
                day = val
            else:
                raise ValueError(f"In date, unknown key {key!r}")

        if year is None:
            raise ValueError("In date, no key 'year'")
        if month is None:
            raise ValueError("In date, no key 'month'")
        if day is None:
            raise ValueError("In date, no key 'day'")

        return date(year=year, month=month, day=day)


class CruxError:
    def __init__(self, status_code: int, raw_data: dict[str, Any]) -> None:
        self.status_code = status_code
        self.raw_data = raw_data

    @classmethod
    def from_raw_query(cls, status_code: int, data: dict[str, Any]) -> CruxError:
        return CruxError(status_code=status_code, raw_data=data)


class CruxApiRequester:
    API_URL = "https://chromeuxreport.googleapis.com/v1/records:queryRecord"
    DEFAULT_TIMEOUT = 1.0

    def __init__(self, api_key: str, engine: RequestEngine) -> None:
        self._api_key = api_key
        self._engine = engine

    def raw_query(self, query: CruxQuery) -> tuple[int, dict[str, Any]]:
        resp = self._engine.post(
            url=self.API_URL,
            params={"key": self._api_key},
            data=query.as_dict(),
            timeout=self.DEFAULT_TIMEOUT,
        )
        return resp.status_code, resp.json()

    def query(self, query: CruxQuery) -> CruxResult | CruxError:
        """
        Request data from the CrUX API

        TODO: Time the request
        TODO: Handle timeout error
        TODO: Handle resp.json() failure
        TODO: Handle parsing ValueError
        """
        status_code, data = self.raw_query(query)
        if status_code == 200:
            return CruxResult.from_raw_query(data)
        else:
            return CruxError.from_raw_query(status_code, data)


def main(domain: str, requester: CruxApiRequester) -> str:
    query = CruxQuerySpecification(domain).queries()[0]
    status_code, data = requester.raw_query(query)
    return json.dumps(data)


if __name__ == "__main__":
    import os
    import sys

    api_key = os.environ.get("CRUX_API_KEY")
    if not api_key:
        print("Set CRUX_API_KEY to the API key")
        sys.exit(1)

    engine = RequestsEngine()
    requester = CruxApiRequester(api_key, engine)
    result = main("https://relay.firefox.com", requester)
    print(result)
