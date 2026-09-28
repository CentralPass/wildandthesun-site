param(
  # The Wild and The Sun CentralPass API origin, e.g. https://api.wildandthesun.com.au
  # Leave empty to publish with the phone-booking fallback and src/venue.json details.
  [string]$ApiBase = $env:CENTRALPASS_API_BASE
)
$ErrorActionPreference = 'Stop'

Push-Location $PSScriptRoot
try {
  $env:CENTRALPASS_API_BASE = $ApiBase
  # Without a backend, the preview shows the booking form with sample data so it
  # can be reviewed. The live deploy never does this.
  $env:BOOKING_DEMO = if ($ApiBase) { '' } else { 'true' }
  # Previews are never indexed.
  Remove-Item Env:SITE_INDEXABLE -ErrorAction SilentlyContinue
  node build.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Site build failed.' }

  $stageName = 'wild-sun-preview-' + (Get-Date -Format 'yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 6)
  $stage = Join-Path ([IO.Path]::GetTempPath()) $stageName
  New-Item -ItemType Directory -Path $stage | Out-Null

  Copy-Item -LiteralPath 'index.html', '404.html', 'design.css', 'config.js', 'venue.js', 'site.js', 'booking.js', '_headers', 'robots.txt', 'llms.txt', 'sitemap.xml' -Destination $stage
  Copy-Item -LiteralPath 'assets', 'menu', 'visit', 'book', 'privacy', 'story', 'venue-hire' -Destination $stage -Recurse
  if ($env:BOOKING_DEMO -eq 'true') { Copy-Item -LiteralPath 'booking-demo.js' -Destination $stage }

  & npx.cmd --yes wrangler@4.142.0 pages deploy $stage --project-name wild-and-the-sun-preview --branch main
  if ($LASTEXITCODE -ne 0) { throw 'Cloudflare Pages preview deployment failed.' }

  # Leave the working copy as the live build would be, without the demo.
  Remove-Item Env:BOOKING_DEMO -ErrorAction SilentlyContinue
  node build.mjs | Out-Null
}
finally {
  Remove-Item Env:BOOKING_DEMO -ErrorAction SilentlyContinue
  Pop-Location
}
