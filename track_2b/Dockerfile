FROM node:22-alpine
LABEL org.opencontainers.image.title="Scythe Apertus" \
      org.opencontainers.image.description="Sovereign software repair with independent offline verification" \
      org.opencontainers.image.licenses="Apache-2.0"
WORKDIR /opt/scythe-apertus
RUN addgroup -S -g 10001 scythe && adduser -S -D -u 10001 -G scythe scythe \
    && mkdir -p /queue/requests /queue/results /artifacts /tmp \
    && chown -R 10001:10001 /queue /artifacts /tmp
COPY --chown=10001:10001 data ./data
COPY --chown=10001:10001 src ./src
COPY --chown=10001:10001 package.json ./package.json
USER 10001:10001
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
CMD ["node", "src/server.mjs"]
