from base64 import b64encode
import json
from typing import Any

import requests

from django.conf import settings
from requests.auth import _basic_auth_str

from rest_framework import exceptions


def send_iq_sms(to_num: str, from_num: str, text: str) -> None:
    iq_formatted_to_num = to_num.replace("+", "")
    iq_formatted_from_num = from_num.replace("+", "")
    json_body = {
        "from": iq_formatted_from_num,
        "to": [iq_formatted_to_num],
        "text": text,
    }
    resp = requests.post(
        settings.IQ_PUBLISH_MESSAGE_URL,
        headers={"Authorization": f"Bearer {settings.IQ_OUTBOUND_API_KEY}"},
        json=json_body,
    )
    if resp.status_code < 200 or resp.status_code > 299:
        raise exceptions.ValidationError(json.loads(resp.content.decode()))


def search_iq_numbers(location: str = "", area_code: str = "", limit: int = 10):
    b64_creds = b64encode(
        b":".join(
            (
                settings.IQ_API_KEY.encode("latin1"),
                settings.IQ_API_SECRET.encode("latin1"),
            )
        )
    ).decode()
    print(f"b64_creds: {b64_creds}")
    json_body: dict[str, Any] = {"privateKey": b64_creds, "pageSort": {"size": limit}}
    search_url = f"{settings.IQ_API_BASE}/tnInventory"
    if location != "":
        json_body["city"] = location
    if area_code != "":
        json_body["tnWildcard"] = f"{area_code}*"

    token_response = requests.post(
        settings.IQ_OAUTH_TOKEN_PATH,
        {
            "client_id": settings.IQ_API_KEY,
            "client_secret": settings.IQ_API_SECRET,
            "grant_type": "client_credentials",
        },
    )
    print(token_response.json())
    access_token = token_response.json().get("access_token", "")
    print(access_token)
    access_token_headers = {"Authorization": f"Bearer {access_token}"}
    print(f"access_token_header: {access_token_headers}")

    print(f"url: {search_url}, json: {json_body}")
    basic_auth = _basic_auth_str(settings.IQ_API_KEY, settings.IQ_API_SECRET)
    print(f"basic_auth: {basic_auth}")
    basic_auth_headers = {"Authorization": f"Basic {b64_creds}"}
    print(f"basic_auth_headers: {basic_auth_headers}")
    print(json_body)
    resp = requests.post(
        search_url,
        json=json_body,
        headers=basic_auth_headers,
    )
    if resp.status_code < 200 or resp.status_code > 299:
        raise exceptions.ValidationError(json.loads(resp.content.decode()))
    return resp
