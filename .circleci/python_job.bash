#!/usr/bin/env bash
# Helper script for python_job in config.yml

# Set defaults if unset or null
: ${ALLOW_FAILURE:=0}
: ${IQ_ENABLED:=0}
: ${MYPY_STRICT:=0}
: ${PHONES_ENABLED:=0}
: ${TEST_RESULTS_FILENAME:=}

# Run black to check Python format
function run_black {
    set -x
    black --check .
}

# Run mypy to check type hints
function run_mypy {
    local MYPY_ARGS=("--no-incremental")
    if [ $MYPY_STRICT -ne 0 ]; then MYPY_ARGS+=("--strict"); fi
    if [ -n "$TEST_RESULTS_FILENAME" ]
    then
        MYPY_ARGS+=("--junit-xml" "job-results/${TEST_RESULTS_FILENAME}")
    fi
    MYPY_ARGS+=(".")

    set -x
    mypy "${MYPY_ARGS[@]}"
}

# Run pytest to run test code
# $1 - if "--skip-results", do not write jUnit-style results XML
function run_pytest {
    local SKIP_RESULTS=$1
    local PYTEST_ARGS=()
    if [ $PYTEST_FAIL_FAST -ne 0 ]; then PYTEST_ARGS+=("--maxfail=3"); fi
    if [ -n "$TEST_RESULTS_FILENAME" ] && [ "$SKIP_RESULTS" != "--skip-results" ]
    then
        PYTEST_ARGS+=("--junit-xml=job-results/$TEST_RESULTS_FILENAME")
    fi
    PYTEST_ARGS+=(".")

    echo "PHONES_ENABLED=${PHONES_ENABLED}, IQ_ENABLED=${IQ_ENABLED}"
    set -x
    pytest ${PYTEST_ARGS[@]}
}

# Run commands to build the email tracker lists
function run_build_email_tracker_lists {
    set -x
    ./manage.py get_latest_email_tracker_lists --skip-checks
    ./manage.py get_latest_email_tracker_lists --skip-checks --tracker-level=2
    mkdir --parents /tmp/workspace/email-trackers
    cp /home/circleci/project/emails/tracker_lists/level-one-trackers.json /tmp/workspace/email-trackers/
    cp /home/circleci/project/emails/tracker_lists/level-two-trackers.json /tmp/workspace/email-trackers/
}

# Run a command by name
# $1 - The command to run - black, mypy, pytest, or build_email_tracker_lists
# Remaining arguments are passed to the run_COMMAND function
function run_command {
    local COMMAND=${1:-}
    case $COMMAND in
        black | mypy | pytest | build_email_tracker_lists)
            :;;
        "")
            echo "No command passed - '$COMMAND'"
            exit 1
            ;;
        *)
            echo "Unknown command $COMMAND"
            exit 1
            ;;
    esac

    if [ $ALLOW_FAILURE -eq 0 ]
    then
        "run_$COMMAND" "${@:2}"
    else
        "run_$COMMAND" "${@:2}" || echo  "*** Command $COMMAND failed, but it is allowed to fail. ***"
    fi
}

# Install the dockerize tool
# $1 - The version to install, default v0.6.1
function install_dockerize {
    local DOCKERIZE_VERSION=${1:-v0.6.1}
    set -x
    wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz &&
    sudo tar -C /usr/local/bin -xzvf dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz &&
    rm dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz
}

# Wait for the PostgreSQL database to respond
function wait_for_the_database {
    dockerize -wait tcp://localhost:5432 -timeout 1m
}

# Get the Docker tag from the production version endpoint
function get_prod_tag {
    echo "$(curl --silent https://relay.firefox.com/__version__ | jq -r '.version')"
}

# Check out production code with migrations from the current branch
# $1 - The commit hash / name of the current branch
function switch_to_production_with_migrations_from {
    local PROD_TAG=$(get_prod_tag)
    local MIGRATIONS_COMMIT=${1:-main}
    echo "# Production tag is ${PROD_TAG}"
    set -x
    git fetch --force origin tag ${PROD_TAG}
    git checkout ${PROD_TAG}
    git submodule update --init --recursive
    git checkout --theirs "${MIGRATIONS_COMMIT}" -- '**/migrations/**'
    git status
}
