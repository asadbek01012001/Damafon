$env:HOST_IP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -notlike "172.*" } | Select-Object -First 1).IPAddress
Write-Host "Starting with IP: $env:HOST_IP"
docker compose up -d
