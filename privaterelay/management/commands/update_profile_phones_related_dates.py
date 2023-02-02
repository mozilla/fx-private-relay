from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.core.management.base import BaseCommand

from allauth.socialaccount.models import SocialAccount
from waffle.models import Flag

from emails.models import Profile
from privaterelay.fxa_utils import get_phone_subscription_dates
from privaterelay.views import update_fxa

if settings.PHONES_ENABLED:
    from phones.models import RelayNumber


def update_profile_phones_related_dates() -> int:
    if not settings.PHONES_ENABLED:
        return 0
    profiles = Profile.objects.filter(
        date_phone_subscription_checked__isnull=False
    ).exclude(date_subscribed_phone__isnull=True)
    num_updated_accounts = 0
    for p in profiles:
        date_subscribed_phone, start_date, end_date = get_phone_subscription_dates(
            p.fxa
        )
        if not (date_subscribed_phone and start_date and end_date):
            # No subscription info from FxA, reset the phone date fields
            p.date_phone_subscription_checked = None
            p.save()
            num_updated_accounts += 1
            continue

        # User has/had a valid phone subscriptions, populate phone date fields
        if p.date_subscribed_phone is None:
            p.date_subscribed_phone = date_subscribed_phone
            p.date_phone_subscription_end = end_date
            p.save()
            num_updated_accounts += 1

    free_phones_flag = Flag.objects.filter(name="free_phones").first()
    phone_foxfooders = free_phones_flag.users.all() if free_phones_flag else []
    for user in phone_foxfooders:
        profile = user.profile
        if profile.date_phone_subscription_checked is None:
            # Set subscription checked date to the past to trigger limits reset
            profile.date_phone_subscription_checked = datetime.now(
                timezone.utc
            ) - timedelta(settings.DAYS_PER_BILLING_CYCLE)
            p.save()
            num_updated_accounts += 1
    return num_updated_accounts


class Command(BaseCommand):
    help = "Update phone related dates on profile"

    def handle(self, *args, **options):
        num_updated_accounts = update_profile_phones_related_dates()
        print(f"{num_updated_accounts} updated")
