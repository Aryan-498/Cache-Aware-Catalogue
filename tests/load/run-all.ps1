$base = "http://localhost:3000/api/v1"
$a = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType "application/json" -Body (@{username="admin";password="admin123"} | ConvertTo-Json)
$H = @{ Authorization = "Bearer $($a.token)" }

New-Item -ItemType Directory -Force results | Out-Null

$levels = @("low", "medium", "high")
$modes  = @("nocache", "cold", "warm")
$rows = @()

foreach ($level in $levels) {
  foreach ($mode in $modes) {
    $name = "$level-$mode"
    Write-Host "`n=== Running $name ===" -ForegroundColor Cyan

    Invoke-RestMethod -Method Post "$base/admin/cache/flush" -Headers $H | Out-Null
    Invoke-RestMethod -Method Post "$base/metrics/reset" -Headers $H | Out-Null

    k6 run --quiet -e MODE=$mode -e OUT="results/$name.json" "tests/load/$level.js"

    $m = Invoke-RestMethod "$base/metrics" -Headers $H
    $m | ConvertTo-Json -Depth 5 | Out-File "results/$name-metrics.json" -Encoding utf8
    $k = Get-Content "results/$name.json" -Raw | ConvertFrom-Json

    $rows += [pscustomobject]@{
      Level    = $level
      Config   = $mode
      Requests = $k.requests
      RPS      = [math]::Round($k.rps, 1)
      AvgMs    = [math]::Round($k.avgMs, 2)
      P95Ms    = [math]::Round($k.p95Ms, 2)
      ErrorPct = [math]::Round($k.errorRate * 100, 2)
      HitRatio = $m.cache.hitRatioPercent
    }
    Start-Sleep -Seconds 5
  }
}

Write-Host "`n=== RESULTS ===" -ForegroundColor Green
$rows | Format-Table -AutoSize
$rows | Export-Csv results/summary.csv -NoTypeInformation