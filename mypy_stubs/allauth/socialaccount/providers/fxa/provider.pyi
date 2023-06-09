from _typeshed import Incomplete
from allauth.socialaccount.providers.base import ProviderAccount as ProviderAccount
from allauth.socialaccount.providers.oauth2.provider import OAuth2Provider as OAuth2Provider

FXA_OAUTH_ENDPOINT: Incomplete
FXA_PROFILE_ENDPOINT: Incomplete

class FirefoxAccountsAccount(ProviderAccount):
    def to_str(self): ...

class FirefoxAccountsProvider(OAuth2Provider):
    id: str
    name: str
    account_class = FirefoxAccountsAccount
    def get_default_scope(self): ...
    def extract_uid(self, data): ...
    def extract_common_fields(self, data): ...

provider_classes: Incomplete
