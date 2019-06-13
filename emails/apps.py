from django.apps import AppConfig


class EmailsConfig(AppConfig):
    name = 'emails'

    def ready(self):
        import emails.signals
