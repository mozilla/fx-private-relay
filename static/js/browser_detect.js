var isFirefox = typeof InstallTrigger !== 'undefined';
if(!isFirefox) {
    window.alert("This works best with Firefox. Download Firefox")
    window.location.replace("https://www.mozilla.org/en-US/firefox/new/");
}
