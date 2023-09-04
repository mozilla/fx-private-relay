# Type stubs for Django waffle
# https://github.com/django-waffle/django-waffle/blob/v3.0.0/waffle/models.py
# Can be removed once type hints ship in the release after v3.0.0

from logging import Logger
from typing import Literal, TypeVar

from django.contrib.auth.models import AbstractBaseUser
from django.db import models
from django.http import HttpRequest
from django.utils.translation import gettext_lazy as _

from django_stubs_ext.db.models import TypedModelMeta
from waffle import managers

logger: Logger
CACHE_EMPTY: str

_T = TypeVar("_T", bound="BaseModel")

class BaseModel(models.Model):
    SINGLE_CACHE_KEY: str
    ALL_CACHE_KEY: str

    class Meta(TypedModelMeta):
        abstract = True
    def natural_key(self) -> tuple[str, ...]: ...
    @classmethod
    def _cache_key(cls, name: str) -> str: ...
    @classmethod
    def get(cls: type[_T], name: str) -> _T: ...
    @classmethod
    def get_from_db(cls: type[_T], name: str) -> _T: ...
    @classmethod
    def get_all(cls: type[_T]) -> list[_T]: ...
    @classmethod
    def get_all_from_db(cls: type[_T]) -> list[_T]: ...
    def flush(self) -> None: ...
    def save(self, *args, **kwargs) -> None: ...
    def delete(self, *args, **kwargs) -> tuple[int, dict[str, int]]: ...

def set_flag(
    request: HttpRequest,
    flag_name: str,
    active: bool = True,
    session_only: bool = False,
) -> None: ...

class AbstractBaseFlag(BaseModel):
    name: models.CharField
    everyone: models.BooleanField
    percent: models.DecimalField
    testing: models.BooleanField
    superusers: models.BooleanField
    staff: models.BooleanField
    authenticated: models.BooleanField
    languages: models.TextField
    rollout: models.BooleanField
    note: models.TextField
    created: models.DateTimeField
    modified: models.DateTimeField
    objects = managers.FlagManager
    SINGLE_CACHE_KEY: str
    ALL_CACHE_KEY: str

    class Meta(TypedModelMeta):
        abstract = True
        verbose_name = _("Flag")
        verbose_name_plural = _("Flags")
    def flush(self) -> None: ...
    def get_flush_keys(self, flush_keys: list[str] | None = None) -> list[str]: ...
    def is_active_for_user(self, user: AbstractBaseUser) -> Literal[True] | None: ...
    def is_active(
        self, request: HttpRequest, read_only: bool = False
    ) -> bool | None: ...

class AbstractUserFlag(AbstractBaseFlag):
    groups: models.ManyToManyField
    users: models.ManyToManyField

    class Meta(AbstractBaseFlag.Meta):
        abstract = True
        verbose_name = _("Flag")
        verbose_name_plural = _("Flags")
    def get_flush_keys(self, flush_keys: list[str] | None = None) -> list[str]: ...
    def is_active_for_user(self, user: AbstractBaseUser) -> Literal[True] | None: ...

class Flag(AbstractUserFlag):
    class Meta(AbstractUserFlag.Meta):
        swappable: str
        verbose_name = _("Flag")
        verbose_name_plural = _("Flags")

class AbstractBaseSwitch(BaseModel):
    name: models.CharField
    active: models.BooleanField
    note: models.TextField
    created: models.DateTimeField
    modified: models.DateTimeField
    objects: managers.SwitchManager
    SINGLE_CACHE_KEY: str
    ALL_CACHE_KEY: str

    class Meta(TypedModelMeta):
        abstract = True
        verbose_name = _("Switch")
        verbose_name_plural = _("Switches")
    def is_active(self) -> bool: ...

class AbstractBaseSample(BaseModel):
    name: models.CharField
    percent: models.DecimalField
    note: models.TextField
    created: models.DateTimeField
    modified: models.DateTimeField
    objects = managers.SampleManager
    SINGLE_CACHE_KEY: str
    ALL_CACHE_KEY: str

    class Meta(TypedModelMeta):
        abstract = True
        verbose_name = _("Sample")
        verbose_name_plural = _("Samples")
    def is_active(self) -> bool: ...

class Switch(AbstractBaseSwitch):
    class Meta(AbstractBaseSwitch.Meta):
        swappable = "WAFFLE_SWITCH_MODEL"
        verbose_name = _("Switch")
        verbose_name_plural = _("Switches")

class Sample(AbstractBaseSample):
    class Meta(AbstractBaseSample.Meta):
        swappable = "WAFFLE_SAMPLE_MODEL"
        verbose_name = _("Sample")
        verbose_name_plural = _("Samples")
