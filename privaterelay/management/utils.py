from django.conf import settings

from allauth.socialaccount.models import SocialAccount
from waffle.models import Flag


def get_free_phone_social_accounts() -> set[SocialAccount]:
    free_phones_flag = Flag.objects.filter(name="free_phones").first()
    if free_phones_flag is None:
        return set()

    free_phones_sa = set(
        SocialAccount.objects.filter(user__in=free_phones_flag.users.all())
    )
    for group in free_phones_flag.groups.all():
        free_phones_sa.update(SocialAccount.objects.filter(user__in=group.users.all()))
    return free_phones_sa


def get_phone_subscriber_social_accounts() -> set[SocialAccount]:
    phone_subscribers_sa = set()
    for sub_with_phone in settings.SUBSCRIPTIONS_WITH_PHONE:
        social_accounts = SocialAccount.objects.filter(
            extra_data__icontains=sub_with_phone
        )
        phone_subscribers_sa.update(social_accounts)
    return phone_subscribers_sa
