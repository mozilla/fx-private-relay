# MPP-4770 at its base, with the agent setup from SETUP_REF on top. .agents/evals/_lib/seal.sh does the work.
# The Python the base commit's own Dockerfile names, so tests run on production's Python.
FROM python:3.12.14
COPY --from=ghcr.io/astral-sh/uv:0.13.8 /uv /uvx /usr/local/bin/
ARG REPO=mozilla/fx-private-relay
ARG BASE=d67a0419cbbc823128ad4a4a8d704ce9008c64e0
ARG SETUP_REF=eval-ready-test-env
ADD https://raw.githubusercontent.com/${REPO}/${SETUP_REF}/.agents/evals/_lib/seal.sh /opt/eval/seal.sh
RUN bash /opt/eval/seal.sh
WORKDIR /app
