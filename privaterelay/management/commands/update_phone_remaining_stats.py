from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.core.management.base import BaseCommand

from allauth.socialaccount.models import SocialAccount

if settings.PHONES_ENABLED:
    from phones.models import RelayNumber

from privaterelay.views import update_fxa


def update_phone_remaining_stats():
    if not settings.PHONES_ENABLED:
        return []
    accounts_with_phones = []
    for sub_with_phone in list(
        filter(None, settings.SUBSCRIPTIONS_WITH_PHONE.split(","))
    ):
        social_accounts = SocialAccount.objects.filter(
            extra_data__icontains=sub_with_phone
        )
        accounts_with_phones.extend(list(social_accounts))
    updated_profiles = []
    for social_account in accounts_with_phones:
        profile = social_account.user.profile_set.first()
        # Has it been more than 30 days since we last checked the user's phone
        # subscription?
        if (
            not profile.date_phone_subscription_checked
            or profile.date_phone_subscription_checked
            <= datetime.now(timezone.utc) - timedelta(settings.DAYS_PER_BILLING_CYCLE)
        ):
            # Re-fetch all FXA data into profile so we can see if the user still has
            # a phone subscription.
            update_fxa(social_account)
            profile.date_phone_subscription_checked = datetime.now(timezone.utc)
            profile.save()
            updated_profiles.append(profile)
            if profile.has_phone:
                # If they still have a phone subscription, re-set their
                # remaining_texts and remaining_seconds to the maximum value per
                # month.
                try:
                    relay_number = RelayNumber.objects.get(user=profile.user)
                    relay_number.remaining_texts = settings.MAX_TEXTS_PER_BILLING_CYCLE
                    relay_number.remaining_seconds = (
                        settings.MAX_MINUTES_PER_BILLING_CYCLE * 60
                    )
                    relay_number.save()
                except RelayNumber.DoesNotExist:
                    # no need to update their relay number - they haven't got one yet.
                    pass
    return updated_profiles


class Command(BaseCommand):
    help = "Update all phone users' subscription and stats."

    def handle(self, *args, **options):
        update_phone_remaining_stats()
