from django.test import TestCase

import pytest

@pytest.mark.xfail(reason="urlpattern needs migration to django.urls.path")
@pytest.mark.parametrize("format", ("yaml", "json"))
def test_swagger_format(client, format):
    path = f"/api/v1/swagger.{format}"
    response = client.get(path)
    assert response.status_code == 200
    expected_content_type = {
        "yaml": "application/yaml; charset=utf-8",
        "json": "application/json; charset=utf-8",
    }[format]
    assert response["Content-Type"].startswith(f"application/{format}")


@pytest.mark.parametrize("subpath", ("swagger", "swagger.", "swagger.txt"))
def test_swagger_unknown_format(client, subpath):
    path = f"/api/v1/{subpath}"
    response = client.get(path)
    assert response.status_code == 404
