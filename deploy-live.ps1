$ErrorActionPreference = 'Stop'

Push-Location $PSScriptRoot
try {
  node build.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Site build failed.' }

  $stageName = 'wild-sun-live-' + (Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 6)
  $stage = Join-Path ([IO.Path]::GetTempPath()) $stageName
  New-Item -ItemType Directory -Path $stage | Out-Null

  Copy-Item -LiteralPath 'index.html', 'design.css', 'site.js', 'booking.js', 'business-settings.js', 'config.js', '404.html', 'sitemap.xml' -Destination $stage
  Copy-Item -LiteralPath 'assets', 'menu', 'story', 'visit', 'book', 'venue-hire' -Destination $stage -Recurse
  [IO.File]::WriteAllText((Join-Path $stage '_headers'), "/*`n  X-Robots-Tag: noindex`n", [Text.UTF8Encoding]::new($false))

  & npx.cmd --yes wrangler@latest pages deploy $stage --project-name wild-and-the-sun --branch main
  if ($LASTEXITCODE -ne 0) { throw 'Cloudflare Pages live deployment failed.' }
}
finally {
  Pop-Location
}
