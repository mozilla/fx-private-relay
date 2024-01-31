"""Types for the privaterelay app"""
from typing import Literal

RELAY_CHANNEL_NAME = Literal["local", "dev", "stage", "prod"]
