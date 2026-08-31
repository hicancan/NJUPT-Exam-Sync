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
    [string]$HistoryOutputPath,

    [Parameter(Mandatory = $true)]
    [string]$RoomOutputPath,

    [Parameter(Mandatory = $true)]
    [string]$TeachingSourcePath,

    [Parameter(Mandatory = $true)]
    [string]$TeachingOutputPath,

    [Parameter(Mandatory = $true)]
    [string]$TeachingRoomOutputPath,

    [Parameter(Mandatory = $true)]
    [string]$RoomCatalogPath,

    [string]$PreviousExamSnapshotPath,

    [string]$PreviousExamHistoryPath,

    [switch]$RefreshMaterialized
)

$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$source = (Resolve-Path -LiteralPath $SourcePath).Path
$catalog = (Resolve-Path -LiteralPath $RoomCatalogPath).Path
$materialized = [System.IO.Path]::GetFullPath($MaterializedPath)
$cache = [System.IO.Path]::GetFullPath($CachePath)
$examOutput = [System.IO.Path]::GetFullPath($ExamOutputPath)
$historyOutput = [System.IO.Path]::GetFullPath($HistoryOutputPath)
$roomOutput = [System.IO.Path]::GetFullPath($RoomOutputPath)
$teachingSource = (Resolve-Path -LiteralPath $TeachingSourcePath).Path
$teachingOutput = [System.IO.Path]::GetFullPath($TeachingOutputPath)
$teachingRoomOutput = [System.IO.Path]::GetFullPath($TeachingRoomOutputPath)

if ([string]::IsNullOrWhiteSpace($PreviousExamSnapshotPath) -ne [string]::IsNullOrWhiteSpace($PreviousExamHistoryPath)) {
    throw 'PreviousExamSnapshotPath and PreviousExamHistoryPath must be provided together'
}

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

    $historyArguments = @(
        '-m', 'academics.exam', 'history',
        '--current-snapshot', $examOutput,
        '--output', $historyOutput
    )
    if ($PreviousExamSnapshotPath) {
        $historyArguments += @(
            '--previous-snapshot', ([System.IO.Path]::GetFullPath($PreviousExamSnapshotPath)),
            '--previous-history', ([System.IO.Path]::GetFullPath($PreviousExamHistoryPath))
        )
    }
    & uv run python @historyArguments
    if ($LASTEXITCODE -ne 0) { throw 'ExamHistory build failed' }

    & uv run python -m academics.room `
        --exam $examOutput `
        --catalog $catalog `
        --output $roomOutput
    if ($LASTEXITCODE -ne 0) { throw 'RoomOccupancy build failed' }

    & uv run python -m academics.timetable `
        --source $teachingSource `
        --snapshot $teachingOutput `
        --occupancy $teachingRoomOutput `
        --catalog $catalog `
        --exam $examOutput
    if ($LASTEXITCODE -ne 0) { throw 'TeachingSchedule build failed' }
}
finally {
    Pop-Location
}
