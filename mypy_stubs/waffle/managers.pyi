from django.db import models
from waffle.utils import get_cache as get_cache, get_setting as get_setting

class BaseManager(models.Manager):
    KEY_SETTING: str
    def get_by_natural_key(self, name): ...
    def create(self, *args, **kwargs): ...

class FlagManager(BaseManager):
    KEY_SETTING: str

class SwitchManager(BaseManager):
    KEY_SETTING: str

class SampleManager(BaseManager):
    KEY_SETTING: str
