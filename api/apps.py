from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = "api"

    def ready(self) -> None:
        # Register drf_spectacular schema extensions
        import api.schema  # noqa: F401
