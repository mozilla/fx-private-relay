# Feature Flags with Django-Waffle

This document describes how feature flags are implemented in the Django backend using `django-waffle` and how they are exposed to the frontend via the `/runtime_data` endpoint.

## Django-Waffle Backend Implementation

`django-waffle` is used to manage feature flags that can be toggled based on various conditions (e.g., per user, group, percentage, or globally). Flags are typically managed via the Django admin interface on local machines. To change a flag locally, go to http://127.0.0.1:8000/admin/waffle/flag/.

In the dev, stage and prod environments, use `python manage.py waffle_flag` command. (See https://waffle.readthedocs.io/en/stable/usage/cli.html)

## The `/runtime_data` Endpoint

The `/runtime_data` endpoint is a public API endpoint that provides various pieces of configuration and runtime information needed by the frontend, including the current state of all defined Waffle flags, switches, and samples.

It is defined in `api/urls.py`, and implemented in `api/views/privaterelay.py`.

This view gathers all active flags and returns them in the response payload, specifically in the `WAFFLE_FLAGS` field.

## Frontend Usage

Components in the frontend can then use the `isFlagctive` to check if a specific feature flag is active and adjust the UI or behavior accordingly:

```
import { isFlagActive } from "../functions/waffle";
...

if isFlagActive(runtimeData.data, "tracker_removal") {
    ...
}
```

(note: The frontend application fetches `runtimeData`, including the waffle flags, with the `useRuntimeData` hook defined in `frontend/src/hooks/api/runtimeData.ts`.)
