FROM docker.io/denoland/deno:2.7.11 AS cache

ENV DENO_DIR=/deno-dir

WORKDIR /app

COPY deno.json deno.lock ./
COPY locales ./locales
COPY src ./src

RUN deno cache --allow-import --lock=deno.lock --frozen src/app.ts

FROM docker.io/denoland/deno:2.7.11

ENV DENO_DIR=/deno-dir

WORKDIR /app

COPY --from=cache /deno-dir /deno-dir
COPY deno.json deno.lock ./
COPY locales ./locales
COPY src ./src

CMD ["deno", "run", "--cached-only", "-A", "src/app.ts"]
