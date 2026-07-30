[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,

    [Parameter(Mandatory = $true)]
    [string]$MaterializedPath,

    [Parameter(Mandatory = $true)]
    [string]$CachePath,

    [Parameter(Mandatory = $true)]
    [string]$ExamOutputPath,

    [Parameter(Mandatory = $true)]
    [string]$RoomOutputPath,

    [Parameter(Mandatory = $true)]
    [string]$RoomCatalogPath,

    [switch]$RefreshMaterialized
)

$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$source = (Resolve-Path -LiteralPath $SourcePath).Path
$catalog = (Resolve-Path -LiteralPath $RoomCatalogPath).Path
$materialized = [System.IO.Path]::GetFullPath($MaterializedPath)
$cache = [System.IO.Path]::GetFullPath($CachePath)
$examOutput = [System.IO.Path]::GetFullPath($ExamOutputPath)
$roomOutput = [System.IO.Path]::GetFullPath($RoomOutputPath)

Push-Location $repository
try {
    if ($RefreshMaterialized) {
        & uv run python -m academics.exam materialize `
            --source $source `
            --materialized $materialized `
            --cache $cache
        if ($LASTEXITCODE -ne 0) { throw 'Exam source materialization failed' }
    }
    elseif (-not (Test-Path -LiteralPath (Join-Path $materialized 'source_metadata.json') -PathType Leaf)) {
        throw "Materialized exam input is missing source_metadata.json: $materialized"
    }

    & uv run python -m academics.exam build `
        --materialized $materialized `
        --output $examOutput
    if ($LASTEXITCODE -ne 0) { throw 'ExamSnapshot build failed' }

    & uv run python -m academics.room `
        --exam $examOutput `
        --catalog $catalog `
        --output $roomOutput
    if ($LASTEXITCODE -ne 0) { throw 'RoomOccupancy build failed' }
}
finally {
    Pop-Location
}
