# syntax=docker/dockerfile:1
# 서버 렌더 앱 이미지. 빌드 컨텍스트는 레포 루트(워크스페이스 전체가 필요하다):
#   docker build -f apps/starter-ssr/Dockerfile -t starter-ssr .
#   docker run --rm -p 3000:3000 -e API_BASE_URL=http://host.docker.internal:8080/api/v1 starter-ssr
# 런타임 이미지에는 node_modules 가 없다 — 서버 번들(dist/server)이 의존을 안에 담고 server/main.ts 는 node 내장 모듈만 쓴다.
ARG APP=starter-ssr

FROM node:24-slim AS build
ARG APP
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter ${APP} build

FROM node:24-slim
ARG APP
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /repo/apps/${APP}/dist ./dist
COPY --from=build /repo/apps/${APP}/server ./server
USER node
EXPOSE 3000
CMD ["node", "server/main.ts"]
