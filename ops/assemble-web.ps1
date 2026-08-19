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

function Resolve-SafeArtifactPath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )
    if (
        [string]::IsNullOrWhiteSpace($RelativePath) -or
        [System.IO.Path]::IsPathRooted($RelativePath) -or
        $RelativePath.Contains('?') -or
        $RelativePath.Contains('#')
    ) {
        throw "Artifact path is invalid: $RelativePath"
    }
    $rootPath = [System.IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $resolved = [System.IO.Path]::GetFullPath((Join-Path $rootPath $RelativePath))
    $prefix = "$rootPath$([System.IO.Path]::DirectorySeparatorChar)"
    if (-not $resolved.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Artifact path escapes its root: $RelativePath"
    }
    return $resolved
}

function Copy-ContentAddressedArtifact {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][string]$Identity,
        [Parameter(Mandatory = $true)][string[]]$ArtifactPaths
    )
    if ($Identity -notmatch '^[a-f0-9]{64}$') {
        throw "Artifact manifest has an invalid identity: $Identity"
    }
    $expected = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    [void]$expected.Add('manifest.json')
    foreach ($relativePath in $ArtifactPaths) {
        $normalized = $relativePath.Replace('\', '/')
        if (-not $expected.Add($normalized)) {
            throw "Artifact manifest contains a duplicate path: $normalized"
        }
        $sourcePath = Resolve-SafeArtifactPath -Root $Source -RelativePath $relativePath
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "Artifact file is missing: $relativePath"
        }
    }
    $actual = Get-ChildItem -LiteralPath $Source -File -Recurse | ForEach-Object {
        [System.IO.Path]::GetRelativePath($Source, $_.FullName).Replace('\', '/')
    }
    $unexpected = @($actual | Where-Object { -not $expected.Contains($_) })
    $missing = @($expected | Where-Object { $_ -notin $actual })
    if ($unexpected.Count -or $missing.Count) {
        throw "Artifact file set mismatch; missing=[$($missing -join ', ')]; unexpected=[$($unexpected -join ', ')]"
    }

    New-Item -ItemType Directory -Path $Destination | Out-Null
    Copy-Item -LiteralPath (Join-Path $Source 'manifest.json') -Destination $Destination
    $contentRoot = Join-Path $Destination $Identity
    New-Item -ItemType Directory -Path $contentRoot | Out-Null
    foreach ($relativePath in $ArtifactPaths) {
        $sourcePath = Resolve-SafeArtifactPath -Root $Source -RelativePath $relativePath
        $destinationPath = Resolve-SafeArtifactPath -Root $contentRoot -RelativePath $relativePath
        $destinationParent = Split-Path -Parent $destinationPath
        if (-not (Test-Path -LiteralPath $destinationParent)) {
            New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
        }
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
    }
}

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
$searchRoot = Join-Path $generated 'search'
New-Item -ItemType Directory -Path $searchRoot | Out-Null
$searchManifest = Get-Content -LiteralPath (Join-Path $searchBundle 'manifest.json') -Raw | ConvertFrom-Json
if ($searchManifest.bundle_id -notmatch '^[a-f0-9]{64}$') {
    throw 'SearchBundle manifest has an invalid bundle identity'
}
$searchContent = Join-Path $searchRoot $searchManifest.bundle_id
New-Item -ItemType Directory -Path $searchContent | Out-Null
Copy-Item -LiteralPath (Join-Path $searchBundle 'manifest.json') -Destination $searchRoot
Get-ChildItem -LiteralPath $searchBundle -File |
    Where-Object Name -ne 'manifest.json' |
    Copy-Item -Destination $searchContent
$examManifest = Get-Content -LiteralPath (Join-Path $examSnapshot 'manifest.json') -Raw | ConvertFrom-Json
$examArtifactPaths = @(
    $examManifest.records.path
    $examManifest.class_index.path
    $examManifest.class_chunks | ForEach-Object { $_.path }
)
Copy-ContentAddressedArtifact `
    -Source $examSnapshot `
    -Destination (Join-Path $generated 'exam') `
    -Identity $examManifest.snapshot_id `
    -ArtifactPaths $examArtifactPaths

$roomManifest = Get-Content -LiteralPath (Join-Path $roomOccupancy 'manifest.json') -Raw | ConvertFrom-Json
$roomArtifactPaths = @($roomManifest.dates | ForEach-Object {
    $_.floors | ForEach-Object { $_.artifact.path }
})
Copy-ContentAddressedArtifact `
    -Source $roomOccupancy `
    -Destination (Join-Path $generated 'rooms') `
    -Identity $roomManifest.occupancy_id `
    -ArtifactPaths $roomArtifactPaths

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
