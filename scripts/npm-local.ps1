# Windows helper: use a compatible Node without changing the global installation.
# Examples: .\scripts\npm-local.ps1 ci / run dev / run dev:api / run build
$ErrorActionPreference = 'Stop'
$npmArguments = @($args)
$minimumNode = [version]'22.12.0'
$nodeCandidates = @()
$installedNode = Get-Command node.exe -ErrorAction SilentlyContinue
if ($installedNode) { $nodeCandidates += $installedNode.Source }
if ($env:USERPROFILE) {
    $nodeCandidates += Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}

$selectedNode = $null
foreach ($candidate in ($nodeCandidates | Select-Object -Unique)) {
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
    $reportedVersion = & $candidate --version
    if ($LASTEXITCODE -eq 0 -and $reportedVersion -match '^v(\d+\.\d+\.\d+)$') {
        if ([version]$Matches[1] -ge $minimumNode) {
            $selectedNode = $candidate
            break
        }
    }
}
if (-not $selectedNode) {
    throw 'Se necesita Node >=22.12.0. Instala Node 24 y abre una nueva terminal.'
}

# npm.cmd can force its adjacent (older) node.exe; invoke npm-cli.js explicitly.
$npmCandidates = @(Join-Path (Split-Path -Parent $selectedNode) 'node_modules\npm\bin\npm-cli.js')
$installedNpm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($installedNpm) {
    $npmCandidates += Join-Path (Split-Path -Parent $installedNpm.Source) 'node_modules\npm\bin\npm-cli.js'
}
if ($env:ProgramFiles) {
    $npmCandidates += Join-Path $env:ProgramFiles 'nodejs\node_modules\npm\bin\npm-cli.js'
}
$selectedNpm = $npmCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $selectedNpm) {
    throw 'No se encontro npm-cli.js. Repara la instalacion de Node con npm incluido.'
}

$previousPath = $env:Path
$commandExitCode = 1
Push-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
try {
    # Lifecycle scripts (Vite and the API) must also resolve the selected Node.
    $env:Path = (Split-Path -Parent $selectedNode) + [IO.Path]::PathSeparator + $previousPath
    & $selectedNode $selectedNpm @npmArguments
    $commandExitCode = $LASTEXITCODE
} finally {
    $env:Path = $previousPath
    Pop-Location
}
exit $commandExitCode
