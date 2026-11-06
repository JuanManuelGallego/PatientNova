# pg_dump must be at least the server's major version; a newer client can dump older servers.
FROM postgres:18-alpine

RUN apk add --no-cache age bash curl rclone

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod 0755 /usr/local/bin/backup.sh

USER postgres
ENTRYPOINT ["/usr/local/bin/backup.sh"]
