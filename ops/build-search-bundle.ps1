[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$CorpusPath,

    [Parameter(Mandatory = $true)]
    [string]$BundlePath,

    [string]$CargoTargetPath
)

$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$corpus = (Resolve-Path -LiteralPath $CorpusPath).Path

if (-not (Test-Path -LiteralPath (Join-Path $corpus 'manifest.json') -PathType Leaf)) {
    throw "NjuptCorpusSnapshot manifest is missing: $corpus"
}

$bundle = [System.IO.Path]::GetFullPath($BundlePath)
if (-not $CargoTargetPath) {
    $CargoTargetPath = if ($env:RUNNER_TEMP) {
        Join-Path $env:RUNNER_TEMP 'njupt-search-cargo-target'
    }
    elseif ($IsWindows) {
        'D:\Cache\njupt-search\cargo-target'
    }
    else {
        Join-Path ([System.IO.Path]::GetTempPath()) 'njupt-search-cargo-target'
    }
}
$cargoTarget = [System.IO.Path]::GetFullPath($CargoTargetPath)
[System.IO.Directory]::CreateDirectory($cargoTarget) | Out-Null
$previousCargoTarget = $env:CARGO_TARGET_DIR
try {
    $env:CARGO_TARGET_DIR = $cargoTarget
    & cargo run `
        --manifest-path (Join-Path $repository 'search/Cargo.toml') `
        -p njupt-search `
        --release `
        -- build-index `
        --corpus $corpus `
        --out $bundle

    if ($LASTEXITCODE -ne 0) {
        throw "SearchBundle build failed with exit code $LASTEXITCODE"
    }
}
finally {
    $env:CARGO_TARGET_DIR = $previousCargoTarget
}
