FROM golang:1.24-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /version-source .

FROM scratch

COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /version-source /version-source
COPY data.yml /data.yml

USER 65532:65532
EXPOSE 8080
ENV CONFIG_FILE=/data.yml

ENTRYPOINT ["/version-source"]
