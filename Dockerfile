FROM oven/bun

COPY package.json package.json
COPY bun.lockb bun.lockb
COPY tsconfig.json tsconfig.json
RUN bun install
COPY src/ src/

ENTRYPOINT ["bun", "start"]
