from django.conf import settings
from django_hosts import patterns, host

host_patterns = patterns('',
    host(r'%s' % settings.SITE_ORIGIN, settings.ROOT_URLCONF, name='relay'),
    host(r'%s' % settings.PRIVACY_HOST, 'privaterelay.privacyurls', name='privacy'),
)
