// TODO Find a way to make this reusable across the app?
function apiRequest(path, options) {
    const cookieString = typeof document.cookie === "string" ? document.cookie : "";
    const cookieStringArray = cookieString
        .split(";")
        .map(individualCookieString => individualCookieString.split("="))
        .map(([cookieKey, cookieValue]) => [cookieKey?.trim(), cookieValue?.trim()]);
    // Looks like the `argsIgnorePattern` option for ESLint doesn't like array destructuring:
    // eslint-disable-next-line no-unused-vars
    const [_csrfCookieKey, csrfCookieValue] = cookieStringArray.find(([cookieKey, _cookieValue]) => cookieKey === "csrftoken");
    const headers = new Headers(options ? options.headers : undefined);
    headers.set("X-CSRFToken", csrfCookieValue);
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    return fetch(
        `/api/v1${path}`,
        {
            mode: "same-origin",
            ...options,
            headers: headers,
        },
    );
}

// eslint-disable-next-line no-unused-vars
async function patchProfile(profileId, bodyObject) {
    const response = await apiRequest(
        `/profiles/${profileId}/`,
        {
            method: "PATCH",
            body: JSON.stringify(bodyObject),
        },
    );
    return response;
}

// eslint-disable-next-line no-unused-vars
async function postProfileSubdomain( { domain }){

    const requestUrl = "/accounts/profile/subdomain";

    const cookieString = typeof document.cookie === "string" ? document.cookie : "";
    const cookieStringArray = cookieString
        .split(";")
        .map(individualCookieString => individualCookieString.split("="))
        .map(([cookieKey, cookieValue]) => [cookieKey?.trim(), cookieValue?.trim()]);
        
    // Looks like the `argsIgnorePattern` option for ESLint doesn't like array destructuring:
    // eslint-disable-next-line no-unused-vars
    const [_csrfCookieKey, csrfCookieValue] = cookieStringArray.find(([cookieKey, _cookieValue]) => cookieKey === "csrftoken");
    const headers = new Headers();
    headers.set("X-CSRFToken", csrfCookieValue);
    headers.set("Content-Type", " application/x-www-form-urlencoded");
    headers.set("Accept", "application/json");

    const response = await fetch(requestUrl, {
        method: "post",
        headers: headers,
        body: `subdomain=${domain}`
    });

    return await response.json();
}
