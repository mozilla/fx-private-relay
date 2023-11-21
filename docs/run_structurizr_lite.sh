#!/usr/bin/env bash
set -x
set -v
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
docker pull structurizr/lite
docker run -it --rm -p 8080:8080 -v ${SCRIPT_DIR}:/usr/local/structurizr structurizr/lite
