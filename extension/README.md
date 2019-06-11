# Private Relay
Private Relay provides generated email addresses to use in place of personal
email addresses.

Recipients will still receive emails, but Private Relay keeps their personal
email address from being [harvested](https://blog.hubspot.com/marketing/what-is-a-landing-page-ht), 
and then [bought, sold, traded, or combined](https://www.bookyourdata.com/) 
with  other data to personally identify, track, and/or [target
them](https://www.facebook.com/business/help/606443329504150?helpref=faq_content).

## Usage (for now)

1. Go to [privaterelay.groovecoder.com](http://privaterelay.groovecoder.com/),
   and sign in.
   * The extension will detect and load your relay addresses.

2. Go to any page with an `<input type="email">` element, and click in the
   input to bring up its auto-complete options.
   * The extension will populate the options with your relay addresses.

## Extension Development

1. Clone and change to the directory:

    ```
    git clone git@github.com:groovecoder/private-relay.git
    cd private-relay/extension
    ```

### Run (Firefox)

2. Run it with
   [`web-ext`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Getting_started_with_web-ext):

    ```
    web-ext run
    ```

### Run (Chrome, Opera, Edge)

2. Run it with
   [`--load-extension` flag](https://stackoverflow.com/questions/22193369/run-chrome-extensions-using-command-prompt):

    ```
    /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --user-data-dir=/tmp/privaterelay --load-extension=. --no-first-run
    /Applications/Opera.app/Contents/MacOS/Opera --user-data-dir=/tmp/privaterelay --load-extension=. --no-first-run
    /Applications/Microsoft\ Edge\ Canary.app/Contents/MacOS/Microsoft\ Edge\ Canary --user-data-dir=/tmp/privaterelay --load-extension=. --no-first-run
    ```

## Credits
Icon is "[Mail by Thengakola from the Noun
Project](https://thenounproject.com/search/?q=email%20shield&i=930191)"
