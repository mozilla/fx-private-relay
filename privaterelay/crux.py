"""
Interface to Chrome User Experience (CrUX) API

https://developer.chrome.com/docs/crux/api
"""


def main(api_key: str) -> str:
    # Gather query parameters
    # Call API for each query, respect API limit
    # Generate text report
    # Return text report
    return "to do"


if __name__ == "__main__":
    import os
    import sys

    api_key = os.environ.get("CRUX_API_KEY")
    if not api_key:
        print("Set CRUX_API_KEY to the API key")
        sys.exit(1)

    result = main(api_key)
    print(result)
