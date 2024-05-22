"""Tasks that detect and fix data issues in privaterelay app or 3rd part apps."""

from django.contrib.auth.models import User
from django.db.models import Q

from allauth.socialaccount.models import SocialAccount

from .cleaner_task import CleanerTask, DataBisectSpec, DataItem, DataModelSpec


class MissingEmailCleaner(CleanerTask):
    slug = "missing-email"
    title = "Ensure all users have an email"
    check_description = (
        "When User.email is empty, we are unable to forward email to the Relay user."
        " We can get the email from the FxA profile if available."
    )

    data_specification = [
        # Report on how many users do not have an email
        DataModelSpec(
            model=User,
            subdivisions=[
                DataBisectSpec("email", ~Q(email__exact="")),
                DataBisectSpec("!email.fxa", Q(socialaccount__provider="fxa")),
            ],
            omit_key_prefixes=["!email.!fxa"],
            report_name_overrides={"!email": "No Email", "!email.fxa": "Has FxA"},
            ok_key="email",
            needs_cleaning_key="!email.fxa",
        )
    ]

    def clean_users(self, item: DataItem[User]) -> int:
        fixed = 0
        for user in item.get_queryset():
            try:
                fxa_account = SocialAccount.objects.get(provider="fxa", user=user)
            except SocialAccount.DoesNotExist:
                continue
            if fxa_email := fxa_account.extra_data.get("email"):
                user.email = fxa_email
                user.save(update_fields=["email"])
                fixed += 1
        return fixed
