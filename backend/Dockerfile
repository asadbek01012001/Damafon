FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

ENV NUGET_FALLBACK_PACKAGES=""

COPY Damafon.API/Damafon.API.csproj Damafon.API/
RUN dotnet restore Damafon.API/Damafon.API.csproj --disable-parallel

COPY . .
RUN dotnet publish Damafon.API/Damafon.API.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5000
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

ENTRYPOINT ["dotnet", "Damafon.API.dll"]
