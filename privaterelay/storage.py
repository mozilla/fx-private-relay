"""
Staticfiles storage implementation for Relay.

This is used when running ./manage.py collectstatic, or rendering Django templates.
"""
from typing import Any

from whitenoise.storage import CompressedManifestStaticFilesStorage


class RelayStaticFilesStorage(CompressedManifestStaticFilesStorage):
    """
    Customize Whitenoise storage for Relay

    The Django ManifestStaticFilesStorage creates a copy of each file that
    includes a hash of its contents, and serves these with a long cache time.
    It also creates staticfiles/staticfiles.json that lists all the known static
    files, rather than scanning the folder for files at startup.

    The Whitenoise CompressedManifestStaticFilesStorage builds on this by
    pre-compressing files as well, so that the gzipped versions can be served.

    This class skips renaming files from Next.js, which already include hashes
    in the filenames.

    See:
    https://docs.djangoproject.com/en/4.2/ref/contrib/staticfiles/#manifeststaticfilesstorage
    http://whitenoise.evans.io/en/stable/django.html#add-compression-and-caching-support
    """

    def hashed_name(
        self, name: str, content: str | None = None, filename: str | None = None
    ) -> str:
        """Skip hashing filenames output by Next.js"""
        if name.startswith("_next/static/"):
            return name
        else:
            new_name = super().hashed_name(name, content, filename)
            assert isinstance(new_name, str)
            return new_name

    def url_converter(
        self, name: str, hashed_files: dict[str, str], template: str | None = None
    ) -> Any:
        """
        Convert Next.js source map URL to absolute URL.

        If this changes, or other django.contrib.staticfiles changes adjust CSS output,
        then update the cache version in globals.scss and tokens.scss to bust the cache.
        """
        if (
            name.startswith("_next/static/css/")
            and name.endswith(".css")
            and template == "/*# sourceMappingURL=%(url)s */"
        ):
            path = name.rsplit("/", 1)[0]
            template = f"/*# sourceMappingURL={self.base_url}{path}/%(url)s */"
        return super().url_converter(name, hashed_files, template)
