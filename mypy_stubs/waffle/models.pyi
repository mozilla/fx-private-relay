from _typeshed import Incomplete
from django.db import models
from waffle import (
    get_waffle_flag_model as get_waffle_flag_model,
    get_waffle_sample_model as get_waffle_sample_model,
    get_waffle_switch_model as get_waffle_switch_model,
    managers as managers,
)
from waffle.utils import (
    get_cache as get_cache,
    get_setting as get_setting,
    keyfmt as keyfmt,
)

logger: Incomplete
CACHE_EMPTY: str

class BaseModel(models.Model):
    SINGLE_CACHE_KEY: str
    ALL_CACHE_KEY: str

    class Meta:
        abstract: bool
    def natural_key(self): ...
    @classmethod
    def get(cls, name): ...
    @classmethod
    def get_from_db(cls, name): ...
    @classmethod
    def get_all(cls): ...
    @classmethod
    def get_all_from_db(cls): ...
    def flush(self) -> None: ...
    modified: Incomplete
    def save(self, *args, **kwargs): ...
    def delete(self, *args, **kwargs): ...

def set_flag(
    request, flag_name, active: bool = ..., session_only: bool = ...
) -> None: ...

class AbstractBaseFlag(BaseModel):
    name: Incomplete
    everyone: Incomplete
    percent: Incomplete
    testing: Incomplete
    superusers: Incomplete
    staff: Incomplete
    authenticated: Incomplete
    languages: Incomplete
    rollout: Incomplete
    note: Incomplete
    created: Incomplete
    modified: Incomplete
    objects: Incomplete
    SINGLE_CACHE_KEY: str
    ALL_CACHE_KEY: str

    class Meta:
        abstract: bool
        verbose_name: Incomplete
        verbose_name_plural: Incomplete
    def flush(self) -> None: ...
    def get_flush_keys(self, flush_keys: Incomplete | None = ...): ...
    def is_active_for_user(self, user): ...
    def is_active(self, request, read_only: bool = ...): ...

class AbstractUserFlag(AbstractBaseFlag):
    groups: Incomplete
    users: Incomplete

    class Meta(AbstractBaseFlag.Meta):
        abstract: bool
        verbose_name: Incomplete
        verbose_name_plural: Incomplete
    def get_flush_keys(self, flush_keys: Incomplete | None = ...): ...
    def is_active_for_user(self, user): ...

class Flag(AbstractUserFlag):
    class Meta(AbstractUserFlag.Meta):
        swappable: str
        verbose_name: Incomplete
        verbose_name_plural: Incomplete

class AbstractBaseSwitch(BaseModel):
    name: Incomplete
    active: Incomplete
    note: Incomplete
    created: Incomplete
    modified: Incomplete
    objects: Incomplete
    SINGLE_CACHE_KEY: str
    ALL_CACHE_KEY: str

    class Meta:
        abstract: bool
        verbose_name: Incomplete
        verbose_name_plural: Incomplete
    def is_active(self): ...

class AbstractBaseSample(BaseModel):
    name: Incomplete
    percent: Incomplete
    note: Incomplete
    created: Incomplete
    modified: Incomplete
    objects: Incomplete
    SINGLE_CACHE_KEY: str
    ALL_CACHE_KEY: str

    class Meta:
        abstract: bool
        verbose_name: Incomplete
        verbose_name_plural: Incomplete
    def is_active(self): ...

class Switch(AbstractBaseSwitch):
    class Meta(AbstractBaseSwitch.Meta):
        swappable: str
        verbose_name: Incomplete
        verbose_name_plural: Incomplete

class Sample(AbstractBaseSample):
    class Meta(AbstractBaseSample.Meta):
        swappable: str
        verbose_name: Incomplete
        verbose_name_plural: Incomplete
