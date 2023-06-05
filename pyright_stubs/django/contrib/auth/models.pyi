"""
Typing hints for django.contrib.auth.models

pyright doesn't understand django OneToOne relationships, so create a stub of the User
class/type with a "profile" property of type Profile

Generated with:
stubgen -o pyright_stubs -m django.contrib.auth.models

Changes:
* Deleted globals and classes unused by User
"""

from _typeshed import Incomplete
from django.contrib.auth.base_user import AbstractBaseUser as AbstractBaseUser, BaseUserManager as BaseUserManager
from django.db import models as models

from emails.models import Profile

def update_last_login(sender, user, **kwargs) -> None: ...

class UserManager(BaseUserManager):
    use_in_migrations: bool
    def create_user(self, username, email: Incomplete | None = ..., password: Incomplete | None = ..., **extra_fields): ...
    def create_superuser(self, username, email: Incomplete | None = ..., password: Incomplete | None = ..., **extra_fields): ...
    def with_perm(self, perm, is_active: bool = ..., include_superusers: bool = ..., backend: Incomplete | None = ..., obj: Incomplete | None = ...): ...

class PermissionsMixin(models.Model):
    is_superuser: Incomplete
    groups: Incomplete
    user_permissions: Incomplete
    class Meta:
        abstract: bool
    def get_user_permissions(self, obj: Incomplete | None = ...): ...
    def get_group_permissions(self, obj: Incomplete | None = ...): ...
    def get_all_permissions(self, obj: Incomplete | None = ...): ...
    def has_perm(self, perm, obj: Incomplete | None = ...): ...
    def has_perms(self, perm_list, obj: Incomplete | None = ...): ...
    def has_module_perms(self, app_label): ...

class AbstractUser(AbstractBaseUser, PermissionsMixin):
    username_validator: Incomplete
    username: Incomplete
    first_name: Incomplete
    last_name: Incomplete
    email: Incomplete
    is_staff: Incomplete
    is_active: Incomplete
    date_joined: Incomplete
    objects: Incomplete
    EMAIL_FIELD: str
    USERNAME_FIELD: str
    REQUIRED_FIELDS: Incomplete
    class Meta:
        verbose_name: Incomplete
        verbose_name_plural: Incomplete
        abstract: bool
    def clean(self) -> None: ...
    def get_full_name(self): ...
    def get_short_name(self): ...
    def email_user(self, subject, message, from_email: Incomplete | None = ..., **kwargs) -> None: ...

class User(AbstractUser):
    profile: Profile
    class Meta(AbstractUser.Meta):
        swappable: str
