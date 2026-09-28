param(
  # The Wild and The Sun CentralPass API origin, e.g. https://api.wildandthesun.com.au
  # Leave empty to publish with the phone-booking fallback and src/venue.json details.
  [string]$ApiBase = $env:CENTRALPASS_API_BASE,
  # Lets search engines and AI assistants index the site. Use once the owner
  # has approved launch: pwsh -File .\deploy-live.ps1 -Indexable
  [switch]$Indexable
)
$ErrorActionPreference = 'Stop'

Push-Location $PSScriptRoot
try {
  $env:CENTRALPASS_API_BASE = $ApiBase
  # The sample booking demo is for previews only.
  Remove-Item Env:BOOKING_DEMO -ErrorAction SilentlyContinue
  $env:SITE_INDEXABLE = if ($Indexable) { 'true' } else { '' }
  node build.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Site build failed.' }

  $stageName = 'wild-sun-live-' + (Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 6)
  $stage = Join-Path ([IO.Path]::GetTempPath()) $stageName
  New-Item -ItemType Directory -Path $stage | Out-Null

  Copy-Item -LiteralPath 'index.html', '404.html', 'design.css', 'config.js', 'venue.js', 'site.js', 'booking.js', '_headers', 'sitemap.xml', 'robots.txt', 'llms.txt' -Destination $stage
  Copy-Item -LiteralPath 'assets', 'menu', 'visit', 'book', 'privacy', 'story', 'venue-hire' -Destination $stage -Recurse

  & npx.cmd --yes wrangler@4.142.0 pages deploy $stage --project-name wild-and-the-sun --branch main
  if ($LASTEXITCODE -ne 0) { throw 'Cloudflare Pages live deployment failed.' }
}
finally {
  Pop-Location
}
