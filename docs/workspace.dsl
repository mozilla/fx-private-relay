!const SERVICE_NAME "Firefox Relay"
!const ACCOUNTS_NAME "Mozilla Accounts"


workspace "${SERVICE_NAME}" "Mozilla's service providing email and phone masks." {
    configuration {
        scope softwaresystem
    }

    model {
        user = person "Relay User" "A user of ${SERVICE_NAME}." {
            tags "Relay User"
        }
        email_contact = person "Email Contact" {
            description "A person or business emailing with a Relay User."
            tags "External Contact"
        }
        phone_contact = person "Phone Contact" {
            description "A person or business calling or texting with a Relay User."
            tags "External Contact"
        }
        group Mozilla {
            relay = softwareSystem "${SERVICE_NAME}" {
                description "Manages email and phone masks. Forwards messages between masks and external services."
                tags "Relay Software System"

                group "User Interfaces" {
                    web = container "Single-Page App" {
                        description "Provides marketing pages, user dashboards, onboarding flows"
                        tags "Browser Interface"
                        technology "JavaScript - Next.js"
                    }
                    add_on = container "Relay Extension" {
                        description "Suggests email masks on webpages"
                        tags "Browser Interface"
                        technology "Extension for Firefox and Chrome"
                    }
                    other_client = container "Bitwarden, Other API users" {
                        description "Integrates with Relay API"
                        tags "Browser Interface"
                        technology "3rd Party Tools"
                    }
                    firefox = container "Firefox" {
                        description "Suggests email mails on webpages"
                        tags "Browser Interface"
                        technology "Desktop application for Windows, MacOS, and Linux"
                    }
                }

                // Shared Components
                // Tons of incoming connection, need to be middle of container diagram
                db = container "Database" {
                    description "Stores Relay User profiles, masks, abuse metrics, etc."
                    tags "Database"
                    technology "PostgreSQL"
                }
                replica_db = container "Replica DB" {
                    description "Read-only replica database"
                    tags "Optional Database"
                    technology "PostgreSQL"
                }
                logs = container "Log Aggregator" {
                    description "Collects logs from other containers"
                    tags "Managed Service"
                }
                metrics = container "Metrics Aggregator" {
                    description "Collects metrics from other containers"
                    tags "Optional Application"
                    technology telegraf
                }

                // Managed Services
                // At edges of container diagram, since they talk to external services
                // Many incoming connections
                email_receiver = container "Email Receiver" {
                    description "Routes incoming emails, complaints, and bounces"
                    tags "Managed Service"
                    technology "Amazon SES"
                }
                email_sender = container "Email Sender" {
                    description "Sends emails from the Relay domain"
                    tags "Managed Service"
                    technology "Amazon SES"
                }
                profiler = container Profiler {
                    description "Collects CPU and timing profiles"
                    tags "Managed Service"
                    technology "Google Cloud Profiler"
                }
                phone_service = container "Phone Service" {
                    description "Provides phone numbers, sends and receives SMS messages and voice calls"
                    tags "Managed Service"
                    technology "Twilio"
                }
                iq_phone_service = container "iQ Phone Service" {
                    description "Provides phone numbers, sends and receives SMS messages and voice calls"
                    tags "Optional Managed Service",omit_in_gcp
                    technology "Inteliquent"
                }

                // Main backend applications
                web_app = container "Web Application" {
                    description "Delivers the Single-Page App; provides API, hooks, and callbacks"
                    tags "Application"
                    technology "Python - Django Application"
                }
                email_processor = container "Email Processor" {
                    description "Processes and forwards incoming emails; Processes complaint and bounce reports"
                    tags "Application"
                    technology "Python - Django Command"
                }

                // Periodic Tasks
                task_cleanup = container "Cleanup Task" {
                    description "Fixes data consistency issues"
                    tags "Task", "Periodic Task"
                    technology "Python - Django Command"
                }
                task_clean_replies = container "Clean Replies Task" {
                    description "Deletes expired reply data"
                    tags "Task", "Periodic Task"
                    technology "Python - Django Command"
                }
                task_sync_phones = container "Sync Phone Dates Task" {
                    description "Syncs Mozilla Accounts subscription data for phone users"
                    tags "Task", "Periodic Task"
                    technology "Python - Django Command"
                }
                task_update_phones = container "Update Phone Limits Task" {
                    description "Resets remaining texts and voice minutes at start of month"
                    tags "Task", "Periodic Task"
                    technology "Python - Django Command"
                }
                task_welcome = container "Send Welcome Emails Task" {
                    description "Sends a welcome email to recent subscribers"
                    tags "Task", "Periodic Task"
                    technology "Python - Django Command"
                }
                dlq_processor = container "Dead-Letter Processor" {
                    description "Deletes emails with processing errors"
                    tags "Task", "Periodic Task"
                    technology "Python - Django Command"
                }

                // Used by web application
                cache = container "Cache" {
                    description "Stores runtime data"
                    tags "Database"
                    technology "Redis"
                }

                // Email parts
                email_object_store = container "Incoming Email Storage" {
                    description "Stores incoming mail"
                    technology "AWS S3"
                    tags "Database"
                }
                email_queue = container "Email Notification Queue" {
                    description "Holds notifications for emails, complaints, and bounces"
                    technology "AWS SQS"
                    tags "Database"
                }
                email_dlq_queue = container "Email Dead-Letter Queue" {
                    description "Holds notifications for emails that fail to process"
                    technology "AWS SQS"
                    tags "Database"
                }
                email_key = container "Email Encryption" {
                    description "Encrypts emails, notifications at rest"
                    technology "AWS KMS"
                    tags "Managed Service"
                }
                email_topic = container "Email Pub/Sub" {
                    description "Published notifications to subscribers"
                    technology "AWS SNS"
                    tags "Managed Service"
                }
            }

            accounts = softwareSystem "Accounts and Subscriptions" {
                description "${ACCOUNTS_NAME} and the Subscription Platform."
                tags "Other Software System"
            }

            data_system = softwareSystem "Data Platform" {
                description "The Mozilla Telemetry Platform"
                tags "Other Software System"
            }

            metrics_system = softwareSystem "Operational Metrics Platform" {
                description "The Mozilla operational metrics and reporting platform"
                tags "Other Software System"
            }

            sentry = softwareSystem "Sentry" {
                description "Collects and organizes tracebacks and errors"
                tags "Other Software System"
            }
        }

        ga = softwareSystem "Google Analytics" {
            description "Collects and reports interaction events"
            tags "Other Software System"
        }
        stripe = softwareSystem "Stripe" {
            description "Handles billing and payment processing"
            tags "Other Software System"
        }
        user -> accounts "Registers, manages subscription" "HTTPS"

        // Relay container relationships
        user -> web "Uses"
        user -> add_on "Uses"
        user -> other_client "Uses"
        user -> firefox "Uses"
        web -> web_app "Uses API, requests static assets" "HTTPS" "omit_in_gcp"
        web -> accounts "Requests flow tracking, sends users for login and subscriptions" "HTTPS, OAuth 2, APIs"
        web -> ga "Sends page views, interactions" "HTTPS"
        web -> stripe "Requests purchase tracking" "HTTPS"
        accounts -> stripe "Uses" "HTTPS, Stripe API"
        add_on -> web_app "Uses API, sends UI events" "HTTPS" "omit_in_gcp"
        add_on -> web "Scrapes data" "Extension API"
        other_client -> web_app "Uses API" "HTTPS" "omit_in_gcp"
        firefox -> web_app "Uses API" "HTTPS" "omit_in_gcp"
        web_app -> db "Updates" "Django ORM"
        web_app -> cache "Uses" "Django Cache API"
        web_app -> email_sender "Sends email" "SES API"
        web_app -> accounts "Delegates user registration, payments" "HTTPS, OAuth 2, API"
        web_app -> ga "Forwards extension's UI events" "Measurement Protocol"
        web_app -> sentry "Sends exceptions" "HTTPS API"
        web_app -> metrics "Sends metrics" "HTTP"
        web_app -> logs "Emits logs" "stdout / stderr"
        web_app -> phone_service "Reserves phone number, routes SMS and calls" "Stripe API, HTTPS callbacks"
        web_app -> iq_phone_service "Reserves phone number, routes SMS" "Inteliquent API, HTTPS callbacks" "Optional Relationship"
        web_app -> profiler "Sends Profiles" "Profile API"
        task_sync_phones -> accounts "Reads subscription data" "Subscription API" "component_detail"
        task_welcome -> email_sender "Sends welcome email" "SES API" "component_detail"
        db -> replica_db

        // Common task relations (db, logs, etc) are unlabelled to reduce clutter
        task_cleanup -> db
        task_cleanup -> logs
        task_cleanup -> metrics
        task_cleanup -> sentry
        task_clean_replies -> db
        task_clean_replies -> logs
        task_clean_replies -> metrics
        task_clean_replies -> sentry
        task_sync_phones -> db
        task_sync_phones -> logs
        task_sync_phones -> metrics
        task_sync_phones -> sentry
        task_update_phones -> db
        task_update_phones -> logs
        task_update_phones -> metrics
        task_update_phones -> sentry
        task_welcome -> db
        task_welcome -> logs
        task_welcome -> metrics
        task_welcome -> sentry
        dlq_processor -> db
        dlq_processor -> logs
        dlq_processor -> metrics
        dlq_processor -> sentry

        email_contact -> email_receiver "Sends email" "SMTP via user's email mask"
        email_receiver -> email_object_store "Stores incoming emails" "S3"
        email_receiver -> email_key "Encrypts" "KMS"
        email_receiver -> email_topic "Notifies of new emails" "SNS"
        email_object_store -> email_key "Decrypts" "KMS"
        email_sender -> email_topic "Notifies of complaints and bounces" "SNS"
        email_topic -> email_key "Decrypts" "KMS"
        email_topic -> email_queue "Adds emails, complaints, bounces" "SQS"
        email_topic -> web_app "Sends emails, complaints, bounces" "SQS" "Optional Relationship,omit_in_gcp"
        email_sender -> user "Forwards email" "SMTP via user's real email"
        user -> email_receiver "Send reply email" "SMTP via replies email address"
        email_sender -> email_contact "Sends replies" "SMTP via user's email mask"
        email_sender -> email_key "Encrypts" "KMS"
        email_processor -> db "Updates" "Django ORM"
        email_processor -> email_sender "Forwards email" "SES API"
        email_processor -> email_queue "Polls" "SQS API"
        email_processor -> email_object_store "Reads, deletes emails" "S3 API"
        email_processor -> sentry "Sends exceptions" "HTTPS API"
        email_processor -> metrics "Sends metrics" "HTTP"
        email_processor -> logs "Emits logs" "stdout / stderr"
        email_processor -> profiler "Sends profiles" "Profile API"
        email_queue -> email_key "Decrypts" "KMS"
        email_queue -> email_dlq_queue "Moves failed emails notifications" "SQS"
        email_dlq_queue -> email_key "Decrypts" "KMS"
        dlq_processor -> email_object_store "Reads, deletes emails" "S3 API" "component_detail"
        dlq_processor -> email_sender "Forwards email (rarely)" "SES API" "component_detail"
        dlq_processor -> email_dlq_queue "Polls" "SQS API" "component_detail"

        phone_contact -> phone_service "Sends texts, starts calls" "PSTN via user's phone mask"
        phone_service -> phone_contact "Sends reply texts" "PSTN via user's phone mask"
        phone_contact -> iq_phone_service "Sends texts, starts calls" "PSTN via user's phone mask"
        iq_phone_service -> user "Forwards Texts, Calls" "PSTN via user's real phone" "Optional Relationship"
        iq_phone_service -> phone_contact "Sends reply texts" "PSTN via user's phone mask"
        phone_service -> user "Forwards Texts, Calls" "PSTN via user's real phone"
        metrics -> metrics_system "Sends metrics" "Telegraf"
        metrics -> db "Queries" "SQL"
        logs -> data_system "Sends Glean events" "JSON over GCP SNS"

        dev_deploy = deploymentEnvironment "dev.fxprivaterelay.nonprod.cloudops.mozgcp.net" {
            deploymentNode "Dev User Interfaces" {
                dev_web = containerInstance web
                dev_add_on = containerInstance add_on
            }
            deploymentNode "Amazon Web Services" {
                deploymentNode "us-east-1 region" {
                    deploymentNode "Amazon SQS" {
                        dev_sqs_dlq = containerInstance email_dlq_queue
                        dev_sqs_emails = containerInstance email_queue
                    }
                    deploymentNode "Amazon SNS" {
                        dev_sns_topic = containerInstance email_topic
                    }
                    deploymentNode "Amazon SES" {
                        dev_ses_incoming = containerInstance email_receiver
                        dev_ses_outgoing = containerInstance email_sender
                    }
                    deploymentNode "Amazon S3" {
                        dev_s3_emails = containerInstance email_object_store
                    }
                    deploymentNode "Amazon KMS" {
                        dev_kms_emails = containerInstance email_key
                    }
                }
            }
            deploymentNode "Heroku" {
                deploymentNode "Dynos" {
                    deploymentNode "web" {
                        web_dyno = containerInstance web_app
                    }
                    deploymentNode "worker" {
                        worker_dyno = containerInstance email_processor
                    }
                }
                deploymentNode "Heroku Add-Ons" {
                    deploymentNode "Heroku Data for Redis" {
                        heroku_cache = containerInstance cache
                    }
                    deploymentNode "Heroku Postgres" {
                        heroku_psql = containerInstance db
                    }
                    deploymentNode "Heroku Scheduler" {
                        heroku_task_cleanup = containerInstance task_cleanup
                        heroku_task_clean_replies = containerInstance task_clean_replies
                        heroku_task_sync_phones = containerInstance task_sync_phones
                        heroku_task_update_phones = containerInstance task_update_phones
                        heroku_task_welcome = containerInstance task_welcome
                        heroku_task_dql = containerInstance dlq_processor
                    }

                    deploymentNode "Papertrail" {
                        heroku_papertrail = containerInstance logs
                    }
                }
            }
            deploymentNode "Google Cloud Platform" {
                deploymentNode "Cloud Profiler" {
                    dev_gcprofiler = containerInstance profiler
                }
            }
            deploymentNode accounts.stage.mozaws.net {
                dev_accounts = softwareSystemInstance accounts
            }
            deploymentNode analytics.google.com {
                dev_ga = softwareSystemInstance ga
            }
            deploymentNode mozilla.sentry.io {
                dev_sentry = softwareSystemInstance sentry
            }
            deploymentNode "Stripe" {
                dev_stripe = softwareSystemInstance stripe {
                    description "Development Stripe, with select subscriptions"
                }
            }
            deploymentNode twilio.com {
                dev_twilio_phone = containerInstance phone_service
            }
            deploymentNode inteliquent.com {
                dev_iq_phone = containerInstance iq_phone_service
            }
        }

        stage_deploy = deploymentEnvironment "stage.fxprivaterelay.nonprod.cloudops.mozgcp.net" {
            deploymentNode "Stage User Interfaces" {
                stage_web = containerInstance web
                stage_add_on = containerInstance add_on
            }
            deploymentNode "Amazon Web Services" {
                deploymentNode "us-east-1 region" {
                    deploymentNode "Amazon SQS" {
                        stage_sqs_dlq = containerInstance email_dlq_queue
                        stage_sqs_emails = containerInstance email_queue
                    }
                    deploymentNode "Amazon SNS" {
                        stage_email_topic = containerInstance email_topic
                    }
                    deploymentNode "Amazon SES" {
                        stage_ses_incoming = containerInstance email_receiver
                        stage_ses_outgoing = containerInstance email_sender
                    }
                    deploymentNode "Amazon S3" {
                        stage_s3_emails = containerInstance email_object_store
                    }
                    deploymentNode "Amazon KMS" {
                        stage_kms_emails = containerInstance email_key
                    }
                }
            }
            deploymentNode "Google Cloud Platform" {
                deploymentNode "Kubernetes Engine" {
                    deploymentNode "app" {
                        technology "Kubernetes Deployment"
                        instances 3
                        stage_app_nginx = infrastructureNode "nginx" {
                            tags "Deployment Service"
                            description "Reverse proxy"
                        }
                        stage_app_web = containerInstance web_app
                    }
                    deploymentNode "app-canary" {
                        technology "Kubernetes Deployment"
                        instances 1
                        stage_app_canary_nginx = infrastructureNode "nginx" {
                            tags "Deployment Service"
                            description "Reverse proxy"
                        }
                        stage_app_canary_web = containerInstance web_app {
                            description "Canary App for deployment testing"
                        }
                    }
                    deploymentNode "cleanup" {
                        technology "Kubernetes Cron Job"
                        stage_task_cleanup = containerInstance task_cleanup
                    }
                    deploymentNode "emails" {
                        technology "Kubernetes Deployment"
                        instances 6
                        stage_task_emails = containerInstance email_processor
                    }
                    deploymentNode "replys [sic]" {
                        technology "Kubernetes Cron Job"
                        stage_task_clean_replies = containerInstance task_clean_replies
                    }
                    deploymentNode "sqs-dlq" {
                        technology "Kubernetes Cron Job"
                        stage_task_dlq = containerInstance dlq_processor
                    }
                    deploymentNode "syncphones" {
                        technology "Kubernetes Cron Job"
                        stage_task_sync_phones = containerInstance task_sync_phones
                    }
                    deploymentNode "updphones" {
                        technology "Kubernetes Cron Job"
                        stage_task_update_phones = containerInstance task_update_phones
                    }
                    deploymentNode "welcome" {
                        technology "Kubernetes Cron Job"
                        stage_task_welcome = containerInstance task_welcome
                    }
                    deploymentNode "iprepd-nginx" {
                        technology "Kubernetes Deployment"
                        instances 3
                        stage_iprepd_nginx = infrastructureNode "iprepd-nginx" {
                            description "Tracks IP reputation, blocks IPs"
                            tags "Deployment Service"
                        }
                    }
                    deploymentNode "stackdriver-telegraf" {
                        technology "Kubernetes Deployment"
                        instances 1
                        stage_stackdriver_telegraf = infrastructureNode "stackdriver-telegraf" {
                            tags "Deployment Service"
                        }
                    }
                    deploymentNode "statsd-telegraf" {
                        technology "Kubernetes Deployment"
                        instances 1
                        stage_statsd_telegraf = containerInstance metrics
                    }
                }
                deploymentNode "Cloud SQL" {
                    stage_psql = containerInstance db
                    stage_psql_replica = containerInstance replica_db
                }
                deploymentNode "Cloud Logging" {
                    stage_logs = containerInstance logs
                }
                deploymentNode "BiqQuery" {
                    stage_bq = infrastructureNode "log_storage" {
                        technology "BigQuery"
                        tags "Database"
                        description "Log Analytics, 90 day retention"
                    }
                }
                deploymentNode "MemoryStore" {
                    stage_redis = containerInstance cache
                }
                deploymentNode "Cloud Profiler" {
                    stage_gcprofiler = containerInstance profiler
                }
                deploymentNode "Cloud Load Balancing" {
                    stage_lb = infrastructureNode "Load Balancer" {
                        description "Zone for fxprivaterelay.nonprod.cloudops.mozgcp.net"
                        tags "Managed Service"
                    }
                }
                deploymentNode "Cloud Metrics" {
                    stage_cloud_metrics = infrastructureNode "Cloud Metrics" {
                        description "GCP service metrics"
                        tags "Managed Service"
                    }
                }
            }
            deploymentNode accounts.stage.mozaws.net {
                stage_accounts = softwareSystemInstance accounts
            }
            deploymentNode analytics.google.com {
                stage_ga = softwareSystemInstance ga
            }
            deploymentNode "Mozilla Data Platform" {
                stage_data = softwareSystemInstance data_system
            }
            deploymentNode "Stripe" {
                stage_stripe = softwareSystemInstance stripe {
                    description "Development Stripe, with select subscriptions"
                }
            }
            deploymentNode mozilla.sentry.io {
                stage_sentry = softwareSystemInstance sentry
            }
            deploymentNode influxcloud.net {
                stage_metrics = softwareSystemInstance metrics_system
            }
            deploymentNode twilio.com {
                stage_phone = containerInstance phone_service
            }
            stage_iprepd_nginx -> stage_app_nginx "Requests" "HTTP"
            stage_iprepd_nginx -> stage_app_canary_nginx "Requests" "HTTP"
            stage_app_nginx -> stage_app_web "Requests" "HTTP 1.0"
            stage_app_canary_nginx -> stage_app_canary_web "Requests" "HTTP"
            stage_logs -> stage_bq "Forwards Logs"
            stage_lb -> stage_iprepd_nginx "Requests" "HTTP"
            stage_web -> stage_lb "Uses API, requests static assets"
            stage_add_on -> stage_lb "Uses API, sends UI events"
            stage_cloud_metrics -> stage_stackdriver_telegraf "Sends metrics"
            stage_stackdriver_telegraf -> stage_metrics "Sends metrics"
            stage_phone -> stage_lb "Informs of incoming SMS and calls"
            stage_email_topic -> stage_lb "Sends emails, complaints, bounces" "SQS" "Optional Relationship"
        }
        prod_deploy = deploymentEnvironment "relay.firefox.com" {
            deploymentNode "Stage User Interfaces" {
                prod_web = containerInstance web
                prod_add_on = containerInstance add_on
                prod_firefox = containerInstance firefox
                prod_other_client = containerInstance other_client
            }
            deploymentNode "Amazon Web Services" {
                deploymentNode "us-east-1 region" {
                    deploymentNode "Amazon SQS" {
                        prod_sqs_dlq = containerInstance email_dlq_queue
                        prod_sqs_emails = containerInstance email_queue
                    }
                    deploymentNode "Amazon SNS" {
                        prod_email_topic = containerInstance email_topic
                    }
                    deploymentNode "Amazon SES" {
                        prod_ses_incoming = containerInstance email_receiver
                        prod_ses_outgoing = containerInstance email_sender
                    }
                    deploymentNode "Amazon S3" {
                        prod_s3_emails = containerInstance email_object_store
                    }
                    deploymentNode "Amazon KMS" {
                        prod_kms_emails = containerInstance email_key
                    }
                }
            }
            deploymentNode "Google Cloud Platform" {
                deploymentNode "Kubernetes Engine" {
                    deploymentNode "app" {
                        technology "Kubernetes Deployment"
                        instances 3
                        prod_app_nginx = infrastructureNode "nginx" {
                            tags "Deployment Service"
                            description "Reverse proxy"
                        }
                        prod_app_web = containerInstance web_app
                    }
                    deploymentNode "app-canary" {
                        technology "Kubernetes Deployment"
                        instances 1
                        prod_app_canary_nginx = infrastructureNode "nginx" {
                            tags "Deployment Service"
                            description "Reverse proxy"
                        }
                        prod_app_canary_web = containerInstance web_app {
                            description "Canary App for deployment testing"
                        }
                    }
                    deploymentNode "cleanup" {
                        technology "Kubernetes Cron Job"
                        prod_task_cleanup = containerInstance task_cleanup
                    }
                    deploymentNode "emails" {
                        technology "Kubernetes Deployment"
                        instances 6
                        prod_task_emails = containerInstance email_processor
                    }
                    deploymentNode "replys [sic]" {
                        technology "Kubernetes Cron Job"
                        prod_task_clean_replies = containerInstance task_clean_replies
                    }
                    deploymentNode "sqs-dlq" {
                        technology "Kubernetes Cron Job"
                        prod_task_dlq = containerInstance dlq_processor
                    }
                    deploymentNode "syncphones" {
                        technology "Kubernetes Cron Job"
                        prod_task_sync_phones = containerInstance task_sync_phones
                    }
                    deploymentNode "updphones" {
                        technology "Kubernetes Cron Job"
                        prod_task_update_phones = containerInstance task_update_phones
                    }
                    deploymentNode "welcome" {
                        technology "Kubernetes Cron Job"
                        prod_task_welcome = containerInstance task_welcome
                    }
                    deploymentNode "iprepd-nginx" {
                        technology "Kubernetes Deployment"
                        instances 3
                        prod_iprepd_nginx = infrastructureNode "iprepd-nginx" {
                            description "Tracks IP reputation, blocks IPs"
                            tags "Deployment Service"
                        }
                    }
                    deploymentNode "stackdriver-telegraf" {
                        technology "Kubernetes Deployment"
                        instances 1
                        prod_stackdriver_telegraf = infrastructureNode "stackdriver-telegraf" {
                            tags "Deployment Service"
                        }
                    }
                    deploymentNode "statsd-telegraf" {
                        technology "Kubernetes Deployment"
                        instances 1
                        prod_statsd_telegraf = containerInstance metrics
                    }
                }
                deploymentNode "Cloud SQL" {
                    prod_psql = containerInstance db
                }
                deploymentNode "Cloud Logging" {
                    prod_logs = containerInstance logs
                }
                deploymentNode "BiqQuery" {
                    prod_bq = infrastructureNode "log_storage" {
                        technology "BigQuery"
                        tags "Database"
                        description "Log Analytics, 90 day retention"
                    }
                }
                deploymentNode "MemoryStore" {
                    prod_redis = containerInstance cache
                }
                deploymentNode "Cloud Profiler" {
                    prod_gcprofiler = containerInstance profiler
                }
                deploymentNode "Cloud Load Balancing" {
                    prod_lb = infrastructureNode "Load Balancer" {
                        description "Zone for prod.fxprivaterelay.prod.cloudops.mozgcp.net"
                        tags "Managed Service"
                    }
                }
                deploymentNode "Cloud Metrics" {
                    prod_cloud_metrics = infrastructureNode "Cloud Metrics" {
                        description "GCP service metrics"
                        tags "Managed Service"
                    }
                }
            }
            deploymentNode accounts.prod.mozaws.net {
                prod_accounts = softwareSystemInstance accounts
            }
            deploymentNode analytics.google.com {
                prod_ga = softwareSystemInstance ga
            }
            deploymentNode "Mozilla Data Platform" {
                prod_data = softwareSystemInstance data_system
            }
            deploymentNode "Stripe" {
                prod_stripe = softwareSystemInstance stripe {
                    description "Development Stripe, with select subscriptions"
                }
            }
            deploymentNode mozilla.sentry.io {
                prod_sentry = softwareSystemInstance sentry
            }
            deploymentNode influxcloud.net {
                prod_metrics = softwareSystemInstance metrics_system
            }
            deploymentNode twilio.com {
                prod_phone = containerInstance phone_service
            }
            prod_iprepd_nginx -> prod_app_nginx "Requests" "HTTP"
            prod_iprepd_nginx -> prod_app_canary_nginx "Requests" "HTTP"
            prod_app_nginx -> prod_app_web "Requests" "HTTP 1.0"
            prod_app_canary_nginx -> prod_app_canary_web "Requests" "HTTP"
            prod_logs -> prod_bq "Forwards Logs"
            prod_lb -> prod_iprepd_nginx "Requests" "HTTP"
            prod_web -> prod_lb "Uses API, requests static assets"
            prod_add_on -> prod_lb "Uses API, sends UI events"
            prod_firefox -> prod_lb "Uses API"
            prod_other_client -> prod_lb "Uses API"
            prod_cloud_metrics -> prod_stackdriver_telegraf "Sends metrics"
            prod_stackdriver_telegraf -> prod_metrics "Sends metrics"
            prod_phone -> prod_lb "Informs of incoming SMS and calls"
            prod_email_topic -> prod_lb "Sends emails, complaints, bounces" "SQS" "Optional Relationship"
        }
    }

    views {
        properties {
            "structurizr.sort" "created"
        }
        systemContext relay "RelaySystemContext" {
            title "[System Context] Relay"
            default
            include *
        }
        container relay "RelayContainersAllDetails" {
            title "[Container] Relay (All Details)"
            include *
        }

        dynamic relay forward_process "ForwardEmailProcess" {
            title "[Dynamic] Forwarding an Email to a Relay User"
            email_contact -> email_receiver "Sends email. Email passes DMARC, virus, and spam checks" "SMTP via user's email mask"
            {
                {
                    email_receiver -> email_key "Encrypts email with key" "KMS"
                }
                {
                    email_receiver -> email_object_store "Stores encrypted email" S3
                }
            }
            email_receiver -> email_topic "Publishes email notification" SNS
            {
                {
                    email_topic -> email_key "Decrypts notification" KMS
                }
                {
                    email_topic -> email_queue "Adds email notification" SQS
                }
            }
            {
                {
                    email_processor -> email_queue "Pulls and processes email notification" "SQS API"
                }
                {
                    email_queue -> email_key "Decrypts notification" KMS
                }
            }
            {
                {
                    email_processor -> email_object_store "Requests email body" "S3 API"
                }
                {
                    email_object_store -> email_key "Decrypts email body" KMS
                }
            }
            {
                {
                    email_processor -> email_sender "Forwards email"
                }
                {
                    email_processor -> db "Adds reply record, updates usage"
                }
                {
                    email_processor -> metrics "Emits counters, timers"
                }
                {
                    email_processor -> logs "Logs processing events, glean metrics"
                }
            }
            email_processor -> email_object_store "Deletes original email"
            email_sender -> user "User receives email"
        }

        deployment relay dev_deploy "RelayDevelopmentDeployment" {
            title "[Deployment] Development"
            include *
        }
        deployment relay stage_deploy "RelayStageDeployment" {
            title "[Deployment] Stage"
            include *
            exclude relationship.tag==omit_in_gcp
        }
        deployment relay prod_deploy "RelayProductionDeployment" {
            title "[Deployment] Production relay.firefox.com"
            include *
            exclude relationship.tag==omit_in_gcp
        }

        // Brand 2024 data visualization colors
        !const COLOR_BLACK #000000
        !const COLOR_DARK_GREY #505050
        !const COLOR_WHITE #FFFFFF
        !const COLOR_ZILLA_GREEN_PLUS #00FF8C
        !const COLOR_ZILLA_GREEN #00D230
        !const COLOR_ZILLA_GREEN_MINUS #005E2A
        !const COLOR_FOX_ORANGE #FF9900

        styles {
            element "Relay Software System" {
                background ${COLOR_ZILLA_GREEN_MINUS}
                color ${COLOR_WHITE}
            }
            element "Other Software System" {
                # Defaults - black on grey
            }
            element "External Contact" {
                shape person
                color ${COLOR_BLACK}
            }
            element "Relay User" {
                shape person
                color ${COLOR_BLACK}
                background ${COLOR_FOX_ORANGE}
            }
            element "Database" {
                shape Cylinder
                background ${COLOR_ZILLA_GREEN}
                color ${COLOR_BLACK}
            }
            element "Optional Database" {
                shape Cylinder
                background ${COLOR_WHITE}
                color ${COLOR_BLACK}
                border solid
                stroke ${COLOR_ZILLA_GREEN}
                strokeWidth 10
            }
            element "Browser Interface" {
                shape WebBrowser
                background ${COLOR_ZILLA_GREEN}
                color ${COLOR_BLACK}
            }
            element "Application" {
                shape RoundedBox
                background ${COLOR_ZILLA_GREEN}
                color ${COLOR_BLACK}
            }
            element "Optional Application" {
                shape RoundedBox
                background ${COLOR_WHITE}
                color ${COLOR_BLACK}
                border solid
                stroke ${COLOR_ZILLA_GREEN}
                strokeWidth 10
            }
            element "Managed Service" {
                shape Ellipse
                background ${COLOR_ZILLA_GREEN}
                color ${COLOR_BLACK}
            }
            element "Optional Managed Service" {
                shape Ellipse
                background ${COLOR_WHITE}
                color ${COLOR_BLACK}
                border solid
                stroke ${COLOR_ZILLA_GREEN}
                strokeWidth 10
            }
            element "Deployment Service" {
                shape Box
                background ${COLOR_WHITE}
                color ${COLOR_BLACK}
                border solid
                stroke ${COLOR_ZILLA_GREEN}
                strokeWidth 10
            }
            element "Task" {
                shape Box
                background ${COLOR_ZILLA_GREEN}
                color ${COLOR_BLACK}
            }
            element "Deployment Node" {
                # Without this, shows up as "Element" in key
                shape RoundedBox
            }
            relationship "Relationship" {
                dashed false
                color ${COLOR_DARK_GREY}
            }
            relationship "Optional Relationship" {
                style Dotted
            }
        }
    }
}
