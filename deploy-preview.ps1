$ErrorActionPreference = 'Stop'

Push-Location $PSScriptRoot
try {
  node build.mjs

  $stageName = 'wild-sun-pages-' + (Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 6)
  $stage = Join-Path ([IO.Path]::GetTempPath()) $stageName
  New-Item -ItemType Directory -Path $stage | Out-Null

  Copy-Item -LiteralPath 'index.html', 'design.css', 'site.js', 'booking.js', 'config.js', 'menu-data.js', 'menu-page.js', 'venue-planner.js' -Destination $stage
  Copy-Item -LiteralPath 'assets', 'menu', 'story', 'visit', 'book', 'venue-hire' -Destination $stage -Recurse
  [IO.File]::WriteAllText((Join-Path $stage '_headers'), "/*`n  X-Robots-Tag: noindex`n", [Text.UTF8Encoding]::new($false))

  & npx.cmd --yes wrangler@latest pages deploy $stage --project-name wild-and-the-sun-preview --branch main
  if ($LASTEXITCODE -ne 0) { throw 'Cloudflare Pages deployment failed.' }
}
finally {
  Pop-Location
}
