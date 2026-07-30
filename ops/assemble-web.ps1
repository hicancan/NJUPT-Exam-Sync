[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SearchBundlePath,

    [Parameter(Mandatory = $true)]
    [string]$ExamSnapshotPath,

    [Parameter(Mandatory = $true)]
    [string]$RoomOccupancyPath,

    [Parameter(Mandatory = $true)]
    [string]$StagePath,

    [Parameter(Mandatory = $true)]
    [string]$DistPath
)

$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$searchBundle = (Resolve-Path -LiteralPath $SearchBundlePath).Path
$examSnapshot = (Resolve-Path -LiteralPath $ExamSnapshotPath).Path
$roomOccupancy = (Resolve-Path -LiteralPath $RoomOccupancyPath).Path
$stage = [System.IO.Path]::GetFullPath($StagePath)
$dist = [System.IO.Path]::GetFullPath($DistPath)

foreach ($artifact in @($searchBundle, $examSnapshot, $roomOccupancy)) {
    if (-not (Test-Path -LiteralPath (Join-Path $artifact 'manifest.json') -PathType Leaf)) {
        throw "Artifact manifest is missing: $artifact"
    }
}
foreach ($target in @($stage, $dist)) {
    if (
        $target.StartsWith($repository, [System.StringComparison]::OrdinalIgnoreCase) -or
        [System.IO.Path]::GetPathRoot($target) -eq $target
    ) {
        throw "Web staging and dist must be explicit external directories: $target"
    }
    if (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Recurse -Force
    }
    New-Item -ItemType Directory -Path $target | Out-Null
}

$public = Join-Path $stage 'public'
New-Item -ItemType Directory -Path $public | Out-Null
Copy-Item -Path (Join-Path $repository 'apps/web/public/*') -Destination $public -Recurse -Force
$generated = Join-Path $public 'generated'
New-Item -ItemType Directory -Path $generated | Out-Null
Copy-Item -LiteralPath $searchBundle -Destination (Join-Path $generated 'search') -Recurse
Copy-Item -LiteralPath $examSnapshot -Destination (Join-Path $generated 'exam') -Recurse
Copy-Item -LiteralPath $roomOccupancy -Destination (Join-Path $generated 'rooms') -Recurse

$previousPublic = $env:NJUPT_SEARCH_WEB_PUBLIC_DIR
$previousOut = $env:NJUPT_SEARCH_WEB_OUT_DIR
$previousSearchUrl = $env:VITE_NJUPT_SEARCH_ARTIFACT_URL
$previousExamUrl = $env:VITE_NJUPT_EXAM_ARTIFACT_URL
$previousRoomUrl = $env:VITE_NJUPT_ROOM_ARTIFACT_URL
try {
    $env:NJUPT_SEARCH_WEB_PUBLIC_DIR = $public
    $env:NJUPT_SEARCH_WEB_OUT_DIR = $dist
    $env:VITE_NJUPT_SEARCH_ARTIFACT_URL = '/generated/search'
    $env:VITE_NJUPT_EXAM_ARTIFACT_URL = '/generated/exam'
    $env:VITE_NJUPT_ROOM_ARTIFACT_URL = '/generated/rooms'
    Push-Location $repository
    try {
        & npm run build:prepared
        if ($LASTEXITCODE -ne 0) { throw 'Web production build failed' }
    }
    finally {
        Pop-Location
    }
}
finally {
    $env:NJUPT_SEARCH_WEB_PUBLIC_DIR = $previousPublic
    $env:NJUPT_SEARCH_WEB_OUT_DIR = $previousOut
    $env:VITE_NJUPT_SEARCH_ARTIFACT_URL = $previousSearchUrl
    $env:VITE_NJUPT_EXAM_ARTIFACT_URL = $previousExamUrl
    $env:VITE_NJUPT_ROOM_ARTIFACT_URL = $previousRoomUrl
}
