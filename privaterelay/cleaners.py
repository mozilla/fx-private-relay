"""Tasks that detect and fix data issues in privaterelay app or 3rd party apps."""

from django.contrib.auth.models import User
from django.db.models import Q, QuerySet, Value
from django.db.models.functions import Coalesce, NullIf

from allauth.socialaccount.models import SocialAccount, SocialApp

from .cleaner_task import CleanerTask, DataBisectSpec, DataModelSpec


class MissingEmailCleaner(CleanerTask):
    slug = "missing-email"
    title = "Ensure all users have an email"
    check_description = (
        "When User.email is empty, we are unable to forward email to the Relay user."
        " We can get the email from the FxA profile if available."
    )

    # The Firefox Accounts default provider identifier is `fxa`. Firefox Accounts was
    # the name for Mozilla Accounts before 2023. This query returns the value, as a
    # one-element list, of the `SocialApp.provider_id` if set, and `fxa` if not.
    #
    # The `provider` field for a SocialAccount is a CharField, not a ForeignKey.  The
    # default `provider` value is the `id` of the SocialAccount provider. This `id` is
    # used in the django-allauth URLs. The `provider` value can be overridden by setting
    # the `SocialApp.provider_id`. This supports generic providers like OpenID Connect
    # and SAML. When it is set on a non-generic provider, it changes the value of the
    # SocialAccount's `provider`, but not the URLs. When django-allauth needs the
    # SocialApp for a given SocialAccount, it uses an adapter to look it up at runtime.
    #
    # See:
    # - The Firefox Account Provider docs
    # https://docs.allauth.org/en/latest/socialaccount/providers/fxa.html
    # - The OpenID Connect docs
    # https://docs.allauth.org/en/latest/socialaccount/providers/openid_connect.html
    # - The DefaultSocialAccountAdapter docs
    # https://docs.allauth.org/en/latest/socialaccount/adapter.html#allauth.socialaccount.adapter.DefaultSocialAccountAdapter.get_provider

    _fxa_provider_id = SocialApp.objects.filter(provider="fxa").values_list(
        Coalesce(NullIf("provider_id", Value("")), "provider"), flat=True
    )

    data_specification = [
        # Report on how many users do not have an email
        DataModelSpec(
            model=User,
            subdivisions=[
                DataBisectSpec("email", ~Q(email__exact="")),
                DataBisectSpec(
                    "!email.fxa", Q(socialaccount__provider__in=_fxa_provider_id)
                ),
            ],
            omit_key_prefixes=["!email.!fxa"],
            report_name_overrides={"!email": "No Email", "!email.fxa": "Has FxA"},
            ok_key="email",
            needs_cleaning_key="!email.fxa",
        )
    ]

    def clean_users(self, queryset: QuerySet[User]) -> int:
        fixed = 0
        for user in queryset:
            try:
                fxa_account = SocialAccount.objects.get(
                    provider__in=self._fxa_provider_id, user=user
                )
            except SocialAccount.DoesNotExist:
                continue
            if fxa_email := fxa_account.extra_data.get("email"):
                user.email = fxa_email
                user.save(update_fields=["email"])
                fixed += 1
        return fixed
