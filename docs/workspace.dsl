!const SERVICE_NAME "Firefox Relay"
!const ACCOUNTS_NAME "Mozilla Accounts"


workspace "${SERVICE_NAME}" "Mozilla's service providing email and phone masks." {
    configuration {
        scope softwaresystem
    }

    model {
        ga = softwareSystem "Google Analytics" {
            description "Collects and reports interaction events"
            tags "Other Software System"
        }
        stripe = softwareSystem "Stripe" {
            description "Handles billing and payment processing"
            tags "Other Software System"
        }
        group Mozilla {
            accounts = softwareSystem "Accounts and Subscriptions" {
                description "${ACCOUNTS_NAME} and the Subscription Platform."
                tags "Other Software System"
                -> stripe "Uses" "HTTPS, Stripe API"
            }
            data_system = softwareSystem "Data Platform" {
                description "The Mozilla Telemetry Platform"
                tags "Other Software System"
            }
            metrics_system = softwareSystem "Google Managed Prometheus" {
                description "Stores metrics for queries and reports"
                tags "Other Software System"
            }
            sentry = softwareSystem "Sentry" {
                description "Collects and organizes tracebacks and errors"
                tags "Other Software System"
            }

            relay = softwareSystem "${SERVICE_NAME}" {
                description "Manages email and phone masks. Forwards messages between masks and external services."
                tags "Relay Software System"

                db = container "Database" {
                    description "Stores Relay User profiles, masks, abuse metrics, etc."
                    tags "Database"
                    technology "PostgreSQL"
                }

                // "Other Managed Services" for top-level C2 diagrams
                c2_other_managed_services = container "Other Managed Services" {
                    description "Other services used to deploy Relay"
                    technology "GCP services"
                    tags "Container Collection"
                }

                // The Other Managed Services
                replica_db = container "Replica DB" {
                    description "Read-only replica database"
                    tags "Optional Database",in_other_managed_services
                    technology "PostgreSQL"
                    -> db "Replicates data" "Optional Relationship"
                }
                logs = container "Log Aggregator" {
                    description "Collects logs from other containers"
                    tags "Managed Service",in_other_managed_services
                    -> data_system "Sends Glean events" "JSON over GCP SNS"
                }
                metrics = container "Metrics Aggregator" {
                    description "Collects metrics from other containers"
                    tags "Optional Application",in_other_managed_services
                    technology telegraf
                    -> metrics_system "Pulls metrics" "Prometheus"
                    -> db "Queries" "SQL"
                }
                profiler = container Profiler {
                    description "Collects CPU and timing profiles"
                    tags "Managed Service",in_other_managed_services
                    technology "Google Cloud Profiler"
                }
                cache = container "Cache" {
                    description "Stores runtime data"
                    tags "Database",in_other_managed_services
                    technology "Redis"
                }

                phone_service = container "Phone Service" {
                    description "Provides phone numbers, sends and receives SMS messages and voice calls"
                    tags "Managed Service"
                    technology "Twilio"
                    # Forward relationships defined below
                    # -> user "Forwards Texts, Calls" "PSTN via user's real phone"
                    # -> phone_contact "Sends reply texts" "PSTN via user's phone mask"
                }
                iq_phone_service = container "iQ Phone Service" {
                    description "Provides phone numbers, sends and receives SMS messages and voice calls"
                    tags "Optional Managed Service",omit_in_gcp,omit_in_c2_high_level
                    technology "Inteliquent"
                    # Forward relationships defined below
                    # -> user "Forwards Texts, Calls" "PSTN via user's real phone" "Optional Relationship"
                    # -> phone_contact "Sends reply texts" "PSTN via user's phone mask"
                }


                // "Email Services" for C2 top-level diagram
                c2_email_services = container "Email Services" {
                    description "Sends and receives emails"
                    technology "AWS services"
                    tags "Container Collection"
                }

                // Email Service components
                email_key = container "Email Encryption" {
                    description "Encrypts emails, notifications at rest"
                    technology "AWS KMS"
                    tags "Managed Service",in_email_services
                }
                email_object_store = container "Incoming Email Storage" {
                    description "Stores incoming mail"
                    technology "AWS S3"
                    tags "Database",in_email_services
                    -> email_key "Decrypts" "KMS"
                }
                email_dlq_queue = container "Email Dead-Letter Queue" {
                    description "Holds notifications for emails that fail to process"
                    technology "AWS SQS"
                    tags "Database",in_email_services
                    -> email_key "Decrypts" "KMS"
                }
                email_queue = container "Email Notification Queue" {
                    description "Holds notifications for emails, complaints, and bounces"
                    technology "AWS SQS"
                    tags "Database",in_email_services
                    -> email_key "Decrypts" "KMS"
                    -> email_dlq_queue "Moves failed emails notifications" "SQS"
                }
                email_topic = container "Email Pub/Sub" {
                    description "Published notifications to subscribers"
                    technology "AWS SNS"
                    tags "Managed Service",in_email_services
                    -> email_key "Decrypts" "KMS"
                    -> email_queue "Adds emails, complaints, bounces" "SQS"
                    # Forward relationships defined below
                    # -> web_app "Sends emails, complaints, bounces" "SQS" "Optional Relationship,omit_in_gcp"
                }
                email_sender = container "Email Sender" {
                    description "Sends emails from the Relay domain"
                    tags "Managed Service",in_email_services
                    technology "Amazon SES"
                    -> email_topic "Notifies of complaints and bounces" "SNS"
                    -> email_key "Encrypts complaints and bounces" "KMS"
                    # Forward relationships defined below
                    # -> user "Forwards email" "SMTP via user's real email"
                    # -> email_contact "Sends replies" "SMTP via user's email mask"
                }
                email_receiver = container "Email Receiver" {
                    description "Routes incoming emails, complaints, and bounces"
                    tags "Managed Service",in_email_services
                    technology "Amazon SES"
                    -> email_object_store "Stores incoming emails" "S3"
                    -> email_key "Encrypts" "KMS"
                    -> email_topic "Notifies of new emails" "SNS"
                }

                // "Periodic Tasks" for C2 top-level diagram
                c2_periodic_tasks = container "Periodic Tasks" {
                    description "Scheduled tasks (k8s cronjobs) to provide Relay service"
                    technology "Python - Django Commands"
                    tags "Container Collection"
                }

                // Periodic Tasks
                task_cleanup = container "Cleanup Task" {
                    description "Fixes data consistency issues"
                    tags "Task", "Periodic Task", in_periodic_tasks
                    technology "Python - Django Command"
                    -> db
                    -> logs
                    -> metrics
                    -> sentry
                }
                task_clean_replies = container "Clean Replies Task" {
                    description "Deletes expired reply data"
                    tags "Task", "Periodic Task", in_periodic_tasks
                    technology "Python - Django Command"
                    -> db
                    -> logs
                    -> metrics
                    -> sentry
                }
                task_sync_phones = container "Sync Phone Dates Task" {
        description "Syncs Mozilla Accounts subscription data for phone users"
                    tags "Task", "Periodic Task", in_periodic_tasks
                    technology "Python - Django Command"
                    -> accounts "Reads subscription data" "Subscription API"
                    -> db
                    -> logs
                    -> metrics
                    -> sentry

                }
                task_update_phones = container "Update Phone Limits Task" {
                    description "Resets remaining texts and voice minutes at start of month"
                    tags "Task", "Periodic Task", in_periodic_tasks
                    technology "Python - Django Command"
                    -> db
                    -> logs
                    -> metrics
                    -> sentry
                }
                task_welcome = container "Send Welcome Emails Task" {
                    description "Sends a welcome email to recent subscribers"
                    tags "Task", "Periodic Task", in_periodic_tasks
                    technology "Python - Django Command"
                    -> email_sender "Sends welcome email" "SES API"
                    -> db
                    -> logs
                    -> metrics
                    -> sentry
                }
                task_dlq = container "Dead-Letter Processor" {
                    description "Deletes emails with processing errors"
                    tags "Task", "Periodic Task", in_periodic_tasks
                    technology "Python - Django Command"
                    -> email_object_store "Reads, deletes emails" "S3 API"
                    -> email_sender "Forwards email (rarely)" "SES API"
                    -> email_dlq_queue "Polls" "SQS API"
                    -> db
                    -> logs
                    -> metrics
                    -> sentry
                }

                // Main backend applications
                web_app = container "Web Application" {
                    description "Delivers the Single-Page App; provides API, hooks, and callbacks"
                    tags "Application"
                    technology "Python - Django Application"
                    -> db "Updates" "Django ORM"
                    -> cache "Uses" "Django Cache API"
                    -> accounts "Delegates user registration, payments" "HTTPS, OAuth 2, API"
                    -> ga "Forwards extension's UI events" "Measurement Protocol"
                    -> email_sender "Sends email" "SES API"
                    -> sentry "Sends exceptions" "HTTPS API"
                    -> metrics "Sends metrics" "UDP"
                    -> logs "Emits logs" "stdout / stderr"
                    -> phone_service "Reserves phone number, routes SMS and calls" "Stripe API, HTTPS callbacks"
                    -> iq_phone_service "Reserves phone number, routes SMS" "Inteliquent API, HTTPS callbacks" "Optional Relationship"
                    -> profiler "Sends Profiles" "Profile API"
                }
                email_processor = container "Email Processor" {
                    description "Processes and forwards incoming emails; Processes complaint and bounce reports"
                    tags "Application"
                    technology "Python - Django Command"
                    -> db "Updates" "Django ORM"
                    -> email_sender "Forwards email" "SES API"
                    -> email_queue "Polls" "SQS API"
                    -> email_object_store "Reads, deletes emails" "S3 API"
                    -> sentry "Sends exceptions" "HTTPS API"
                    -> metrics "Sends metrics" "UDP"
                    -> logs "Emits logs" "stdout / stderr"
                    -> profiler "Sends profiles" "Profile API"
                }

                // "User Interfaces: for C2 top-level diagram
                c2_user_interfaces = container "User Interfaces" {
                    description "Website and browser interfaces for users"
                    technology "Web, Extensions, Firefox"
                    tags "Container Collection"
                }

                // User Interface components
                group "User Interfaces" {
                    web = container "Single-Page App" {
                        description "Provides marketing pages, user dashboards, onboarding flows"
                        tags "Browser Interface",in_user_interfaces
                        technology "JavaScript - Next.js"
                        -> accounts "Requests flow tracking, sends users for login and subscriptions" "HTTPS, OAuth 2, APIs"
                        -> ga "Sends page views, interactions" "HTTPS"
                        -> stripe "Requests purchase tracking" "HTTPS"
                        -> web_app "Uses API, requests static assets" "HTTPS" "omit_in_gcp"
                    }
                    add_on = container "Relay Extension" {
                        description "Suggests email masks on webpages"
                        tags "Browser Interface",in_user_interfaces
                        technology "Extension for Firefox and Chrome"
                        -> web_app "Uses API, sends UI events" "HTTPS" "omit_in_gcp"
                        -> web "Scrapes data" "Extension API"
                    }
                    other_client = container "Bitwarden, Other API users" {
                        description "Integrates with Relay API"
                        tags "Browser Interface",in_user_interfaces
                        technology "3rd Party Tools"
                        -> web_app "Uses API" "HTTPS" "omit_in_gcp"
                    }
                    firefox = container "Firefox" {
                        description "Suggests email mails on webpages"
                        tags "Browser Interface",in_user_interfaces
                        technology "Desktop application for Windows, MacOS, and Linux"
                        -> web_app "Uses API" "HTTPS" "omit_in_gcp"
                    }
                }
            }
        }

        user = person "Relay User" "A user of ${SERVICE_NAME}." {
            tags "Relay User"
            -> accounts "Registers, manages subscription" "HTTPS"
            -> web "Uses"
            -> add_on "Uses"
            -> other_client "Uses"
            -> firefox "Uses"
            -> email_receiver "Send reply email" "SMTP via replies email address"
        }
        email_contact = person "Email Contact" {
            description "A person or business emailing with a Relay User."
            tags "External Contact"
            -> email_receiver "Sends email" "SMTP via user's email mask"
        }
        phone_contact = person "Phone Contact" {
            description "A person or business calling or texting with a Relay User."
            tags "External Contact"
            -> phone_service "Sends texts, starts calls" "PSTN via user's phone mask"
            -> iq_phone_service "Sends texts, starts calls" "PSTN via user's phone mask"
        }

        // Other relationships (defined earlier to defined later)
        email_topic -> web_app "Sends emails, complaints, bounces" "SQS" "Optional Relationship,omit_in_gcp"
        email_sender -> user "Forwards email" "SMTP via user's real email"
        email_sender -> email_contact "Sends replies" "SMTP via user's email mask"
        phone_service -> phone_contact "Sends reply texts" "PSTN via user's phone mask"
        phone_service -> user "Forwards Texts, Calls" "PSTN via user's real phone"
        iq_phone_service -> user "Forwards Texts, Calls" "PSTN via user's real phone" "Optional Relationship"
        iq_phone_service -> phone_contact "Sends reply texts" "PSTN via user's phone mask"

        //
        // Alternate relations for C2 high-level graph
        //

        // User Interfaces
        user -> c2_user_interfaces "Uses"
        c2_user_interfaces -> web_app "Uses API, requests static assets" "HTTPS" "omit_in_gcp"
        c2_user_interfaces -> stripe "Requests purchase tracking" "HTTPS"
        c2_user_interfaces -> ga "Sends page views, interactions" "HTTPS"

        // Email Service
        c2_email_services -> user "Forwards email"
        user -> c2_email_services "Sends reply email"
        web_app -> c2_email_services "Sends email"
        email_processor -> c2_email_services "Processes emails"
        email_contact -> c2_email_services "Sends email"
        c2_email_services -> email_contact "Sends replies"
        task_welcome -> c2_email_services "Sends welcome email" "SES API"
        task_dlq -> c2_email_services "Clears unprocessable email"

        // Other Managed Services
        c2_other_managed_services -> data_system "Sends Glean events" "JSON over GCP SNS"
        c2_other_managed_services -> metrics_system "Pulls metrics" "Prometheus"
        c2_other_managed_services -> db "Queries and replicates data" "SQL"
        web_app -> c2_other_managed_services "Uses"
        email_processor -> c2_other_managed_services "Uses"
        task_cleanup -> c2_other_managed_services
        task_clean_replies -> c2_other_managed_services
        task_sync_phones -> c2_other_managed_services
        task_update_phones -> c2_other_managed_services
        task_welcome -> c2_other_managed_services
        task_dlq -> c2_other_managed_services

        // Periodic Tasks
        c2_periodic_tasks -> db "Updates" "Django ORM"
        c2_periodic_tasks -> sentry "Sends exceptions" "HTTPS API"
        c2_periodic_tasks -> accounts "Reads subscription data" "Subscription API"
        c2_periodic_tasks -> email_sender "Sends welcome email" "SES API"
        c2_periodic_tasks -> c2_email_services "Cleans undeliverable email" "AWS APIs"
        c2_periodic_tasks -> email_dlq_queue "Cleans undeliverable email" "AWS APIs"
        c2_periodic_tasks -> email_object_store "Deletes undeliverable email" "AWS APIs"
        c2_periodic_tasks -> c2_other_managed_services "Uses"
        c2_periodic_tasks -> metrics "Sends metrics" "UDP"
        c2_periodic_tasks -> logs "Emits logs"

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
                        heroku_task_dql = containerInstance task_dlq
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
                stage_cloudwatch = infrastructureNode "Amazon CloudWatch" {
                    description "AWS metrics storage and reporting"
                    tags "Managed Service"
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
                        stage_task_dlq = containerInstance task_dlq
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
            stage_phone -> stage_lb "Informs of incoming SMS and calls"
            stage_email_topic -> stage_lb "Sends emails, complaints, bounces" "SQS" "Optional Relationship"
            stage_cloudwatch -> stage_metrics "Polls metrics"
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
                prod_cloudwatch = infrastructureNode "Amazon CloudWatch" {
                    description "AWS metrics storage and reporting"
                    tags "Managed Service"
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
                        prod_task_dlq = containerInstance task_dlq
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
            prod_cloudwatch -> prod_metrics "Pulls metrics"
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

        container relay "RelayContainersHighLevel" {
            title "[Container] Relay (High Level)"
            include ->web_app->
            include ->email_processor->
            include ->db->
            include stripe
            include user
            include data_system
            include metrics_system
            include email_contact
            include phone_contact
            exclude element.tag==omit_in_c2_high_level
            exclude element.tag==in_email_services
            exclude element.tag==in_user_interfaces
            exclude element.tag==in_other_managed_services
            exclude element.tag==in_periodic_tasks
        }

        container relay "RelayContainersUserInterfaces" {
            title "[Container] Relay (User Interfaces)"
            include element.tag==in_user_interfaces
            include ->web_app->
            include stripe
            include user
            include email_contact
            include phone_contact
            include email_processor
            exclude sentry
            exclude c2_user_interfaces
            exclude c2_other_managed_services
            exclude element.tag==omit_in_c2_high_level
            exclude element.tag==in_email_services
            exclude element.tag==in_other_managed_services
            exclude element.tag==in_periodic_tasks
        }

        container relay "RelayContainersPeriodicTasks" {
            title "[Container] Relay (Periodic Tasks)"
            include element.tag==in_periodic_tasks
            exclude c2_periodic_tasks
            include web_app
            include email_processor
            include db
            include accounts
            include sentry
            include data_system
            include metrics_system
            include c2_email_services
            include c2_other_managed_services
            exclude c2_user_interfaces
            exclude element.tag==omit_in_c2_high_level
            exclude element.tag==in_email_services
            exclude element.tag==in_user_interfaces
        }

        container relay "RelayContainersEmailServices" {
            title "[Container] Relay (Email Services)"
            include element.tag==in_email_services
            exclude c2_email_services
            include ->email_sender->
            include ->email_receiver->
            include user
            include email_contact
            include db
            exclude sentry
            exclude phone_service
            exclude c2_periodic_tasks
            exclude c2_user_interfaces
            exclude element.tag==omit_in_c2_high_level
            exclude element.tag==in_user_interfaces
            exclude element.tag==in_other_managed_services
        }

        container relay "RelayContainersManagedServices" {
            title "[Container] Relay (Managed Services)"
            include element.tag==in_other_managed_services
            exclude c2_other_managed_services
            include web_app
            include email_processor
            include db
            include c2_periodic_tasks
            include data_system
            include metrics_system
            include sentry
            exclude c2_user_interfaces
            exclude element.tag==omit_in_c2_high_level
            exclude element.tag==in_email_services
            exclude element.tag==in_user_interfaces
            exclude element.tag==in_periodic_tasks
        }

        container relay "RelayContainersAllDetails" {
            title "[Container] Relay (All Details)"
            include *
            exclude "element.tag==Container Collection"
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
                stroke ${COLOR_ZILLA_GREEN_MINUS}
                strokeWidth 10
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
            element "Container Collection" {
                shape hexagon
                background ${COLOR_ZILLA_GREEN}
                color ${COLOR_BLACK}
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
