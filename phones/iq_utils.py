import json

from django.conf import settings

import requests
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
