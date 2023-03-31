#!/usr/bin/env python
"""
Django's command-line utility for administrative tasks.
"""

import os
import sys


def main():
    """
    Execute Django's administrative tasks from the command line.
    """
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "privaterelay.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            f"Couldn't import Django. Are you sure it's installed and "
            f"available on your PYTHONPATH environment variable? Did you "
            f"forget to activate a virtual environment? {exc}"
        )
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    if __name__ == '__main__':
        main()
