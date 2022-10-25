"""
Staticfiles storage implementation for Relay.

This is used when running ./manage.py collectstatic, or rendering Django templates.
"""
from whitenoise.storage import CompressedManifestStaticFilesStorage


class RelayStaticFilesStorage(CompressedManifestStaticFilesStorage):
    """
    Customize Whitenoise storage for Relay

    The Django ManifestStaticFilesStorage [1] creates a copy of each file that
    includes a hash of its contents, and serves these with a long cache time.
    It also creates staticfiles/staticfiles.json that lists all the known static
    files, rather than scanning the folder for files at startup.

    The Whitenoise CompressedManifestStaticFilesStorage [2] builds on this by
    pre-compressing files as well, so that the gzipped versions can be served.

    This class skips renaming files from Next.js, which already include hashes
    in the filenames.

    [1] https://docs.djangoproject.com/en/3.2/ref/contrib/staticfiles/#manifeststaticfilesstorage
    [2] http://whitenoise.evans.io/en/stable/django.html#add-compression-and-caching-support
    """

    def hashed_name(self, name, content=None, filename=None):
        """Skip hashing files output by Next.js"""
        if name.startswith("_next/static/"):
            return name
        else:
            return super().hashed_name(name, content, filename)
